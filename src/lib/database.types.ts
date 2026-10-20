export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          business_name: string | null;
          brand_name: string | null;
          contact_number: string | null;
          city: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          business_name?: string | null;
          brand_name?: string | null;
          contact_number?: string | null;
          city?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          business_name?: string | null;
          brand_name?: string | null;
          contact_number?: string | null;
          city?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          brand_name: string | null;
          address: string;
          city: string;
          state: string;
          timezone: string;
          grace_period_minutes: number;
          rounding_interval_min: number;
          day_rate_switchover_hrs: number;
          overstay_alert_hrs: number;
          daily_revenue_target: number;
          total_slots: number;
          contact_number: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          company_id?: string;
          name: string;
          brand_name?: string | null;
          address?: string;
          city?: string;
          state?: string;
          timezone?: string;
          grace_period_minutes?: number;
          rounding_interval_min?: number;
          day_rate_switchover_hrs?: number;
          overstay_alert_hrs?: number;
          daily_revenue_target?: number;
          total_slots?: number;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          brand_name?: string | null;
          address?: string;
          city?: string;
          state?: string;
          timezone?: string;
          grace_period_minutes?: number;
          rounding_interval_min?: number;
          day_rate_switchover_hrs?: number;
          overstay_alert_hrs?: number;
          daily_revenue_target?: number;
          total_slots?: number;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          company_id: string;
          site_id: string;
          auth_user_id: string | null;
          name: string;
          mobile: string;
          email: string | null;
          role: EmployeeRole;
          pin: string | null;
          active: boolean;
          avatar_url: string | null;
          shift: ShiftType | null;
          salary_advance: number;
          base_salary: number;
          salary_type: SalaryType;
          designation: string | null;
          joining_date: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          company_id?: string;
          site_id?: string;
          auth_user_id?: string | null;
          name: string;
          mobile: string;
          email?: string | null;
          role?: EmployeeRole;
          pin?: string | null;
          active?: boolean;
          avatar_url?: string | null;
          shift?: ShiftType | null;
          salary_advance?: number;
          base_salary?: number;
          salary_type?: SalaryType;
          designation?: string | null;
          joining_date?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          site_id?: string;
          auth_user_id?: string | null;
          name?: string;
          mobile?: string;
          email?: string | null;
          role?: EmployeeRole;
          pin?: string | null;
          active?: boolean;
          avatar_url?: string | null;
          shift?: ShiftType | null;
          salary_advance?: number;
          base_salary?: number;
          salary_type?: SalaryType;
          designation?: string | null;
          joining_date?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      rate_cards: {
        Row: {
          id: string;
          company_id: string;
          site_id: string;
          vehicle_type: VehicleType;
          hourly_rate: number;
          daily_rate: number;
          effective_from: string;
          effective_to: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string;
          site_id?: string;
          vehicle_type: VehicleType;
          hourly_rate: number;
          daily_rate: number;
          effective_from?: string;
          effective_to?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          site_id?: string;
          vehicle_type?: VehicleType;
          hourly_rate?: number;
          daily_rate?: number;
          effective_from?: string;
          effective_to?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      parking_sessions: {
        Row: {
          id: string;
          company_id: string;
          site_id: string;
          vehicle_number: string;
          vehicle_type: VehicleType;
          driver_number: string;
          driver_name: string | null;
          notes: string | null;
          vehicle_photos: Json;
          entry_at: string;
          entry_operator_id: string;
          exit_at: string | null;
          exit_operator_id: string | null;
          rate_card_id: string | null;
          duration_minutes: number | null;
          gross_amount: number | null;
          status: SessionStatus;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          company_id?: string;
          site_id?: string;
          vehicle_number: string;
          vehicle_type: VehicleType;
          driver_number?: string;
          driver_name?: string | null;
          notes?: string | null;
          vehicle_photos?: Json;
          entry_at?: string;
          entry_operator_id?: string;
          exit_at?: string | null;
          exit_operator_id?: string | null;
          rate_card_id?: string | null;
          duration_minutes?: number | null;
          gross_amount?: number | null;
          status?: SessionStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          site_id?: string;
          vehicle_number?: string;
          vehicle_type?: VehicleType;
          driver_number?: string;
          driver_name?: string | null;
          notes?: string | null;
          vehicle_photos?: Json;
          entry_at?: string;
          entry_operator_id?: string;
          exit_at?: string | null;
          exit_operator_id?: string | null;
          rate_card_id?: string | null;
          duration_minutes?: number | null;
          gross_amount?: number | null;
          status?: SessionStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          session_id: string;
          status: PaymentStatus;
          method: PaymentMethod | null;
          amount: number;
          discount_amount: number;
          tax_amount: number;
          collected_by_id: string | null;
          collected_at: string | null;
          receipt_number: string | null;
          transaction_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          status?: PaymentStatus;
          method?: PaymentMethod | null;
          amount: number;
          discount_amount?: number;
          tax_amount?: number;
          collected_by_id?: string | null;
          collected_at?: string | null;
          receipt_number?: string | null;
          transaction_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          status?: PaymentStatus;
          method?: PaymentMethod | null;
          amount?: number;
          discount_amount?: number;
          tax_amount?: number;
          collected_by_id?: string | null;
          collected_at?: string | null;
          receipt_number?: string | null;
          transaction_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_attendance: {
        Row: {
          id: string;
          company_id: string;
          site_id: string;
          employee_id: string;
          date: string; // YYYY-MM-DD
          status: StaffAttendanceStatus;
          check_in: string | null;
          check_out: string | null;
          shift: string | null;
          notes: string | null;
          marked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string;
          site_id: string;
          employee_id: string;
          date: string;
          status: StaffAttendanceStatus;
          check_in?: string | null;
          check_out?: string | null;
          shift?: string | null;
          notes?: string | null;
          marked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          site_id?: string;
          employee_id?: string;
          date?: string;
          status?: StaffAttendanceStatus;
          check_in?: string | null;
          check_out?: string | null;
          shift?: string | null;
          notes?: string | null;
          marked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_transactions: {
        Row: {
          id: string;
          company_id: string;
          site_id: string | null;
          employee_id: string;
          type: StaffTransactionType;
          amount: number; // in paise
          payment_date: string; // YYYY-MM-DD
          payment_method: TransactionPaymentMethod;
          month: string | null; // e.g. '2026-08'
          notes: string | null;
          transaction_ref: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string;
          site_id?: string | null;
          employee_id: string;
          type: StaffTransactionType;
          amount: number;
          payment_date?: string;
          payment_method?: TransactionPaymentMethod;
          month?: string | null;
          notes?: string | null;
          transaction_ref?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          site_id?: string | null;
          employee_id?: string;
          type?: StaffTransactionType;
          amount?: number;
          payment_date?: string;
          payment_method?: TransactionPaymentMethod;
          month?: string | null;
          notes?: string | null;
          transaction_ref?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          company_id: string | null;
          site_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          actor_id: string | null;
          details: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          site_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          actor_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          site_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          actor_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      rpc_vehicle_entry: {
        Args: {
          p_company_id: string;
          p_site_id: string;
          p_vehicle_number: string;
          p_vehicle_type: string;
          p_driver_number: string;
          p_notes?: string | null;
          p_vehicle_photos?: Json | null;
          p_entry_operator_id?: string | null;
          p_driver_name?: string | null;
        };
        Returns: Json;
      };
      rpc_vehicle_checkout: {
        Args: {
          p_company_id: string;
          p_session_id: string;
          p_exit_operator_id: string;
          p_payment_method: string;
          p_gross_amount: number;
          p_duration_minutes: number;
          p_discount_amount?: number;
          p_transaction_ref?: string | null;
        };
        Returns: Json;
      };
      rpc_verify_pin: {
        Args: {
          p_identifier: string;
          p_pin: string;
        };
        Returns: Json;
      };
      rpc_dashboard_stats: {
        Args: {
          p_company_id: string;
          p_site_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type EmployeeRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'GATE_ATTENDANT' | 'ACCOUNTANT' | 'VIEWER';
export type VehicleType = 'TRAILOR' | 'BODY_VEHICLE' | 'EICHER';
export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'WAIVED';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';
export type TransactionPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';
export type SalaryType = 'MONTHLY' | 'DAILY' | 'HOURLY';
export type StaffAttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'HOLIDAY';
export type StaffTransactionType = 'SALARY_PAYMENT' | 'ADVANCE_GIVEN' | 'ADVANCE_REPAYMENT' | 'BONUS' | 'DEDUCTION';

export type Site = Database['public']['Tables']['sites']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type RateCard = Database['public']['Tables']['rate_cards']['Row'];
export type ParkingSession = Database['public']['Tables']['parking_sessions']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type StaffAttendance = Database['public']['Tables']['staff_attendance']['Row'];
export type StaffTransaction = Database['public']['Tables']['staff_transactions']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

export interface SessionWithRelations extends ParkingSession {
  entry_operator?: Employee;
  exit_operator?: Employee;
  rate_card?: RateCard;
  payment?: Payment;
}

export interface ActiveVehicle {
  id: string;
  site_id?: string;
  site_name?: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  driver_number: string;
  driver_name?: string | null;
  notes: string | null;
  entry_at: string;
  entry_operator_name: string;
  elapsed_minutes: number;
  is_overstaying: boolean;
  vehicle_photos?: { front?: string; rear?: string } | null;
}

export interface DashboardStats {
  today_revenue: number;
  yesterday_revenue: number;
  today_vehicle_count: number;
  yesterday_vehicle_count: number;
  active_vehicles: number;
  avg_duration_minutes: number;
  daily_revenue_target: number;
  total_slots: number;
  overstaying_count: number;
  vehicle_type_breakdown: { type: VehicleType; count: number; revenue: number }[];
  revenue_by_day: { date: string; revenue: number; count: number }[];
  peak_hours: { hour: number; count: number }[];
}

export interface MonthlyPayrollSummary {
  employee_id: string;
  employee_name: string;
  designation: string;
  month: string; // 'YYYY-MM'
  total_month_days: number;
  present_days: number;
  half_days: number;
  paid_leaves: number;
  unpaid_leaves: number;
  absent_days: number;
  effective_worked_days: number;
  base_salary: number; // paise
  earned_salary: number; // paise
  active_advance_balance: number; // paise (total pending advance)
  advances_given_this_month: number; // paise
  advance_deductions_this_month: number; // paise
  bonuses_this_month: number; // paise
  other_deductions_this_month: number; // paise
  salary_paid_this_month: number; // paise
  net_remaining_salary_due: number; // paise (Earned + Bonus - Deductions - Salary Paid - Advance Deductions)
}
