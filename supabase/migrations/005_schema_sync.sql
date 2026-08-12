-- ============================================================
-- 005: Schema Synchronization & Data Integrity
-- Aligns Supabase schema with local SQLite schema,
-- adds missing constraints, and performance indexes.
-- ============================================================

-- 1. Add missing columns to employees (these exist locally but not in Supabase)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS shift text CHECK (shift IN ('MORNING','AFTERNOON','NIGHT'));
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_advance int NOT NULL DEFAULT 0;

-- 2. Prevent duplicate active parking sessions for the same vehicle
-- This is critical for multi-device conflict resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_vehicle
  ON public.parking_sessions (company_id, vehicle_number)
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- 3. Add company_id scoped indexes for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_sites_company ON public.sites(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_company ON public.rate_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_sessions_company ON public.parking_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_sessions_company_status ON public.parking_sessions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_company_entry ON public.parking_sessions(company_id, entry_at);
CREATE INDEX IF NOT EXISTS idx_payments_session ON public.payments(session_id);

-- 4. Ensure contact_number exists on sites (was added in 003 but verify)
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS contact_number text;
