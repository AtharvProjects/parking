import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fmnnqnuvbirzobwuevph.supabase.co',
  'sb_publishable_cnKSTHjEEMBPclSm5IJk3Q_5OXZDn9m'
);

async function test() {
  const { data, error } = await supabase
    .from("parking_sessions")
    .select(`
      *,
      *,
      payment:payments(amount, method)
    `)
    .limit(1);
    
  console.log("Error:", error);
  console.log("Data:", data);
}

test();
