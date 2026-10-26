-- ==============================================================================
-- 010_PRODUCTION_CONSOLIDATION.SQL
-- Consolidated Production Migration & Safe Idempotent Setup
-- Execute this script in your Supabase SQL Editor to enable all features,
-- atomic RPCs, multi-device Realtime publications, and database constraints.
-- ==============================================================================

-- ─── 1. EXTEND TABLES WITH MISSING COLUMNS & CONSTRAINTS ────────────────────

-- Parking Sessions: driver_name and active uniqueness index
ALTER TABLE public.parking_sessions ADD COLUMN IF NOT EXISTS driver_name text;
CREATE INDEX IF NOT EXISTS idx_sessions_driver_name ON public.parking_sessions(driver_name);

-- Audit Logs: ensure company_id and site_id exist
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_site ON public.audit_logs(site_id, created_at);

-- Uniqueness constraint: prevents two devices from creating duplicate active sessions
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_vehicle_site 
  ON public.parking_sessions(site_id, vehicle_number) 
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- Employees: salary & designation fields
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS base_salary int NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_type text NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation text DEFAULT 'Parking Attendant';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date date DEFAULT current_date;

DO $$ 
BEGIN
  ALTER TABLE public.employees ADD CONSTRAINT chk_employees_salary_type 
    CHECK (salary_type IN ('MONTHLY', 'DAILY', 'HOURLY'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ─── 2. STAFF ATTENDANCE TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'HOLIDAY')),
  check_in timestamptz,
  check_out timestamptz,
  shift text,
  notes text,
  marked_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_emp_date ON public.staff_attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_comp_date ON public.staff_attendance(company_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_site_date ON public.staff_attendance(site_id, date);

-- ─── 3. STAFF TRANSACTIONS (ADVANCES & PAYROLL) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('SALARY_PAYMENT', 'ADVANCE_GIVEN', 'ADVANCE_REPAYMENT', 'BONUS', 'DEDUCTION')),
  amount int NOT NULL, -- in paise
  payment_date date NOT NULL DEFAULT current_date,
  payment_method text NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE')),
  month text,
  notes text,
  transaction_ref text,
  recorded_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_tx_emp ON public.staff_transactions(employee_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_tx_comp_month ON public.staff_transactions(company_id, month);

-- Trigger: auto-recalculate employee salary advances
CREATE OR REPLACE FUNCTION public.recalculate_employee_advance()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id uuid;
  v_total_advance int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp_id := OLD.employee_id;
  ELSE
    v_emp_id := NEW.employee_id;
  END IF;

  SELECT COALESCE(
    SUM(
      CASE 
        WHEN type = 'ADVANCE_GIVEN' THEN amount
        WHEN type = 'ADVANCE_REPAYMENT' THEN -amount
        ELSE 0
      END
    ), 0
  ) INTO v_total_advance
  FROM public.staff_transactions
  WHERE employee_id = v_emp_id;

  UPDATE public.employees
  SET salary_advance = GREATEST(0, v_total_advance),
      updated_at = now()
  WHERE id = v_emp_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_employee_advance ON public.staff_transactions;
CREATE TRIGGER trg_recalc_employee_advance
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_transactions
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_employee_advance();

-- ─── 4. RPC: SECURE PIN VERIFICATION (BCRYPT + PLAINTEXT COMPATIBLE) ────────
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
  v_pin_matches boolean := false;
BEGIN
  -- Look up active employee by mobile, email or id
  SELECT * INTO v_employee
  FROM public.employees
  WHERE (mobile = p_identifier OR email = p_identifier OR id::text = p_identifier)
    AND active = true
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found. Please check your mobile number or ID.');
  END IF;

  IF v_employee.pin IS NULL OR v_employee.pin = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No PIN set for this account. Contact your admin.');
  END IF;

  -- Support both plaintext PINs and bcrypt hashed PINs
  IF v_employee.pin = p_pin OR v_employee.pin = crypt(p_pin, v_employee.pin) THEN
    v_pin_matches := true;
  END IF;

  IF NOT v_pin_matches THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN. Please try again.');
  END IF;

  -- Update last login
  UPDATE public.employees SET updated_at = now() WHERE id = v_employee.id;

  -- Return employee record WITHOUT the PIN hash
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
      'base_salary', v_employee.base_salary,
      'salary_type', v_employee.salary_type,
      'designation', v_employee.designation,
      'created_at', v_employee.created_at,
      'updated_at', v_employee.updated_at
    )
  );
END;
$$;

-- ─── 5. RPC: ATOMIC VEHICLE ENTRY ───────────────────────────────────────────
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
  v_session_id uuid;
  v_site record;
  v_active_count int;
  v_rate_card_id uuid;
  v_now timestamptz := now();
  v_result jsonb;
BEGIN
  -- 1. Validate site exists and belongs to company
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

  -- 3. Check for duplicate active session
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

  -- 4. Resolve current active rate card
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

-- ─── 6. RPC: ATOMIC VEHICLE CHECKOUT ────────────────────────────────────────
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

-- ─── 7. RPC: DASHBOARD STATS ──────────────────────────────────────────────
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

-- ─── 8. PERMISSIONS & REALTIME GRANTS ───────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.rpc_verify_pin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vehicle_entry TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vehicle_checkout TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dashboard_stats TO anon, authenticated;

-- Add tables to Realtime publication
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_attendance;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
