// POST /export-data
// Returns everything stored about the member as JSON, read through their own RLS-scoped
// client, plus short-lived links to their photos.

import { authenticate, type Deps } from '../_shared/context.ts';
import { HttpError, json, route } from '../_shared/http.ts';

const TABLES = [
  'profiles',
  'subscriptions',
  'body_scans',
  'plans',
  'daily_logs',
  'workout_sessions',
  'set_logs',
  'meal_logs',
  'chat_messages',
  'ai_usage',
] as const;

const LINK_SECONDS = 60 * 60;

export function createHandler(deps: Deps) {
  return route('POST', async (req) => {
    const { db, user } = await authenticate(req, deps);
    const out: Record<string, unknown> = {
      exported_at: deps.now().toISOString(),
      user_id: user.id,
      email: user.email,
    };

    for (const table of TABLES) {
      // RLS limits every table to the member's own rows.
      const { data, error } = await db.from(table).select('*');
      if (error) throw new HttpError('internal');
      out[table] = data;
    }

    const photoLinks: Record<string, string> = {};
    for (const [bucket, rows] of [
      ['scan-photos', out.body_scans],
      ['meal-photos', out.meal_logs],
    ] as const) {
      const paths = (rows as { photo_path: string | null }[])
        .map((r) => r.photo_path)
        .filter(Boolean) as string[];
      if (!paths.length) continue;
      const { data } = await db.storage.from(bucket).createSignedUrls(paths, LINK_SECONDS);
      for (const item of data ?? [])
        if (item.signedUrl && item.path) photoLinks[`${bucket}/${item.path}`] = item.signedUrl;
    }
    out.photo_links = photoLinks;

    return json(out);
  });
}
