import { describe, expect, it } from 'vitest';
import {
  allocateKurusByWeights,
  calculateLineKurus,
  formatKurusTRY,
  fromKurus,
  toKurus,
} from '../utils/money';

describe('money utilities (integer kuruş precision)', () => {
  it('converts TL numbers and Turkish comma strings accurately without float drift', () => {
    expect(toKurus(19.99)).toBe(1999);
    expect(toKurus('1250,75')).toBe(125075);
    expect(toKurus('1.250.000,50')).toBe(125000050);
    expect(toKurus('0.1')).toBe(10);
    expect(fromKurus(100250)).toBe(1002.5);
    expect(toKurus('invalid')).toBe(0);
  });

  it('calculates line discount, VAT, and gross total in kuruş', () => {
    const res = calculateLineKurus(10, toKurus(150), 10, 20);
    // raw = 1500 TL (150_000 kurus), disc 10% = 150 TL, net = 1350 TL, vat 20% = 270 TL, gross = 1620 TL
    expect(res.rawGrossKurus).toBe(150_000);
    expect(res.discountKurus).toBe(15_000);
    expect(res.netKurus).toBe(135_000);
    expect(res.vatKurus).toBe(27_000);
    expect(res.grossTotalKurus).toBe(162_000);
  });

  it('allocates kuruş across multiple projects/warehouses with zero rounding drift', () => {
    const splits = allocateKurusByWeights(10_000, [1, 1, 1]);
    expect(splits.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(splits).toEqual([3334, 3333, 3333]);

    const realWorld = allocateKurusByWeights(toKurus(100_000), [60, 30, 10]);
    expect(realWorld).toEqual([6_000_000, 3_000_000, 1_000_000]);
  });

  it('formats Turkish currency string consistently', () => {
    const formatted = formatKurusTRY(toKurus(12500.5));
    expect(formatted).toContain('12.500,50');
  });
});
