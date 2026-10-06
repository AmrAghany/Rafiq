// POST /meal-estimate { text?: string, photoPath?: "<uid>/<file>.jpg" }
// Returns { estimate: { name, kcal, protein_g, carbs_g, fat_g, confidence } } for the member
// to check and edit before saving. Members whose plan hides calories get only the name.

import { aiError, CHAT_MODEL } from '../_shared/claude.ts';
import { authenticate, type Deps } from '../_shared/context.ts';
import { consumeQuota } from '../_shared/entitlements.ts';
import { HttpError, json, readJson, route } from '../_shared/http.ts';
import { checkMeal, MEAL_SCHEMA } from '../_shared/schemas.ts';
import { readOwnPhoto } from '../_shared/storage.ts';

export const MAX_DESCRIPTION_CHARS = 500;

export const MEAL_PROMPT = `You are a nutrition estimator in a fitness app used mostly in the Middle East.
Estimate the meal using typical portion sizes, including Middle Eastern and Gulf dishes (for example shawarma, mandi, kabsa, foul, falafel, hummus, labneh, dates).
Give the totals for everything described or visible. Write "name" in the same language as the member's description; if there is no description, use {{language}}.
Set "is_food" to false if the input is not a meal, snack or drink. Use "confidence" to say how sure you are about the portion size.`;

export function createHandler(deps: Deps) {
  return route('POST', async (req) => {
    const { db, user } = await authenticate(req, deps);
    const body = await readJson(req);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length > MAX_DESCRIPTION_CHARS) throw new HttpError('bad_request', { reason: 'text' });
    if (!text && body.photoPath == null) throw new HttpError('bad_request', { reason: 'empty' });

    const [{ data: profile }, { data: plan }] = await Promise.all([
      db.from('profiles').select('locale').eq('id', user.id).single(),
      db.from('plans').select('plan').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ]);
    const photo =
      body.photoPath != null
        ? await readOwnPhoto(db, 'meal-photos', body.photoPath, user.id)
        : null;

    const quota = await consumeQuota(deps, user.id, 'meal_estimate');
    try {
      const language = profile?.locale === 'ar' ? 'Arabic' : 'English';
      const content = [
        ...(photo
          ? [
              {
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: photo.mediaType, data: photo.data },
              },
            ]
          : []),
        {
          type: 'text' as const,
          text: text ? `Member's description: ${text}` : 'Estimate the meal in this photo.',
        },
      ];
      const response = await deps.anthropic().messages.create({
        model: CHAT_MODEL,
        max_tokens: 1024,
        system: MEAL_PROMPT.replace('{{language}}', language),
        messages: [{ role: 'user', content }],
        output_config: { format: { type: 'json_schema', schema: MEAL_SCHEMA } },
      });
      if (response.stop_reason === 'refusal') throw new HttpError('ai_refused');
      const out = response.content.find((b) => b.type === 'text');
      const estimate = out && out.type === 'text' ? checkMeal(out.text) : null;
      if (!estimate) {
        await quota.refund();
        return json({ estimate: null, reason: 'not_recognised' });
      }
      const hideNumbers = !!(plan?.plan as { safety?: { hideCalories?: boolean } } | undefined)
        ?.safety?.hideCalories;
      return json({
        estimate: hideNumbers
          ? {
              name: estimate.name,
              kcal: null,
              protein_g: null,
              carbs_g: null,
              fat_g: null,
              confidence: estimate.confidence,
            }
          : estimate,
        photoPath: photo?.path ?? null,
        quota: { used: quota.used, limit: quota.limit },
      });
    } catch (e) {
      await quota.refund();
      throw aiError(e);
    }
  });
}
