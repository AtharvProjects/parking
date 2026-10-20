import type {
  VehicleType,
  EmployeeRole,
  SessionStatus,
  PaymentStatus,
  PaymentMethod,
  ShiftType,
  StaffAttendanceStatus,
  StaffTransactionType,
  SalaryType,
} from './database.types';

// ─── VEHICLE TYPE CONFIG ─────────────────────────────────

export const VEHICLE_TYPE_CONFIG: Record<VehicleType, {
  label: string;
  icon: string;
  color: string;
}> = {
  TRAILOR:      { label: 'Trailor',       icon: '🚛', color: '#3B82F6' },
  BODY_VEHICLE: { label: 'Body Vehicle',  icon: '🚚', color: '#8B5CF6' },
  EICHER:       { label: 'Eicher',        icon: '🚐', color: '#06B6D4' },
};

export const VEHICLE_TYPES = Object.keys(VEHICLE_TYPE_CONFIG) as VehicleType[];

// ─── ROLE CONFIG ─────────────────────────────────────────

export const ROLE_CONFIG: Record<EmployeeRole, { label: string; level: number }> = {
  SUPER_ADMIN:    { label: 'Super Admin',    level: 100 },
  ADMIN:          { label: 'Admin',          level: 80 },
  MANAGER:        { label: 'Manager',        level: 60 },
  OPERATOR:       { label: 'Operator',       level: 40 },
  GATE_ATTENDANT: { label: 'Gate Attendant', level: 30 },
  ACCOUNTANT:     { label: 'Accountant',     level: 50 },
  VIEWER:         { label: 'Viewer',         level: 10 },
};

// ─── SESSION STATUS CONFIG ───────────────────────────────

export const SESSION_STATUS_CONFIG: Record<SessionStatus, {
  label: string;
  color: string;
  dotColor: string;
}> = {
  ACTIVE:    { label: 'Parked',    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',       dotColor: 'bg-blue-500' },
  COMPLETED: { label: 'Exited',    color: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300',       dotColor: 'bg-gray-400' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',           dotColor: 'bg-red-400' },
};

// ─── PAYMENT CONFIG ──────────────────────────────────────

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, {
  label: string;
  color: string;
}> = {
  PENDING:        { label: 'Pending',  color: 'bg-amber-50 text-amber-700' },
  PAID:           { label: 'Paid',     color: 'bg-green-50 text-green-700' },
  PARTIALLY_PAID: { label: 'Partial',  color: 'bg-orange-50 text-orange-700' },
  WAIVED:         { label: 'Waived',   color: 'bg-gray-50 text-gray-500' },
};

export const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, {
  label: string;
  icon: string;
}> = {
  CASH: { label: 'Cash', icon: '💵' },
  UPI:  { label: 'UPI',  icon: '📱' },
  CARD: { label: 'Card', icon: '💳' },
};

// ─── SHIFTS ──────────────────────────────────────────────

export const SHIFT_CONFIG: Record<ShiftType, {
  label: string;
  start: string;
  end: string;
}> = {
  MORNING:   { label: 'Morning',   start: '06:00', end: '14:00' },
  AFTERNOON: { label: 'Afternoon', start: '14:00', end: '22:00' },
  NIGHT:     { label: 'Night',     start: '22:00', end: '06:00' },
};

// ─── BUSINESS DEFAULTS ───────────────────────────────────

export const UPI_CONFIG = {
  vpa: 'kirandhakane9595-1@okhdfcbank',
  mobile: '+91 96998 86899',
  payeeName: 'Sant Wamanbhau Parking',
} as const;

export const APP_NAME = 'THE EAST PALACE';
export const BUSINESS_NAME = 'Sant Wamanbhau Parking';

// ─── VALIDATION ──────────────────────────────────────────

export const INDIAN_PLATE_REGEX = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/;

// ─── ROLE-BASED ACCESS CONTROL ──────────────────────────────

export type AppFeature = 'DASHBOARD' | 'GATE_ENTRY' | 'GATE_EXIT' | 'VEHICLES' | 'SEARCH' | 'REPORTS' | 'SETTINGS' | 'EMPLOYEES' | 'SITES';

export const ROLE_PERMISSIONS: Record<EmployeeRole, AppFeature[]> = {
  SUPER_ADMIN:    ['DASHBOARD', 'GATE_ENTRY', 'GATE_EXIT', 'VEHICLES', 'SEARCH', 'REPORTS', 'SETTINGS', 'EMPLOYEES', 'SITES'],
  ADMIN:          ['DASHBOARD', 'GATE_ENTRY', 'GATE_EXIT', 'VEHICLES', 'SEARCH', 'REPORTS', 'SETTINGS', 'EMPLOYEES', 'SITES'],
  MANAGER:        ['DASHBOARD', 'GATE_ENTRY', 'GATE_EXIT', 'VEHICLES', 'SEARCH', 'REPORTS', 'EMPLOYEES'],
  OPERATOR:       ['DASHBOARD', 'GATE_ENTRY', 'GATE_EXIT', 'VEHICLES', 'SEARCH'],
  GATE_ATTENDANT: ['DASHBOARD', 'GATE_ENTRY', 'GATE_EXIT', 'VEHICLES'],
  ACCOUNTANT:     ['DASHBOARD', 'SEARCH', 'REPORTS'],
  VIEWER:         ['DASHBOARD'],
};

export const hasPermission = (role: EmployeeRole | undefined, feature: AppFeature): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(feature) ?? false;
};

// ─── STAFF ATTENDANCE CONFIG ─────────────────────────────

export const ATTENDANCE_STATUS_CONFIG: Record<StaffAttendanceStatus, {
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotColor: string;
}> = {
  PRESENT:       { label: 'Present',       shortLabel: 'P',  badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', dotColor: 'bg-emerald-500' },
  HALF_DAY:      { label: 'Half Day',      shortLabel: 'HD', badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',       dotColor: 'bg-amber-500' },
  ABSENT:        { label: 'Absent',        shortLabel: 'A',  badgeClass: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800',                   dotColor: 'bg-red-500' },
  PAID_LEAVE:    { label: 'Paid Leave',    shortLabel: 'PL', badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',             dotColor: 'bg-blue-500' },
  UNPAID_LEAVE:  { label: 'Unpaid Leave',  shortLabel: 'UL', badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',       dotColor: 'bg-slate-400' },
  HOLIDAY:       { label: 'Holiday / Off', shortLabel: 'H',  badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',   dotColor: 'bg-purple-500' },
};

// ─── STAFF TRANSACTION TYPE CONFIG ───────────────────────

export const STAFF_TRANSACTION_CONFIG: Record<StaffTransactionType, {
  label: string;
  badgeClass: string;
  isCredit: boolean; // positive impact to employee cash received
}> = {
  SALARY_PAYMENT:    { label: 'Salary Payment',   badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', isCredit: true },
  ADVANCE_GIVEN:     { label: 'Advance Given',    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',             isCredit: true },
  ADVANCE_REPAYMENT: { label: 'Advance Deducted', badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',          isCredit: false },
  BONUS:             { label: 'Bonus / Incentive',badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',       isCredit: true },
  DEDUCTION:         { label: 'Penalty / Other',  badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',             isCredit: false },
};

export const SALARY_TYPE_CONFIG: Record<SalaryType, { label: string }> = {
  MONTHLY: { label: 'Monthly Fixed' },
  DAILY:   { label: 'Daily Wage' },
  HOURLY:  { label: 'Hourly Rate' },
};

// ─── LOCALIZATION HELPERS ─────────────────────────────────

export const getVehicleTypeLabel = (type: VehicleType, t?: any): string => {
  if (t?.vehicles) {
    const keyMap: Record<VehicleType, string> = {
      TRAILOR: 'trailor',
      BODY_VEHICLE: 'bodyVehicle',
      EICHER: 'eicher',
    };
    return t.vehicles[keyMap[type]] || VEHICLE_TYPE_CONFIG[type]?.label || type;
  }
  return VEHICLE_TYPE_CONFIG[type]?.label || type;
};

export const getRoleLabel = (role: EmployeeRole, t?: any): string => {
  if (t?.roles) {
    const keyMap: Record<EmployeeRole, string> = {
      SUPER_ADMIN: 'superAdmin',
      ADMIN: 'admin',
      MANAGER: 'manager',
      OPERATOR: 'operator',
      GATE_ATTENDANT: 'gateAttendant',
      ACCOUNTANT: 'accountant',
      VIEWER: 'viewer',
    };
    return t.roles[keyMap[role]] || ROLE_CONFIG[role]?.label || role;
  }
  return ROLE_CONFIG[role]?.label || role;
};

export const getShiftLabel = (shift: ShiftType, t?: any): string => {
  if (t?.shifts) {
    const keyMap: Record<ShiftType, string> = {
      MORNING: 'morning',
      AFTERNOON: 'afternoon',
      NIGHT: 'night',
    };
    return t.shifts[keyMap[shift]] || SHIFT_CONFIG[shift]?.label || shift;
  }
  return SHIFT_CONFIG[shift]?.label || shift;
};

export const getPaymentMethodLabel = (method: PaymentMethod, t?: any): string => {
  if (t?.payments) {
    const keyMap: Record<PaymentMethod, string> = {
      CASH: 'cash',
      UPI: 'upi',
      CARD: 'card',
    };
    return t.payments[keyMap[method]] || PAYMENT_METHOD_CONFIG[method]?.label || method;
  }
  return PAYMENT_METHOD_CONFIG[method]?.label || method;
};

export const getSessionStatusLabel = (status: SessionStatus, t?: any): string => {
  if (t?.activeVehicles) {
    const keyMap: Record<SessionStatus, string> = {
      ACTIVE: 'parked',
      COMPLETED: 'exited',
      CANCELLED: 'cancelled',
    };
    return t.activeVehicles[keyMap[status]] || SESSION_STATUS_CONFIG[status]?.label || status;
  }
  return SESSION_STATUS_CONFIG[status]?.label || status;
};

export const getAttendanceStatusLabel = (status: StaffAttendanceStatus, t?: any): string => {
  if (t?.attendance) {
    const keyMap: Record<StaffAttendanceStatus, string> = {
      PRESENT: 'present',
      HALF_DAY: 'halfDay',
      ABSENT: 'absent',
      PAID_LEAVE: 'paidLeave',
      UNPAID_LEAVE: 'unpaidLeave',
      HOLIDAY: 'holiday',
    };
    return t.attendance[keyMap[status]] || ATTENDANCE_STATUS_CONFIG[status]?.label || status;
  }
  return ATTENDANCE_STATUS_CONFIG[status]?.label || status;
};

export const getStaffTransactionTypeLabel = (type: StaffTransactionType, t?: any): string => {
  if (t?.staffTransactions) {
    const keyMap: Record<StaffTransactionType, string> = {
      SALARY_PAYMENT: 'salaryPayment',
      ADVANCE_GIVEN: 'advanceGiven',
      ADVANCE_REPAYMENT: 'advanceDeducted',
      BONUS: 'bonusIncentive',
      DEDUCTION: 'penaltyOther',
    };
    return t.staffTransactions[keyMap[type]] || STAFF_TRANSACTION_CONFIG[type]?.label || type;
  }
  return STAFF_TRANSACTION_CONFIG[type]?.label || type;
};

export const getSalaryTypeLabel = (type: SalaryType, t?: any): string => {
  if (t?.salaryTypes) {
    const keyMap: Record<SalaryType, string> = {
      MONTHLY: 'monthlyFixed',
      DAILY: 'dailyWage',
      HOURLY: 'hourlyRate',
    };
    return t.salaryTypes[keyMap[type]] || SALARY_TYPE_CONFIG[type]?.label || type;
  }
  return SALARY_TYPE_CONFIG[type]?.label || type;
};
