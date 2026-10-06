// POST /coach-chat { message, localDate: "YYYY-MM-DD", localTime?: "HH:MM" }
// Streams the coach's reply as Server-Sent Events:
//   event: delta  data: {"text": "..."}       (repeated)
//   event: done   data: {"id": "<chat message id>"}
//   event: error  data: {"code": "ai_refused" | "ai_unavailable" | ...}

import { CHAT_MODEL, aiError } from '../_shared/claude.ts';
import {
  ageFrom,
  buildMemberContext,
  COACH_RULES,
  historyForRequest,
  type ChatTurn,
  type ExerciseInfo,
  type StoredPlan,
} from '../_shared/coach.ts';
import { authenticate, type Deps } from '../_shared/context.ts';
import { consumeQuota } from '../_shared/entitlements.ts';
import { HttpError, readJson, route } from '../_shared/http.ts';

export const MAX_MESSAGE_CHARS = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const sse = (event: string, data: unknown) =>
  new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export function createHandler(deps: Deps) {
  return route('POST', async (req) => {
    const caller = await authenticate(req, deps);
    const body = await readJson(req);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > MAX_MESSAGE_CHARS) {
      throw new HttpError('bad_request', { reason: 'message' });
    }
    const localDate =
      typeof body.localDate === 'string' && DATE_RE.test(body.localDate) ? body.localDate : null;
    if (!localDate) throw new HttpError('bad_request', { reason: 'localDate' });
    const localTime =
      typeof body.localTime === 'string' && TIME_RE.test(body.localTime) ? body.localTime : null;

    const { db, user } = caller;
    const quota = await consumeQuota(deps, user.id, 'coach_chat');

    try {
      const [profile, plan, daily, meals, history] = await Promise.all([
        db
          .from('profiles')
          .select(
            'display_name, sex, date_of_birth, height_cm, goal, experience, health_flags, ramadan_mode',
          )
          .eq('id', user.id)
          .single(),
        db.from('plans').select('plan').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        db
          .from('daily_logs')
          .select('readiness_score')
          .eq('user_id', user.id)
          .eq('log_date', localDate)
          .maybeSingle(),
        db.from('meal_logs').select('kcal').eq('user_id', user.id).eq('log_date', localDate),
        db
          .from('chat_messages')
          .select('role, content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (profile.error || !plan.data) throw new HttpError('bad_request', { reason: 'no_plan' });

      const storedPlan = plan.data.plan as StoredPlan;
      const [y, m, d] = localDate.split('-').map(Number);
      const dayIndex = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
      const workoutKey = storedPlan.week[dayIndex]?.workoutKey ?? null;

      let workoutName: string | null = null;
      let exercises: ExerciseInfo[] = [];
      if (workoutKey) {
        const { data: tpl } = await db
          .from('workout_templates')
          .select('name_en, exercise_keys')
          .eq('key', workoutKey)
          .maybeSingle();
        if (tpl) {
          workoutName = tpl.name_en;
          const { data: ex } = await db
            .from('exercises')
            .select('key, name_en, bodyweight_ratio, is_compound, is_per_hand, timed_seconds')
            .in('key', tpl.exercise_keys);
          const byKey = new Map((ex ?? []).map((e: ExerciseInfo) => [e.key, e]));
          exercises = tpl.exercise_keys
            .map((k: string) => byKey.get(k))
            .filter(Boolean) as ExerciseInfo[];
        }
      }

      const p = profile.data;
      const memberContext = buildMemberContext({
        name: (p.display_name ?? '').split(' ')[0],
        sex: p.sex,
        age: ageFrom(p.date_of_birth, deps.now()),
        heightCm: p.height_cm,
        goal: p.goal,
        experience: p.experience,
        healthFlags: p.health_flags ?? [],
        plan: storedPlan,
        dayIndex,
        workoutName,
        exercises,
        readiness: daily.data?.readiness_score ?? null,
        eatenKcal: (meals.data ?? []).reduce(
          (a: number, r: { kcal: number | null }) => a + (r.kcal ?? 0),
          0,
        ),
        ramadan: !!p.ramadan_mode,
        localTime,
      });

      const turns: ChatTurn[] = [
        ...historyForRequest((history.data ?? []) as ChatTurn[]),
        { role: 'user', content: message },
      ];

      const { error: insertError } = await db
        .from('chat_messages')
        .insert({ user_id: user.id, role: 'user', content: message });
      if (insertError) throw new HttpError('internal');

      const stream = deps.anthropic().messages.stream({
        model: CHAT_MODEL,
        max_tokens: 1024,
        // Stable rules first, then this member's data. Top-level cache_control caches the
        // longest stable prefix once a conversation is long enough to be cacheable.
        system: [
          { type: 'text', text: COACH_RULES },
          { type: 'text', text: memberContext },
        ],
        cache_control: { type: 'ephemeral' },
        messages: turns,
      });

      let refunded = false;
      const refundOnce = async () => {
        if (!refunded) {
          refunded = true;
          await quota.refund();
        }
      };

      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          let text = '';
          try {
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                text += event.delta.text;
                controller.enqueue(sse('delta', { text: event.delta.text }));
              }
            }
            const final = await stream.finalMessage();
            if (final.stop_reason === 'refusal' || !text.trim()) {
              await refundOnce();
              controller.enqueue(sse('error', { code: 'ai_refused' }));
            } else {
              const { data: saved } = await db
                .from('chat_messages')
                .insert({
                  user_id: user.id,
                  role: 'assistant',
                  content: text,
                  model: final.model,
                  input_tokens: final.usage.input_tokens,
                  output_tokens: final.usage.output_tokens,
                })
                .select('id')
                .single();
              controller.enqueue(
                sse('done', {
                  id: saved?.id ?? null,
                  truncated: final.stop_reason === 'max_tokens',
                }),
              );
            }
          } catch (e) {
            await refundOnce();
            controller.enqueue(sse('error', { code: aiError(e).code }));
          } finally {
            controller.close();
          }
        },
        cancel() {
          // The member left mid-reply: stop generating (and paying for) tokens.
          stream.abort();
        },
      });

      return new Response(body, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Quota-Used': String(quota.used),
          'X-Quota-Limit': String(quota.limit),
        },
      });
    } catch (e) {
      await quota.refund();
      throw e instanceof HttpError ? e : aiError(e);
    }
  });
}
