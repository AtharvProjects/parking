import { getDB } from '@/database/connection';
import { supabase } from '@/lib/supabase';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { SyncQueue } from './queue';

export class SyncEngine {
  static syncInterval: any = null;
  static activeChannel: any = null;
  static isPushing: boolean = false;
  static isPulling: boolean = false;
  static lastSyncKey = 'last_sync_at';

  static async pushSync() {
    if (this.isPushing) return;
    this.isPushing = true;
    try {
      const db = await getDB();
      
      // Get pending jobs
      const result = await db.query(`SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY created_at ASC`);
      const jobs = result.values || [];

      for (const job of jobs) {
        try {
          let payload = JSON.parse(job.payload);

          // Upload images to Supabase Storage before syncing to DB
          if (job.table_name === 'parking_sessions' && payload.vehicle_photos) {
            const photos = typeof payload.vehicle_photos === 'string' ? JSON.parse(payload.vehicle_photos) : payload.vehicle_photos;
            const updatedPhotos = { ...photos };
            let photosChanged = false;
            
            for (const key of ['front', 'rear']) {
              if (photos[key] && !photos[key].startsWith('http')) {
                try {
                  const file = await Filesystem.readFile({ path: photos[key], directory: Directory.Data });
                  const base64Response = await fetch(`data:image/jpeg;base64,${file.data}`);
                  const blob = await base64Response.blob();
                  
                  const path = `${payload.company_id}/${payload.site_id}/${photos[key]}`;
                  const { data, error } = await supabase.storage.from('parking_assets').upload(path, blob, {
                    upsert: true,
                    contentType: 'image/jpeg'
                  });
                  
                  if (!error && data) {
                    const { data: urlData } = await supabase.storage.from('parking_assets').createSignedUrl(path, 315360000); // 10 years
                    if (urlData) {
                      updatedPhotos[key] = urlData.signedUrl;
                      photosChanged = true;
                    }
                  }
                } catch (e) {
                  console.error(`Failed to upload ${key} photo to Supabase`, e);
                }
              }
            }
            
            if (photosChanged) {
              payload.vehicle_photos = updatedPhotos;
            }
          }

          if (job.operation === 'INSERT') {
            // @ts-ignore
            let { error } = await supabase.from(job.table_name).insert(payload);
            if (error && (error.message?.includes('driver_name') || error.message?.includes('base_salary') || (error as any).code === 'PGRST204')) {
              const fallback = { ...payload };
              delete fallback.driver_name;
              delete fallback.base_salary;
              delete fallback.salary_type;
              delete fallback.designation;
              delete fallback.joining_date;
              // @ts-ignore
              const res = await supabase.from(job.table_name).insert(fallback);
              error = res.error;
            }
            // 23505 is PostgreSQL unique constraint violation (duplicate primary key). 
            // If it already exists, consider it a successful sync.
            if (error && error.code !== '23505') throw error;
          } else if (job.operation === 'UPDATE') {
            // @ts-ignore
            let { error } = await supabase.from(job.table_name).update(payload).eq('id', payload.id);
            if (error && (error.message?.includes('driver_name') || error.message?.includes('base_salary') || (error as any).code === 'PGRST204')) {
              const fallback = { ...payload };
              delete fallback.driver_name;
              delete fallback.base_salary;
              delete fallback.salary_type;
              delete fallback.designation;
              delete fallback.joining_date;
              // @ts-ignore
              const res = await supabase.from(job.table_name).update(fallback).eq('id', payload.id);
              error = res.error;
            }
            if (error) throw error;
          }
        
          // Mark complete
          await db.executeSet([{
            statement: `UPDATE sync_queue SET status = 'COMPLETED' WHERE id = ?`,
            values: [job.id]
          }]);

        } catch (error: any) {
          console.error(`Sync Job Failed for ${job.table_name} ${job.operation}`, error);
          await db.executeSet([{
            statement: `UPDATE sync_queue SET retry_count = retry_count + 1, status = CASE WHEN retry_count >= 5 THEN 'FAILED' ELSE 'PENDING' END WHERE id = ?`,
            values: [job.id]
          }]);
        }
      }
      
      // Cleanup old queue jobs
      await SyncQueue.cleanup();
      
    } finally {
      this.isPushing = false;
    }
  }

  static async pullSync(companyId: string) {
    if (this.isPulling) return;
    this.isPulling = true;
    
    const db = await getDB();
    const lastSyncAt = typeof window !== 'undefined' ? localStorage.getItem(this.lastSyncKey) : null;
    let nextSyncAt = lastSyncAt;
    
    let tablesChanged = new Set<string>();

    try {
      // 1. Pull Sites
      try {
        let siteQuery = supabase.from('sites').select('*').eq('company_id', companyId);
        if (lastSyncAt) siteQuery = siteQuery.gt('updated_at', lastSyncAt);
        const { data: sites } = await siteQuery;
        
        if (sites && sites.length > 0) {
          tablesChanged.add('sites');
          const stmts = sites.map(site => ({
            statement: `
              INSERT INTO sites (id, company_id, name, brand_name, address, city, state, timezone, grace_period_minutes, rounding_interval_min, day_rate_switchover_hrs, overstay_alert_hrs, daily_revenue_target, total_slots, contact_number, created_at, updated_at, deleted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, brand_name=excluded.brand_name, address=excluded.address,
                city=excluded.city, state=excluded.state, timezone=excluded.timezone,
                grace_period_minutes=excluded.grace_period_minutes, rounding_interval_min=excluded.rounding_interval_min,
                day_rate_switchover_hrs=excluded.day_rate_switchover_hrs, overstay_alert_hrs=excluded.overstay_alert_hrs,
                daily_revenue_target=excluded.daily_revenue_target, total_slots=excluded.total_slots,
                contact_number=excluded.contact_number, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at
            `,
            values: [site.id, site.company_id, site.name, site.brand_name, site.address, site.city, site.state, site.timezone, site.grace_period_minutes, site.rounding_interval_min, site.day_rate_switchover_hrs, site.overstay_alert_hrs, site.daily_revenue_target, site.total_slots, site.contact_number || null, site.created_at, site.updated_at, site.deleted_at || null]
          }));
          await db.executeSet(stmts);
          sites.forEach((r: any) => { if (!nextSyncAt || r.updated_at > nextSyncAt) nextSyncAt = r.updated_at; });
        }
      } catch (e) {
        console.warn('Pull sites error:', e);
      }

      // 2. Pull Rate Cards
      try {
        let rateQuery = supabase.from('rate_cards').select('*').eq('company_id', companyId);
        if (lastSyncAt) rateQuery = rateQuery.gt('updated_at', lastSyncAt);
        const { data: rates } = await rateQuery;
        
        if (rates && rates.length > 0) {
          tablesChanged.add('rate_cards');
          const stmts = rates.map(rate => ({
            statement: `
              INSERT INTO rate_cards (id, company_id, site_id, vehicle_type, hourly_rate, daily_rate, effective_from, effective_to, created_at, updated_at, deleted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                vehicle_type=excluded.vehicle_type, hourly_rate=excluded.hourly_rate,
                daily_rate=excluded.daily_rate, effective_from=excluded.effective_from,
                effective_to=excluded.effective_to, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at
            `,
            values: [rate.id, rate.company_id, rate.site_id, rate.vehicle_type, rate.hourly_rate, rate.daily_rate, rate.effective_from, rate.effective_to || null, rate.created_at, rate.updated_at, (rate as any).deleted_at || null]
          }));
          await db.executeSet(stmts);
          rates.forEach((r: any) => { if (!nextSyncAt || r.updated_at > nextSyncAt) nextSyncAt = r.updated_at; });
        }
      } catch (e) {
        console.warn('Pull rates error:', e);
      }

      // 3. Pull Employees
      try {
        let empQuery = supabase.from('employees').select('*').eq('company_id', companyId);
        if (lastSyncAt) empQuery = empQuery.gt('updated_at', lastSyncAt);
        const { data: employees } = await empQuery;
        
        if (employees && employees.length > 0) {
          tablesChanged.add('employees');
          const stmts = employees.map(emp => ({
            statement: `
              INSERT INTO employees (id, company_id, site_id, auth_user_id, name, mobile, email, role, shift, active, pin, base_salary, salary_type, designation, joining_date, created_at, updated_at, deleted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                site_id=excluded.site_id, auth_user_id=excluded.auth_user_id, name=excluded.name,
                mobile=excluded.mobile, email=excluded.email, role=excluded.role, shift=excluded.shift,
                active=excluded.active, pin=excluded.pin, base_salary=excluded.base_salary,
                salary_type=excluded.salary_type, designation=excluded.designation,
                joining_date=excluded.joining_date, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at
            `,
            values: [
              emp.id, emp.company_id, emp.site_id || null, emp.auth_user_id || null, emp.name, emp.mobile,
              emp.email || null, emp.role, emp.shift || null, emp.active ? 1 : 0, emp.pin || null,
              emp.base_salary || 0, emp.salary_type || 'MONTHLY', emp.designation || null, emp.joining_date || null,
              emp.created_at, emp.updated_at, emp.deleted_at || null
            ]
          }));
          await db.executeSet(stmts);
          employees.forEach((r: any) => { if (!nextSyncAt || r.updated_at > nextSyncAt) nextSyncAt = r.updated_at; });
        }
      } catch (e) {
        console.warn('Pull employees error:', e);
      }

      // 4. Pull Active Sessions and recently updated sessions
      try {
        let sessionQuery = supabase.from('parking_sessions').select('*').eq('company_id', companyId);
        if (lastSyncAt) {
          sessionQuery = sessionQuery.gt('updated_at', lastSyncAt);
        } else {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          sessionQuery = sessionQuery.or(`status.eq.ACTIVE,updated_at.gte.${yesterday}`);
        }
        
        const { data: sessions } = await sessionQuery;
          
        if (sessions && sessions.length > 0) {
          tablesChanged.add('parking_sessions');
          const stmts = sessions.map(s => ({
            statement: `
              INSERT INTO parking_sessions (id, company_id, site_id, vehicle_number, vehicle_type, driver_number, driver_name, notes, vehicle_photos, entry_at, entry_operator_id, rate_card_id, status, created_at, updated_at, exit_at, exit_operator_id, duration_minutes, gross_amount, deleted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET 
                status=excluded.status, 
                driver_name=excluded.driver_name,
                updated_at=excluded.updated_at,
                exit_at=excluded.exit_at,
                exit_operator_id=excluded.exit_operator_id,
                duration_minutes=excluded.duration_minutes,
                gross_amount=excluded.gross_amount,
                deleted_at=excluded.deleted_at
            `,
            values: [
              s.id, s.company_id, s.site_id, s.vehicle_number, s.vehicle_type, s.driver_number, s.driver_name || null,
              s.notes, s.vehicle_photos ? JSON.stringify(s.vehicle_photos) : null, s.entry_at, s.entry_operator_id,
              s.rate_card_id, s.status, s.created_at, s.updated_at, s.exit_at, s.exit_operator_id,
              s.duration_minutes, s.gross_amount, s.deleted_at || null
            ]
          }));
          await db.executeSet(stmts);
          
          // 5. Pull Payments for these sessions
          const sessionIds = sessions.map((s: any) => s.id);
          const chunkSize = 100;
          let pStmts: any[] = [];
          for (let i = 0; i < sessionIds.length; i += chunkSize) {
            const chunk = sessionIds.slice(i, i + chunkSize);
            const { data: payments } = await supabase.from('payments').select('*').in('session_id', chunk);
            if (payments && payments.length > 0) {
              tablesChanged.add('payments');
              pStmts.push(...payments.map(p => ({
                statement: `
                  INSERT INTO payments (id, session_id, status, method, amount, discount_amount, tax_amount, collected_by_id, collected_at, receipt_number, transaction_ref, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET 
                    status=excluded.status, amount=excluded.amount, discount_amount=excluded.discount_amount, 
                    collected_by_id=excluded.collected_by_id, collected_at=excluded.collected_at, updated_at=excluded.updated_at
                `,
                values: [p.id, p.session_id, p.status, p.method, p.amount, p.discount_amount, p.tax_amount, p.collected_by_id, p.collected_at, p.receipt_number, p.transaction_ref, p.created_at, p.updated_at]
              })));
            }
          }
          if (pStmts.length > 0) {
            await db.executeSet(pStmts);
          }
          
          sessions.forEach((r: any) => { if (!nextSyncAt || r.updated_at > nextSyncAt) nextSyncAt = r.updated_at; });
        }
      } catch (e) {
        console.warn('Pull sessions error:', e);
      }

      // 6. Pull Staff Attendance
      try {
        let attendanceQuery = supabase.from('staff_attendance').select('*').eq('company_id', companyId);
        if (lastSyncAt) attendanceQuery = attendanceQuery.gt('updated_at', lastSyncAt);
        const { data: attendanceData } = await attendanceQuery;
        if (attendanceData && attendanceData.length > 0) {
          tablesChanged.add('staff_attendance');
          const stmts = attendanceData.map((att: any) => ({
            statement: `
              INSERT INTO staff_attendance (id, company_id, site_id, employee_id, date, status, check_in, check_out, shift, notes, marked_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(employee_id, date) DO UPDATE SET
                status=excluded.status, check_in=excluded.check_in, check_out=excluded.check_out,
                shift=excluded.shift, notes=excluded.notes, marked_by=excluded.marked_by, updated_at=excluded.updated_at
            `,
            values: [att.id, att.company_id, att.site_id, att.employee_id, att.date, att.status, att.check_in, att.check_out, att.shift, att.notes, att.marked_by, att.created_at, att.updated_at]
          }));
          await db.executeSet(stmts);
          attendanceData.forEach((r: any) => { if (!nextSyncAt || r.updated_at > nextSyncAt) nextSyncAt = r.updated_at; });
        }
      } catch (e) {
        console.warn('Pull attendance error:', e);
      }

      // 7. Pull Staff Transactions
      try {
        let txQuery = supabase.from('staff_transactions').select('*').eq('company_id', companyId);
        if (lastSyncAt) txQuery = txQuery.gt('updated_at', lastSyncAt);
        const { data: txData } = await txQuery;
        if (txData && txData.length > 0) {
          tablesChanged.add('staff_transactions');
          const stmts = txData.map((tx: any) => ({
            statement: `
              INSERT INTO staff_transactions (id, company_id, site_id, employee_id, type, amount, payment_date, payment_method, month, notes, transaction_ref, recorded_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                type=excluded.type, amount=excluded.amount, payment_date=excluded.payment_date,
                payment_method=excluded.payment_method, month=excluded.month, notes=excluded.notes,
                transaction_ref=excluded.transaction_ref, updated_at=excluded.updated_at
            `,
            values: [tx.id, tx.company_id, tx.site_id, tx.employee_id, tx.type, tx.amount, tx.payment_date, tx.payment_method, tx.month, tx.notes, tx.transaction_ref, tx.recorded_by, tx.created_at, tx.updated_at]
          }));
          await db.executeSet(stmts);
          txData.forEach((r: any) => { if (!nextSyncAt || r.updated_at > nextSyncAt) nextSyncAt = r.updated_at; });
        }
      } catch (e) {
        console.warn('Pull transactions error:', e);
      }

      // Update last sync time on success
      if (nextSyncAt && nextSyncAt !== lastSyncAt && typeof window !== 'undefined') {
        localStorage.setItem(this.lastSyncKey, nextSyncAt);
      }

    } catch (err: any) {
      console.error('Pull sync failed', err);
    } finally {
      this.isPulling = false;
      if (tablesChanged.size > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync_completed', { 
          detail: { tables: Array.from(tablesChanged) } 
        }));
      }
    }
  }

  static startRealtimeSubscription(companyId: string) {
    const channelName = `public:parking_sessions:company_id=eq.${companyId}`;
    
    if (this.activeChannel) {
      supabase.removeChannel(this.activeChannel);
    }
    
    const channels = supabase.getChannels();
    const existing = channels.find(c => c.topic.includes(channelName));
    if (existing) {
      supabase.removeChannel(existing);
    }

    this.activeChannel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_sessions', filter: `company_id=eq.${companyId}` }, () => {
        this.pullSync(companyId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites', filter: `company_id=eq.${companyId}` }, () => {
        this.pullSync(companyId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rate_cards', filter: `company_id=eq.${companyId}` }, () => {
        this.pullSync(companyId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees', filter: `company_id=eq.${companyId}` }, () => {
        this.pullSync(companyId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        this.pullSync(companyId);
      })
      .subscribe();
  }


  static stopBackgroundSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.activeChannel) {
      supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
    }
  }

  static startBackgroundSync(companyId: string) {
    this.stopBackgroundSync();

    this.syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        await this.pushSync();
        await this.pullSync(companyId);
      }
    }, 60000); // every 60 seconds

    this.startRealtimeSubscription(companyId);

    // Run initial sync on startup
    if (navigator.onLine) {
      setTimeout(() => {
        this.pushSync().then(() => this.pullSync(companyId));
      }, 1000);
    }
  }

  static async triggerPush() {
    if (navigator.onLine) {
      await this.pushSync();
    }
  }
}
