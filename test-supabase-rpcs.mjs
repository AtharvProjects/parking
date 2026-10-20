import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fmnnqnuvbirzobwuevph.supabase.co',
  'sb_publishable_cnKSTHjEEMBPclSm5IJk3Q_5OXZDn9m'
);

async function testRpcs() {
  const rpcs = ['exec_sql', 'execute_sql', 'exec', 'run_sql', 'rpc_execute_sql', 'query'];
  for (const r of rpcs) {
    const { data, error } = await supabase.rpc(r, { sql: 'SELECT 1;' });
    console.log(`RPC ${r}:`, error?.message);
  }
}

testRpcs().catch(console.error);
