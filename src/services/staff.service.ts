import { supabaseStaffService } from '@/services/supabase-staff.service';
import type {
  Employee,
  StaffAttendance,
  StaffTransaction,
  StaffAttendanceStatus,
  StaffTransactionType,
  TransactionPaymentMethod,
  MonthlyPayrollSummary,
} from '@/lib/database.types';

function getCompanyId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('company_id') || '00000000-0000-0000-0000-000000000000'
    : '00000000-0000-0000-0000-000000000000';
}

export const staffService = {
  // ─── ATTENDANCE ──────────────────────────────────────────

  async getAttendanceByMonth(month: string, employeeId?: string): Promise<StaffAttendance[]> {
    return supabaseStaffService.getAttendanceByMonth(getCompanyId(), month, employeeId);
  },

  async getDailyAttendance(date: string, siteId?: string): Promise<StaffAttendance[]> {
    return supabaseStaffService.getDailyAttendance(getCompanyId(), date, siteId);
  },

  async markAttendanceBatch(
    records: {
      site_id: string;
      employee_id: string;
      date: string;
      status: StaffAttendanceStatus;
      check_in?: string | null;
      check_out?: string | null;
      shift?: string | null;
      notes?: string | null;
    }[],
    markedBy?: string
  ): Promise<void> {
    return supabaseStaffService.markAttendanceBatch(getCompanyId(), records, markedBy);
  },

  // ─── TRANSACTIONS & PAYROLL ──────────────────────────────

  async getTransactions(options?: {
    employeeId?: string;
    month?: string;
    type?: StaffTransactionType;
    limit?: number;
  }): Promise<(StaffTransaction & { employee_name?: string; designation?: string })[]> {
    return supabaseStaffService.getTransactions(getCompanyId(), options);
  },

  async recordAdvance(
    data: {
      site_id?: string | null;
      employee_id: string;
      amount: number; // in paise
      payment_date?: string;
      payment_method?: TransactionPaymentMethod;
      month?: string | null;
      notes?: string | null;
      transaction_ref?: string | null;
    },
    recordedBy?: string
  ): Promise<StaffTransaction> {
    return supabaseStaffService.recordTransaction(
      getCompanyId(),
      {
        ...data,
        type: 'ADVANCE_GIVEN',
      },
      recordedBy
    );
  },

  async recordAdvanceRepayment(
    data: {
      site_id?: string | null;
      employee_id: string;
      amount: number; // in paise
      payment_date?: string;
      payment_method?: TransactionPaymentMethod;
      month?: string | null;
      notes?: string | null;
      transaction_ref?: string | null;
    },
    recordedBy?: string
  ): Promise<StaffTransaction> {
    return supabaseStaffService.recordTransaction(
      getCompanyId(),
      {
        ...data,
        type: 'ADVANCE_REPAYMENT',
      },
      recordedBy
    );
  },

  async recordSalaryPayment(
    data: {
      site_id?: string | null;
      employee_id: string;
      amount: number; // in paise
      payment_date?: string;
      payment_method?: TransactionPaymentMethod;
      month?: string | null;
      notes?: string | null;
      transaction_ref?: string | null;
    },
    recordedBy?: string
  ): Promise<StaffTransaction> {
    return supabaseStaffService.recordTransaction(
      getCompanyId(),
      {
        ...data,
        type: 'SALARY_PAYMENT',
      },
      recordedBy
    );
  },

  async recordTransaction(
    data: {
      site_id?: string | null;
      employee_id: string;
      type: StaffTransactionType;
      amount: number; // in paise
      payment_date?: string;
      payment_method?: TransactionPaymentMethod;
      month?: string | null;
      notes?: string | null;
      transaction_ref?: string | null;
    },
    recordedBy?: string
  ): Promise<StaffTransaction> {
    return supabaseStaffService.recordTransaction(getCompanyId(), data, recordedBy);
  },

  async deleteTransaction(id: string): Promise<void> {
    return supabaseStaffService.deleteTransaction(getCompanyId(), id);
  },

  // ─── CALCULATION ─────────────────────────────────────────

  calculateMonthlyPayroll(
    employee: Employee,
    month: string,
    attendanceRecords: StaffAttendance[],
    allTransactions: StaffTransaction[]
  ): MonthlyPayrollSummary {
    return supabaseStaffService.calculateMonthlyPayroll(employee, month, attendanceRecords, allTransactions);
  },
};
