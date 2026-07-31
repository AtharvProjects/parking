-- ============================================================
-- THE EAST PALACE — Parking Management System
-- Supabase PostgreSQL Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── SITES ──────────────────────────────────────────────────
create table public.sites (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand_name text,
  address text not null default '',
  city text not null default 'Ahilyanagar',
  state text not null default 'Maharashtra',
  timezone text not null default 'Asia/Kolkata',
  
  -- Billing configuration
  grace_period_minutes int not null default 15,
  rounding_interval_min int not null default 30,
  day_rate_switchover_hrs int not null default 12,
  overstay_alert_hrs int not null default 24,
  daily_revenue_target int not null default 1500000, -- paise = ₹15,000
  total_slots int not null default 100,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ─── EMPLOYEES ──────────────────────────────────────────────
create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  
  name text not null,
  mobile text not null,
  email text unique,
  role text not null default 'OPERATOR' check (role in ('SUPER_ADMIN','ADMIN','MANAGER','OPERATOR','GATE_ATTENDANT','ACCOUNTANT','VIEWER')),
  pin text, -- hashed 4-6 digit PIN
  active boolean not null default true,
  avatar_url text,
  shift text check (shift in ('MORNING','AFTERNOON','NIGHT')),
  salary_advance int not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_employees_site_active on public.employees(site_id, active);
create index idx_employees_mobile on public.employees(mobile);
create index idx_employees_auth_user on public.employees(auth_user_id);

-- ─── RATE CARDS ─────────────────────────────────────────────
create table public.rate_cards (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('TRAILOR','BODY_VEHICLE','EICHER')),
  hourly_rate int not null, -- paise
  daily_rate int not null,  -- paise
  effective_from timestamptz not null default now(),
  effective_to timestamptz,  -- null = currently active
  created_by uuid references public.employees(id),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rate_cards_lookup on public.rate_cards(site_id, vehicle_type, effective_from);

-- ─── PARKING SESSIONS ───────────────────────────────────────
create table public.parking_sessions (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  
  -- Vehicle info
  vehicle_number text not null,
  vehicle_type text not null check (vehicle_type in ('TRAILOR','BODY_VEHICLE','EICHER')),
  driver_number text not null default '',
  notes text,
  vehicle_photos jsonb default '[]'::jsonb,
  
  -- Entry
  entry_at timestamptz not null default now(),
  entry_operator_id uuid not null references public.employees(id),
  
  -- Exit
  exit_at timestamptz,
  exit_operator_id uuid references public.employees(id),
  
  -- Billing
  rate_card_id uuid references public.rate_cards(id),
  duration_minutes int,
  gross_amount int, -- paise
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','CANCELLED')),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_sessions_vehicle on public.parking_sessions(vehicle_number);
create index idx_sessions_driver on public.parking_sessions(driver_number);
create index idx_sessions_site_status on public.parking_sessions(site_id, status);
create index idx_sessions_entry_at on public.parking_sessions(entry_at);
create index idx_sessions_site_entry on public.parking_sessions(site_id, entry_at);

-- ─── PAYMENTS ───────────────────────────────────────────────
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null unique references public.parking_sessions(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','PAID','PARTIALLY_PAID','WAIVED')),
  method text check (method in ('CASH','UPI','CARD')),
  amount int not null, -- paise, final after discount
  discount_amount int not null default 0,
  tax_amount int not null default 0,
  collected_by_id uuid references public.employees(id),
  collected_at timestamptz,
  receipt_number text unique,
  transaction_ref text, -- UPI/Card reference
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_receipt on public.payments(receipt_number);
create index idx_payments_collected_at on public.payments(collected_at);

-- ─── AUDIT LOGS ─────────────────────────────────────────────
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  actor_id uuid references public.employees(id),
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_actor on public.audit_logs(actor_id);
create index idx_audit_timestamp on public.audit_logs(created_at);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.sites enable row level security;
alter table public.employees enable row level security;
alter table public.rate_cards enable row level security;
alter table public.parking_sessions enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- Allow authenticated users full access (app handles authorization)
create policy "Authenticated users can read sites" on public.sites for select to authenticated using (true);
create policy "Authenticated users can manage sites" on public.sites for all to authenticated using (true) with check (true);

create policy "Authenticated users can read employees" on public.employees for select to authenticated using (true);
create policy "Authenticated users can manage employees" on public.employees for all to authenticated using (true) with check (true);

create policy "Authenticated users can read rate_cards" on public.rate_cards for select to authenticated using (true);
create policy "Authenticated users can manage rate_cards" on public.rate_cards for all to authenticated using (true) with check (true);

create policy "Authenticated users can read sessions" on public.parking_sessions for select to authenticated using (true);
create policy "Authenticated users can manage sessions" on public.parking_sessions for all to authenticated using (true) with check (true);

create policy "Authenticated users can read payments" on public.payments for select to authenticated using (true);
create policy "Authenticated users can manage payments" on public.payments for all to authenticated using (true) with check (true);

create policy "Authenticated users can read audit_logs" on public.audit_logs for select to authenticated using (true);
create policy "Authenticated users can manage audit_logs" on public.audit_logs for all to authenticated using (true) with check (true);

-- ─── SEED DATA ──────────────────────────────────────────────
insert into public.sites (name, brand_name, address, city) values
  ('Sant Wamanbhau Parking', 'The East Palace', 'Near Bus Stand', 'Ahilyanagar');

-- Insert default rate cards (using the first site)
insert into public.rate_cards (site_id, vehicle_type, hourly_rate, daily_rate)
select s.id, v.vehicle_type, v.hourly_rate, v.daily_rate
from public.sites s
cross join (values
  ('TRAILOR', 4000, 50000),
  ('BODY_VEHICLE', 3000, 40000),
  ('EICHER', 2000, 30000)
) as v(vehicle_type, hourly_rate, daily_rate)
where s.name = 'Sant Wamanbhau Parking';
