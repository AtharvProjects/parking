import { getDB } from '@/database/connection';
import type { Employee, EmployeeRole, ShiftType } from '@/lib/database.types';
import { SyncQueue } from '@/sync/queue';

export class EmployeeRepository {
  static async getEmployeesBySite(companyId: string, siteId: string): Promise<Employee[]> {
    const db = await getDB();
    const result = await db.query(`
      SELECT * FROM employees 
      WHERE company_id = ? AND site_id = ? AND deleted_at IS NULL
    `, [companyId, siteId]);
    
    return result.values as Employee[];
  }

  static async getAllByCompany(companyId: string): Promise<Employee[]> {
    const db = await getDB();
    const result = await db.query(`
      SELECT e.*, s.name as site_name FROM employees e
      LEFT JOIN sites s ON e.site_id = s.id
      WHERE e.company_id = ? AND e.deleted_at IS NULL
      ORDER BY e.name ASC
    `, [companyId]);
    
    return result.values as (Employee & { site_name?: string })[];
  }

  static async create(companyId: string, data: {
    site_id: string;
    name: string;
    mobile: string;
    email?: string;
    role: EmployeeRole;
    shift?: ShiftType;
    pin?: string;
  }): Promise<Employee> {
    const db = await getDB();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO employees (id, company_id, site_id, auth_user_id, name, mobile, email, role, pin, active, avatar_url, shift, salary_advance, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, NULL, ?, 0, ?, ?)
    `;
    const params = [
      id, companyId, data.site_id, data.name, data.mobile,
      data.email || null, data.role, data.pin || null,
      data.shift || null, now, now
    ];

    await db.executeSet([{ statement: query, values: params }]);

    const employee: any = {
      id, company_id: companyId, site_id: data.site_id, auth_user_id: null,
      name: data.name, mobile: data.mobile, email: data.email || null,
      role: data.role, pin: data.pin || null, active: true, avatar_url: null,
      shift: data.shift || null, salary_advance: 0, created_at: now, updated_at: now,
      deleted_at: null
    };

    await SyncQueue.enqueue('employees', 'INSERT', employee);
    return employee as Employee;
  }

  static async update(companyId: string, id: string, data: {
    name?: string;
    mobile?: string;
    email?: string;
    role?: EmployeeRole;
    shift?: ShiftType | null;
    site_id?: string;
    pin?: string;
  }): Promise<void> {
    const db = await getDB();
    const now = new Date().toISOString();
    const allowedFields = ['name', 'mobile', 'email', 'role', 'shift', 'site_id', 'pin'];
    const sets: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        sets.push(`${field} = ?`);
        values.push((data as any)[field]);
      }
    }

    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(now);
    values.push(id, companyId);

    const query = `UPDATE employees SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`;
    await db.executeSet([{ statement: query, values }]);

    await SyncQueue.enqueue('employees', 'UPDATE', { id, ...data, updated_at: now });
  }

  static async toggleActive(companyId: string, id: string, active: boolean): Promise<void> {
    const db = await getDB();
    const now = new Date().toISOString();

    await db.executeSet([{
      statement: `UPDATE employees SET active = ?, updated_at = ? WHERE id = ? AND company_id = ?`,
      values: [active ? 1 : 0, now, id, companyId]
    }]);

    await SyncQueue.enqueue('employees', 'UPDATE', { id, active, updated_at: now });
  }

  static async softDelete(companyId: string, id: string): Promise<void> {
    const db = await getDB();
    const now = new Date().toISOString();

    await db.executeSet([{
      statement: `UPDATE employees SET deleted_at = ?, active = 0, updated_at = ? WHERE id = ? AND company_id = ?`,
      values: [now, now, id, companyId]
    }]);

    await SyncQueue.enqueue('employees', 'UPDATE', { id, deleted_at: now, active: false, updated_at: now });
  }

  static async verifyPin(identifier: string, pin: string): Promise<Employee | null> {
    const db = await getDB();
    const cleanIdentifier = identifier.trim();
    const result = await db.query(`
      SELECT * FROM employees 
      WHERE (mobile = ? OR email = ? OR id = ?) 
        AND pin = ? 
        AND active = 1 
        AND deleted_at IS NULL
      LIMIT 1
    `, [cleanIdentifier, cleanIdentifier, cleanIdentifier, pin.trim()]);

    if (!result.values || result.values.length === 0) return null;
    return result.values[0] as Employee;
  }

  static async getEmployeeById(id: string): Promise<Employee | null> {
    const db = await getDB();
    const result = await db.query(`
      SELECT * FROM employees WHERE id = ? AND active = 1 AND deleted_at IS NULL LIMIT 1
    `, [id]);

    if (!result.values || result.values.length === 0) return null;
    return result.values[0] as Employee;
  }

  static async getEmployeesForQuickSelect(): Promise<Pick<Employee, 'id' | 'name' | 'mobile' | 'role' | 'shift' | 'site_id'>[]> {
    const db = await getDB();
    const result = await db.query(`
      SELECT id, name, mobile, role, shift, site_id FROM employees 
      WHERE active = 1 AND deleted_at IS NULL AND pin IS NOT NULL AND pin != ''
      ORDER BY name ASC
    `);

    return (result.values || []) as any[];
  }
}
