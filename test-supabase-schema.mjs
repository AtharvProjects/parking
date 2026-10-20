import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fmnnqnuvbirzobwuevph.supabase.co',
  'sb_publishable_cnKSTHjEEMBPclSm5IJk3Q_5OXZDn9m'
);

async function testSchema() {
  console.log("Checking parking_sessions...");
  const { data: ps, error: psErr } = await supabase.from('parking_sessions').select('*').limit(1);
  console.log("parking_sessions sample:", ps ? Object.keys(ps[0] || {}) : "empty", "error:", psErr?.message);

  console.log("\nChecking employees...");
  const { data: emps, error: empErr } = await supabase.from('employees').select('*').limit(1);
  console.log("employees sample:", emps ? Object.keys(emps[0] || {}) : "empty", "error:", empErr?.message);

  console.log("\nChecking staff_attendance...");
  const { data: sa, error: saErr } = await supabase.from('staff_attendance').select('*').limit(1);
  console.log("staff_attendance:", sa ? Object.keys(sa[0] || {}) : "none", "error:", saErr?.message);

  console.log("\nChecking staff_transactions...");
  const { data: st, error: stErr } = await supabase.from('staff_transactions').select('*').limit(1);
  console.log("staff_transactions:", st ? Object.keys(st[0] || {}) : "none", "error:", stErr?.message);
}

testSchema().catch(console.error);
