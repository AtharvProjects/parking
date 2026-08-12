/**
 * Billing computation engine for the parking management system.
 *
 * All monetary values are in PAISE (₹ × 100) to avoid floating-point issues.
 * All computations happen server-side — never trust client-computed amounts.
 */

import { differenceInMinutes } from "date-fns";

export interface BillingConfig {
  gracePeriodMinutes: number;
  roundingIntervalMin: number;
  dayRateSwitchoverHrs: number;
}

export interface RateInfo {
  hourlyRate: number; // paise
  dailyRate: number; // paise
}

export interface BillingResult {
  rawMinutes: number;
  billableMinutes: number;
  roundedMinutes: number;
  roundedHours: number;
  fullDays: number;
  remainingHours: number;
  usedDayRate: boolean;
  grossAmount: number; // paise
  breakdown: string; // Human-readable breakdown
}

/**
 * Compute parking charges for a session.
 *
 * Logic:
 * 1. If within grace period → ₹0
 * 2. Subtract grace period from raw duration
 * 3. Round up to next `roundingIntervalMin`
 * 4. If rounded duration >= `dayRateSwitchoverHrs`:
 *    - Charge full days at daily rate
 *    - Remainder: if >= switchover threshold → another full day, else hourly
 * 5. Else: charge hourly
 */
export function computeCharges(
  entryAt: Date,
  exitAt: Date,
  rate: RateInfo,
  config: BillingConfig
): BillingResult {
  const rawMinutes = Math.max(0, differenceInMinutes(exitAt, entryAt));

  // Grace period
  if (rawMinutes <= config.gracePeriodMinutes) {
    return {
      rawMinutes,
      billableMinutes: 0,
      roundedMinutes: 0,
      roundedHours: 0,
      fullDays: 0,
      remainingHours: 0,
      usedDayRate: false,
      grossAmount: 0,
      breakdown: `Within grace period (${config.gracePeriodMinutes} min free)`,
    };
  }

  const billableMinutes = rawMinutes - config.gracePeriodMinutes;

  // Round up to next interval
  const roundedMinutes =
    Math.ceil(billableMinutes / config.roundingIntervalMin) *
    config.roundingIntervalMin;
  const roundedHours = roundedMinutes / 60;

  const switchoverHrs = config.dayRateSwitchoverHrs;

  // Day rate switchover logic
  if (roundedHours >= switchoverHrs) {
    const fullDays = Math.floor(roundedHours / 24);
    const remainingHours = roundedHours - fullDays * 24;

    let grossAmount: number;
    let breakdown: string;

    if (remainingHours >= switchoverHrs) {
      // Remaining exceeds switchover → charge as another full day
      grossAmount = (fullDays + 1) * rate.dailyRate;
      breakdown =
        fullDays > 0
          ? `${fullDays + 1} day(s) × ${formatPaise(rate.dailyRate)}`
          : `1 day × ${formatPaise(rate.dailyRate)}`;
    } else if (remainingHours > 0) {
      // Mix of daily + hourly
      const dailyPart = fullDays * rate.dailyRate;
      const hourlyPart = Math.ceil(remainingHours) * rate.hourlyRate;
      grossAmount = dailyPart + hourlyPart;
      breakdown =
        fullDays > 0
          ? `${fullDays} day(s) × ${formatPaise(rate.dailyRate)} + ${Math.ceil(remainingHours)} hr(s) × ${formatPaise(rate.hourlyRate)}`
          : `${Math.ceil(remainingHours)} hr(s) × ${formatPaise(rate.hourlyRate)}`;
    } else {
      grossAmount = fullDays * rate.dailyRate;
      breakdown = `${fullDays} day(s) × ${formatPaise(rate.dailyRate)}`;
    }

    return {
      rawMinutes,
      billableMinutes,
      roundedMinutes,
      roundedHours,
      fullDays,
      remainingHours,
      usedDayRate: true,
      grossAmount,
      breakdown,
    };
  }

  // Hourly billing
  const hours = Math.ceil(roundedHours);
  const grossAmount = hours * rate.hourlyRate;

  return {
    rawMinutes,
    billableMinutes,
    roundedMinutes,
    roundedHours,
    fullDays: 0,
    remainingHours: roundedHours,
    usedDayRate: false,
    grossAmount,
    breakdown: `${hours} hr(s) × ${formatPaise(rate.hourlyRate)}`,
  };
}

/**
 * Apply a discount to a gross amount.
 */
export function applyDiscount(
  grossAmount: number,
  discountType: "PERCENTAGE" | "FLAT",
  discountValue: number
): { discountAmount: number; finalAmount: number } {
  let discountAmount: number;

  if (discountType === "PERCENTAGE") {
    discountAmount = Math.round((grossAmount * discountValue) / 100);
  } else {
    discountAmount = Math.min(discountValue, grossAmount); // Can't discount more than gross
  }

  return {
    discountAmount,
    finalAmount: Math.max(0, grossAmount - discountAmount),
  };
}

/**
 * Helper: format paise as rupee string for billing breakdown.
 */
function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

/**
 * Check if a session is overstaying.
 */
export function isOverstaying(
  entryAt: Date,
  overstayAlertHrs: number
): boolean {
  const minutesSinceEntry = differenceInMinutes(new Date(), entryAt);
  return minutesSinceEntry >= overstayAlertHrs * 60;
}
