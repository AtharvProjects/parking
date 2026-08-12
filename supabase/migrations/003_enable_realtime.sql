-- Enable Realtime for all tables
-- This ensures that the client receives postgres_changes events

begin;
  -- The publication supabase_realtime usually exists in Supabase projects.
  
  -- Add tables to the publication
  alter publication supabase_realtime add table public.companies;
  alter publication supabase_realtime add table public.sites;
  alter publication supabase_realtime add table public.employees;
  alter publication supabase_realtime add table public.rate_cards;
  alter publication supabase_realtime add table public.parking_sessions;
  alter publication supabase_realtime add table public.payments;
  
  -- Add missing column to sites table that was added in local SQLite
  alter table public.sites add column if not exists contact_number text;
commit;
