// The smart-station contract (pure) and station-api against local Supabase.

import { assert, assertEquals } from 'jsr:@std/assert@1';

import type { Deps } from '../_shared/context.ts';
import { Anthropic, createClient } from '../_shared/deps.ts';
import {
  MAX_SKEW_SECONDS,
  parseStationRequest,
  signStationRequest,
  verifyStationRequest,
} from '../_shared/station.ts';
import { stationHandler } from './handlers.ts';

const URL_ = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('API_URL');
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY');
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

const SECRET = 'test-secret-0123456789abcdef0123456789';

Deno.test('station signatures: HMAC-SHA256 of "timestamp.body", within 5 minutes', async () => {
  const now = new Date('2026-10-07T10:00:00Z');
  const ts = String(now.getTime() / 1000);
  const body = '{"type":"pairing_code"}';
  const sig = await signStationRequest(SECRET, ts, body);
  assert(/^v1=[0-9a-f]{64}$/.test(sig));
  assertEquals(await verifyStationRequest(SECRET, ts, body, sig, now), 'ok');
  assertEquals(await verifyStationRequest(SECRET, ts, body + ' ', sig, now), 'bad_signature');
  assertEquals(
    await verifyStationRequest('other-secret-xxxxxxxxxxxxxxxxxxxxxx', ts, body, sig, now),
    'bad_signature',
  );
  const late = new Date(now.getTime() + (MAX_SKEW_SECONDS + 1) * 1000);
  assertEquals(await verifyStationRequest(SECRET, ts, body, sig, late), 'stale_timestamp');
  assertEquals(await verifyStationRequest(SECRET, 'soon', body, sig, now), 'stale_timestamp');
});

Deno.test('station request bodies', () => {
  assertEquals(parseStationRequest({ type: 'pairing_code' }), {
    type: 'pairing_code',
  });
  assertEquals(parseStationRequest({ type: 'end' }), { type: 'end' });
  assertEquals(
    parseStationRequest({
      type: 'set',
      event_id: 'rack3-000123',
      exercise_key: 'back_squat',
      weight_kg: 100,
      reps: 5,
    }),
    {
      type: 'set',
      event_id: 'rack3-000123',
      exercise_key: 'back_squat',
      weight_kg: 100,
      reps: 5,
      performed_at: null,
    },
  );
  for (const bad of [
    null,
    { type: 'nope' },
    {
      type: 'set',
      event_id: '',
      exercise_key: 'back_squat',
      weight_kg: 1,
      reps: 1,
    },
    {
      type: 'set',
      event_id: 'a',
      exercise_key: 'Back Squat',
      weight_kg: 1,
      reps: 1,
    },
    {
      type: 'set',
      event_id: 'a',
      exercise_key: 'back_squat',
      weight_kg: '100',
      reps: 1,
    },
    {
      type: 'set',
      event_id: 'a',
      exercise_key: 'back_squat',
      weight_kg: 100,
      reps: 2.5,
    },
    {
      type: 'set',
      event_id: 'a',
      exercise_key: 'back_squat',
      weight_kg: 100,
      reps: 2,
      performed_at: 'x',
    },
  ]) {
    assertEquals(parseStationRequest(bad), null);
  }
});

Deno.test({
  name: 'station-api against local Supabase',
  ignore: !(URL_ && ANON && SERVICE),
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const service = createClient(URL_!, SERVICE!, noSession);
    const now = new Date();
    const deps: Deps = {
      userClient: (jwt) =>
        createClient(URL_!, ANON!, {
          ...noSession,
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        }),
      serviceClient: () => service,
      anthropic: () => new Anthropic({ apiKey: 'unused' }),
      revenuecat: () => null,
      now: () => now,
    };
    const api = stationHandler(deps);
    const stationId = `test-rack-${crypto.randomUUID().slice(0, 8)}`;
    await service.from('stations').insert({
      id: stationId,
      label: 'Rack 3',
      gym_name: 'FitZone Olaya',
      exercise_keys: ['back_squat', 'deadlift'],
      secret: SECRET,
    });

    const call = async (
      body: unknown,
      opts: { secret?: string; station?: string; ts?: string } = {},
    ) => {
      const raw = JSON.stringify(body);
      const ts = opts.ts ?? String(Math.floor(now.getTime() / 1000));
      const res = await api(
        new Request('http://localhost/station-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Rafiq-Station': opts.station ?? stationId,
            'X-Rafiq-Timestamp': ts,
            'X-Rafiq-Signature': await signStationRequest(opts.secret ?? SECRET, ts, raw),
          },
          body: raw,
        }),
      );
      return { status: res.status, body: await res.json() };
    };

    // A member with today's plan.
    const email = `st-${crypto.randomUUID()}@example.com`;
    const { data: created } = await service.auth.admin.createUser({
      email,
      password: 'long-enough-pw',
      email_confirm: true,
    });
    const uid = created.user!.id;
    const week = Array.from({ length: 7 }, () => ({ workoutKey: 'lower_a', dayType: 'high' }));
    await service.from('plans').insert({
      user_id: uid,
      version: 1,
      engine_version: '1.0.0',
      inputs: {},
      plan: {
        week,
        schemes: {
          main: { sets: 4, reps: 6 },
          accessory: { sets: 3, reps: 10 },
        },
      },
    });
    const anon = createClient(URL_!, ANON!, noSession);
    const { data: session } = await anon.auth.signInWithPassword({
      email,
      password: 'long-enough-pw',
    });
    const member = deps.userClient(session.session!.access_token);

    await t.step('unsigned, wrongly signed, unknown and stale requests are refused', async () => {
      assertEquals(
        (
          await call(
            { type: 'pairing_code' },
            {
              secret: 'wrong-secret-xxxxxxxxxxxxxxxxxxxxx',
            },
          )
        ).status,
        401,
      );
      assertEquals(
        (await call({ type: 'pairing_code' }, { station: 'no-such-station' })).status,
        401,
      );
      const stale = await call(
        { type: 'pairing_code' },
        {
          ts: String(Math.floor(now.getTime() / 1000) - 600),
        },
      );
      assertEquals([stale.status, stale.body.error.code], [401, 'stale_timestamp']);
      const res = await api(
        new Request('http://localhost/station-api', {
          method: 'POST',
          body: '{}',
        }),
      );
      assertEquals(res.status, 401);
      assertEquals((await call({ type: 'dance' })).status, 400);
    });

    await t.step('a set before pairing is refused', async () => {
      const res = await call({
        type: 'set',
        event_id: 'e0',
        exercise_key: 'back_squat',
        weight_kg: 100,
        reps: 5,
      });
      assertEquals([res.status, res.body.error.code], [409, 'not_paired']);
    });

    await t.step(
      'the member pairs with the code the station shows, and sets are logged',
      async () => {
        const code = await call({ type: 'pairing_code' });
        assertEquals(code.status, 200);
        assert(/^\d{6}$/.test(code.body.code));
        const paired = await member.rpc('pair_station', {
          p_code: code.body.code,
        });
        assertEquals(paired.data.label, 'Rack 3');

        const first = await call({
          type: 'set',
          event_id: 'e1',
          exercise_key: 'back_squat',
          weight_kg: 100,
          reps: 5,
        });
        assertEquals([first.status, first.body.status, first.body.set_number], [200, 'logged', 1]);
        const retry = await call({
          type: 'set',
          event_id: 'e1',
          exercise_key: 'back_squat',
          weight_kg: 100,
          reps: 5,
        });
        assertEquals(retry.body.status, 'duplicate');
        const second = await call({
          type: 'set',
          event_id: 'e2',
          exercise_key: 'back_squat',
          weight_kg: 102.5,
          reps: 4,
        });
        assertEquals(second.body.set_number, 2);
        const other = await call({
          type: 'set',
          event_id: 'e3',
          exercise_key: 'bench_press',
          weight_kg: 60,
          reps: 5,
        });
        assertEquals([other.status, other.body.error.code], [422, 'exercise_not_tracked']);

        const { data: sets } = await member
          .from('set_logs')
          .select('set_number, actual_weight_kg, actual_reps, target_reps, source, completed')
          .order('set_number');
        assertEquals(sets, [
          {
            set_number: 1,
            actual_weight_kg: 100,
            actual_reps: 5,
            target_reps: 6,
            source: 'station',
            completed: true,
          },
          {
            set_number: 2,
            actual_weight_kg: 102.5,
            actual_reps: 4,
            target_reps: 6,
            source: 'station',
            completed: true,
          },
        ]);
      },
    );

    await t.step('ending at the station stops logging', async () => {
      assertEquals((await call({ type: 'end' })).body.status, 'ended');
      assertEquals((await member.rpc('my_station_pairing')).data, null);
      const res = await call({
        type: 'set',
        event_id: 'e4',
        exercise_key: 'back_squat',
        weight_kg: 100,
        reps: 5,
      });
      assertEquals(res.status, 409);
    });

    await service.auth.admin.deleteUser(uid);
    await service.from('stations').delete().eq('id', stationId);
  },
});
