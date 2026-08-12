import { EmployeeRepository } from '@/database/repositories/EmployeeRepository';
import type { EmployeeRole, ShiftType } from '@/lib/database.types';

export const employeesService = {
  get companyId() {
    return localStorage.getItem('company_id') || '';
  },

  async getAll(siteId?: string) {
    if (!siteId) return [];
    return EmployeeRepository.getEmployeesBySite(this.companyId, siteId);
  },

  async getAllByCompany() {
    return EmployeeRepository.getAllByCompany(this.companyId);
  },

  async create(siteId: string, data: {
    name: string;
    mobile: string;
    email?: string;
    role: EmployeeRole;
    shift?: ShiftType;
    pin?: string;
  }) {
    return EmployeeRepository.create(this.companyId, { ...data, site_id: siteId });
  },

  async update(id: string, data: {
    name?: string;
    mobile?: string;
    email?: string;
    role?: EmployeeRole;
    shift?: ShiftType | null;
    site_id?: string;
    pin?: string;
  }) {
    return EmployeeRepository.update(this.companyId, id, data);
  },

  async toggleActive(id: string, active: boolean) {
    return EmployeeRepository.toggleActive(this.companyId, id, active);
  },

  async delete(id: string) {
    return EmployeeRepository.softDelete(this.companyId, id);
  }
};
