// Runs every function's handler against a real local Supabase (auth, RLS, Storage, quotas)
// and the fake Messages API. Skipped unless the local stack's URL and keys are in the env:
//   eval "$(npx supabase status -o env)" && deno task test

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  handler as coachHandler,
  mealHandler,
  scanHandler,
  deleteHandler,
  exportHandler,
} from './handlers.ts';
import type { Deps } from '../_shared/context.ts';
import { Anthropic, createClient, type SupabaseClient } from '../_shared/deps.ts';
import { startFakeAnthropic } from './fake_anthropic.ts';
import { startFakeRevenueCat } from './fake_revenuecat.ts';
import { revenueCatClient } from '../_shared/revenuecat.ts';

const URL_ = Deno.env.get('API_URL') ?? Deno.env.get('SUPABASE_URL');
const ANON = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const enabled = !!(URL_ && ANON && SERVICE);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

const plan = {
  engineVersion: '1.0.0',
  bmrKcal: 1810,
  bodyFatPct: 18.4,
  leanMassKg: 66.9,
  trainingDays: 4,
  weightKg: 82,
  loadFactor: 0.8,
  schemes: { main: { sets: 4, reps: 6 }, accessory: { sets: 3, reps: 10 } },
  macros: {
    high: { kcal: 2880, proteinG: 164, carbsG: 408, fatG: 66 },
    medium: { kcal: 2670, proteinG: 164, carbsG: 337, fatG: 74 },
    low: { kcal: 2190, proteinG: 164, carbsG: 172, fatG: 94 },
  },
  week: [
    { dayType: 'medium', workoutKey: 'upper_a' },
    { dayType: 'high', workoutKey: 'lower_a' },
    { dayType: 'low', workoutKey: null },
    { dayType: 'medium', workoutKey: 'upper_b' },
    { dayType: 'high', workoutKey: 'lower_b' },
    { dayType: 'low', workoutKey: null },
    { dayType: 'low', workoutKey: null },
  ],
  safety: { noDeficit: false, hideCalories: false, doctorNotice: false, moderateTraining: false },
};

interface Member {
  id: string;
  jwt: string;
  db: SupabaseClient;
}

async function newMember(
  service: SupabaseClient,
  opts: { tier?: 'free' | 'pro' | 'elite'; careful?: boolean } = {},
): Promise<Member> {
  const email = `fn-${crypto.randomUUID()}@example.com`;
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password: 'long-enough-pw',
    email_confirm: true,
  });
  if (error) throw error;
  const anon = createClient(URL_!, ANON!, noSession);
  const { data: session } = await anon.auth.signInWithPassword({
    email,
    password: 'long-enough-pw',
  });
  const jwt = session.session!.access_token;
  const db = createClient(URL_!, ANON!, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const memberPlan = opts.careful
    ? { ...plan, safety: { ...plan.safety, noDeficit: true, hideCalories: true } }
    : plan;
  const { error: onboardError } = await db.rpc('complete_onboarding', {
    p_profile: {
      display_name: 'Sam Haddad',
      sex: 'male',
      date_of_birth: '1997-02-14',
      height_cm: 178,
      weight_kg: 82,
      goal: 'recomp',
      training_days: 4,
      experience: 'intermediate',
      health_flags: opts.careful ? ['eating_disorder'] : [],
      locale: 'en',
      timezone: 'Asia/Dubai',
      medical_notice_accepted_at: new Date().toISOString(),
    },
    p_scan: { source: 'manual', weight_kg: 82, body_fat_pct: 18.4, bmr_kcal: 1810 },
    p_plan_inputs: {},
    p_plan: memberPlan,
    p_engine_version: '1.0.0',
  });
  if (onboardError) throw onboardError;
  if (opts.tier && opts.tier !== 'free') {
    await service
      .from('subscriptions')
      .update({ tier: opts.tier, status: 'active' })
      .eq('user_id', created.user!.id);
  }
  return { id: created.user!.id, jwt, db };
}

const post = (path: string, jwt: string | null, body: unknown) =>
  new Request(`http://localhost/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });

async function readSse(res: Response) {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)![1];
      const data = JSON.parse(/^data: (.*)$/m.exec(block)![1]);
      return { event, data };
    });
}

async function usage(service: SupabaseClient, userId: string, feature: string) {
  const { data } = await service
    .from('ai_usage')
    .select('request_count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .maybeSingle();
  return data?.request_count ?? 0;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

Deno.test({
  name: 'edge functions against local Supabase',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const fake = startFakeAnthropic();
    const rc = startFakeRevenueCat();
    const service = createClient(URL_!, SERVICE!, noSession);
    const deps: Deps = {
      userClient: (jwt) =>
        createClient(URL_!, ANON!, {
          ...noSession,
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        }),
      serviceClient: () => service,
      anthropic: () => new Anthropic({ apiKey: 'test-key', baseURL: fake.baseURL, maxRetries: 0 }),
      revenuecat: () => revenueCatClient(rc.secret, rc.baseUrl),
      now: () => new Date('2026-10-06T09:00:00Z'),
    };
    const coach = coachHandler(deps);
    const meal = mealHandler(deps);
    const scan = scanHandler(deps);

    const pro = await newMember(service, { tier: 'pro' });
    const free = await newMember(service);

    await t.step('rejects missing or bad tokens', async () => {
      assertEquals(
        (await coach(post('coach-chat', null, { message: 'hi', localDate: '2026-10-06' }))).status,
        401,
      );
      assertEquals(
        (await coach(post('coach-chat', 'not-a-jwt', { message: 'hi', localDate: '2026-10-06' })))
          .status,
        401,
      );
      assertEquals((await coach(new Request('http://localhost/coach-chat'))).status, 405);
    });

    await t.step('free members are asked to upgrade, nothing is used', async () => {
      const res = await coach(
        post('coach-chat', free.jwt, { message: 'hi', localDate: '2026-10-06' }),
      );
      assertEquals(res.status, 402);
      assertEquals((await res.json()).error.code, 'upgrade_required');
      assertEquals(fake.requests.length, 0);
      assertEquals(await usage(service, free.id, 'coach_chat'), 0);
    });

    await t.step('validates the message', async () => {
      assertEquals(
        (await coach(post('coach-chat', pro.jwt, { message: '  ', localDate: '2026-10-06' })))
          .status,
        400,
      );
      assertEquals(
        (
          await coach(
            post('coach-chat', pro.jwt, { message: 'x'.repeat(2001), localDate: '2026-10-06' }),
          )
        ).status,
        400,
      );
      assertEquals(
        (await coach(post('coach-chat', pro.jwt, { message: 'hi', localDate: 'today' }))).status,
        400,
      );
    });

    await t.step(
      'coach streams a reply built from the member’s own data and saves both turns',
      async () => {
        await pro.db
          .from('daily_logs')
          .insert({ user_id: pro.id, log_date: '2026-10-06', readiness_score: 50, checkin: {} });
        await pro.db.from('meal_logs').insert({
          user_id: pro.id,
          log_date: '2026-10-06',
          name: 'Oats',
          kcal: 720,
          source: 'plan',
        });
        fake.reply({
          kind: 'text',
          text: 'Swap the squat for the leg press today, 3 x 6 at 60 kg.',
        });

        const res = await coach(
          post('coach-chat', pro.jwt, {
            message: 'The rack is busy',
            localDate: '2026-10-06',
            localTime: '17:40',
          }),
        );
        assertEquals(res.status, 200);
        assertEquals(res.headers.get('Content-Type'), 'text/event-stream; charset=utf-8');
        assertEquals(res.headers.get('X-Quota-Used'), '1');
        const events = await readSse(res);
        const text = events
          .filter((e) => e.event === 'delta')
          .map((e) => e.data.text)
          .join('');
        assertEquals(text, 'Swap the squat for the leg press today, 3 x 6 at 60 kg.');
        assert(events.filter((e) => e.event === 'delta').length > 1, 'arrives in several chunks');
        const done = events.at(-1)!;
        assertEquals(done.event, 'done');
        assert(done.data.id);

        const sent = fake.requests[0].body as {
          model: string;
          stream: boolean;
          system: { text: string }[];
          messages: { role: string; content: string }[];
          cache_control: unknown;
        };
        assertEquals(sent.model, 'claude-haiku-4-5-20251001');
        assertEquals(sent.stream, true);
        assertStringIncludes(sent.system[0].text, 'same language and dialect');
        // 6 Oct 2026 is a Tuesday: Lower body A, light day from readiness 50.
        assertStringIncludes(
          sent.system[1].text,
          'Today (Tuesday): Lower body A (light day: low readiness): Back squat 3 x 6 at 60 kg',
        );
        assertStringIncludes(sent.system[1].text, 'Eaten so far: 720 kcal.');
        assertStringIncludes(sent.system[1].text, 'Local time: 17:40.');
        assertEquals(sent.messages, [{ role: 'user', content: 'The rack is busy' }]);
        assertEquals(sent.cache_control, { type: 'ephemeral' });

        const { data: chat } = await pro.db
          .from('chat_messages')
          .select('role, content, model, output_tokens')
          .order('created_at');
        assertEquals(
          chat!.map((m) => m.role),
          ['user', 'assistant'],
        );
        assertEquals(chat![1].model, 'claude-haiku-4-5-20251001');
        assertEquals(chat![1].output_tokens, 30);
      },
    );

    await t.step('the next message carries the conversation so far', async () => {
      fake.reset();
      fake.reply({ kind: 'text', text: 'شكرًا!' });
      await readSse(
        await coach(
          post('coach-chat', pro.jwt, { message: 'شكرا يا كابتن', localDate: '2026-10-06' }),
        ),
      );
      const messages = (fake.requests[0].body as { messages: { role: string; content: string }[] })
        .messages;
      assertEquals(
        messages.map((m) => m.role),
        ['user', 'assistant', 'user'],
      );
      assertEquals(messages[2].content, 'شكرا يا كابتن');
    });

    await t.step('a refusal is reported, not saved, and the quota is refunded', async () => {
      fake.reset();
      const before = await usage(service, pro.id, 'coach_chat');
      fake.reply({ kind: 'text', text: '', stopReason: 'refusal' });
      const events = await readSse(
        await coach(post('coach-chat', pro.jwt, { message: 'something', localDate: '2026-10-06' })),
      );
      assertEquals(events.at(-1), { event: 'error', data: { code: 'ai_refused' } });
      assertEquals(await usage(service, pro.id, 'coach_chat'), before);
      const { count } = await pro.db
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'assistant');
      assertEquals(count, 2);
    });

    await t.step('an API failure becomes ai_unavailable and is refunded', async () => {
      fake.reset();
      const before = await usage(service, pro.id, 'coach_chat');
      fake.reply({ kind: 'error', status: 400 });
      const events = await readSse(
        await coach(post('coach-chat', pro.jwt, { message: 'again', localDate: '2026-10-06' })),
      );
      assertEquals(events.at(-1), { event: 'error', data: { code: 'ai_unavailable' } });
      assertEquals(await usage(service, pro.id, 'coach_chat'), before);
    });

    await t.step('the daily limit is enforced', async () => {
      await service
        .from('ai_usage')
        .update({ request_count: 50 })
        .eq('user_id', pro.id)
        .eq('feature', 'coach_chat');
      const res = await coach(
        post('coach-chat', pro.jwt, { message: 'one more', localDate: '2026-10-06' }),
      );
      assertEquals(res.status, 429);
      assertEquals((await res.json()).error, {
        code: 'quota_exceeded',
        feature: 'coach_chat',
        limit: 50,
      });
    });

    await t.step('meal estimate from text uses structured output', async () => {
      fake.reset();
      fake.reply({
        kind: 'text',
        text: JSON.stringify({
          is_food: true,
          name: 'Chicken shawarma wrap',
          kcal: 550,
          protein_g: 32,
          carbs_g: 48,
          fat_g: 24,
          confidence: 'medium',
        }),
      });
      const res = await meal(
        post('meal-estimate', pro.jwt, { text: '1 chicken shawarma wrap with garlic sauce' }),
      );
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.estimate, {
        name: 'Chicken shawarma wrap',
        kcal: 550,
        protein_g: 32,
        carbs_g: 48,
        fat_g: 24,
        confidence: 'medium',
      });
      const sent = fake.requests[0].body as {
        model: string;
        output_config: { format: { type: string } };
        stream?: boolean;
      };
      assertEquals(sent.model, 'claude-haiku-4-5-20251001');
      assertEquals(sent.output_config.format.type, 'json_schema');
      assertEquals(sent.stream, undefined);
    });

    await t.step('meal estimate from the member’s own photo sends the image', async () => {
      fake.reset();
      const path = `${pro.id}/meal-1.jpg`;
      const { error } = await pro.db.storage
        .from('meal-photos')
        .upload(path, JPEG, { contentType: 'image/jpeg' });
      assertEquals(error, null);
      fake.reply({
        kind: 'text',
        text: JSON.stringify({
          is_food: true,
          name: 'Mandi',
          kcal: 900,
          protein_g: 45,
          carbs_g: 100,
          fat_g: 30,
          confidence: 'low',
        }),
      });
      const body = await (await meal(post('meal-estimate', pro.jwt, { photoPath: path }))).json();
      assertEquals(body.estimate.name, 'Mandi');
      assertEquals(body.photoPath, path);
      const content = (
        fake.requests[0].body as {
          messages: {
            content: { type: string; source?: { media_type: string; data: string } }[];
          }[];
        }
      ).messages[0].content;
      assertEquals(content[0].type, 'image');
      assertEquals(content[0].source!.media_type, 'image/jpeg');
      assertEquals(content[0].source!.data, btoa(String.fromCharCode(...JPEG)));
    });

    await t.step('photos outside the member’s folder are refused before any AI call', async () => {
      fake.reset();
      for (const photoPath of [
        `${free.id}/meal-1.jpg`,
        `${pro.id}/../x.jpg`,
        `${pro.id}/missing.jpg`,
        42,
      ]) {
        const res = await meal(post('meal-estimate', pro.jwt, { photoPath }));
        assert([400, 404].includes(res.status), `status for ${photoPath}`);
      }
      assertEquals(fake.requests.length, 0);
    });

    await t.step('not food: no estimate and no charge', async () => {
      fake.reset();
      const before = await usage(service, pro.id, 'meal_estimate');
      fake.reply({
        kind: 'text',
        text: JSON.stringify({
          is_food: false,
          name: 'Keyboard',
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          confidence: 'high',
        }),
      });
      const body = await (
        await meal(post('meal-estimate', pro.jwt, { text: 'my keyboard' }))
      ).json();
      assertEquals(body, { estimate: null, reason: 'not_recognised' });
      assertEquals(await usage(service, pro.id, 'meal_estimate'), before);
    });

    await t.step('members whose plan hides calories get only a name', async () => {
      fake.reset();
      const careful = await newMember(service, { tier: 'pro', careful: true });
      fake.reply({
        kind: 'text',
        text: JSON.stringify({
          is_food: true,
          name: 'Pizza',
          kcal: 600,
          protein_g: 25,
          carbs_g: 70,
          fat_g: 22,
          confidence: 'medium',
        }),
      });
      const body = await (
        await meal(post('meal-estimate', careful.jwt, { text: '2 slices of pizza' }))
      ).json();
      assertEquals(body.estimate, {
        name: 'Pizza',
        kcal: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        confidence: 'medium',
      });
    });

    await t.step(
      'scan reading uses Sonnet 5.5 with low effort, fallbacks, and plausibility checks',
      async () => {
        fake.reset();
        const path = `${pro.id}/scan-1.jpg`;
        await pro.db.storage.from('scan-photos').upload(path, JPEG, { contentType: 'image/jpeg' });
        fake.reply({
          kind: 'text',
          text: JSON.stringify({
            is_body_composition_sheet: true,
            weight_kg: 82.1,
            body_fat_percent: 18.4,
            skeletal_muscle_kg: 38.2,
            bmr_kcal: 99999,
          }),
        });
        const body = await (await scan(post('scan-read', pro.jwt, { photoPath: path }))).json();
        assertEquals(body.reading, {
          weight_kg: 82.1,
          body_fat_percent: 18.4,
          skeletal_muscle_kg: 38.2,
          bmr_kcal: null,
        });
        const req = fake.requests[0];
        const sent = req.body as {
          model: string;
          output_config: { effort: string; format: { type: string } };
          fallbacks: string;
        };
        assertEquals(sent.model, 'claude-sonnet-5-5');
        assertEquals(sent.output_config.effort, 'low');
        assertEquals(sent.output_config.format.type, 'json_schema');
        assertEquals(sent.fallbacks, 'default');
        assertStringIncludes(
          req.headers.get('anthropic-beta') ?? '',
          'server-side-fallback-2026-07-01',
        );
      },
    );

    await t.step('scan reading is a paid feature', async () => {
      const path = `${free.id}/scan-1.jpg`;
      await free.db.storage.from('scan-photos').upload(path, JPEG, { contentType: 'image/jpeg' });
      assertEquals((await scan(post('scan-read', free.jwt, { photoPath: path }))).status, 402);
    });

    await t.step('export returns only the member’s own data, with photo links', async () => {
      await pro.db.from('meal_logs').insert({
        user_id: pro.id,
        log_date: '2026-10-06',
        name: 'Mandi',
        source: 'photo',
        photo_path: `${pro.id}/meal-1.jpg`,
      });
      const res = await exportHandler(deps)(post('export-data', pro.jwt, {}));
      assertEquals(res.status, 200);
      const out = await res.json();
      assertEquals(out.user_id, pro.id);
      assertEquals(out.profiles.length, 1);
      assertEquals(out.plans.length, 1);
      assert(out.chat_messages.length >= 4);
      for (const table of ['meal_logs', 'chat_messages', 'daily_logs']) {
        for (const row of out[table]) assertEquals(row.user_id, pro.id);
      }
      assert(Object.keys(out.photo_links).includes(`meal-photos/${pro.id}/meal-1.jpg`));
      assertEquals(out.coach_reviews, []);
    });

    await t.step('delete account removes photos, rows and the login', async () => {
      const del = deleteHandler(deps);
      assertEquals((await del(post('delete-account', pro.jwt, {}))).status, 400);
      const res = await del(post('delete-account', pro.jwt, { confirm: 'DELETE' }));
      assertEquals(res.status, 200);
      const { data: photos } = await service.storage.from('meal-photos').list(pro.id);
      assertEquals(photos?.length ?? 0, 0);
      const { data: scans } = await service.storage.from('scan-photos').list(pro.id);
      assertEquals(scans?.length ?? 0, 0);
      for (const table of ['profiles', 'plans', 'chat_messages', 'meal_logs', 'ai_usage']) {
        const column = table === 'profiles' ? 'id' : 'user_id';
        const { count } = await service
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(column, pro.id);
        assertEquals(count, 0, table);
      }
      const { data } = await service.auth.admin.getUserById(pro.id);
      assertEquals(data.user, null);
      assertEquals(rc.deleted, [pro.id]);
      // The other member is untouched.
      const { count } = await service
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('id', free.id);
      assertEquals(count, 1);
    });

    await fake.close();
    await rc.close();
  },
});
