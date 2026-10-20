import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fmnnqnuvbirzobwuevph.supabase.co',
  'sb_publishable_cnKSTHjEEMBPclSm5IJk3Q_5OXZDn9m'
);

async function testKnownRpcs() {
  const rpcs = [
    'rpc_vehicle_entry',
    'rpc_vehicle_exit',
    'rpc_get_active_sessions',
    'rpc_search_sessions',
    'rpc_get_dashboard_stats',
  ];
  for (const r of rpcs) {
    const { data, error } = await supabase.rpc(r, {});
    console.log(`RPC ${r}:`, error?.message || "Success/Params needed");
  }
}

testKnownRpcs().catch(console.error);
