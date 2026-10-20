/**
 * Employees Service — Thin adapter using Supabase-direct operations.
 */
import { supabaseEmployeesService } from '@/services/supabase-employees.service';
import type { Employee, EmployeeRole, ShiftType } from '@/lib/database.types';

function getCompanyId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('company_id') || '00000000-0000-0000-0000-000000000000'
    : '00000000-0000-0000-0000-000000000000';
}

export const employeesService = {
  async getAll(siteId?: string): Promise<(Employee & { site_name?: string })[]> {
    return supabaseEmployeesService.getAll(getCompanyId(), siteId);
  },

  async getAllByCompany(): Promise<(Employee & { site_name?: string })[]> {
    return supabaseEmployeesService.getAllByCompany(getCompanyId());
  },

  async getById(id: string): Promise<Employee | null> {
    return supabaseEmployeesService.getById(id);
  },

  async create(siteId: string, data: {
    name: string;
    mobile: string;
    email?: string;
    role: EmployeeRole;
    shift?: ShiftType;
    pin?: string;
    base_salary?: number;
    salary_type?: 'MONTHLY' | 'DAILY' | 'HOURLY';
    designation?: string;
    joining_date?: string;
  }): Promise<Employee> {
    return supabaseEmployeesService.create(getCompanyId(), siteId, data);
  },

  async update(id: string, data: {
    name?: string;
    mobile?: string;
    email?: string;
    role?: EmployeeRole;
    shift?: ShiftType | null;
    site_id?: string;
    pin?: string;
    base_salary?: number;
    salary_type?: 'MONTHLY' | 'DAILY' | 'HOURLY';
    designation?: string;
    joining_date?: string;
  }): Promise<void> {
    return supabaseEmployeesService.update(getCompanyId(), id, data);
  },

  async toggleActive(id: string, active: boolean): Promise<void> {
    return supabaseEmployeesService.toggleActive(getCompanyId(), id, active);
  },

  async softDelete(id: string): Promise<void> {
    return supabaseEmployeesService.softDelete(getCompanyId(), id);
  },

  async delete(id: string): Promise<void> {
    return supabaseEmployeesService.softDelete(getCompanyId(), id);
  },

  async getQuickSelectEmployees(): Promise<Pick<Employee, 'id' | 'name' | 'mobile' | 'role' | 'shift' | 'site_id'>[]> {
    return supabaseEmployeesService.getQuickSelectEmployees(getCompanyId());
  },
};
