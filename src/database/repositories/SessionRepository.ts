import { getDB } from '@/database/connection';
import type { ParkingSession, SessionWithRelations, ActiveVehicle, VehicleType } from '@/lib/database.types';
import { differenceInMinutes } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { SyncQueue } from '@/sync/queue';
import { SyncEngine } from '@/sync/engine';
import { getLocalISOBounds } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';

export class SessionRepository {
  static async getActiveSessions(companyId: string, siteId?: string): Promise<ActiveVehicle[]> {
    const db = await getDB();
    
    let query = `
      SELECT s.*, e.name as entry_operator_name, st.overstay_alert_hrs
      FROM parking_sessions s
      LEFT JOIN employees e ON s.entry_operator_id = e.id
      LEFT JOIN sites st ON s.site_id = st.id
      WHERE s.status = 'ACTIVE' AND s.deleted_at IS NULL AND s.company_id = ?
    `;
    const params: any[] = [companyId];

    if (siteId && siteId !== 'ALL') {
      query += ` AND s.site_id = ?`;
      params.push(siteId);
    }
    
    query += ` ORDER BY s.entry_at DESC`;

    const result = await db.query(query, params);
    const now = new Date();
    
    const hydratedSessions = await Promise.all((result.values || []).map(async (s: any) => {
      const entryDate = new Date(s.entry_at);
      const elapsed = Math.max(0, differenceInMinutes(now, entryDate));
      
      let photos = s.vehicle_photos ? JSON.parse(s.vehicle_photos) : null;
      if (photos) {
        try {
          if (photos.front && !photos.front.startsWith('http') && !photos.front.startsWith('data:')) {
            const { uri } = await Filesystem.getUri({ path: photos.front, directory: Directory.Data });
            photos.front = Capacitor.convertFileSrc(uri);
          }
          if (photos.rear && !photos.rear.startsWith('http') && !photos.rear.startsWith('data:')) {
            const { uri } = await Filesystem.getUri({ path: photos.rear, directory: Directory.Data });
            photos.rear = Capacitor.convertFileSrc(uri);
          }
        } catch (e) {
          console.error("Failed to load local photos", e);
        }
      }

      return {
        id: s.id,
        vehicle_number: s.vehicle_number,
        vehicle_type: s.vehicle_type as VehicleType,
        driver_number: s.driver_number,
        notes: s.notes,
        entry_at: s.entry_at,
        entry_operator_name: s.entry_operator_name || 'Unknown',
        elapsed_minutes: elapsed,
        is_overstaying: elapsed >= (s.overstay_alert_hrs || 24) * 60,
        vehicle_photos: photos,
      };
    }));

    return hydratedSessions;
  }

  static async createEntry(data: {
    id: string; // generate UUID before calling
    company_id: string;
    site_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
    driver_number: string;
    notes?: string;
    vehicle_photos?: { front?: string; rear?: string };
    entry_operator_id: string;
    rate_card_id: string | null;
  }): Promise<ParkingSession> {
    const db = await getDB();
    const now = new Date().toISOString();
    
    // Check duplicates
    const check = await db.query(`
      SELECT id FROM parking_sessions 
      WHERE vehicle_number = ? AND status = 'ACTIVE' AND deleted_at IS NULL AND company_id = ?
    `, [data.vehicle_number, data.company_id]);
    
    if (check.values && check.values.length > 0) {
      throw new Error(`Vehicle ${data.vehicle_number} is already parked`);
    }

    // Handle photos via Filesystem to avoid bloated DB
    const finalPhotos: any = {};
    if (data.vehicle_photos) {
      const safeVehicleNum = data.vehicle_number.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (data.vehicle_photos.front) {
        const frontPath = `${safeVehicleNum}_${data.id}_front.jpg`;
        await Filesystem.writeFile({
          path: frontPath,
          data: data.vehicle_photos.front.replace(/^data:image\/[a-z]+;base64,/, ''),
          directory: Directory.Data,
        });
        finalPhotos.front = frontPath;
      }
      if (data.vehicle_photos.rear) {
        const rearPath = `${safeVehicleNum}_${data.id}_rear.jpg`;
        await Filesystem.writeFile({
          path: rearPath,
          data: data.vehicle_photos.rear.replace(/^data:image\/[a-z]+;base64,/, ''),
          directory: Directory.Data,
        });
        finalPhotos.rear = rearPath;
      }
    }

    const query = `
      INSERT INTO parking_sessions (
        id, company_id, site_id, vehicle_number, vehicle_type, driver_number, notes,
        vehicle_photos, entry_at, entry_operator_id, rate_card_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `;
    
    const params = [
      data.id, data.company_id, data.site_id, data.vehicle_number, data.vehicle_type,
      data.driver_number, data.notes || null, 
      Object.keys(finalPhotos).length > 0 ? JSON.stringify(finalPhotos) : null,
      now, data.entry_operator_id, data.rate_card_id, now, now
    ];

    await db.executeSet([{ statement: query, values: params }]);
    
    // Queue Sync Job
    await SyncQueue.enqueue('parking_sessions', 'INSERT', {
      ...data, vehicle_photos: finalPhotos, entry_at: now, status: 'ACTIVE', created_at: now, updated_at: now
    });
    
    // Trigger immediate background sync push
    SyncEngine.triggerPush().catch(() => {});

    return { ...data, vehicle_photos: finalPhotos, entry_at: now, status: 'ACTIVE', created_at: now, updated_at: now } as any;
  }

  static async processExit(
    companyId: string,
    sessionId: string,
    exitOperatorId: string,
    paymentMethod: 'CASH' | 'UPI' | 'CARD',
    grossAmount: number,
    durationMinutes: number,
    discountAmount = 0,
    transactionRef?: string,
  ): Promise<SessionWithRelations> {
    const db = await getDB();
    const now = new Date().toISOString();
    const finalAmount = Math.max(0, grossAmount - discountAmount);

    // Concurrency Check: Verify session is currently ACTIVE
    const check = await db.query(
      `SELECT status, exit_at FROM parking_sessions WHERE id = ? AND company_id = ?`,
      [sessionId, companyId]
    );
    if (!check.values || check.values.length === 0) {
      throw new Error("Parking session record not found.");
    }
    if (check.values[0].status === 'COMPLETED') {
      throw new Error("This vehicle has already been marked as exited by another operator.");
    }

    // Update Session atomically
    const updateSessionQuery = `
      UPDATE parking_sessions 
      SET exit_at = ?, exit_operator_id = ?, duration_minutes = ?, gross_amount = ?, status = 'COMPLETED', updated_at = ?
      WHERE id = ? AND company_id = ? AND status = 'ACTIVE'
    `;
    const sessionParams = [now, exitOperatorId, durationMinutes, grossAmount, now, sessionId, companyId];

    // Generate receipt number
    const dateStr = now.slice(0, 10).replace(/-/g, '');
    const countCheck = await db.query(`SELECT COUNT(*) as c FROM payments WHERE created_at >= ?`, [now.slice(0, 10)]);
    const count = countCheck.values?.[0]?.c || 0;
    const seq = String(count + 1).padStart(4, '0');
    const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const receiptNumber = `SWP-${dateStr}-${seq}-${shortId}`;

    // Create Payment
    const paymentId = crypto.randomUUID();
    const insertPaymentQuery = `
      INSERT INTO payments (
        id, session_id, status, method, amount, discount_amount, tax_amount, collected_by_id, collected_at, receipt_number, transaction_ref, created_at, updated_at
      ) VALUES (?, ?, 'PAID', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `;
    const paymentParams = [
      paymentId, sessionId, paymentMethod, finalAmount, discountAmount, exitOperatorId, now, receiptNumber, transactionRef || null, now, now
    ];

    await db.executeSet([
      { statement: updateSessionQuery, values: sessionParams },
      { statement: insertPaymentQuery, values: paymentParams }
    ]);

    await SyncQueue.enqueue('parking_sessions', 'UPDATE', { id: sessionId, exit_at: now, exit_operator_id: exitOperatorId, duration_minutes: durationMinutes, gross_amount: grossAmount, status: 'COMPLETED', updated_at: now });
    await SyncQueue.enqueue('payments', 'INSERT', { id: paymentId, session_id: sessionId, status: 'PAID', method: paymentMethod, amount: finalAmount, discount_amount: discountAmount, tax_amount: 0, collected_by_id: exitOperatorId, collected_at: now, receipt_number: receiptNumber, transaction_ref: transactionRef, created_at: now, updated_at: now });

    // Trigger immediate background sync push
    SyncEngine.triggerPush().catch(() => {});

    return this.getSession(companyId, sessionId) as any;
  }

  static async getSession(companyId: string, id: string): Promise<SessionWithRelations | null> {
    const db = await getDB();
    const result = await db.query(`
      SELECT s.*, 
             st.name as site_name,
             e1.name as entry_operator_name, e1.mobile as entry_operator_mobile,
             e2.name as exit_operator_name, e2.mobile as exit_operator_mobile,
             p.id as payment_id, p.amount, p.discount_amount, p.status as payment_status, p.receipt_number, p.method as payment_method
      FROM parking_sessions s
      LEFT JOIN sites st ON s.site_id = st.id
      LEFT JOIN employees e1 ON s.entry_operator_id = e1.id
      LEFT JOIN employees e2 ON s.exit_operator_id = e2.id
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.id = ? AND s.company_id = ?
    `, [id, companyId]);

    if (!result.values || result.values.length === 0) return null;
    
    const row = result.values[0];
    return {
      ...row,
      entry_operator: { name: row.entry_operator_name, mobile: row.entry_operator_mobile },
      exit_operator: row.exit_operator_name ? { name: row.exit_operator_name, mobile: row.exit_operator_mobile } : undefined,
      payment: row.payment_id ? [{ amount: row.amount, discount_amount: row.discount_amount || 0, status: row.payment_status, receipt_number: row.receipt_number, method: row.payment_method }] : []
    } as any;
  }

  static async deleteSession(companyId: string, id: string) {
    const db = await getDB();
    const now = new Date().toISOString();
    await db.executeSet([{
      statement: `UPDATE parking_sessions SET deleted_at = ?, status = 'CANCELLED', updated_at = ? WHERE id = ? AND company_id = ?`,
      values: [now, now, id, companyId]
    }]);
    await SyncQueue.enqueue('parking_sessions', 'UPDATE', { id, deleted_at: now, status: 'CANCELLED', updated_at: now });
  }

  static async searchSessions(companyId: string, queryText: string, siteId?: string, limit = 40) {
    const db = await getDB();
    const q = `%${queryText.trim()}%`;
    const isAllSites = !siteId || siteId === 'ALL';

    let queryStr = `
      SELECT s.*, 
             st.name as site_name,
             e1.name as entry_operator_name,
             e2.name as exit_operator_name,
             p.amount, p.discount_amount, p.status as payment_status, p.receipt_number, p.method as payment_method
      FROM parking_sessions s
      LEFT JOIN sites st ON s.site_id = st.id
      LEFT JOIN employees e1 ON s.entry_operator_id = e1.id
      LEFT JOIN employees e2 ON s.exit_operator_id = e2.id
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.company_id = ? AND s.deleted_at IS NULL 
        AND (s.vehicle_number LIKE ? OR s.driver_number LIKE ? OR p.receipt_number LIKE ? OR s.entry_at LIKE ?)
    `;
    const params: any[] = [companyId, q, q, q, q];

    if (!isAllSites) {
      queryStr += ` AND s.site_id = ?`;
      params.push(siteId);
    }

    queryStr += ` ORDER BY s.entry_at DESC LIMIT ?`;
    params.push(limit);

    const result = await db.query(queryStr, params);

    const hydratedSessions = await Promise.all((result.values || []).map(async (row: any) => {
      let photos = row.vehicle_photos ? (typeof row.vehicle_photos === 'string' ? JSON.parse(row.vehicle_photos) : row.vehicle_photos) : null;
      if (photos) {
        try {
          if (photos.front && !photos.front.startsWith('http') && !photos.front.startsWith('data:')) {
            const { uri } = await Filesystem.getUri({ path: photos.front, directory: Directory.Data });
            photos.front = Capacitor.convertFileSrc(uri);
          }
          if (photos.rear && !photos.rear.startsWith('http') && !photos.rear.startsWith('data:')) {
            const { uri } = await Filesystem.getUri({ path: photos.rear, directory: Directory.Data });
            photos.rear = Capacitor.convertFileSrc(uri);
          }
        } catch (e) {
          console.error("Failed to load local photos", e);
        }
      }

      return {
        ...row,
        vehicle_photos: photos,
        entry_operator: { name: row.entry_operator_name },
        exit_operator: row.exit_operator_name ? { name: row.exit_operator_name } : undefined,
        payment: row.amount !== null && row.amount !== undefined ? [{
          amount: row.amount,
          discount_amount: row.discount_amount || 0,
          status: row.payment_status,
          receipt_number: row.receipt_number,
          method: row.payment_method
        }] : []
      };
    }));

    return hydratedSessions;
  }


  static async getReports(companyId: string, startDate: string, endDate: string, siteId?: string) {
    const db = await getDB();
    const startISO = getLocalISOBounds(startDate, false);
    const endISO = getLocalISOBounds(endDate, true);

    // If online, sync the requested date range from Supabase into local SQLite
    if (typeof navigator !== 'undefined' && navigator.onLine && companyId) {
      try {
        let sbQuery = supabase
          .from('parking_sessions')
          .select('*, payments(*)')
          .eq('company_id', companyId)
          .gte('entry_at', startISO)
          .lte('entry_at', endISO)
          .is('deleted_at', null);

        if (siteId && siteId !== 'ALL') {
          sbQuery = sbQuery.eq('site_id', siteId);
        }

        const { data: remoteSessions, error } = await sbQuery;

        if (!error && remoteSessions && remoteSessions.length > 0) {
          const sessionStmts: any[] = [];
          const paymentStmts: any[] = [];

          for (const s of remoteSessions) {
            sessionStmts.push({
              statement: `
                INSERT INTO parking_sessions (
                  id, company_id, site_id, vehicle_number, vehicle_type, driver_number, 
                  notes, vehicle_photos, entry_at, entry_operator_id, rate_card_id, 
                  status, created_at, updated_at, exit_at, exit_operator_id, 
                  duration_minutes, gross_amount, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                  status=excluded.status, 
                  updated_at=excluded.updated_at,
                  exit_at=excluded.exit_at,
                  exit_operator_id=excluded.exit_operator_id,
                  duration_minutes=excluded.duration_minutes,
                  gross_amount=excluded.gross_amount,
                  deleted_at=excluded.deleted_at
              `,
              values: [
                s.id, s.company_id, s.site_id, s.vehicle_number, s.vehicle_type, s.driver_number,
                s.notes, s.vehicle_photos ? JSON.stringify(s.vehicle_photos) : null,
                s.entry_at, s.entry_operator_id, s.rate_card_id, s.status,
                s.created_at, s.updated_at, s.exit_at, s.exit_operator_id,
                s.duration_minutes, s.gross_amount, s.deleted_at || null
              ]
            });

            const payments = Array.isArray(s.payments) ? s.payments : (s.payments ? [s.payments] : []);
            for (const p of payments) {
              paymentStmts.push({
                statement: `
                  INSERT INTO payments (
                    id, session_id, status, method, amount, discount_amount, tax_amount, 
                    collected_by_id, collected_at, receipt_number, transaction_ref, 
                    created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET 
                    status=excluded.status, amount=excluded.amount, discount_amount=excluded.discount_amount, 
                    collected_by_id=excluded.collected_by_id, collected_at=excluded.collected_at, 
                    updated_at=excluded.updated_at
                `,
                values: [
                  p.id, p.session_id, p.status, p.method, p.amount, p.discount_amount, p.tax_amount,
                  p.collected_by_id, p.collected_at, p.receipt_number, p.transaction_ref,
                  p.created_at, p.updated_at
                ]
              });
            }
          }

          if (sessionStmts.length > 0) await db.executeSet(sessionStmts);
          if (paymentStmts.length > 0) await db.executeSet(paymentStmts);
        }
      } catch (err) {
        console.warn('Could not sync remote reports data, falling back to local SQLite:', err);
      }
    }

    let query = `
      SELECT s.*, 
             st.name as site_name,
             e1.name as entry_operator_name, e1.mobile as entry_operator_mobile, e1.shift as entry_operator_shift,
             e2.name as exit_operator_name, e2.mobile as exit_operator_mobile, e2.shift as exit_operator_shift,
             p.amount as payment_amount, p.discount_amount as payment_discount_amount,
             p.status as payment_status, p.receipt_number, p.method as payment_method,
             p.collected_by_id, p.collected_at
      FROM parking_sessions s
      LEFT JOIN sites st ON s.site_id = st.id
      LEFT JOIN employees e1 ON s.entry_operator_id = e1.id
      LEFT JOIN employees e2 ON s.exit_operator_id = e2.id
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.company_id = ? AND s.deleted_at IS NULL
        AND s.entry_at >= ? AND s.entry_at <= ?
    `;
    const params: any[] = [companyId, startISO, endISO];

    if (siteId && siteId !== 'ALL') {
      query += ` AND s.site_id = ?`;
      params.push(siteId);
    }
    
    query += ` ORDER BY s.entry_at DESC`;

    const result = await db.query(query, params);
    
    return (result.values || []).map((row: any) => ({
      ...row,
      entry_operator: {
        name: row.entry_operator_name,
        mobile: row.entry_operator_mobile,
        shift: row.entry_operator_shift,
      },
      exit_operator: row.exit_operator_name ? {
        name: row.exit_operator_name,
        mobile: row.exit_operator_mobile,
        shift: row.exit_operator_shift,
      } : undefined,
      payment: (row.payment_amount !== null && row.payment_amount !== undefined) ? [{
        amount: row.payment_amount,
        discount_amount: row.payment_discount_amount || 0,
        status: row.payment_status,
        receipt_number: row.receipt_number,
        method: row.payment_method,
        collected_by_id: row.collected_by_id,
        collected_at: row.collected_at,
      }] : []
    }));
  }
}

