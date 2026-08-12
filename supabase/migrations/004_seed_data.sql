-- Enterprise Multi-Tenant Seed Data

-- 1. Create a default enterprise tenant
INSERT INTO public.companies (id, name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Sant Wamanbhau Parking Ltd',
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- 2. Create default sites for the tenant
INSERT INTO public.sites (id, company_id, name, brand_name, address, city, state, timezone, total_slots, daily_revenue_target, created_at, updated_at)
VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'Main Gate Terminal',
    'Sant Wamanbhau Terminal 1',
    '123 Highway Road',
    'Mumbai',
    'Maharashtra',
    'Asia/Kolkata',
    500,
    150000,
    now(),
    now()
),
(
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'North Checkpost',
    'Sant Wamanbhau Terminal 2',
    '456 Northern Bypass',
    'Pune',
    'Maharashtra',
    'Asia/Kolkata',
    250,
    75000,
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- 3. Create default rate cards
INSERT INTO public.rate_cards (id, company_id, site_id, vehicle_type, hourly_rate, daily_rate, effective_from, created_at, updated_at)
VALUES 
-- Terminal 1 Rates
(gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'TRAILOR', 4000, 50000, now(), now(), now()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'BODY_VEHICLE', 3000, 40000, now(), now(), now()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'EICHER', 2000, 30000, now(), now(), now()),
-- Terminal 2 Rates (Slightly cheaper)
(gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'TRAILOR', 3500, 45000, now(), now(), now()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'BODY_VEHICLE', 2500, 35000, now(), now(), now()),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'EICHER', 1500, 25000, now(), now(), now());
