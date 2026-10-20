import { supabase } from '@/lib/supabase';
import type {
  Employee,
  StaffAttendance,
  StaffTransaction,
  StaffAttendanceStatus,
  StaffTransactionType,
  TransactionPaymentMethod,
  MonthlyPayrollSummary,
} from '@/lib/database.types';

export const supabaseStaffService = {
  // ─── ATTENDANCE ──────────────────────────────────────────

  async getAttendanceByMonth(companyId: string, month: string, employeeId?: string): Promise<StaffAttendance[]> {
    if (!companyId) return [];

    try {
      // month format: YYYY-MM
      const startDate = `${month}-01`;
      // calculate end of month
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

      let query = supabase
        .from('staff_attendance')
        .select('*')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;
      if (error) {
        if (error.message?.includes('staff_attendance') || (error as any).code === 'PGRST204' || (error as any).code === '42P01') {
          console.warn('staff_attendance table not found in Supabase schema cache');
          return [];
        }
        throw new Error(`Failed to fetch attendance: ${error.message}`);
      }
      return (data || []) as StaffAttendance[];
    } catch (err: any) {
      console.warn('getAttendanceByMonth fallback:', err.message);
      return [];
    }
  },

  async getDailyAttendance(companyId: string, date: string, siteId?: string): Promise<StaffAttendance[]> {
    if (!companyId) return [];

    try {
      let query = supabase
        .from('staff_attendance')
        .select('*')
        .eq('company_id', companyId)
        .eq('date', date);

      if (siteId && siteId !== 'ALL') {
        query = query.eq('site_id', siteId);
      }

      const { data, error } = await query;
      if (error) {
        if (error.message?.includes('staff_attendance') || (error as any).code === 'PGRST204' || (error as any).code === '42P01') {
          console.warn('staff_attendance table not found in Supabase schema cache');
          return [];
        }
        throw new Error(`Failed to fetch daily attendance: ${error.message}`);
      }
      return (data || []) as StaffAttendance[];
    } catch (err: any) {
      console.warn('getDailyAttendance fallback:', err.message);
      return [];
    }
  },

  async markAttendanceBatch(
    companyId: string,
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
    if (!companyId || records.length === 0) return;

    const payload = records.map((r) => ({
      company_id: companyId,
      site_id: r.site_id,
      employee_id: r.employee_id,
      date: r.date,
      status: r.status,
      check_in: r.check_in || null,
      check_out: r.check_out || null,
      shift: r.shift || null,
      notes: r.notes || null,
      marked_by: markedBy || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('staff_attendance')
      .upsert(payload, { onConflict: 'employee_id,date' });

    if (error) {
      if (error.message?.includes('staff_attendance') || (error as any).code === 'PGRST204' || (error as any).code === '42P01') {
        console.warn('staff_attendance table not yet created on remote database.');
        return;
      }
      throw new Error(`Failed to save attendance: ${error.message}`);
    }
  },

  // ─── TRANSACTIONS & PAYROLL LEDGER ───────────────────────

  async getTransactions(
    companyId: string,
    options?: {
      employeeId?: string;
      month?: string;
      type?: StaffTransactionType;
      limit?: number;
    }
  ): Promise<(StaffTransaction & { employee_name?: string; designation?: string })[]> {
    if (!companyId) return [];

    try {
      let query = supabase
        .from('staff_transactions')
        .select('*, employee:employees!staff_transactions_employee_id_fkey(name, designation)')
        .eq('company_id', companyId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options?.employeeId) {
        query = query.eq('employee_id', options.employeeId);
      }
      if (options?.month) {
        query = query.eq('month', options.month);
      }
      if (options?.type) {
        query = query.eq('type', options.type);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) {
        if (error.message?.includes('staff_transactions') || (error as any).code === 'PGRST204' || (error as any).code === '42P01') {
          console.warn('staff_transactions table not found in Supabase schema cache');
          return [];
        }
        throw new Error(`Failed to fetch staff transactions: ${error.message}`);
      }

      return (data || []).map((tx: any) => ({
        ...tx,
        employee_name: tx.employee?.name,
        designation: tx.employee?.designation,
      }));
    } catch (err: any) {
      console.warn('getTransactions fallback:', err.message);
      return [];
    }
  },

  async recordTransaction(
    companyId: string,
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
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    const { data: tx, error } = await supabase
      .from('staff_transactions')
      .insert({
        company_id: companyId,
        site_id: data.site_id || null,
        employee_id: data.employee_id,
        type: data.type,
        amount: data.amount,
        payment_date: data.payment_date || today,
        payment_method: data.payment_method || 'CASH',
        month: data.month || currentMonth,
        notes: data.notes || null,
        transaction_ref: data.transaction_ref || null,
        recorded_by: recordedBy || null,
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('staff_transactions') || (error as any).code === 'PGRST204' || (error as any).code === '42P01') {
        console.warn('staff_transactions table not yet created on remote database.');
        return {
          id: `local-tx-${Date.now()}`,
          company_id: companyId,
          site_id: data.site_id || null,
          employee_id: data.employee_id,
          type: data.type,
          amount: data.amount,
          payment_date: data.payment_date || today,
          payment_method: data.payment_method || 'CASH',
          month: data.month || currentMonth,
          notes: data.notes || null,
          transaction_ref: data.transaction_ref || null,
          recorded_by: recordedBy || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as StaffTransaction;
      }
      throw new Error(`Failed to record transaction: ${error.message}`);
    }
    return tx as StaffTransaction;
  },

  async deleteTransaction(companyId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('staff_transactions')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete transaction: ${error.message}`);
  },

  // ─── CALCULATION ENGINE ──────────────────────────────────

  calculateMonthlyPayroll(
    employee: Employee,
    month: string, // YYYY-MM
    attendanceRecords: StaffAttendance[],
    allTransactions: StaffTransaction[]
  ): MonthlyPayrollSummary {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const total_month_days = new Date(year, m, 0).getDate();

    // 1. Attendance calculations
    const empAttendance = attendanceRecords.filter((a) => a.employee_id === employee.id && a.date.startsWith(month));
    
    let present_days = 0;
    let half_days = 0;
    let paid_leaves = 0;
    let unpaid_leaves = 0;
    let absent_days = 0;

    empAttendance.forEach((att) => {
      if (att.status === 'PRESENT') present_days += 1;
      else if (att.status === 'HALF_DAY') half_days += 1;
      else if (att.status === 'PAID_LEAVE' || att.status === 'HOLIDAY') paid_leaves += 1;
      else if (att.status === 'UNPAID_LEAVE') unpaid_leaves += 1;
      else if (att.status === 'ABSENT') absent_days += 1;
    });

    const effective_worked_days = present_days + half_days * 0.5 + paid_leaves;
    const base_salary = employee.base_salary || 0;

    let earned_salary = 0;
    if (employee.salary_type === 'DAILY') {
      earned_salary = base_salary * effective_worked_days;
    } else {
      // Monthly fixed:
      if (empAttendance.length === 0) {
        // Default to full base salary if attendance was not tracked for this month
        earned_salary = base_salary;
      } else {
        // Pro-rata based on days worked
        earned_salary = Math.round((base_salary / total_month_days) * effective_worked_days);
      }
    }

    // 2. Transaction & Ledger calculations
    const empTransactions = allTransactions.filter((tx) => tx.employee_id === employee.id);
    
    // Overall active advance balance across all time
    let totalAdvanceGiven = 0;
    let totalAdvanceRepaid = 0;
    empTransactions.forEach((tx) => {
      if (tx.type === 'ADVANCE_GIVEN') totalAdvanceGiven += tx.amount;
      if (tx.type === 'ADVANCE_REPAYMENT') totalAdvanceRepaid += tx.amount;
    });
    const active_advance_balance = Math.max(0, totalAdvanceGiven - totalAdvanceRepaid);

    // This specific month breakdown
    let advances_given_this_month = 0;
    let advance_deductions_this_month = 0;
    let bonuses_this_month = 0;
    let other_deductions_this_month = 0;
    let salary_paid_this_month = 0;

    empTransactions
      .filter((tx) => tx.month === month || (tx.payment_date && tx.payment_date.startsWith(month)))
      .forEach((tx) => {
        if (tx.type === 'ADVANCE_GIVEN') advances_given_this_month += tx.amount;
        if (tx.type === 'ADVANCE_REPAYMENT') advance_deductions_this_month += tx.amount;
        if (tx.type === 'BONUS') bonuses_this_month += tx.amount;
        if (tx.type === 'DEDUCTION') other_deductions_this_month += tx.amount;
        if (tx.type === 'SALARY_PAYMENT') salary_paid_this_month += tx.amount;
      });

    // Net remaining due calculation
    const grossEarnedTotal = earned_salary + bonuses_this_month;
    const totalDeductedOrPaid = salary_paid_this_month + advance_deductions_this_month + other_deductions_this_month;
    const net_remaining_salary_due = Math.max(0, grossEarnedTotal - totalDeductedOrPaid);

    return {
      employee_id: employee.id,
      employee_name: employee.name,
      designation: employee.designation || 'Parking Staff',
      month,
      total_month_days,
      present_days,
      half_days,
      paid_leaves,
      unpaid_leaves,
      absent_days,
      effective_worked_days,
      base_salary,
      earned_salary,
      active_advance_balance,
      advances_given_this_month,
      advance_deductions_this_month,
      bonuses_this_month,
      other_deductions_this_month,
      salary_paid_this_month,
      net_remaining_salary_due,
    };
  },
};
