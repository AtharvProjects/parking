import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

// ─── CURRENCY ────────────────────────────────────────────

/**
 * Format paise amount to INR display string.
 * e.g., 250000 → "₹2,500.00"
 */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Convert rupee amount to Indian currency words representation.
 * e.g., 800 → "Eight Hundred Rupees Only", 1250.50 → "One Thousand Two Hundred Fifty Rupees and Fifty Paise Only"
 */
export function numberToWordsINR(amountInRupees: number): string {
  if (isNaN(amountInRupees) || amountInRupees < 0) return "Zero Rupees Only";
  const rupees = Math.floor(amountInRupees);
  const paise = Math.round((amountInRupees - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanThousand(num: number): string {
    let str = "";
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + " ";
      num %= 10;
    }
    if (num > 0) {
      str += units[num] + " ";
    }
    return str.trim();
  }

  function convertRupees(num: number): string {
    if (num === 0) return "";
    let str = "";

    // Crore (1,00,00,000)
    if (num >= 10000000) {
      str += convertLessThanThousand(Math.floor(num / 10000000)) + " Crore ";
      num %= 10000000;
    }
    // Lakh (1,00,000)
    if (num >= 100000) {
      str += convertLessThanThousand(Math.floor(num / 100000)) + " Lakh ";
      num %= 100000;
    }
    // Thousand (1,000)
    if (num >= 1000) {
      str += convertLessThanThousand(Math.floor(num / 1000)) + " Thousand ";
      num %= 1000;
    }
    if (num > 0) {
      str += convertLessThanThousand(num);
    }
    return str.trim();
  }

  let result = "";
  if (rupees > 0) {
    result += convertRupees(rupees) + (rupees === 1 ? " Rupee" : " Rupees");
  }
  if (paise > 0) {
    if (result) result += " and ";
    result += convertLessThanThousand(paise) + (paise === 1 ? " Paisa" : " Paise");
  }
  return (result + " Only").trim();
}

// ─── DATE/TIME (IST) ────────────────────────────────────

/**
 * Format a Date to IST date string: "19 Jul 2025"
 */
export function formatDateIST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, IST, "dd MMM yyyy");
}

/**
 * Format a Date to IST time string: "02:30 PM"
 */
export function formatTimeIST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, IST, "hh:mm a");
}

/**
 * Format a Date to IST datetime: "19 Jul 2025, 02:30 PM"
 */
export function formatDateTimeIST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, IST, "dd MMM yyyy, hh:mm a");
}

/**
 * Format a Date to IST short date: "19/07/25"
 */
export function formatShortDateIST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, IST, "dd/MM/yy");
}

/**
 * Get current IST time
 */
export function nowIST(): Date {
  return new Date();
}

// ─── DURATION ────────────────────────────────────────────

/**
 * Humanize a duration in minutes.
 * e.g., 125 → "2h 5m", 1500 → "1d 1h"
 */
export function humanizeDuration(minutes: number): string {
  if (minutes < 1) return "< 1m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.floor(minutes % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && days === 0) parts.push(`${mins}m`); // Skip minutes if showing days

  return parts.join(" ") || "< 1m";
}

/**
 * Compute elapsed minutes from a start time to now.
 */
export function elapsedMinutes(from: Date | string): number {
  const start = typeof from === "string" ? new Date(from) : from;
  return Math.floor((Date.now() - start.getTime()) / 60000);
}

// ─── VEHICLE NUMBER ──────────────────────────────────────

/**
 * Normalize and format vehicle plate number.
 * "mh14ab1234" → "MH-14-AB-1234"
 */
export function formatPlateNumber(raw: string): string {
  const clean = raw.toUpperCase().replace(/[\s-]+/g, "");
  // Try to parse standard Indian format
  const match = clean.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (match) {
    const [, state, district, series, number] = match;
    return series
      ? `${state}-${district}-${series}-${number}`
      : `${state}-${district}-${number}`;
  }
  return clean;
}

// ─── RECEIPT NUMBER ──────────────────────────────────────

/**
 * Generate a receipt number: SWP-YYYYMMDD-XXXX
 */
export function generateReceiptNumber(sequenceNumber: number): string {
  const now = new Date();
  const dateStr = formatInTimeZone(now, IST, "yyyyMMdd");
  const seq = String(sequenceNumber).padStart(4, "0");
  return `SWP-${dateStr}-${seq}`;
}

// ─── PERCENTAGE ──────────────────────────────────────────

/**
 * Format a ratio as percentage: 0.86 → "86%"
 */
export function formatPercent(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/**
 * Compute percentage change between old and new values.
 */
export function percentChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal > 0 ? 100 : 0;
  return ((newVal - oldVal) / oldVal) * 100;
}

// ─── LOCAL TIME / IST DATE BOUNDS ────────────────────────

/**
 * Convert a YYYY-MM-DD string into start-of-day (00:00:00.000) or end-of-day (23:59:59.999)
 * ISO string in IST (Asia/Kolkata, UTC+5:30).
 *
 * FIX: Previously used local browser timezone. Now always computes IST-aware UTC timestamps.
 * IST offset is UTC+5:30 = 330 minutes ahead.
 * E.g. IST midnight 2025-07-19 00:00:00 = UTC 2025-07-18T18:30:00.000Z
 */
export function getLocalISOBounds(dateStr: string, isEnd = false): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 330 minutes in milliseconds

  if (!dateStr) {
    // Use current IST date
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);
    const year = nowIST.getUTCFullYear();
    const month = nowIST.getUTCMonth();
    const day = nowIST.getUTCDate();
    // Compute IST start/end of day, convert to UTC for Supabase query
    if (isEnd) {
      const istEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
      return new Date(istEnd.getTime() - IST_OFFSET_MS).toISOString();
    } else {
      const istStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      return new Date(istStart.getTime() - IST_OFFSET_MS).toISOString();
    }
  }

  if (dateStr.includes("T")) return new Date(dateStr).toISOString();

  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed for Date.UTC
  const day = parseInt(dayStr, 10);

  if (isEnd) {
    // IST 23:59:59.999 → subtract IST offset to get UTC
    const istEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return new Date(istEnd.getTime() - IST_OFFSET_MS).toISOString();
  }
  // IST 00:00:00.000 → subtract IST offset to get UTC
  const istStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return new Date(istStart.getTime() - IST_OFFSET_MS).toISOString();
}

/**
 * Get today's local date string formatted as YYYY-MM-DD for date inputs.
 */
export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

