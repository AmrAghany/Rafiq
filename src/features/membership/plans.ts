// Pure helpers for the paywall: which plan a store product is, and its free trial.
// Products follow the naming in README ("rafiq_pro_monthly", "rafiq_elite_monthly"); on
// Google Play the product id may carry a base plan suffix ("rafiq_pro_monthly:monthly").

import type { Tier } from './entitlements';

export type PaidTier = Exclude<Tier, 'free'>;

export function tierForProduct(productId: string): PaidTier | null {
  const id = productId.toLowerCase();
  if (id.includes('elite')) return 'elite';
  if (id.includes('pro')) return 'pro';
  return null;
}

type PeriodUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | string;
const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** The parts of a RevenueCat store product the paywall needs. */
export interface ProductInfo {
  identifier: string;
  priceString: string;
  /** iOS: introductory offer. */
  introPrice?: {
    price: number;
    periodUnit: PeriodUnit;
    periodNumberOfUnits: number;
    cycles: number;
  } | null;
  /** Google Play: the default subscription option's free phase. */
  defaultOption?: {
    freePhase?: { billingPeriod: { unit: PeriodUnit; value: number } } | null;
  } | null;
}

/** Length of the free trial in days, or null when the product has none (or isn't eligible). */
export function trialDays(product: ProductInfo): number | null {
  const intro = product.introPrice;
  if (intro && intro.price === 0) {
    return (
      (UNIT_DAYS[intro.periodUnit] ?? 0) * intro.periodNumberOfUnits * Math.max(1, intro.cycles) ||
      null
    );
  }
  const free = product.defaultOption?.freePhase?.billingPeriod;
  if (free) return (UNIT_DAYS[free.unit] ?? 0) * free.value || null;
  return null;
}

/** Pro first, then Elite; anything unrecognised is left out. */
export function orderPlans<T extends { product: ProductInfo }>(packages: readonly T[]) {
  return packages
    .map((pkg) => ({ pkg, tier: tierForProduct(pkg.product.identifier) }))
    .filter((p): p is { pkg: T; tier: PaidTier } => p.tier != null)
    .sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'pro' ? -1 : 1));
}
