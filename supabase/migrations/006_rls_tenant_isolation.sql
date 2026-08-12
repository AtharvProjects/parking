-- ============================================================
-- 006: Tenant Isolation & RLS Security
-- Replaces the overly permissive policies in 002 with proper
-- tenant isolation based on the authenticated user's employee record.
-- ============================================================

-- Function to get the current user's company_id
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

-- Drop all existing policies from migrations 001 and 002
DROP POLICY IF EXISTS "Enable all access" ON public.companies;
DROP POLICY IF EXISTS "Enable all access" ON public.sites;
DROP POLICY IF EXISTS "Enable all access" ON public.employees;
DROP POLICY IF EXISTS "Enable all access" ON public.rate_cards;
DROP POLICY IF EXISTS "Enable all access" ON public.parking_sessions;
DROP POLICY IF EXISTS "Enable all access" ON public.payments;
DROP POLICY IF EXISTS "Enable all access" ON public.sync_queue;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.companies;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.companies;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.companies;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.sites;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.sites;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.sites;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.employees;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.employees;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.employees;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.rate_cards;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.rate_cards;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.rate_cards;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.parking_sessions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.parking_sessions;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.parking_sessions;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.payments;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.payments;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.payments;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.sync_queue;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.sync_queue;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.sync_queue;


-- 1. Employees: Users can read/write their own company's employees
-- Special case: allow users to insert themselves during sign-up if their auth_user_id is set
CREATE POLICY "Tenant isolation for employees" ON public.employees
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id() 
    OR auth_user_id = auth.uid()
  );

-- 2. Companies: Users can read/update their own company
CREATE POLICY "Tenant isolation for companies" ON public.companies
  FOR ALL TO authenticated
  USING (
    id = public.get_user_company_id()
  );

-- 3. Sites: Users can read/write their own company's sites
CREATE POLICY "Tenant isolation for sites" ON public.sites
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

-- 4. Rate Cards: Users can read/write their own company's rate cards
CREATE POLICY "Tenant isolation for rate_cards" ON public.rate_cards
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

-- 5. Parking Sessions: Users can read/write their own company's sessions
CREATE POLICY "Tenant isolation for parking_sessions" ON public.parking_sessions
  FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

-- 6. Payments: Need to join to session to verify company, or if they have company_id directly we'll use that.
-- Payments doesn't have company_id directly, so we check the session
CREATE POLICY "Tenant isolation for payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.parking_sessions WHERE company_id = public.get_user_company_id()
    )
  );

-- 7. Sync Queue: Generic access if needed, but primarily client-side table anyway.
-- In Supabase this table shouldn't even be replicated down to clients directly, it's just local.
-- We'll allow access just in case the client pushes to it (though they shouldn't).
CREATE POLICY "Allow all to sync_queue" ON public.sync_queue
  FOR ALL TO authenticated
  USING (true);
