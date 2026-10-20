-- ============================================================
-- 008: Driver Name in Vehicle Entry & Comprehensive Staff Management
-- Adds driver_name to parking_sessions, updates entry RPC,
-- adds employee salary/designation fields, staff_attendance,
-- and staff_transactions tables with RLS and realtime sync.
-- ============================================================

-- ─── 1. ADD DRIVER NAME TO PARKING SESSIONS ──────────────────
ALTER TABLE public.parking_sessions ADD COLUMN IF NOT EXISTS driver_name text;
CREATE INDEX IF NOT EXISTS idx_sessions_driver_name ON public.parking_sessions(driver_name);

-- ─── 2. UPDATE RPC_VEHICLE_ENTRY WITH DRIVER NAME ────────────
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

  -- 4. Resolve current rate card
  SELECT id INTO v_rate_card_id
  FROM public.rate_cards
  WHERE site_id = p_site_id 
    AND company_id = p_company_id
    AND vehicle_type = p_vehicle_type 
    AND effective_to IS NULL
  ORDER BY effective_from DESC
  LIMIT 1;

  -- 5. Create parking session with driver_name
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

  -- 6. Create audit log
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

-- ─── 3. EXTEND EMPLOYEES TABLE ────────────────────────────────
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS base_salary int NOT NULL DEFAULT 0; -- in paise (e.g. 1500000 = ₹15,000)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_type text NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation text DEFAULT 'Parking Attendant';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date date DEFAULT current_date;

-- Add constraint for salary_type if not exists
DO $$ 
BEGIN
  ALTER TABLE public.employees ADD CONSTRAINT chk_employees_salary_type 
    CHECK (salary_type IN ('MONTHLY', 'DAILY', 'HOURLY'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ─── 4. STAFF ATTENDANCE TABLE ───────────────────────────────
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

-- ─── 5. STAFF TRANSACTIONS (ADVANCES & SALARY PAYMENTS) ──────
CREATE TABLE IF NOT EXISTS public.staff_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('SALARY_PAYMENT', 'ADVANCE_GIVEN', 'ADVANCE_REPAYMENT', 'BONUS', 'DEDUCTION')),
  amount int NOT NULL, -- in paise
  payment_date date NOT NULL DEFAULT current_date,
  payment_method text NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE')),
  month text, -- e.g. '2026-08'
  notes text,
  transaction_ref text,
  recorded_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_tx_emp ON public.staff_transactions(employee_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_tx_comp_month ON public.staff_transactions(company_id, month);
CREATE INDEX IF NOT EXISTS idx_staff_tx_type ON public.staff_transactions(type);

-- ─── 6. AUTO-RECALCULATE EMPLOYEE SALARY ADVANCE TRIGGER ──────
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

-- ─── 7. ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_transactions ENABLE ROW LEVEL SECURITY;

-- Attendance Policies
DROP POLICY IF EXISTS "staff_attendance_select" ON public.staff_attendance;
CREATE POLICY "staff_attendance_select" ON public.staff_attendance
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "staff_attendance_insert" ON public.staff_attendance;
CREATE POLICY "staff_attendance_insert" ON public.staff_attendance
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "staff_attendance_update" ON public.staff_attendance;
CREATE POLICY "staff_attendance_update" ON public.staff_attendance
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "staff_attendance_delete" ON public.staff_attendance;
CREATE POLICY "staff_attendance_delete" ON public.staff_attendance
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'));

-- Transactions Policies
DROP POLICY IF EXISTS "staff_transactions_select" ON public.staff_transactions;
CREATE POLICY "staff_transactions_select" ON public.staff_transactions
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "staff_transactions_insert" ON public.staff_transactions;
CREATE POLICY "staff_transactions_insert" ON public.staff_transactions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'));

DROP POLICY IF EXISTS "staff_transactions_update" ON public.staff_transactions;
CREATE POLICY "staff_transactions_update" ON public.staff_transactions
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'))
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "staff_transactions_delete" ON public.staff_transactions;
CREATE POLICY "staff_transactions_delete" ON public.staff_transactions
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER'));

-- ─── 8. ADD TO REALTIME PUBLICATION ──────────────────────────
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_attendance;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_transactions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
