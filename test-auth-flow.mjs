import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  'https://fmnnqnuvbirzobwuevph.supabase.co',
  'sb_publishable_cnKSTHjEEMBPclSm5IJk3Q_5OXZDn9m'
);

async function testAuthLogic() {
  const authUserId = "dummy-auth-id-" + Date.now();
  const email = "farmsouza123@gmail.com";
  
  console.log("Starting debug...");
  
  // 1. Try to find existing employee
  console.log("1. Check existing employee by authUserId");
  const { data: emp, error: err1 } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('active', true)
    .maybeSingle();
  console.log("err1:", err1?.message, "data:", !!emp);
  
  // 2. Try to find by email
  console.log("2. Check existing employee by email");
  const { data: existingByEmail, error: err2 } = await supabase
    .from('employees')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  console.log("err2:", err2?.message, "data:", !!existingByEmail);
  
  if (existingByEmail) {
    console.log("Trying to update existing email...");
    const { data: updatedEmployee, error: err3 } = await supabase
      .from('employees')
      .update({ auth_user_id: authUserId, active: true })
      .eq('id', existingByEmail.id)
      .select()
      .single();
    console.log("err3:", err3?.message, "updated:", !!updatedEmployee);
    return;
  }
  
  // 3. Check if default company exists
  console.log("3. Check default company");
  const companyId = '00000000-0000-0000-0000-000000000000';
  const { data: company, error: err4 } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .maybeSingle();
  console.log("err4:", err4?.message, "company:", !!company);
  
  if (!company) {
    console.log("Trying to insert company...");
    const { error: err5 } = await supabase
      .from('companies')
      .insert({ id: companyId, name: 'Default Company' });
    console.log("err5 (insert company):", err5?.message || err5?.details || err5);
  }
  
  // 4. Check sites
  console.log("4. Check sites");
  let { data: sites, error: err6 } = await supabase
    .from('sites')
    .select('id')
    .limit(1)
    .maybeSingle();
  console.log("err6:", err6?.message, "sites:", !!sites);
  
  if (!sites) {
    console.log("Trying to insert site...");
    const siteId = crypto.randomUUID();
    const { error: siteError } = await supabase.from('sites').insert({
      id: siteId,
      company_id: companyId,
      name: 'Main Gate',
      address: 'Default Location',
      city: 'Default City',
      state: 'Default State',
      timezone: 'Asia/Kolkata',
      grace_period_minutes: 15,
      rounding_interval_min: 30,
      day_rate_switchover_hrs: 12,
      overstay_alert_hrs: 24,
      daily_revenue_target: 10000,
      total_slots: 100
    });
    console.log("siteError:", siteError?.message || siteError?.details || siteError);
    if (!siteError) sites = { id: siteId };
  }
  
  if (sites) {
    console.log("5. Insert employee...");
    const payload = {
      company_id: companyId,
      auth_user_id: authUserId,
      site_id: sites.id,
      name: email.split('@')[0],
      mobile: '0000000000',
      email,
      role: 'ADMIN',
    };
    const { data: newEmp, error: err7 } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();
    console.log("err7 (insert emp):", err7?.message || err7?.details || err7);
  }
}

testAuthLogic().catch(console.error);
