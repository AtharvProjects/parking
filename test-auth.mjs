import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fmnnqnuvbirzobwuevph.supabase.co',
  'sb_publishable_cnKSTHjEEMBPclSm5IJk3Q_5OXZDn9m'
);

async function test() {
  console.log("Checking companies");
  const { data: companies, error: e3 } = await supabase
    .from('companies')
    .select('*');
    
  console.log("Companies error:", e3);
  console.log("Companies data:", companies);
}

test();
