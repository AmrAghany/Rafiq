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
   Set the prices per country from the table below (prices live in the stores, not in the
   app; the paywall shows whatever the store returns).
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

### Prices by country (monthly)

Anchored on the US prices from the prototype ($12.99 Pro, $49 Elite) and adjusted for local
purchasing power. Gulf prices sit close to the US price; Jordan and Egypt are lower. Store
prices in these markets include VAT, so proceeds are lower than the sticker price.

| Market         | Currency | Pro    | Elite  | ≈ USD (Pro / Elite) |
| -------------- | -------- | ------ | ------ | ------------------- |
| US and default | USD      | 12.99  | 49.99  | 12.99 / 49.99       |
| Saudi Arabia   | SAR      | 44.99  | 179.99 | 12.00 / 48.00       |
| UAE            | AED      | 44.99  | 179.99 | 12.25 / 49.00       |
| Qatar          | QAR      | 44.99  | 179.99 | 12.35 / 49.45       |
| Kuwait         | KWD      | 3.990  | 14.990 | 13.00 / 48.75       |
| Bahrain        | BHD      | 4.490  | 17.990 | 11.95 / 47.85       |
| Oman           | OMR      | 4.490  | 17.990 | 11.70 / 46.80       |
| Jordan         | JOD      | 5.99   | 24.99  | 8.45 / 35.25        |
| Egypt          | EGP      | 249.99 | 999.99 | ≈ 5 / 20            |

- **Elite** is $49.99, not $49: App Store price points end in .99.
- **USD storefronts.** Some App Store storefronts bill in US dollars rather than local currency
  (check the price list in App Store Connect). There, use the ≈ USD column rounded to the
  nearest price point: Kuwait 12.99 / 48.99, Bahrain and Oman 11.99 / 46.99, Jordan
  8.99 / 34.99. Google Play takes the local-currency prices as they are.
- **Egypt** is converted at about 50 EGP to the dollar. Check the rate before launch, because
  the pound moves. At ≈ $5, a Pro member who uses all 50 coach messages every day costs more
  in Claude usage than they pay. Typical use is far lower, but watch Egypt's AI cost per
  member after launch.
- **Other countries**: let Apple and Google generate prices from the US price. In lower-income
  markets, review them against the Egypt row.

## Apple Health and Health Connect

Members can connect Apple Health (iOS) or Health Connect (Android) on the Me tab. Rafiq only
**reads** sleep and steps, never writes. Last night's sleep suggests the morning check-in
answer, and both appear on Today and in the coach's context. Readings are saved to the day's
log (`daily_logs.sleep_minutes`, `steps`) when the app opens or comes back to the foreground,
at most every 15 minutes.

- Native modules: `@kingstinct/react-native-healthkit` (with `react-native-nitro-modules`)
  and `react-native-health-connect`. Both need a device build; neither works in Expo Go.
- `app.json` sets up the HealthKit entitlement and read-only usage text, the two Health
  Connect read permissions, and Android `minSdkVersion` 26 (via `expo-build-properties`).
- **Before release**:
  - Google Play needs the Health Connect data declaration in the Play Console. Allow about
    2 weeks: up to 7 days for approval, then about a week for access to reach Health Connect.
  - App Store review checks that health data isn't used for advertising, and that the app
    privacy details list Health and Fitness data.

## Coach console (Elite reviews)

Elite members request one review a month from the Me tab. Coaches work in a separate web
console in `web/coach` (Vite + React). It uses the same Supabase project with the anon key.
Every read and write goes through the `coach_*` database functions, which:

- show a coach a member's data only while that coach holds the member's review;
- keep a coach's draft hidden from the member until it's sent;
- never include the member's chats.

```bash
npm --prefix web/coach install
cp web/coach/.env.example web/coach/.env    # VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run coach:dev                           # http://localhost:5173
npm run coach:build                         # static files in web/coach/dist, for any static host
npm run coach:check                         # typecheck + tests
```

To make someone a coach, have them sign up (with the app, or any Supabase sign-up), then
run this with the service role (SQL editor):

```sql
insert into public.staff (user_id, display_name)
select id, 'Coach Omar' from auth.users where email = 'omar@example.com';
```

The console shows the member's first name, health notes (with a warning about calorie
numbers for careful answers), profile and plan targets, and a week-by-week table of
readiness, sleep, steps, workouts, sets and meals for the five weeks before the request.
It also shows lift progress and scans. Coaches can save a draft, send the review (which
can't be edited after), or give the review back to the queue. The console works in English
and Arabic.

## Smart stations

Partner racks and benches pair with a member by a 6-digit code, then log barbell sets
straight into the member's workout. The partner contract (endpoint, HMAC signing, requests
and errors) is in [docs/smart-stations.md](docs/smart-stations.md).

```bash
npx supabase functions deploy station-api --no-verify-jwt
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run station:sim -- register <id> "<label>" "<gym>" back_squat,deadlift
npm run station:sim -- code          # with STATION_ID and STATION_SECRET from register
npm run station:sim -- set back_squat 100 5
```

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
| `npm run coach:dev`        | Coach console dev server (`web/coach`)                         |
| `npm run coach:build`      | Build the coach console as static files                        |
| `npm run coach:check`      | Coach console typecheck and tests                              |
| `npm run station:sim`      | Smart-station simulator (signs requests like a partner)        |

## Project layout

```
src/
  app/                 Expo Router routes: (auth) sign-in, (onboarding) 3 steps + summary,
                       (tabs) Today/Train/Food/Coach/Me, plan (my plan), history,
                       progress (body charts and scans), rescan, review/[id] (coach review)
  components/          Shared UI primitives (RTL-safe: start/end, never left/right)
  features/auth/       Session provider, Apple/Google/email sign-in
  features/plan/       Plan engine (pure, tested), exercise/workout/split JSON, plan summary UI
  features/onboarding/ Onboarding draft, validation and save payload
  features/profile/    TanStack Query hooks for profile, active plan and onboarding save
  features/today/      Timeline (pure), check-in/water/timeline hooks and cards
  features/train/      Progression (pure), session/set hooks, exercise card, rest timer
  features/food/       Meal plan and intake maths (pure), meal log hooks
  features/reminders/  Reminder schedule (pure) and expo-notifications scheduling
  features/progress/   Rescans and plan rebuilds, 4-weekly due date, trend charts (pure
                       geometry drawn with plain Views), rescan reminder
  features/settings/   Daily schedule, reminders, Ramadan mode, Health, data export, deletion
  features/health/     Apple Health / Health Connect adapters, sleep and steps maths, sync
  features/coachReview/ Elite review request, status and reading
  features/stations/   Smart-station pairing
  features/ai/         Edge Function client (JSON + streaming), SSE parser, photo upload
  features/coach/      Chat history and streaming hooks
  features/membership/ Entitlements helper (tier → features), RevenueCat purchases, paywall
                       helpers, membership panel
  i18n/                i18next setup, en/ar strings, RTL handling
  lib/                 Supabase client, secure storage, env, generated DB types
  stores/              Zustand stores for device-local UI state
  theme/               Design tokens (light/dark) and ThemeProvider
supabase/
  migrations/          Database schema, RLS policies, storage buckets, complete_onboarding(),
                       record_scan(), coach review and smart-station functions
  seed.sql             Generated exercise library, workout and meal templates
  functions/           Edge Functions: coach-chat, meal-estimate, scan-read, export-data,
                       delete-account, revenuecat-webhook, sync-subscription, station-api;
                       _shared/
  tests/database/      pgTAP tests
web/coach/            Coach console (Vite + React web app) for Elite reviews
docs/                  Partner docs (smart-station API)
scripts/               Seed generator, smart-station simulator
reference/             Original HTML prototypes (source of truth for behaviour and UX)
```

## Security notes

- Only `EXPO_PUBLIC_*` variables reach the app bundle. The Anthropic key, Supabase service role
  key and RevenueCat secrets live only in Edge Function secrets.
- Every table has Row Level Security; members can only read and write their own rows. Tiers are
  written only by the server.
- Auth sessions are stored in the device keychain/keystore (expo-secure-store).
- Smart stations authenticate with a per-station HMAC secret and a 5-minute timestamp window;
  station secrets are readable only with the service role.
- Coaches never read tables directly: the `coach_*` functions decide what each coach sees.
