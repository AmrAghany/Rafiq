import { orderPlans, tierForProduct, trialDays, type ProductInfo } from '../plans';

const product = (identifier: string, extra: Partial<ProductInfo> = {}): ProductInfo => ({
  identifier,
  priceString: '$12.99',
  ...extra,
});

describe('plans', () => {
  it('recognises Pro and Elite products on both stores', () => {
    expect(tierForProduct('rafiq_pro_monthly')).toBe('pro');
    expect(tierForProduct('rafiq_elite_monthly:monthly')).toBe('elite');
    expect(tierForProduct('something_else')).toBeNull();
  });

  it('reads an iOS free trial from the introductory offer', () => {
    expect(
      trialDays(
        product('p', {
          introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1 },
        }),
      ),
    ).toBe(7);
    expect(
      trialDays(
        product('p', {
          introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 },
        }),
      ),
    ).toBe(7);
    // A paid intro offer isn't a free trial.
    expect(
      trialDays(
        product('p', {
          introPrice: { price: 0.99, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 1 },
        }),
      ),
    ).toBeNull();
  });

  it('reads a Google Play free trial from the free phase', () => {
    expect(
      trialDays(
        product('p', {
          defaultOption: { freePhase: { billingPeriod: { unit: 'DAY', value: 7 } } },
        }),
      ),
    ).toBe(7);
    expect(trialDays(product('p', { defaultOption: { freePhase: null } }))).toBeNull();
    expect(trialDays(product('p'))).toBeNull();
  });

  it('lists Pro before Elite and drops unknown packages', () => {
    const packages = [
      { id: 'e', product: product('rafiq_elite_monthly') },
      { id: 'x', product: product('coins_100') },
      { id: 'p', product: product('rafiq_pro_monthly') },
    ];
    expect(orderPlans(packages).map((p) => [p.pkg.id, p.tier])).toEqual([
      ['p', 'pro'],
      ['e', 'elite'],
    ]);
  });
});
