// RevenueCat REST API (v1 subscribers) and the mapping to our subscriptions row.
// The app identifies members to RevenueCat with their Supabase user id, so
// RevenueCat's app_user_id is our auth.users.id.

import { HttpError } from './http.ts';

/** Entitlement identifiers configured in the RevenueCat dashboard. */
export const ENTITLEMENTS = { pro: 'pro', elite: 'elite' } as const;

export interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
  purchase_date?: string;
}

export interface RcSubscription {
  expires_date: string | null;
  period_type?: 'normal' | 'trial' | 'intro' | string;
  store?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
}

export interface RcSubscriber {
  entitlements: Record<string, RcEntitlement>;
  subscriptions: Record<string, RcSubscription>;
  management_url?: string | null;
}

export interface RevenueCatClient {
  getSubscriber(appUserId: string): Promise<RcSubscriber>;
  deleteSubscriber(appUserId: string): Promise<void>;
}

export function revenueCatClient(
  secretKey: string,
  baseUrl = 'https://api.revenuecat.com',
): RevenueCatClient {
  const headers = { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };
  return {
    async getSubscriber(appUserId) {
      const res = await fetch(`${baseUrl}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
        headers,
      });
      if (!res.ok) {
        console.error('revenuecat_error', res.status);
        throw new HttpError('internal');
      }
      const body = await res.json();
      return body.subscriber as RcSubscriber;
    },
    async deleteSubscriber(appUserId) {
      const res = await fetch(`${baseUrl}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok && res.status !== 404) {
        console.error('revenuecat_error', res.status);
        throw new HttpError('internal');
      }
    },
  };
}

export type Tier = 'free' | 'pro' | 'elite';
export type Status = 'none' | 'trial' | 'active' | 'cancelled' | 'billing_issue' | 'expired';

export interface SubscriptionRow {
  tier: Tier;
  status: Status;
  product_id: string | null;
  store: string | null;
  is_trial: boolean;
  current_period_ends_at: string | null;
  will_renew: boolean;
  management_url: string | null;
}

/** When an entitlement stops giving access: the later of expiry and any billing grace period. */
function accessUntil(e: RcEntitlement): Date | null {
  if (e.expires_date == null) return null; // lifetime / non-expiring
  const ends = [e.expires_date, e.grace_period_expires_date]
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime());
  return new Date(Math.max(...ends));
}

/** Maps RevenueCat's view of a subscriber to the row we mirror. Pure. */
export function toSubscriptionRow(subscriber: RcSubscriber, now: Date): SubscriptionRow {
  const active = (id: string) => {
    const e = subscriber.entitlements?.[id];
    if (!e) return null;
    const until = accessUntil(e);
    return until == null || until > now ? { e, until } : null;
  };
  const elite = active(ENTITLEMENTS.elite);
  const pro = active(ENTITLEMENTS.pro);
  const chosen = elite ?? pro;
  const management_url = subscriber.management_url ?? null;

  if (!chosen) {
    const hadAccess = Object.keys(subscriber.entitlements ?? {}).length > 0;
    return {
      tier: 'free',
      status: hadAccess ? 'expired' : 'none',
      product_id: null,
      store: null,
      is_trial: false,
      current_period_ends_at: null,
      will_renew: false,
      management_url,
    };
  }

  const sub = subscriber.subscriptions?.[chosen.e.product_identifier];
  const isTrial = sub?.period_type === 'trial';
  const willRenew = !!sub && !sub.unsubscribe_detected_at && chosen.e.expires_date != null;
  const status: Status = sub?.billing_issues_detected_at
    ? 'billing_issue'
    : sub?.unsubscribe_detected_at
      ? 'cancelled'
      : isTrial
        ? 'trial'
        : 'active';

  return {
    tier: elite ? 'elite' : 'pro',
    status,
    product_id: chosen.e.product_identifier,
    store: sub?.store ?? null,
    is_trial: isTrial,
    current_period_ends_at: chosen.until?.toISOString() ?? null,
    will_renew: willRenew,
    management_url,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Our members' ids mentioned by a webhook event (anonymous RevenueCat ids are ignored). */
export function memberIdsFromEvent(event: Record<string, unknown>): string[] {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...((event.aliases as unknown[]) ?? []),
    ...((event.transferred_from as unknown[]) ?? []),
    ...((event.transferred_to as unknown[]) ?? []),
  ];
  return [
    ...new Set(candidates.filter((c): c is string => typeof c === 'string' && UUID_RE.test(c))),
  ];
}

/** Constant-time comparison for the webhook's shared secret. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
