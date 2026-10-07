// POST /scan-read { photoPath: "<uid>/<file>.jpg" }  (photo uploaded to the scan-photos bucket)
// Returns { reading: { weight_kg, body_fat_percent, skeletal_muscle_kg, bmr_kcal } } with
// null for anything unreadable or implausible. The app always shows the numbers for the
// member to confirm or correct before they are used.

import { aiError, SCAN_MODEL } from '../_shared/claude.ts';
import { authenticate, type Deps } from '../_shared/context.ts';
import { consumeQuota } from '../_shared/entitlements.ts';
import { HttpError, json, readJson, route } from '../_shared/http.ts';
import { checkScan, SCAN_SCHEMA } from '../_shared/schemas.ts';
import { readOwnPhoto } from '../_shared/storage.ts';

export const SCAN_PROMPT = `This is a photo of a body composition result sheet, usually an InBody printout (it may be in English or Arabic, photographed at an angle).
Read these values from the sheet itself: body weight in kg, percent body fat (PBF), skeletal muscle mass (SMM) in kg, and basal metabolic rate (BMR) in kcal.
Use the measured value, not the normal range or the target column. Use null for any value you cannot read clearly; never guess.
If the photo is not a body composition sheet, set is_body_composition_sheet to false.`;

export function createHandler(deps: Deps) {
  return route('POST', async (req) => {
    const { db, user } = await authenticate(req, deps);
    const body = await readJson(req);
    const photo = await readOwnPhoto(db, 'scan-photos', body.photoPath, user.id);

    const quota = await consumeQuota(deps, user.id, 'scan_read');
    try {
      const response = await deps.anthropic().beta.messages.create({
        model: SCAN_MODEL,
        max_tokens: 4096,
        // Reading four numbers needs little reasoning.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCAN_SCHEMA } },
        // If Claude Sonnet 5.5 declines, the API retries on a suitable model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: photo.mediaType, data: photo.data },
              },
              { type: 'text', text: SCAN_PROMPT },
            ],
          },
        ],
      });
      if (response.stop_reason === 'refusal') throw new HttpError('ai_refused');
      const out = response.content.find((b) => b.type === 'text');
      const reading = out && out.type === 'text' ? checkScan(out.text) : null;
      if (!reading) {
        await quota.refund();
        return json({ reading: null, reason: 'not_recognised', photoPath: photo.path });
      }
      return json({
        reading,
        photoPath: photo.path,
        quota: { used: quota.used, limit: quota.limit },
      });
    } catch (e) {
      await quota.refund();
      throw aiError(e);
    }
  });
}
