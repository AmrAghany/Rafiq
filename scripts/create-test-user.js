#!/usr/bin/env node
// Creates (or upgrades) a test "super user": a confirmed account on the Elite tier, so
// every member feature is unlocked, who is also a coach in the coach console.
// Testing only: never run this against production with a guessable password.
//
//   SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
//     node scripts/create-test-user.js tester@example.com '<password>' "Test Coach"
//
// The member goes through onboarding on first sign-in (about a minute), which builds
// their real plan. Elite has no end date here, so it never lapses.

const base = (process.env.SUPABASE_URL || 'http://127.0.0.1:54321').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function api(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const data = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found || data.users.length < 200) return found ?? null;
  }
  return null;
}

async function main() {
  const [email, password, coachName = 'Test Coach'] = process.argv.slice(2);
  if (!key || !email || !password) {
    console.log(
      'Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-test-user.js <email> <password> [coach name]',
    );
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) throw new Error('Use a password of at least 8 characters.');

  let user = await findUser(email);
  if (user) {
    await api(`/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
  } else {
    user = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
  }

  // Elite with no end date. The signup trigger already created the free row.
  await api(`/rest/v1/subscriptions?user_id=eq.${user.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      tier: 'elite',
      status: 'active',
      is_trial: false,
      current_period_ends_at: null,
      will_renew: true,
    }),
  });

  // Coach in the coach console.
  await api('/rest/v1/staff?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: user.id, role: 'admin', display_name: coachName }),
  });

  console.log(
    `Ready: ${email} (id ${user.id}) is Elite and a coach. Sign in with the password you chose.`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
