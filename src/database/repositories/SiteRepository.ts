import { getDB } from '@/database/connection';
import type { Site } from '@/lib/database.types';
import { SyncQueue } from '@/sync/queue';

export class SiteRepository {
  static async getSites(companyId: string): Promise<Site[]> {
    const db = await getDB();
    const result = await db.query(`SELECT * FROM sites WHERE company_id = ? AND deleted_at IS NULL ORDER BY name ASC`, [companyId]);
    return result.values as Site[];
  }

  static async getAuthorizedSites(companyId: string, employeeId: string, role: string, defaultSiteId: string): Promise<Site[]> {
    const db = await getDB();
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER';
    
    if (isAdmin) {
      const result = await db.query(`
        SELECT * FROM sites WHERE company_id = ? AND deleted_at IS NULL ORDER BY name ASC
      `, [companyId]);
      return (result.values || []) as Site[];
    }

    const result = await db.query(`
      SELECT DISTINCT s.* FROM sites s
      LEFT JOIN employee_sites es ON s.id = es.site_id
      WHERE s.company_id = ? AND s.deleted_at IS NULL AND (s.id = ? OR es.employee_id = ?)
      ORDER BY s.name ASC
    `, [companyId, defaultSiteId, employeeId]);

    if (!result.values || result.values.length === 0) {
      const fallback = await db.query(`SELECT * FROM sites WHERE id = ? AND deleted_at IS NULL`, [defaultSiteId]);
      return (fallback.values || []) as Site[];
    }

    return (result.values || []) as Site[];
  }


  static async getById(companyId: string, siteId: string): Promise<Site | null> {
    const db = await getDB();
    const result = await db.query(`SELECT * FROM sites WHERE id = ? AND company_id = ? AND deleted_at IS NULL`, [siteId, companyId]);
    if (!result.values || result.values.length === 0) return null;
    return result.values[0] as Site;
  }

  static async create(companyId: string, data: {
    name: string;
    brand_name?: string;
    address?: string;
    city?: string;
    state?: string;
    total_slots?: number;
    grace_period_minutes?: number;
    rounding_interval_min?: number;
    day_rate_switchover_hrs?: number;
    overstay_alert_hrs?: number;
    daily_revenue_target?: number;
    contact_number?: string;
  }): Promise<Site> {
    const db = await getDB();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const site: any = {
      id,
      company_id: companyId,
      name: data.name,
      brand_name: data.brand_name || null,
      address: data.address || '',
      city: data.city || '',
      state: data.state || 'Maharashtra',
      timezone: 'Asia/Kolkata',
      grace_period_minutes: data.grace_period_minutes ?? 15,
      rounding_interval_min: data.rounding_interval_min ?? 30,
      day_rate_switchover_hrs: data.day_rate_switchover_hrs ?? 12,
      overstay_alert_hrs: data.overstay_alert_hrs ?? 24,
      daily_revenue_target: data.daily_revenue_target ?? 10000,
      total_slots: data.total_slots ?? 100,
      contact_number: data.contact_number || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    };

    const query = `
      INSERT INTO sites (id, company_id, name, brand_name, address, city, state, timezone, grace_period_minutes, rounding_interval_min, day_rate_switchover_hrs, overstay_alert_hrs, daily_revenue_target, total_slots, contact_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      site.id, site.company_id, site.name, site.brand_name, site.address,
      site.city, site.state, site.timezone, site.grace_period_minutes,
      site.rounding_interval_min, site.day_rate_switchover_hrs, site.overstay_alert_hrs,
      site.daily_revenue_target, site.total_slots, site.contact_number, site.created_at, site.updated_at
    ];

    await db.executeSet([{ statement: query, values: params }]);
    await SyncQueue.enqueue('sites', 'INSERT', site);

    return site as Site;
  }

  static async update(companyId: string, siteId: string, data: Partial<Site>) {
    const db = await getDB();
    const now = new Date().toISOString();
    const allowedFields = [
      'name', 'brand_name', 'address', 'city', 'state', 'contact_number',
      'total_slots', 'grace_period_minutes', 'rounding_interval_min',
      'day_rate_switchover_hrs', 'overstay_alert_hrs', 'daily_revenue_target'
    ];
    const sets: string[] = [];
    const values: any[] = [];
    
    for (const field of allowedFields) {
      if (data[field as keyof Site] !== undefined) {
        sets.push(`${field} = ?`);
        values.push(data[field as keyof Site]);
      }
    }
    
    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(now);
    values.push(siteId, companyId);
    
    const query = `UPDATE sites SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`;
    await db.executeSet([{ statement: query, values }]);
    
    await SyncQueue.enqueue('sites', 'UPDATE', { id: siteId, ...data, updated_at: now });
  }

  static async softDelete(companyId: string, siteId: string): Promise<void> {
    const db = await getDB();
    const now = new Date().toISOString();

    await db.executeSet([{
      statement: `UPDATE sites SET deleted_at = ?, updated_at = ? WHERE id = ? AND company_id = ?`,
      values: [now, now, siteId, companyId]
    }]);

    await SyncQueue.enqueue('sites', 'UPDATE', { id: siteId, deleted_at: now, updated_at: now });
  }

}
