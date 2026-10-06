// Everything a handler needs from the outside world, injected so tests can use fakes.

import { Anthropic, createClient, type SupabaseClient, type User } from './deps.ts';
import { HttpError } from './http.ts';
import { revenueCatClient, type RevenueCatClient } from './revenuecat.ts';

export interface Deps {
  /** A client acting as the member (their JWT): every query goes through RLS. */
  userClient(jwt: string): SupabaseClient;
  /** Service-role client for tier checks, quotas and account deletion only. */
  serviceClient(): SupabaseClient;
  anthropic(): Anthropic;
  /** Null when no RevenueCat secret key is configured (e.g. local development). */
  revenuecat(): RevenueCatClient | null;
  now(): Date;
}

export function realDeps(): Deps {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    userClient: (jwt) =>
      createClient(url, anonKey, {
        ...noSession,
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      }),
    serviceClient: () => createClient(url, serviceKey, noSession),
    anthropic: () =>
      new Anthropic({
        apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
        // Only set for local testing against a fake API.
        baseURL: Deno.env.get('ANTHROPIC_BASE_URL') || undefined,
        maxRetries: 2,
      }),
    revenuecat: () => {
      const key = Deno.env.get('REVENUECAT_SECRET_API_KEY');
      return key ? revenueCatClient(key, Deno.env.get('REVENUECAT_API_BASE') || undefined) : null;
    },
    now: () => new Date(),
  };
}

export interface Caller {
  user: User;
  jwt: string;
  db: SupabaseClient;
}

/** Verifies the bearer token with Supabase Auth and returns an RLS-scoped client. */
export async function authenticate(req: Request, deps: Deps): Promise<Caller> {
  const header = req.headers.get('Authorization') ?? '';
  const jwt = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!jwt) throw new HttpError('unauthorized');
  const db = deps.userClient(jwt);
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError('unauthorized');
  return { user: data.user, jwt, db };
}
