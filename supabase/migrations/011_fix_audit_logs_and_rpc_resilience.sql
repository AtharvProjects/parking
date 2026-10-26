-- ==============================================================================
-- 011_FIX_AUDIT_LOGS_AND_RPC_RESILIENCE.SQL
-- Run this in your Supabase SQL Editor:
-- 1. Adds company_id and site_id to public.audit_logs if missing.
-- 2. Makes rpc_vehicle_entry and rpc_vehicle_checkout resilient to logging errors.
-- ==============================================================================

-- 1. Ensure columns exist on audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_site ON public.audit_logs(site_id, created_at);

-- 2. Update rpc_vehicle_entry with safe non-blocking audit logging
CREATE OR REPLACE FUNCTION public.rpc_vehicle_entry(
  p_company_id uuid,
  p_site_id uuid,
  p_vehicle_number text,
  p_vehicle_type text,
  p_driver_number text,
  p_notes text DEFAULT NULL,
  p_vehicle_photos jsonb DEFAULT NULL,
  p_entry_operator_id uuid DEFAULT NULL,
  p_driver_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_site record;
  v_active_count int;
  v_existing_id uuid;
  v_rate_card_id uuid;
  v_session_id uuid;
  v_now timestamptz := now();
  v_result jsonb;
BEGIN
  -- 1. Validate site exists and belongs to company
  SELECT * INTO v_site 
  FROM public.sites 
  WHERE id = p_site_id AND company_id = p_company_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Site not found or does not belong to company.');
  END IF;

  -- 2. Capacity check
  IF v_site.total_slots > 0 THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.parking_sessions
    WHERE site_id = p_site_id AND status = 'ACTIVE' AND deleted_at IS NULL;

    IF v_active_count >= v_site.total_slots THEN
      RETURN jsonb_build_object('success', false, 'error', 
        format('Site is at full capacity (%s/%s slots). Cannot accept more vehicles.', v_active_count, v_site.total_slots));
    END IF;
  END IF;

  -- 3. Duplicate active vehicle check
  SELECT id INTO v_existing_id
  FROM public.parking_sessions
  WHERE site_id = p_site_id 
    AND vehicle_number = p_vehicle_number 
    AND status = 'ACTIVE' 
    AND deleted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Vehicle %s is already parked at this site.', p_vehicle_number));
  END IF;

  -- 4. Find active rate card
  SELECT id INTO v_rate_card_id
  FROM public.rate_cards
  WHERE site_id = p_site_id 
    AND company_id = p_company_id
    AND vehicle_type = p_vehicle_type 
    AND effective_to IS NULL
  ORDER BY effective_from DESC
  LIMIT 1;

  -- 5. Create parking session
  v_session_id := gen_random_uuid();
  
  INSERT INTO public.parking_sessions (
    id, company_id, site_id, vehicle_number, vehicle_type, driver_number, driver_name,
    notes, vehicle_photos, entry_at, entry_operator_id, rate_card_id,
    status, created_at, updated_at
  ) VALUES (
    v_session_id, p_company_id, p_site_id, p_vehicle_number, p_vehicle_type, p_driver_number, p_driver_name,
    p_notes, p_vehicle_photos, v_now, p_entry_operator_id, v_rate_card_id,
    'ACTIVE', v_now, v_now
  );

  -- 6. Create audit log (safe non-blocking)
  BEGIN
    INSERT INTO public.audit_logs (id, company_id, site_id, action, entity_type, entity_id, actor_id, details, created_at)
    VALUES (
      gen_random_uuid(), p_company_id, p_site_id, 'VEHICLE_ENTRY', 'parking_session', v_session_id::text,
      p_entry_operator_id,
      jsonb_build_object(
        'vehicle_number', p_vehicle_number,
        'vehicle_type', p_vehicle_type,
        'driver_name', p_driver_name,
        'driver_number', p_driver_number,
        'site_name', v_site.name
      ),
      v_now
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 7. Return created session
  SELECT jsonb_build_object(
    'success', true,
    'session', row_to_json(s)
  ) INTO v_result
  FROM public.parking_sessions s
  WHERE s.id = v_session_id;

  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 
    format('Vehicle %s is already parked at this site.', p_vehicle_number));
END;
$$;

-- 3. Update rpc_vehicle_checkout with safe non-blocking audit logging
CREATE OR REPLACE FUNCTION public.rpc_vehicle_checkout(
  p_company_id uuid,
  p_session_id uuid,
  p_exit_operator_id uuid,
  p_payment_method text,
  p_gross_amount int,
  p_duration_minutes int,
  p_discount_amount int DEFAULT 0,
  p_transaction_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session record;
  v_now timestamptz := now();
  v_final_amount int;
  v_receipt_number text;
  v_today_seq int;
  v_payment_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Row-level lock on session to prevent concurrent checkouts
  SELECT * INTO v_session
  FROM public.parking_sessions
  WHERE id = p_session_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parking session not found.');
  END IF;

  IF v_session.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This vehicle has already been checked out.');
  END IF;

  v_final_amount := GREATEST(0, p_gross_amount - p_discount_amount);

  -- 2. Generate unique daily receipt number
  SELECT COUNT(*) + 1 INTO v_today_seq
  FROM public.payments
  WHERE created_at >= date_trunc('day', v_now AT TIME ZONE 'Asia/Kolkata');

  v_receipt_number := format('SWP-%s-%s', 
    to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD'),
    lpad(v_today_seq::text, 4, '0')
  );

  -- 3. Update parking session to COMPLETED
  UPDATE public.parking_sessions SET
    exit_at = v_now,
    exit_operator_id = p_exit_operator_id,
    duration_minutes = p_duration_minutes,
    gross_amount = p_gross_amount,
    status = 'COMPLETED',
    updated_at = v_now
  WHERE id = p_session_id;

  -- 4. Insert payment record
  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (
    id, session_id, status, method, amount, discount_amount, tax_amount,
    collected_by_id, collected_at, receipt_number, transaction_ref, created_at, updated_at
  ) VALUES (
    v_payment_id, p_session_id, 'PAID', p_payment_method, v_final_amount,
    p_discount_amount, 0, p_exit_operator_id, v_now, v_receipt_number,
    p_transaction_ref, v_now, v_now
  );

  -- 5. Audit log (safe non-blocking)
  BEGIN
    INSERT INTO public.audit_logs (id, company_id, site_id, action, entity_type, entity_id, actor_id, details, created_at)
    VALUES (
      gen_random_uuid(), p_company_id, v_session.site_id, 'VEHICLE_EXIT', 'parking_session', p_session_id::text,
      p_exit_operator_id,
      jsonb_build_object(
        'vehicle_number', v_session.vehicle_number,
        'duration_minutes', p_duration_minutes,
        'gross_amount', p_gross_amount,
        'final_amount', v_final_amount,
        'payment_method', p_payment_method,
        'receipt_number', v_receipt_number
      ),
      v_now
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 6. Return response
  RETURN jsonb_build_object(
    'success', true,
    'receipt_number', v_receipt_number,
    'session_id', p_session_id,
    'payment_id', v_payment_id
  );
END;
$$;

-- 4. Add rpc_dashboard_stats
CREATE OR REPLACE FUNCTION public.rpc_dashboard_stats(
  p_company_id uuid,
  p_site_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER STABLE
AS $$
DECLARE
  v_is_all_sites boolean;
  v_total_slots int;
  v_daily_revenue_target int;
  v_active_vehicles int;
  v_today_revenue bigint;
  v_yesterday_revenue bigint;
  v_today_entries int;
  v_yesterday_entries int;
  v_avg_duration numeric;
  v_overstay_count int;
  v_overstay_hrs int := 24;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_yesterday_start timestamptz;
  v_yesterday_end timestamptz;
  v_breakdown jsonb;
  v_peak_hours jsonb;
BEGIN
  v_is_all_sites := (p_site_id IS NULL);
  
  v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
  v_today_end := v_today_start + interval '1 day' - interval '1 millisecond';
  v_yesterday_start := v_today_start - interval '1 day';
  v_yesterday_end := v_today_start - interval '1 millisecond';

  IF v_is_all_sites THEN
    SELECT COALESCE(SUM(total_slots), 0), COALESCE(SUM(daily_revenue_target), 0)
    INTO v_total_slots, v_daily_revenue_target
    FROM public.sites WHERE company_id = p_company_id AND deleted_at IS NULL;
  ELSE
    SELECT COALESCE(total_slots, 0), COALESCE(daily_revenue_target, 0), COALESCE(overstay_alert_hrs, 24)
    INTO v_total_slots, v_daily_revenue_target, v_overstay_hrs
    FROM public.sites WHERE id = p_site_id AND company_id = p_company_id AND deleted_at IS NULL;
  END IF;

  SELECT COUNT(*) INTO v_active_vehicles
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND status = 'ACTIVE' AND deleted_at IS NULL
    AND (v_is_all_sites OR site_id = p_site_id);

  SELECT COALESCE(SUM(p.amount), 0) INTO v_today_revenue
  FROM public.payments p
  JOIN public.parking_sessions s ON p.session_id = s.id
  WHERE s.company_id = p_company_id AND p.status = 'PAID'
    AND p.collected_at >= v_today_start AND p.collected_at <= v_today_end
    AND (v_is_all_sites OR s.site_id = p_site_id);

  SELECT COALESCE(SUM(p.amount), 0) INTO v_yesterday_revenue
  FROM public.payments p
  JOIN public.parking_sessions s ON p.session_id = s.id
  WHERE s.company_id = p_company_id AND p.status = 'PAID'
    AND p.collected_at >= v_yesterday_start AND p.collected_at <= v_yesterday_end
    AND (v_is_all_sites OR s.site_id = p_site_id);

  SELECT COUNT(*) INTO v_today_entries
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND deleted_at IS NULL
    AND entry_at >= v_today_start AND entry_at <= v_today_end
    AND (v_is_all_sites OR site_id = p_site_id);

  SELECT COUNT(*) INTO v_yesterday_entries
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND deleted_at IS NULL
    AND entry_at >= v_yesterday_start AND entry_at <= v_yesterday_end
    AND (v_is_all_sites OR site_id = p_site_id);

  SELECT COALESCE(AVG(duration_minutes), 0) INTO v_avg_duration
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND status = 'COMPLETED' AND deleted_at IS NULL
    AND exit_at >= v_today_start AND exit_at <= v_today_end
    AND (v_is_all_sites OR site_id = p_site_id);

  SELECT COUNT(*) INTO v_overstay_count
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND status = 'ACTIVE' AND deleted_at IS NULL
    AND EXTRACT(EPOCH FROM (now() - entry_at)) / 3600 >= v_overstay_hrs
    AND (v_is_all_sites OR site_id = p_site_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('type', vehicle_type, 'count', cnt)), '[]'::jsonb)
  INTO v_breakdown
  FROM (
    SELECT vehicle_type, COUNT(*) as cnt
    FROM public.parking_sessions
    WHERE company_id = p_company_id AND deleted_at IS NULL
      AND entry_at >= v_today_start AND entry_at <= v_today_end
      AND (v_is_all_sites OR site_id = p_site_id)
    GROUP BY vehicle_type
  ) sub;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', hr, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_peak_hours
  FROM (
    SELECT EXTRACT(HOUR FROM entry_at AT TIME ZONE 'Asia/Kolkata')::int as hr, COUNT(*) as cnt
    FROM public.parking_sessions
    WHERE company_id = p_company_id AND deleted_at IS NULL
      AND entry_at >= v_today_start AND entry_at <= v_today_end
      AND (v_is_all_sites OR site_id = p_site_id)
    GROUP BY hr
  ) sub;

  RETURN jsonb_build_object(
    'total_slots', v_total_slots,
    'active_vehicles', v_active_vehicles,
    'today_revenue', v_today_revenue,
    'yesterday_revenue', v_yesterday_revenue,
    'today_vehicle_count', v_today_entries,
    'yesterday_vehicle_count', v_yesterday_entries,
    'avg_duration_minutes', round(v_avg_duration),
    'daily_revenue_target', v_daily_revenue_target,
    'overstaying_count', v_overstay_count,
    'vehicle_type_breakdown', v_breakdown,
    'peak_hours', v_peak_hours
  );
END;
$$;

-- 5. Permissions
GRANT EXECUTE ON FUNCTION public.rpc_verify_pin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vehicle_entry TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vehicle_checkout TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dashboard_stats TO anon, authenticated;

-- 6. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
