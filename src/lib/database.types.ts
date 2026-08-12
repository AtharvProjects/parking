export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
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
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
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
          vehicle_type?: VehicleType;
          hourly_rate?: number;
          daily_rate?: number;
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
          vehicle_number?: string;
          vehicle_type?: VehicleType;
          driver_number?: string;
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
      audit_logs: {
        Row: {
          id: string;
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
          action?: string;
          entity_type?: string;
          entity_id?: string;
          actor_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
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
      [_ in never]: never;
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
export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export type Site = Database['public']['Tables']['sites']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type RateCard = Database['public']['Tables']['rate_cards']['Row'];
export type ParkingSession = Database['public']['Tables']['parking_sessions']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

export interface SessionWithRelations extends ParkingSession {
  entry_operator?: Employee;
  exit_operator?: Employee;
  rate_card?: RateCard;
  payment?: Payment;
}

export interface ActiveVehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  driver_number: string;
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
