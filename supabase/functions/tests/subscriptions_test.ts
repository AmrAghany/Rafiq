// RevenueCat mapping (pure) and the webhook / sync functions against local Supabase.

import { assert, assertEquals } from 'jsr:@std/assert@1';

import type { Deps } from '../_shared/context.ts';
import { Anthropic, createClient } from '../_shared/deps.ts';
import { DAILY_LIMITS } from '../_shared/entitlements.ts';
import {
  memberIdsFromEvent,
  revenueCatClient,
  safeEqual,
  toSubscriptionRow,
  type RcSubscriber,
} from '../_shared/revenuecat.ts';
import { startFakeRevenueCat } from './fake_revenuecat.ts';
import { syncHandler, webhookHandler } from './handlers.ts';

const now = new Date('2026-10-06T12:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

const proTrial: RcSubscriber = {
  entitlements: { pro: { expires_date: days(5), product_identifier: 'rafiq_pro_monthly' } },
  subscriptions: {
    rafiq_pro_monthly: { expires_date: days(5), period_type: 'trial', store: 'app_store' },
  },
  management_url: 'https://apps.apple.com/account/subscriptions',
};

Deno.test('a free trial of Pro', () => {
  assertEquals(toSubscriptionRow(proTrial, now), {
    tier: 'pro',
    status: 'trial',
    product_id: 'rafiq_pro_monthly',
    store: 'app_store',
    is_trial: true,
    current_period_ends_at: days(5),
    will_renew: true,
    management_url: 'https://apps.apple.com/account/subscriptions',
  });
});

Deno.test('Elite wins over Pro; cancelled stays active until the period ends', () => {
  const both: RcSubscriber = {
    entitlements: {
      pro: { expires_date: days(20), product_identifier: 'rafiq_elite_monthly' },
      elite: { expires_date: days(20), product_identifier: 'rafiq_elite_monthly' },
    },
    subscriptions: {
      rafiq_elite_monthly: {
        expires_date: days(20),
        period_type: 'normal',
        store: 'play_store',
        unsubscribe_detected_at: days(-1),
      },
    },
  };
  const row = toSubscriptionRow(both, now);
  assertEquals(
    [row.tier, row.status, row.will_renew, row.store],
    ['elite', 'cancelled', false, 'play_store'],
  );
});

Deno.test('billing grace period keeps access; expiry drops to free', () => {
  const grace: RcSubscriber = {
    entitlements: {
      pro: {
        expires_date: days(-1),
        grace_period_expires_date: days(6),
        product_identifier: 'rafiq_pro_monthly',
      },
    },
    subscriptions: {
      rafiq_pro_monthly: {
        expires_date: days(-1),
        period_type: 'normal',
        billing_issues_detected_at: days(-1),
      },
    },
  };
  const row = toSubscriptionRow(grace, now);
  assertEquals(
    [row.tier, row.status, row.current_period_ends_at],
    ['pro', 'billing_issue', days(6)],
  );

  const lapsed: RcSubscriber = {
    entitlements: { pro: { expires_date: days(-3), product_identifier: 'rafiq_pro_monthly' } },
    subscriptions: { rafiq_pro_monthly: { expires_date: days(-3), period_type: 'normal' } },
  };
  assertEquals(toSubscriptionRow(lapsed, now), {
    tier: 'free',
    status: 'expired',
    product_id: null,
    store: null,
    is_trial: false,
    current_period_ends_at: null,
    will_renew: false,
    management_url: null,
  });
  assertEquals(toSubscriptionRow({ entitlements: {}, subscriptions: {} }, now).status, 'none');
});

Deno.test('webhook ids and secret comparison', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  assertEquals(
    memberIdsFromEvent({
      app_user_id: a,
      original_app_user_id: '$RCAnonymousID:abc',
      aliases: [a],
    }),
    [a],
  );
  assertEquals(
    memberIdsFromEvent({ type: 'TRANSFER', transferred_from: [a], transferred_to: [b] }),
    [a, b],
  );
  assertEquals(memberIdsFromEvent({}), []);
  assert(safeEqual('secret', 'secret'));
  assert(!safeEqual('secret', 'secreT'));
  assert(!safeEqual('secret', 'secret2'));
});

const URL_ = Deno.env.get('API_URL');
const ANON = Deno.env.get('ANON_KEY');
const SERVICE = Deno.env.get('SERVICE_ROLE_KEY');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.test({
  name: 'webhook and sync against local Supabase',
  ignore: !(URL_ && ANON && SERVICE),
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const rc = startFakeRevenueCat();
    const service = createClient(URL_!, SERVICE!, noSession);
    const deps: Deps = {
      userClient: (jwt) =>
        createClient(URL_!, ANON!, {
          ...noSession,
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        }),
      serviceClient: () => service,
      anthropic: () => new Anthropic({ apiKey: 'unused' }),
      revenuecat: () => revenueCatClient(rc.secret, rc.baseUrl),
      now: () => now,
    };
    const webhook = webhookHandler(deps, 'whsec_test');
    const sync = syncHandler(deps);

    const email = `rc-${crypto.randomUUID()}@example.com`;
    const { data: created } = await service.auth.admin.createUser({
      email,
      password: 'long-enough-pw',
      email_confirm: true,
    });
    const uid = created.user!.id;
    const anon = createClient(URL_!, ANON!, noSession);
    const { data: session } = await anon.auth.signInWithPassword({
      email,
      password: 'long-enough-pw',
    });
    const jwt = session.session!.access_token;

    const hook = (body: unknown, token: string | null = 'whsec_test') =>
      webhook(
        new Request('http://localhost/revenuecat-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
    const row = async () =>
      (
        await service
          .from('subscriptions')
          .select(
            'tier, status, is_trial, will_renew, product_id, current_period_ends_at, synced_at',
          )
          .eq('user_id', uid)
          .single()
      ).data!;
    const tierRpc = async () => (await service.rpc('current_tier', { p_user_id: uid })).data;

    await t.step('rejects calls without the shared secret', async () => {
      assertEquals(
        (await hook({ event: { type: 'INITIAL_PURCHASE', app_user_id: uid } }, null)).status,
        401,
      );
      assertEquals(
        (await hook({ event: { type: 'INITIAL_PURCHASE', app_user_id: uid } }, 'wrong')).status,
        401,
      );
      assertEquals(rc.calls.length, 0);
    });

    await t.step('acknowledges test events without syncing', async () => {
      const res = await hook({ event: { type: 'TEST', app_user_id: uid } });
      assertEquals(await res.json(), { ok: true, synced: 0 });
    });

    await t.step('a trial purchase makes the member Pro, which unlocks AI quotas', async () => {
      rc.subscribers.set(uid, proTrial);
      const res = await hook({
        event: { type: 'INITIAL_PURCHASE', app_user_id: uid, period_type: 'TRIAL' },
      });
      assertEquals(await res.json(), { ok: true, synced: 1 });
      const r = await row();
      assertEquals(
        [r.tier, r.status, r.is_trial, r.will_renew, r.product_id],
        ['pro', 'trial', true, true, 'rafiq_pro_monthly'],
      );
      assert(r.synced_at);
      assertEquals(await tierRpc(), 'pro');
      assert(DAILY_LIMITS.pro.coach_chat > 0);
    });

    await t.step(
      'events are only triggers: an out-of-order old event still syncs the latest state',
      async () => {
        rc.subscribers.set(uid, {
          entitlements: {
            elite: { expires_date: days(30), product_identifier: 'rafiq_elite_monthly' },
          },
          subscriptions: {
            rafiq_elite_monthly: {
              expires_date: days(30),
              period_type: 'normal',
              store: 'app_store',
            },
          },
        });
        await hook({
          event: { type: 'INITIAL_PURCHASE', app_user_id: uid, event_timestamp_ms: 1 },
        });
        assertEquals((await row()).tier, 'elite');
      },
    );

    await t.step('expiry drops the member to free', async () => {
      rc.subscribers.set(uid, {
        entitlements: {
          elite: { expires_date: days(-1), product_identifier: 'rafiq_elite_monthly' },
        },
        subscriptions: { rafiq_elite_monthly: { expires_date: days(-1), period_type: 'normal' } },
      });
      await hook({ event: { type: 'EXPIRATION', app_user_id: uid } });
      const r = await row();
      assertEquals([r.tier, r.status], ['free', 'expired']);
      assertEquals(await tierRpc(), 'free');
    });

    await t.step('a RevenueCat outage returns 500 so RevenueCat retries', async () => {
      rc.failNext();
      assertEquals((await hook({ event: { type: 'RENEWAL', app_user_id: uid } })).status, 500);
    });

    await t.step('anonymous and unknown ids are ignored', async () => {
      const res = await hook({
        event: { type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:x' },
      });
      assertEquals(await res.json(), { ok: true, synced: 0 });
    });

    await t.step('the app can sync right after a purchase', async () => {
      rc.subscribers.set(uid, proTrial);
      const unauth = await sync(
        new Request('http://localhost/sync-subscription', { method: 'POST' }),
      );
      assertEquals(unauth.status, 401);
      const res = await sync(
        new Request('http://localhost/sync-subscription', {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}` },
        }),
      );
      assertEquals(res.status, 200);
      assertEquals((await res.json()).subscription.tier, 'pro');
      assertEquals((await row()).tier, 'pro');
    });

    await t.step('members still cannot write their own tier', async () => {
      const db = createClient(URL_!, ANON!, {
        ...noSession,
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      await db.from('subscriptions').update({ tier: 'elite' }).eq('user_id', uid);
      assertEquals((await row()).tier, 'pro');
    });

    await service.auth.admin.deleteUser(uid);
    await rc.close();
  },
});
