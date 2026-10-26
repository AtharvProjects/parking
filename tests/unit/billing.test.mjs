import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import billing engine
import { computeCharges, applyDiscount, isOverstaying } from '../../src/core/billing.ts';
import { formatPlateNumber, generateReceiptNumber, formatINR, formatDateIST, numberToWordsINR, getLocalISOBounds } from '../../src/lib/formatters.ts';

describe('Billing Engine Unit Tests', () => {
  const rate = {
    hourlyRate: 5000, // ₹50/hr
    dailyRate: 40000, // ₹400/day
  };

  const config = {
    gracePeriodMinutes: 15,
    roundingIntervalMin: 30,
    dayRateSwitchoverHrs: 12,
  };

  test('within grace period charges ₹0', () => {
    const entry = new Date('2026-08-16T10:00:00Z');
    const exit = new Date('2026-08-16T10:14:00Z'); // 14 mins

    const result = computeCharges(entry, exit, rate, config);
    assert.equal(result.grossAmount, 0);
    assert.equal(result.usedDayRate, false);
    assert.match(result.breakdown, /grace period/i);
  });

  test('exact grace period charges ₹0', () => {
    const entry = new Date('2026-08-16T10:00:00Z');
    const exit = new Date('2026-08-16T10:15:00Z'); // 15 mins

    const result = computeCharges(entry, exit, rate, config);
    assert.equal(result.grossAmount, 0);
  });

  test('just past grace period rounds up to 30 mins interval', () => {
    const entry = new Date('2026-08-16T10:00:00Z');
    const exit = new Date('2026-08-16T10:20:00Z'); // 20 mins, billable = 5 mins, rounded = 30 mins (0.5 hr)

    const result = computeCharges(entry, exit, rate, config);
    // 0.5 hr rounds up to 1 hr for hourly billing = 1 × ₹50 = ₹50 (5000 paise)
    assert.equal(result.grossAmount, 5000);
    assert.equal(result.usedDayRate, false);
  });

  test('4 hours parking charges standard hourly rate', () => {
    const entry = new Date('2026-08-16T10:00:00Z');
    const exit = new Date('2026-08-16T14:15:00Z'); // 4h 15m - 15m grace = 4h

    const result = computeCharges(entry, exit, rate, config);
    assert.equal(result.grossAmount, 20000); // 4 * ₹50 = ₹200 (20000 paise)
    assert.equal(result.usedDayRate, false);
  });

  test('switches to daily rate when hours >= dayRateSwitchoverHrs', () => {
    const entry = new Date('2026-08-16T00:00:00Z');
    const exit = new Date('2026-08-16T13:00:00Z'); // 13 hours

    const result = computeCharges(entry, exit, rate, config);
    assert.equal(result.usedDayRate, true);
    assert.equal(result.grossAmount, 40000); // 1 full day = ₹400 (40000 paise)
  });

  test('multi-day parking applies daily rate + remaining hours', () => {
    const entry = new Date('2026-08-16T00:00:00Z');
    const exit = new Date('2026-08-17T05:00:00Z'); // 29 hours (1 day + 5 hrs)

    const result = computeCharges(entry, exit, rate, config);
    assert.equal(result.usedDayRate, true);
    assert.equal(result.fullDays, 1);
    // 1 day (40000) + 5 hrs (5 * 5000 = 25000) = 65000 paise
    assert.equal(result.grossAmount, 65000);
  });

  test('discounts: percentage discount applied correctly', () => {
    const { discountAmount, finalAmount } = applyDiscount(10000, 'PERCENTAGE', 10);
    assert.equal(discountAmount, 1000); // 10% of 10000
    assert.equal(finalAmount, 9000);
  });

  test('discounts: flat discount capped at gross amount', () => {
    const { discountAmount, finalAmount } = applyDiscount(5000, 'FLAT', 8000);
    assert.equal(discountAmount, 5000);
    assert.equal(finalAmount, 0);
  });

  test('overstay alert detection', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    assert.equal(isOverstaying(fiveHoursAgo, 4), true); // over 4 hrs
    assert.equal(isOverstaying(fiveHoursAgo, 8), false); // under 8 hrs
  });
});

describe('Formatters and Normalization Tests', () => {
  test('formatPlateNumber formats standard Indian vehicle plates', () => {
    assert.equal(formatPlateNumber('mh14ab1234'), 'MH-14-AB-1234');
    assert.equal(formatPlateNumber('MH-20-BC-9999'), 'MH-20-BC-9999');
  });

  test('formatINR converts paise to Indian Rupee string', () => {
    assert.equal(formatINR(5000), '₹50');
    assert.equal(formatINR(40000), '₹400');
    assert.equal(formatINR(0), '₹0');
  });

  test('numberToWordsINR converts numbers to currency words', () => {
    assert.equal(numberToWordsINR(500), 'Five Hundred Rupees Only');
    assert.equal(numberToWordsINR(1250), 'One Thousand Two Hundred Fifty Rupees Only');
  });

  test('getLocalISOBounds computes accurate IST bounds in UTC', () => {
    const startStr = getLocalISOBounds('2026-08-16', false);
    const endStr = getLocalISOBounds('2026-08-16', true);

    // IST midnight 2026-08-16 00:00:00 = 2026-08-15T18:30:00.000Z in UTC
    assert.equal(startStr, '2026-08-15T18:30:00.000Z');
    // IST end of day 2026-08-16 23:59:59.999 = 2026-08-16T18:29:59.999Z in UTC
    assert.equal(endStr, '2026-08-16T18:29:59.999Z');
  });
});
