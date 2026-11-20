/**
 * Integer-kuruş financial precision utilities to prevent floating-point drift.
 * 1 TL = 100 Kuruş.
 */

export function toKurus(tlAmount: number | string): number {
  let num: number;
  if (typeof tlAmount === 'string') {
    const trimmed = tlAmount.trim().replace(/\s+/g, '');
    if (!trimmed) return 0;
    const normalized =
      trimmed.includes('.') && trimmed.includes(',')
        ? trimmed.replace(/\./g, '').replace(',', '.')
        : trimmed.replace(',', '.');
    num = parseFloat(normalized);
  } else {
    num = tlAmount;
  }
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromKurus(kurus: number): number {
  if (!Number.isFinite(kurus)) return 0;
  return kurus / 100;
}

export function formatKurusTRY(kurus: number, withDecimals = true): string {
  const tl = fromKurus(kurus);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(tl);
}

export interface LineCalcResult {
  rawGrossKurus: number;
  discountKurus: number;
  netKurus: number;
  vatKurus: number;
  grossTotalKurus: number;
}

export function calculateLineKurus(
  quantity: number,
  unitPriceKurus: number,
  discountRatePct = 0,
  vatRatePct = 20
): LineCalcResult {
  const safeQty = Math.max(0, Number.isFinite(quantity) ? quantity : 0);
  const safePrice = Math.max(0, Math.round(unitPriceKurus || 0));
  const rawGrossKurus = Math.round(safeQty * safePrice);
  const clampedDisc = Math.min(100, Math.max(0, discountRatePct || 0));
  const discountKurus = Math.round((rawGrossKurus * clampedDisc) / 100);
  const netKurus = rawGrossKurus - discountKurus;
  const clampedVat = Math.max(0, vatRatePct || 0);
  const vatKurus = Math.round((netKurus * clampedVat) / 100);
  const grossTotalKurus = netKurus + vatKurus;
  return { rawGrossKurus, discountKurus, netKurus, vatKurus, grossTotalKurus };
}

/**
 * Splits an integer kuruş total across weighted buckets using the largest-remainder method
 * so the sum of allocations equals `totalKurus` exactly with zero rounding drift.
 */
export function allocateKurusByWeights(totalKurus: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const weightSum = safeWeights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0 || totalKurus === 0) return safeWeights.map(() => 0);

  const exact = safeWeights.map((w) => (totalKurus * w) / weightSum);
  const floored = exact.map((e) => Math.floor(e));
  let remainder = totalKurus - floored.reduce((s, f) => s + f, 0);

  const order = exact
    .map((e, idx) => ({ idx, frac: e - floored[idx] }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < order.length && remainder > 0; i++) {
    floored[order[i].idx] += 1;
    remainder--;
  }
  return floored;
}
