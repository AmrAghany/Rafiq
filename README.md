# Rafiq

An all-day AI personal trainer and nutrition coach for gym members. A native **iOS and Android**
app built with React Native (Expo) and Supabase. There is no web version.
The full brief, build phases and current status are in [CLAUDE.md](CLAUDE.md). The original
prototype lives in [`reference/`](reference/).

## Requirements

- Node 20+ and npm
- Docker (for the local Supabase stack)
- An Android phone or emulator, and/or an iPhone or iOS Simulator (macOS)
- An [Expo account](https://expo.dev/signup) for cloud builds with EAS

## Getting started

```bash
npm install
cp .env.example .env          # then fill in the values below

npm run db:start              # starts local Supabase and applies supabase/migrations
# copy the printed API URL and anon key into EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY

npm start                     # Expo dev server (press i / a, or scan the QR code)
```

Scan the QR code with **Expo Go** on your phone for a quick look (email sign-in works there).
Native Sign in with Apple, and anything else that needs native config, needs a real build.

## AI features (Edge Functions)

The coach chat, meal estimates and InBody photo reading run in Supabase Edge Functions
(`supabase/functions`), so the Anthropic key never ships in the app. Each request checks the
member's tier and daily limit on the server first.

```bash
# Hosted project
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy coach-chat meal-estimate scan-read export-data delete-account

# Local
echo "ANTHROPIC_API_KEY=sk-ant-..." > supabase/functions/.env
npm run fn:serve
```

AI features need a Pro or Elite tier (see Subscriptions below). For local testing without a
store, give an account Pro by hand: `update public.subscriptions set tier = 'pro' where user_id = '<id>';`

Function tests need [Deno](https://deno.com) 2 and the local stack:

```bash
npm run db:start
eval "$(npx supabase status -o env)" && npm run fn:test
```

## Subscriptions (RevenueCat)

Purchases go through RevenueCat (App Store and Google Play in-app subscriptions). The app
identifies each member to RevenueCat by their Supabase user id. The server mirrors RevenueCat
into `public.subscriptions`, and that mirror is the only thing that unlocks features: the
app's entitlements helper reads it, and every Edge Function checks it again.

One-time setup:

1. **Stores**: create two auto-renewing monthly subscriptions in one subscription group:
   `rafiq_pro_monthly` and `rafiq_elite_monthly` (on Google Play, the same product ids with a
   monthly base plan). Add a **7-day free trial** introductory offer to Pro. Trials are set in
   the stores, and the paywall reads them from the store.
2. **RevenueCat**: add both apps. Create entitlements `pro` (attach both products) and `elite`
   (attach the Elite product). Make a `default` offering with both packages.
3. **Keys**: put the public SDK keys in `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (EAS environment variables for builds). Set the server
   secrets:
   ```bash
   npx supabase secrets set REVENUECAT_SECRET_API_KEY=sk_... REVENUECAT_WEBHOOK_AUTH_TOKEN=<random>
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   npx supabase functions deploy sync-subscription
   ```
4. **Webhook**: in RevenueCat → Integrations → Webhooks, set the URL to
   `https://<project>.supabase.co/functions/v1/revenuecat-webhook` and the Authorization
   header to the same `<random>` value.
5. Set `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL` (the stores require both on the
   paywall).

Test purchases with App Store sandbox or Play license-test accounts on a `preview` build.
Purchases don't work in Expo Go.

## Building the Android and iOS apps

Builds run in the cloud with [EAS Build](https://docs.expo.dev/build/introduction/), so no Mac is
needed for Android and no local Xcode is needed for iOS.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                     # links the project to your Expo account (first time)
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<project>.supabase.co
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>

npx eas-cli@latest build --profile preview --platform android   # installable .apk
npx eas-cli@latest build --profile preview --platform ios       # needs an Apple Developer account
npx eas-cli@latest build --profile production --platform all    # store builds (.aab / .ipa)
```

Profiles live in `eas.json`. `preview` makes an APK you can install straight from the build page,
and an iOS build for registered test devices. `production` makes store builds.

## Scripts

| Script                     | What it does                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `npm start`                | Expo dev server                                                |
| `npm test`                 | Jest unit and component tests                                  |
| `npm run test:integration` | Onboarding against a local Supabase (`src/__integration__`)    |
| `npm run typecheck`        | TypeScript (strict)                                            |
| `npm run lint`             | ESLint                                                         |
| `npm run format`           | Prettier (write); `format:check` to verify                     |
| `npm run check`            | typecheck + lint + format check + tests                        |
| `npm run db:start`         | Start local Supabase (Docker)                                  |
| `npm run db:reset`         | Recreate the local database from migrations                    |
| `npm run db:test`          | pgTAP tests for RLS and triggers (`supabase/tests/database`)   |
| `npm run db:types`         | Regenerate `src/lib/database.types.ts` from the local database |
| `npm run db:seed:generate` | Regenerate `supabase/seed.sql` from the plan JSON data         |
| `npm run fn:check`         | Type-check the Edge Functions (Deno)                           |
| `npm run fn:test`          | Edge Function tests (Deno; needs the local stack env)          |
| `npm run fn:serve`         | Serve Edge Functions locally                                   |

## Project layout

```
src/
  app/                 Expo Router routes: (auth) sign-in, (onboarding) 3 steps + summary,
                       (tabs) Today/Train/Food/Coach/Me, plan (my plan), history
  components/          Shared UI primitives (RTL-safe: start/end, never left/right)
  features/auth/       Session provider, Apple/Google/email sign-in
  features/plan/       Plan engine (pure, tested), exercise/workout/split JSON, plan summary UI
  features/onboarding/ Onboarding draft, validation and save payload
  features/profile/    TanStack Query hooks for profile, active plan and onboarding save
  features/today/      Timeline (pure), check-in/water/timeline hooks and cards
  features/train/      Progression (pure), session/set hooks, exercise card, rest timer
  features/food/       Meal plan and intake maths (pure), meal log hooks
  features/reminders/  Reminder schedule (pure) and expo-notifications scheduling
  features/settings/   Daily schedule, reminders, data export and account deletion
  features/ai/         Edge Function client (JSON + streaming), SSE parser, photo upload
  features/coach/      Chat history and streaming hooks
  features/membership/ Entitlements helper (tier → features), RevenueCat purchases, paywall
                       helpers, membership panel
  i18n/                i18next setup, en/ar strings, RTL handling
  lib/                 Supabase client, secure storage, env, generated DB types
  stores/              Zustand stores for device-local UI state
  theme/               Design tokens (light/dark) and ThemeProvider
supabase/
  migrations/          Database schema, RLS policies, storage buckets, complete_onboarding()
  seed.sql             Generated exercise library, workout and meal templates
  functions/           Edge Functions: coach-chat, meal-estimate, scan-read, export-data,
                       delete-account, revenuecat-webhook, sync-subscription; _shared/
  tests/database/      pgTAP tests
reference/             Original HTML prototypes (source of truth for behaviour and UX)
```

## Security notes

- Only `EXPO_PUBLIC_*` variables reach the app bundle. The Anthropic key, Supabase service role
  key and RevenueCat secrets live only in Edge Function secrets.
- Every table has Row Level Security; members can only read and write their own rows. Tiers are
  written only by the server.
- Auth sessions are stored in the device keychain/keystore (expo-secure-store).
