import { getDB } from '@/database/connection';
import type { RateCard, VehicleType } from '@/lib/database.types';
import { SyncQueue } from '@/sync/queue';

export class RateRepository {
  static async getActiveRates(companyId: string, siteId: string): Promise<RateCard[]> {
    const db = await getDB();
    const result = await db.query(`
      SELECT * FROM rate_cards 
      WHERE company_id = ? AND site_id = ? AND effective_to IS NULL
    `, [companyId, siteId]);
    
    return result.values as RateCard[];
  }

  static async createRate(companyId: string, siteId: string, data: any, createdById: string) {
    const db = await getDB();
    const now = new Date().toISOString();
    
    // 1. Deprecate the old active rate for this vehicle type
    const checkQuery = await db.query(
      `SELECT id FROM rate_cards WHERE company_id = ? AND site_id = ? AND vehicle_type = ? AND effective_to IS NULL`, 
      [companyId, siteId, data.vehicle_type]
    );
    
    const oldId = checkQuery.values?.[0]?.id;
    if (oldId) {
      await db.executeSet([{ 
        statement: `UPDATE rate_cards SET effective_to = ?, updated_at = ? WHERE id = ?`, 
        values: [now, now, oldId] 
      }]);
      await SyncQueue.enqueue('rate_cards', 'UPDATE', { id: oldId, effective_to: now, updated_at: now });
    }
    
    // 2. Insert the new active rate
    const newId = crypto.randomUUID();
    const effectiveFrom = data.effective_from || now;
    
    await db.executeSet([{ 
      statement: `
        INSERT INTO rate_cards (id, company_id, site_id, vehicle_type, hourly_rate, daily_rate, effective_from, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, 
      values: [newId, companyId, siteId, data.vehicle_type, data.hourly_rate, data.daily_rate, effectiveFrom, createdById, now, now] 
    }]);
    
    await SyncQueue.enqueue('rate_cards', 'INSERT', { 
      id: newId, 
      company_id: companyId, 
      site_id: siteId, 
      vehicle_type: data.vehicle_type, 
      hourly_rate: data.hourly_rate, 
      daily_rate: data.daily_rate, 
      effective_from: effectiveFrom, 
      created_by: createdById, 
      created_at: now, 
      updated_at: now 
    });
  }

}
