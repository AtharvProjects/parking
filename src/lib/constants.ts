import type { VehicleType, EmployeeRole, SessionStatus, PaymentStatus, PaymentMethod, ShiftType } from './database.types';

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
