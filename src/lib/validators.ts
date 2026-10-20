import { z } from 'zod';
import { INDIAN_PLATE_REGEX } from './constants';

// ─── Vehicle Number ──────────────────────────────────────

export const vehicleNumberSchema = z
  .string()
  .min(4, 'Vehicle number is too short')
  .max(15, 'Vehicle number is too long')
  .transform((val) => val.toUpperCase().replace(/[\s-]+/g, ''));

// ─── Mobile Number ───────────────────────────────────────

export const mobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number (10 digits, starts with 6-9)');

// ─── Create Entry ────────────────────────────────────────

export const createEntrySchema = z.object({
  vehicle_number: z.string().min(4).max(15),
  vehicle_type: z.enum(['TRAILOR', 'BODY_VEHICLE', 'EICHER']),
  driver_number: z.string().min(0).max(10),
  driver_name: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

// ─── Process Exit ────────────────────────────────────────

export const processExitSchema = z.object({
  payment_method: z.enum(['CASH', 'UPI', 'CARD']),
  discount_amount: z.number().int().min(0).optional(),
  transaction_ref: z.string().optional(),
});

export type ProcessExitInput = z.infer<typeof processExitSchema>;

// ─── Employee ────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  mobile: mobileSchema,
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR', 'GATE_ATTENDANT', 'ACCOUNTANT', 'VIEWER']),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits').optional(),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
  salary_advance: z.coerce.number().int().min(0).default(0),
  base_salary: z.coerce.number().int().min(0).default(0),
  salary_type: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).default('MONTHLY'),
  designation: z.string().optional(),
  joining_date: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ─── Staff Attendance & Transactions ──────────────────────

export const markAttendanceSchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'HOLIDAY']),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  notes: z.string().optional(),
});

export const recordTransactionSchema = z.object({
  employee_id: z.string().uuid(),
  type: z.enum(['SALARY_PAYMENT', 'ADVANCE_GIVEN', 'ADVANCE_REPAYMENT', 'BONUS', 'DEDUCTION']),
  amount: z.number().int().min(1, 'Amount must be greater than 0'),
  payment_date: z.string(),
  payment_method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  month: z.string().optional(),
  notes: z.string().optional(),
  transaction_ref: z.string().optional(),
});


// ─── Rate Card ───────────────────────────────────────────

export const createRateCardSchema = z.object({
  vehicle_type: z.enum(['TRAILOR', 'BODY_VEHICLE', 'EICHER']),
  hourly_rate: z.number().int().min(0),
  daily_rate: z.number().int().min(0),
});

export type CreateRateCardInput = z.infer<typeof createRateCardSchema>;

// ─── Login ───────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const pinLoginSchema = z.object({
  identifier: z.string().min(3, 'Enter mobile number or staff ID'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});

export type PinLoginInput = z.infer<typeof pinLoginSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
