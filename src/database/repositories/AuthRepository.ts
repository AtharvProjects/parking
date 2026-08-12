import { getDB } from '@/database/connection';
import type { Employee } from '@/lib/database.types';

export class AuthRepository {
  static async getEmployeeByAuthId(authUserId: string): Promise<Employee | null> {
    const db = await getDB();
    const result = await db.query(`
      SELECT * FROM employees WHERE auth_user_id = ? AND active = 1 AND deleted_at IS NULL
    `, [authUserId]);
    
    if (!result.values || result.values.length === 0) return null;
    return result.values[0] as Employee;
  }

  static async upsertEmployee(employee: Employee) {
    const db = await getDB();
    const query = `
      INSERT INTO employees (id, company_id, site_id, auth_user_id, name, mobile, email, role, pin, active, avatar_url, shift, salary_advance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        company_id=excluded.company_id,
        site_id=excluded.site_id,
        auth_user_id=excluded.auth_user_id,
        name=excluded.name,
        mobile=excluded.mobile,
        email=excluded.email,
        role=excluded.role,
        pin=excluded.pin,
        active=excluded.active,
        avatar_url=excluded.avatar_url,
        shift=excluded.shift,
        salary_advance=excluded.salary_advance,
        updated_at=excluded.updated_at
    `;
    
    const params = [
      employee.id, employee.company_id, employee.site_id, employee.auth_user_id,
      employee.name, employee.mobile, employee.email || null, employee.role, employee.pin || null,
      employee.active ? 1 : 0, employee.avatar_url || null, employee.shift || null,
      employee.salary_advance || 0, employee.created_at, employee.updated_at
    ];
    
    await db.executeSet([{ statement: query, values: params }]);
  }

  static async upsertCompany(company: any) {
    const db = await getDB();
    const query = `
      INSERT INTO companies (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        updated_at=excluded.updated_at
    `;
    const params = [
      company.id, company.name, company.created_at || new Date().toISOString(), company.updated_at || new Date().toISOString()
    ];
    await db.executeSet([{ statement: query, values: params }]);
  }

  static async upsertSite(site: any) {
    const db = await getDB();
    const query = `
      INSERT INTO sites (id, company_id, name, brand_name, address, city, state, timezone, grace_period_minutes, rounding_interval_min, day_rate_switchover_hrs, overstay_alert_hrs, daily_revenue_target, total_slots, contact_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        brand_name=excluded.brand_name,
        address=excluded.address,
        city=excluded.city,
        state=excluded.state,
        timezone=excluded.timezone,
        grace_period_minutes=excluded.grace_period_minutes,
        rounding_interval_min=excluded.rounding_interval_min,
        day_rate_switchover_hrs=excluded.day_rate_switchover_hrs,
        overstay_alert_hrs=excluded.overstay_alert_hrs,
        daily_revenue_target=excluded.daily_revenue_target,
        total_slots=excluded.total_slots,
        contact_number=excluded.contact_number,
        updated_at=excluded.updated_at
    `;
    const params = [
      site.id, site.company_id, site.name, site.brand_name || null, site.address || '', site.city || '', site.state || '', site.timezone || 'Asia/Kolkata',
      site.grace_period_minutes ?? 15, site.rounding_interval_min ?? 30, site.day_rate_switchover_hrs ?? 12, site.overstay_alert_hrs ?? 24,
      site.daily_revenue_target ?? 10000, site.total_slots ?? 100, site.contact_number || null, site.created_at || new Date().toISOString(), site.updated_at || new Date().toISOString()
    ];
    await db.executeSet([{ statement: query, values: params }]);
  }
}
