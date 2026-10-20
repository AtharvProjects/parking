-- ============================================================
-- 007: Production Overhaul Migration
-- Fixes security, concurrency, roles, RLS, and adds atomic RPCs
-- for the multi-user web parking management system.
-- ============================================================

-- ─── 1. ENABLE PGCRYPTO ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 2. ADD ORGANIZATION FIELDS TO COMPANIES ──────────────────
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city text;

-- ─── 3. PIN HASHING ──────────────────────────────────────────
-- Hash all existing plaintext PINs (only those that don't look like bcrypt hashes)
UPDATE public.employees 
SET pin = crypt(pin, gen_salt('bf', 8))
WHERE pin IS NOT NULL 
  AND pin != '' 
  AND pin NOT LIKE '$2a$%' 
  AND pin NOT LIKE '$2b$%';

-- Trigger to auto-hash PINs on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.hash_employee_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin != '' 
     AND NEW.pin NOT LIKE '$2a$%' AND NEW.pin NOT LIKE '$2b$%' THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf', 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hash_employee_pin ON public.employees;
CREATE TRIGGER trg_hash_employee_pin
  BEFORE INSERT OR UPDATE OF pin ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.hash_employee_pin();

-- ─── 4. FIX UNIQUE ACTIVE VEHICLE INDEX ──────────────────────
-- Change from company-wide to site-scoped uniqueness
DROP INDEX IF EXISTS idx_sessions_active_vehicle;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_vehicle_site
  ON public.parking_sessions (site_id, vehicle_number)
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- ─── 5. SINGLE ADMIN CONSTRAINT ──────────────────────────────
-- Only one active ADMIN (or SUPER_ADMIN) per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_admin_per_company
  ON public.employees (company_id)
  WHERE role IN ('ADMIN', 'SUPER_ADMIN') AND active = true AND deleted_at IS NULL;

-- ─── 6. ADD AUDIT LOGS TO REALTIME ───────────────────────────
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already added
END $$;

-- ─── 7. ADD company_id TO audit_logs ─────────────────────────
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_site ON public.audit_logs(site_id, created_at);

-- ─── 8. ADD site_id INDEX ON payments ────────────────────────
-- payments don't have site_id directly; we rely on session join
-- but add index for collected_by_id for operator perf queries
CREATE INDEX IF NOT EXISTS idx_payments_collector ON public.payments(collected_by_id);

-- ─── 9. ATOMIC RPC: VEHICLE ENTRY ───────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_vehicle_entry(
  p_company_id uuid,
  p_site_id uuid,
  p_vehicle_number text,
  p_vehicle_type text,
  p_driver_number text,
  p_notes text DEFAULT NULL,
  p_vehicle_photos jsonb DEFAULT NULL,
  p_entry_operator_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id uuid;
  v_site record;
  v_active_count int;
  v_rate_card_id uuid;
  v_now timestamptz := now();
  v_result jsonb;
BEGIN
  -- 1. Validate site exists and is active
  SELECT * INTO v_site 
  FROM public.sites 
  WHERE id = p_site_id AND company_id = p_company_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parking site not found or inactive.');
  END IF;

  -- 2. Check capacity
  SELECT COUNT(*) INTO v_active_count
  FROM public.parking_sessions
  WHERE site_id = p_site_id AND status = 'ACTIVE' AND deleted_at IS NULL;

  IF v_active_count >= v_site.total_slots THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Site is at full capacity (%s/%s slots). Cannot accept more vehicles.', v_active_count, v_site.total_slots));
  END IF;

  -- 3. Check for duplicate active session (the unique index also enforces this,
  --    but we provide a friendlier error message here)
  IF EXISTS (
    SELECT 1 FROM public.parking_sessions 
    WHERE site_id = p_site_id 
      AND vehicle_number = p_vehicle_number 
      AND status = 'ACTIVE' 
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Vehicle %s is already parked at this site.', p_vehicle_number));
  END IF;

  -- 4. Resolve current rate card
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
    id, company_id, site_id, vehicle_number, vehicle_type, driver_number,
    notes, vehicle_photos, entry_at, entry_operator_id, rate_card_id,
    status, created_at, updated_at
  ) VALUES (
    v_session_id, p_company_id, p_site_id, p_vehicle_number, p_vehicle_type, p_driver_number,
    p_notes, p_vehicle_photos, v_now, p_entry_operator_id, v_rate_card_id,
    'ACTIVE', v_now, v_now
  );

  -- 6. Create audit log
  INSERT INTO public.audit_logs (id, company_id, site_id, action, entity_type, entity_id, actor_id, details, created_at)
  VALUES (
    gen_random_uuid(), p_company_id, p_site_id, 'VEHICLE_ENTRY', 'parking_session', v_session_id::text,
    p_entry_operator_id,
    jsonb_build_object('vehicle_number', p_vehicle_number, 'vehicle_type', p_vehicle_type, 'site_name', v_site.name),
    v_now
  );

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

-- ─── 10. ATOMIC RPC: VEHICLE CHECKOUT ────────────────────────
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
  v_payment_id uuid;
  v_receipt_number text;
  v_final_amount int;
  v_now timestamptz := now();
  v_date_str text;
  v_seq int;
  v_result jsonb;
BEGIN
  -- 1. Lock and validate session
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

  IF v_session.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This parking session was cancelled.');
  END IF;

  -- 2. Check if payment already exists (idempotency)
  IF EXISTS (SELECT 1 FROM public.payments WHERE session_id = p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment already recorded for this session.');
  END IF;

  -- 3. Calculate final amount
  v_final_amount := GREATEST(0, p_gross_amount - p_discount_amount);

  -- 4. Generate receipt number
  v_date_str := to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_seq 
  FROM public.payments 
  WHERE created_at::date = v_now::date;
  v_receipt_number := 'SWP-' || v_date_str || '-' || lpad(v_seq::text, 4, '0');

  -- 5. Update session
  UPDATE public.parking_sessions SET
    exit_at = v_now,
    exit_operator_id = p_exit_operator_id,
    duration_minutes = p_duration_minutes,
    gross_amount = p_gross_amount,
    status = 'COMPLETED',
    updated_at = v_now
  WHERE id = p_session_id;

  -- 6. Create payment
  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (
    id, session_id, status, method, amount, discount_amount, tax_amount,
    collected_by_id, collected_at, receipt_number, transaction_ref,
    created_at, updated_at
  ) VALUES (
    v_payment_id, p_session_id, 'PAID', p_payment_method, v_final_amount,
    p_discount_amount, 0, p_exit_operator_id, v_now, v_receipt_number,
    p_transaction_ref, v_now, v_now
  );

  -- 7. Audit log
  INSERT INTO public.audit_logs (id, company_id, site_id, action, entity_type, entity_id, actor_id, details, created_at)
  VALUES (
    gen_random_uuid(), p_company_id, v_session.site_id, 'VEHICLE_CHECKOUT', 'parking_session', p_session_id::text,
    p_exit_operator_id,
    jsonb_build_object(
      'vehicle_number', v_session.vehicle_number,
      'duration_minutes', p_duration_minutes,
      'gross_amount', p_gross_amount,
      'discount_amount', p_discount_amount,
      'final_amount', v_final_amount,
      'payment_method', p_payment_method,
      'receipt_number', v_receipt_number
    ),
    v_now
  );

  -- 8. Return completed session with payment
  SELECT jsonb_build_object(
    'success', true,
    'session', row_to_json(s),
    'payment', row_to_json(p),
    'receipt_number', v_receipt_number
  ) INTO v_result
  FROM public.parking_sessions s
  LEFT JOIN public.payments p ON p.session_id = s.id
  WHERE s.id = p_session_id;

  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Payment already recorded for this session.');
END;
$$;

-- ─── 11. RPC: VERIFY PIN ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_verify_pin(
  p_identifier text,
  p_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee record;
BEGIN
  SELECT * INTO v_employee
  FROM public.employees
  WHERE (mobile = p_identifier OR email = p_identifier OR id::text = p_identifier)
    AND active = true
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found. Please check your mobile number or ID.');
  END IF;

  -- Verify PIN using bcrypt
  IF v_employee.pin IS NULL OR v_employee.pin = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No PIN set for this account. Contact your admin.');
  END IF;

  IF v_employee.pin = crypt(p_pin, v_employee.pin) THEN
    -- Update last login
    UPDATE public.employees SET updated_at = now() WHERE id = v_employee.id;
    
    -- Return employee data WITHOUT the pin hash
    RETURN jsonb_build_object(
      'success', true,
      'employee', jsonb_build_object(
        'id', v_employee.id,
        'company_id', v_employee.company_id,
        'site_id', v_employee.site_id,
        'auth_user_id', v_employee.auth_user_id,
        'name', v_employee.name,
        'mobile', v_employee.mobile,
        'email', v_employee.email,
        'role', v_employee.role,
        'active', v_employee.active,
        'avatar_url', v_employee.avatar_url,
        'shift', v_employee.shift,
        'salary_advance', v_employee.salary_advance,
        'created_at', v_employee.created_at,
        'updated_at', v_employee.updated_at
      )
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN. Please try again.');
  END IF;
END;
$$;

-- ─── 12. RPC: DASHBOARD STATS ────────────────────────────────
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
  
  -- Calculate IST day boundaries
  v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
  v_today_end := v_today_start + interval '1 day' - interval '1 millisecond';
  v_yesterday_start := v_today_start - interval '1 day';
  v_yesterday_end := v_today_start - interval '1 millisecond';

  -- Site config
  IF v_is_all_sites THEN
    SELECT COALESCE(SUM(total_slots), 0), COALESCE(SUM(daily_revenue_target), 0)
    INTO v_total_slots, v_daily_revenue_target
    FROM public.sites WHERE company_id = p_company_id AND deleted_at IS NULL;
  ELSE
    SELECT COALESCE(total_slots, 0), COALESCE(daily_revenue_target, 0), COALESCE(overstay_alert_hrs, 24)
    INTO v_total_slots, v_daily_revenue_target, v_overstay_hrs
    FROM public.sites WHERE id = p_site_id AND company_id = p_company_id AND deleted_at IS NULL;
  END IF;

  -- Active vehicles
  SELECT COUNT(*) INTO v_active_vehicles
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND status = 'ACTIVE' AND deleted_at IS NULL
    AND (v_is_all_sites OR site_id = p_site_id);

  -- Today revenue
  SELECT COALESCE(SUM(p.amount), 0) INTO v_today_revenue
  FROM public.payments p
  JOIN public.parking_sessions s ON p.session_id = s.id
  WHERE s.company_id = p_company_id AND p.status = 'PAID'
    AND p.collected_at >= v_today_start AND p.collected_at <= v_today_end
    AND (v_is_all_sites OR s.site_id = p_site_id);

  -- Yesterday revenue
  SELECT COALESCE(SUM(p.amount), 0) INTO v_yesterday_revenue
  FROM public.payments p
  JOIN public.parking_sessions s ON p.session_id = s.id
  WHERE s.company_id = p_company_id AND p.status = 'PAID'
    AND p.collected_at >= v_yesterday_start AND p.collected_at <= v_yesterday_end
    AND (v_is_all_sites OR s.site_id = p_site_id);

  -- Today entries
  SELECT COUNT(*) INTO v_today_entries
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND deleted_at IS NULL
    AND entry_at >= v_today_start AND entry_at <= v_today_end
    AND (v_is_all_sites OR site_id = p_site_id);

  -- Yesterday entries
  SELECT COUNT(*) INTO v_yesterday_entries
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND deleted_at IS NULL
    AND entry_at >= v_yesterday_start AND entry_at <= v_yesterday_end
    AND (v_is_all_sites OR site_id = p_site_id);

  -- Avg duration today
  SELECT COALESCE(AVG(duration_minutes), 0) INTO v_avg_duration
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND status = 'COMPLETED' AND deleted_at IS NULL
    AND exit_at >= v_today_start AND exit_at <= v_today_end
    AND (v_is_all_sites OR site_id = p_site_id);

  -- Overstay count
  SELECT COUNT(*) INTO v_overstay_count
  FROM public.parking_sessions
  WHERE company_id = p_company_id AND status = 'ACTIVE' AND deleted_at IS NULL
    AND EXTRACT(EPOCH FROM (now() - entry_at)) / 3600 >= v_overstay_hrs
    AND (v_is_all_sites OR site_id = p_site_id);

  -- Vehicle type breakdown
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

  -- Peak hours
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

-- ─── 13. FIX RLS POLICIES ───────────────────────────────────

-- Drop ALL existing policies to start clean
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('companies','sites','employees','rate_cards','parking_sessions','payments','audit_logs')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Helper: get user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role 
  FROM public.employees 
  WHERE auth_user_id = auth.uid() 
    AND active = true
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- Recreate get_user_company_id (ensure it exists)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT company_id 
  FROM public.employees 
  WHERE auth_user_id = auth.uid() 
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- COMPANIES: read own company, admin can update
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.get_user_company_id());

CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'))
  WITH CHECK (id = public.get_user_company_id());

-- SITES: read own company's sites; admin can insert/update/delete
CREATE POLICY "sites_select" ON public.sites
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "sites_insert" ON public.sites
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'));

CREATE POLICY "sites_update" ON public.sites
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'))
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "sites_delete" ON public.sites
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'));

-- EMPLOYEES: read own company; admin can manage
CREATE POLICY "employees_select" ON public.employees
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR auth_user_id = auth.uid());

CREATE POLICY "employees_insert" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'));

CREATE POLICY "employees_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'))
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "employees_delete" ON public.employees
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'));

-- RATE_CARDS: read own company; admin can manage
CREATE POLICY "rate_cards_select" ON public.rate_cards
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "rate_cards_insert" ON public.rate_cards
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'));

CREATE POLICY "rate_cards_update" ON public.rate_cards
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'))
  WITH CHECK (company_id = public.get_user_company_id());

-- PARKING_SESSIONS: read own company; all authenticated can insert/update (operators need to create entries)
CREATE POLICY "sessions_select" ON public.parking_sessions
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "sessions_insert" ON public.parking_sessions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "sessions_update" ON public.parking_sessions
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- PAYMENTS: read/write for own company's sessions
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM public.parking_sessions WHERE company_id = public.get_user_company_id()));

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (session_id IN (SELECT id FROM public.parking_sessions WHERE company_id = public.get_user_company_id()));

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated
  USING (session_id IN (SELECT id FROM public.parking_sessions WHERE company_id = public.get_user_company_id()));

-- AUDIT_LOGS: read own company; no direct insert/update/delete (RPCs handle insertion)
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- Note: Audit log insertions happen through SECURITY DEFINER RPCs, not direct client writes.
-- This prevents operators from tampering with audit records.

-- ─── 14. GRANT EXECUTE ON RPCs ───────────────────────────────
-- RPCs use SECURITY DEFINER so they run as the function owner,
-- but we still need to allow authenticated users to call them.
GRANT EXECUTE ON FUNCTION public.rpc_vehicle_entry TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vehicle_checkout TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_verify_pin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;

-- ─── 15. ADDITIONAL PERFORMANCE INDEXES ──────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_site_active ON public.parking_sessions(site_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_sessions_entry_operator ON public.parking_sessions(entry_operator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exit_operator ON public.parking_sessions(exit_operator_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_collected_at_status ON public.payments(collected_at, status) WHERE status = 'PAID';
