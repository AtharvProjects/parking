-- ==============================================================================
-- 009_PRODUCTION_CLEAN_WIPE.SQL
-- Production Ready Cleanup & Fresh State Initialization for Sant Wamanbhau Parking
-- ==============================================================================

-- 1. Wipe all test parking sessions and transactions
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.parking_sessions CASCADE;
TRUNCATE TABLE public.staff_attendance CASCADE;
TRUNCATE TABLE public.staff_transactions CASCADE;

-- 2. Clean up test / mock rate cards
DELETE FROM public.rate_cards;

-- 3. Clean up test / mock employees (except verified admin accounts if any)
DELETE FROM public.employees WHERE email IS NULL OR email LIKE '%test%' OR email LIKE '%dummy%';

-- 4. Clean up test / mock sites
DELETE FROM public.sites WHERE name LIKE '%Test%' OR name LIKE '%Checkpost%' OR name LIKE '%Terminal 2%';

-- 5. Ensure official tenant company exists
INSERT INTO public.companies (id, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Sant Wamanbhau Parking',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE 
SET name = 'Sant Wamanbhau Parking', updated_at = now();

-- 6. Ensure official primary parking site exists
INSERT INTO public.sites (
  id,
  company_id,
  name,
  brand_name,
  address,
  city,
  state,
  timezone,
  grace_period_minutes,
  rounding_interval_min,
  day_rate_switchover_hrs,
  overstay_alert_hrs,
  daily_revenue_target,
  total_slots,
  contact_number,
  created_at,
  updated_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'Main Gate Terminal',
  'Sant Wamanbhau Parking',
  'Main Terminal, Ahilyanagar',
  'Ahilyanagar',
  'Maharashtra',
  'Asia/Kolkata',
  15,
  30,
  12,
  24,
  10000,
  100,
  '+91 96998 86899',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Main Gate Terminal',
  brand_name = 'Sant Wamanbhau Parking',
  city = 'Ahilyanagar',
  state = 'Maharashtra',
  contact_number = '+91 96998 86899',
  updated_at = now();

-- 7. Initialize standard official rate cards
INSERT INTO public.rate_cards (
  id,
  company_id,
  site_id,
  vehicle_type,
  hourly_rate,
  daily_rate,
  effective_from,
  effective_to,
  created_at,
  updated_at
)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'TRAILOR', 4000, 50000, now(), NULL, now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'BODY_VEHICLE', 3000, 40000, now(), NULL, now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'EICHER', 2000, 30000, now(), NULL, now(), now());

-- 8. Ensure Primary Admin Account exists
INSERT INTO public.employees (
  id,
  company_id,
  site_id,
  name,
  mobile,
  email,
  role,
  pin,
  active,
  base_salary,
  salary_type,
  designation,
  joining_date,
  created_at,
  updated_at
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'Admin',
  '9699886899',
  'admin@santwamanbhau.com',
  'ADMIN',
  '1234',
  true,
  25000,
  'MONTHLY',
  'System Administrator',
  CURRENT_DATE,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Admin',
  mobile = '9699886899',
  email = 'admin@santwamanbhau.com',
  role = 'ADMIN',
  pin = '1234',
  active = true,
  updated_at = now();

-- 9. Refresh schema cache
NOTIFY pgrst, 'reload schema';
