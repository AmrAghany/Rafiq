# Rafiq: all-day AI personal trainer app

This file is the project brief for Claude Code. Read it fully before writing code, and keep it updated as decisions change.

## What we are building

Rafiq is a mobile app that acts as a personal trainer and nutrition coach for gym members, from the moment they wake up until they go to sleep. It builds a training program and a carb-cycling nutrition plan from the member's body data (height, weight, goal and an InBody body-composition scan), guides them through the day with a timeline and reminders, tracks their workouts, and gives them an AI coach they can talk to in any language.

The working HTML prototype in `reference/rafiq-prototype.html` shows the intended screens, flows, copy and plan formulas. Treat it as the source of truth for behaviour and UX, but rebuild it properly as a native app. Do not copy its single-file structure.

Target market starts with Arabic- and English-speaking members (Middle East first), so Arabic with full right-to-left layout is a first-class requirement, not an afterthought.

## Users

- **Members (primary):** gym-goers, adults 18+, beginner to advanced. They pay for Pro or Elite.
- **Gym owners (later phase):** can offer Rafiq to their members under the gym's brand and see an engagement dashboard.

## Tech stack

- **App:** React Native with Expo (managed workflow), TypeScript in strict mode, Expo Router for navigation. **Native iOS and Android only; there is no web target** (decided 2026-10-06). Builds go through EAS (`eas.json`).
- **Coach console:** a separate web app in `web/coach` (Vite, React, TypeScript, TanStack Query, i18next) for staff, not members (decided 2026-10-07). It shares the Supabase project and reads only through the `coach_*` database functions.
- **State and data fetching:** TanStack Query for server data, Zustand for local UI state.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions). Row Level Security on every table.
- **AI:** Anthropic Claude API, called ONLY from Supabase Edge Functions. The API key must never ship in the app bundle.
  - Coach chat and meal estimation: `claude-haiku-4-5-20251001` (fast and cheap).
  - InBody scan reading and program customisation: `claude-sonnet-5-5`.
- **Subscriptions:** RevenueCat (App Store and Google Play in-app subscriptions are required for digital content).
- **Notifications:** Expo Notifications for local timeline reminders.
- **i18n:** i18next with `en` and `ar` from day one, RTL via `I18nManager`. All user-facing strings go through translation keys.
- **Testing:** Jest and React Native Testing Library for logic and components. The plan engine must have thorough unit tests.
- **Lint and format:** ESLint and Prettier.

If a better choice exists for any of these, propose it and explain why before switching.

## Core features (from the prototype)

### 1. Onboarding

Three steps: about you (name, sex, age, height, weight, goal, training days per week, experience), InBody scan (upload a photo that the AI reads, or type body fat %, skeletal muscle kg and BMR), and a health check (injury or joint pain, heart or blood pressure condition, diabetes, pregnant or breastfeeding, past or current eating disorder). Block users under 18. Always let the user confirm or correct numbers the AI read from a scan.

### 2. Plan engine (pure TypeScript module, fully unit-tested)

Port the formulas from the prototype's `plan()` function:

- Lean body mass = weight × (1 − body fat). BMR = scan BMR if provided, else Katch-McArdle `370 + 21.6 × LBM`.
- TDEE = BMR × activity factor (3 days 1.45, 4 days 1.55, 5 days 1.65).
- Target calories = TDEE × goal factor (lose 0.80, build 1.10, recomp 0.95), rounded to 10.
- Protein = 2.0 g/kg bodyweight, or 2.4 g/kg lean mass if body fat is over 30%.
- Carb cycle day types: High (calories × 1.08, fat 0.8 g/kg), Medium (× 1.0, fat 0.9 g/kg), Low (× 0.82, fat 1.15 g/kg). Carbs fill the remaining calories, minimum 50 g.
- Splits: 3-day full body, 4-day upper/lower, 5-day push/pull/legs plus upper/lower, with the day-type mapping in the prototype's `SPLIT` table (leg days High, upper days Medium, rest days Low).
- Starting weights = bodyweight × exercise ratio × experience factor × goal factor, rounded to 2.5 kg. Rep schemes depend on goal.
- Readiness from the morning check-in (sleep, energy, soreness) gives a score of 40–100. Below 60 means one less set per exercise and 10% less weight.
- Safety overrides: an eating-disorder or pregnancy flag means no calorie deficit and no calorie numbers shown in the UI (balanced meals only). Heart, diabetes or injury flags show a "check with your doctor" notice and keep training moderate.

Keep the exercise library, splits and meal templates as data (JSON or DB tables), not hard-coded in components, so coaches can edit them later.

### 3. Today tab

Greeting, a week strip showing each day's carb type (H, M, L) and training or rest, today's macro targets, the morning check-in and readiness score, a water tracker, and the full-day timeline (wake-up check-in, meals, movement breaks, pre-workout snack, workout, dinner, wind-down, sleep) with "now" highlighted and tap-to-complete items. Schedule local notifications for timeline items, and let the user set their wake-up and workout times.

### 4. Train tab

Today's workout from the program, adjusted for readiness. Tap to complete sets, rest timer, editable actual weight and reps per set, a "machine busy?" swap to an alternative exercise, and workout history with progression (suggest a weight increase when all reps are completed for two sessions in a row). Mark barbell lifts that can be auto-tracked at partner smart stations (integration comes in a later phase).

### 5. Food tab

Daily macro targets and progress bars, a meal plan for the day type with local dishes, and meal logging by text description or photo (the AI estimates name, kcal, protein, carbs and fat; the user can edit before saving). Ramadan mode renames meals to suhoor, iftar and so on.

### 6. AI coach

Chat in any language. The coach replies in the language and dialect of the member's latest message. Each request to the Edge Function builds a system prompt from the member's profile, today's plan, readiness, food eaten so far and Ramadan status (see `coachContext()` in the prototype). Stream responses. Keep replies brief and practical. Safety rules in the system prompt: never diagnose; refer chest pain, dizziness, injuries, medication, pregnancy and eating-disorder concerns to a professional; never suggest eating below BMR or extreme diets. Store chat history per user. Add rate limits per user per day by tier.

### 7. Me tab

Profile, scan results with a rescan reminder every 4 weeks (a new scan rebuilds the plan and keeps history for progress charts), settings (Ramadan mode, language, reminder times, units), and membership management.

### 8. Membership tiers

- **Free:** workout logging and a basic plan.
- **Pro:** AI coach, program from InBody, carb cycle and meal plans, meal logging by photo or text. 7-day free trial.
- **Elite:** everything in Pro, plus a monthly review by a human coach (build the coach-review workflow in a later phase).
  Gate features through one entitlements helper backed by RevenueCat. Never trust the client alone for entitlements: Edge Functions must check the tier before calling Claude.

## Data model (starting point; refine as needed)

`profiles`, `body_scans`, `plans` (a generated plan snapshot as JSONB plus version), `daily_logs` (check-in, water, completed timeline items), `workout_sessions`, `set_logs`, `meal_logs`, `chat_messages`, `subscriptions` (mirrored from RevenueCat webhooks), and the content tables `exercises`, `workout_templates`, `meal_templates`. Scan photos go in a private Storage bucket.

## Privacy and safety

Body scans, health flags and chat are sensitive health data. Use RLS so users only access their own rows, encrypt in transit, never log message content or scan images in plain logs, and provide data export and account deletion in settings. Show a clear "not medical advice" notice at onboarding. Keep the under-18 block.

## Build phases

Work in this order. Finish, test and summarise each phase before starting the next, and ask me before moving on.

1. **Foundation:** Expo project, navigation with 5 tabs, theming (light and dark), i18n with English and Arabic plus RTL, Supabase setup with auth (email and Apple/Google sign-in), and the database schema with RLS.
2. **Plan engine and onboarding:** the pure plan engine with unit tests, the onboarding flow with manual scan entry, and the plan summary screen.
3. **Daily experience:** Today, Train and Food tabs working with real data, local notifications, workout history and progression.
4. **AI features:** Edge Functions for coach chat (streaming), meal estimation (text and photo) and InBody photo reading, with tier checks and rate limits.
5. **Monetisation:** RevenueCat integration, paywall, free trial, entitlement gating.
6. **Polish:** Ramadan mode, progress charts and rescan flow, accessibility pass (screen reader labels, dynamic type), and an Arabic copy review.
7. **Later:** Apple Health and Health Connect for sleep and steps, the gym owner dashboard, smart station integration, and Elite human-coach review.

## Working rules for Claude Code

- Ask before adding a dependency that isn't listed above.
- Keep secrets in environment variables; add `.env.example` with every variable name and never commit real keys.
- Write tests alongside the plan engine and any calculation logic.
- After each phase, update the "Status" section below with what was built, how to run it, and any open questions.

## Status

### Phase 7: Health, coach reviews and smart stations — done (2026-10-07)

Scope (your answers): Apple Health / Health Connect, Elite coach review with a **separate web console**, and smart stations with **our own contract**. The gym owner dashboard waits.

**Built**

- **Sleep and steps** (`src/features/health`):
  - Apple Health on iOS and Health Connect on Android, read only. Connect on Me.
  - On open and on returning to the app (at most every 15 min), the app reads last night's sleep (18:00–14:00, overlapping sources merged, only asleep stages) and today's steps.
  - Readings are saved to new `daily_logs` columns. Only those columns are written, so a missing value never erases one.
  - Sleep pre-selects the check-in's sleep answer (7 h great, 5½ h OK, less badly), and the member can change it. Today shows a sleep and steps card. The coach's context gets both.
  - Health Connect missing, needing an update, or refused each get their own message.
  - `app.json` has the HealthKit entitlement, a read-only usage text, the two Health Connect read permissions and `minSdkVersion` 26.
- **Elite coach review**:
  - **Database**: `staff`, `coach_reviews`, and functions that are the only way in:
    - `request_coach_review` (Elite only, one per month), `my_coach_reviews`, `mark_coach_review_read`;
    - `coach_review_queue`, `claim_coach_review`, `release_coach_review`, `coach_review_bundle`, `save_coach_review`.
    - A coach sees a member's data only while holding their review: profile, health flags, plan, scans, and the 5 weeks before the request of check-ins, sleep, steps, workouts with sets, and meals. Never chats.
    - The member sees the coach's text only once it's sent.
  - **App**:
    - Me → Coach review: request with an optional note, after a plain-language note on what the coach will see. Status follows requested → in review → ready, with earlier reviews listed.
    - Today shows a "review ready" card. The review screen marks it read and shows each section in its own text direction.
    - Pro members see an Elite upsell. Data export now includes reviews.
  - **Coach console** (`web/coach`):
    - Sign-in, coaches only. A queue of in-progress, open and delivered reviews (first names only), claim and give back.
    - The member's month: health-note banners, with a no-calorie-numbers warning for careful answers and body numbers hidden for the eating-disorder answer. Profile, plan targets, a week-by-week table, lift progress and scans.
    - Write, save a draft, and send (with a confirmation; no edits after).
    - English and Arabic with RTL. Light and dark.
- **Smart stations**:
  - **Contract**: `docs/smart-stations.md`.
    - `station-api` Edge Function, with no JWT. Requests are signed with HMAC-SHA256 of `timestamp.body`, within a 5-minute window, and checked with a constant-time compare.
    - Requests: pairing code (6 digits, 2 min), set, and end.
  - **Database**: `stations` (secret readable only with the service role), `station_pairings`, `station_events` (one set per event id, so retries are safe), and `set_logs.source` / `station_id`.
    - Sets land in today's planned session, the one Train shows, as the next set number with the plan's target reps. A rest day uses a free-training session.
    - A station pairs with one member at a time. A pairing ends after 20 minutes without a set.
  - **App**: a pairing card on Train when today's workout has station lifts. The code accepts Arabic-Indic digits. While paired, Train refreshes every 10 s, and station sets are marked "Logged by station".
  - **Simulator**: `npm run station:sim` (register, code, set, end).
- **Fixes found while verifying**:
  - Set rows: the phase 6 `minWidth` change let the inputs squeeze the "Set 1" label to one letter per line. It's now a fixed 76 px.
  - Names from outside the app (station, gym, coach) are wrapped in direction isolates inside Arabic sentences.
- **Tests**:
  - 799 Jest tests, including sleep and steps maths and the native adapters, check-in pre-fill, Health settings, sync, coach review screens, station pairing and badges, and UI accessibility.
  - 112 pgTAP tests: 24 for coach reviews (who can request, see, claim, read and write) and 22 for stations (pairing, idempotency, isolation).
  - 22 Deno tests, 30 steps (signing and replay, request parsing, `station-api` against local Supabase, coach sleep and steps context, export with reviews).
  - 5 integration tests.
  - 12 console tests (Vitest: summary maths, sign-in, non-coach, claim, draft and send, careful members, give back, Arabic).
- **Verified**:
  - `npm run check`, `npx eslint .`, `npm run coach:check` and `coach:build` pass. The iOS and Android bundles export with the new native modules.
  - The real `station-api` entry point was served under Deno and driven by the simulator over HTTP: pair, log, refuse an untracked lift, end, then refuse after end and with a wrong secret.
  - The coach console ran in Chromium against local Supabase with a seeded coach and Elite member: sign in, claim, read the month, draft, send, Arabic, and phone width. Three fixes came out of it: the review window (now the 5 weeks before the request), Arabic units, and bidi for notes and lifts.
  - In a temporary web preview of the app (not committed), these all worked in English and Arabic: the Health-filled check-in, requesting a review, the "review ready" card and the review screen (written by the coach), and pairing on Train with station sets appearing through polling.

**Not verified**: reading real Apple Health / Health Connect data, permission sheets, and the Android `minSdkVersion` 26 build. These need device builds. Real partner hardware has also not been tested.

**Decisions**

- New dependencies (approved): `@kingstinct/react-native-healthkit` (with its peer `react-native-nitro-modules`), `react-native-health-connect` (ships its own Expo plugin) and `expo-build-properties` (first-party, for minSdk 26).
- The console is a Vite single-page app, not Next.js: everything goes through Supabase, so there's no server to run. It deploys as static files.
- Coaches are added with SQL by an admin (README). Any coach can claim any open request; there are no assignments yet.
- Station sets go into today's planned session. The member can still edit them on Train.

**Testing builds (2026-10-07)**: the app is linked to the Expo project `gazar` (owner `amrelgazar`, project id in `app.json`). `eas.json` sets the hosted Supabase URL and anon key for `preview` and `production`. For now `production` also builds an installable **APK** so "Build from GitHub" gives a phone-installable app; **switch `production.android.buildType` back to `app-bundle` before the first Play Store upload.**

**Open questions for what's next**

1. The gym owner dashboard: should it live in the same web console (a new "owner" staff role) with gym branding and engagement charts?
2. Coach assignment: should each Elite member keep the same coach every month, and do coaches need notifications (email) when a request arrives?
3. Should the member get a push notification when a review is ready? Today they see it on next open. Push needs a server-sent notification service.
4. Station partners: is there a first partner gym? Its rack ids, lift list, and whether stations can measure reps themselves or need the member to confirm.
5. Still open: prayer-time automation, the Egypt AI limits, rescans changing the goal, terms and privacy URLs, paywall after onboarding, annual plans, bundle id, fonts, `expo-updates`, native Google sign-in, email confirmation, the carb-day letters, and EAS accounts.

### Phase 6: Polish — done (2026-10-07)

**Built**

- **Ramadan mode** (Me → Ramadan mode):
  - An on/off switch, plus the member's suhoor and iftar times. The times are stored on the profile (new `suhoor_time` and `iftar_time` columns).
  - The fasting-day timeline is built around those times. The defaults (03:45 and 18:05) give exactly the prototype's Ramadan day. Meals get their Ramadan names, the water goal is 8 glasses, and reminders follow the new times, including items after midnight.
  - The coach's context now includes the suhoor and iftar times.
  - The times are entered by hand, with validation (a fast of 10–18 hours). Automatic prayer times would need location access and a prayer-time library; see the open questions.
- **Rescan and progress**:
  - A new `record_scan()` database function (migration `20261007010000`, runs as the member) saves the scan and updates the profile weight. It then switches to a new plan version and keeps every earlier scan and plan.
  - The plan is rebuilt with the same engine. Goal, training days, experience and health answers carry over, and logged workout weights carry on.
  - The Rescan screen (`/rescan`): weight is required and the scan numbers are optional. Each field shows last time's value as a hint. Pro members can read the sheet from a photo (`ScanPhoto` now also works outside onboarding). Before saving, the screen shows what changes (calories, protein, BMR, lean mass).
  - The Progress screen (`/progress`):
    - One chart each for weight, body fat and skeletal muscle. Tap a dot to read that scan.
    - Each chart shows the change since the first scan, and the screen lists every scan.
  - **Charts without a new dependency**: the geometry is pure and tested, drawn with plain Views. Following the data-viz rules:
    - Single series, 2 px lines, ringed dots, hairline gridlines with whole-number labels and a validated series colour.
    - A screen-reader summary for each chart and a table of every scan.
  - **Rescan every 4 weeks**:
    - A "Body scan" card shows on Today when a scan is due or 3 days away, and always on Me.
    - One local reminder is scheduled at wake-up + 2 h on the due day. The text has no body numbers.
  - **Careful flags**: for the eating-disorder answer, Progress shows no body charts or scan numbers, only an encouraging note, and the rescan screen hides past values and the calorie lines.
- **Accessibility**:
  - Dynamic type: body text scales up to 2×, titles to 1.5×. Fixed widths that could clip large text are now minimum widths (timeline times, set inputs, the coach send button).
  - Only warnings are announced as alerts.
  - Field errors are read as hints.
  - Repeated buttons now have specific labels ("Remove: <meal>", "<meal>: Log this meal").
  - The sign-in mode switch now has a 44 pt touch target.
- **Arabic copy review**:
  - Consistent units (كغ, غ).
  - "قياس" (measurement) for the InBody scan, with "فحص" kept for the health check.
  - Readable weekday names (إثنين…أحد) in place of the clipped abbreviations.
  - "تقييم الصباح" for the morning check-in.
  - Grammatically safe counts ("المجموعات المنجزة: 5"), "{{price}} شهريًا", neutral تشغيل/إيقاف switches, and Western digits throughout.
  - Fixed a stale message in both languages: "subscriptions arrive in the next update" now points to the free trial.
- **Prices per country**: see the README section "Prices by country". Prices are set in the stores, not in code. Monthly Pro / Elite:

  | Market         | Pro        | Elite      |
  | -------------- | ---------- | ---------- |
  | US and default | $12.99     | $49.99     |
  | Saudi Arabia   | SAR 44.99  | SAR 179.99 |
  | UAE            | AED 44.99  | AED 179.99 |
  | Qatar          | QAR 44.99  | QAR 179.99 |
  | Kuwait         | KWD 3.990  | KWD 14.990 |
  | Bahrain        | BHD 4.490  | BHD 17.990 |
  | Oman           | OMR 4.490  | OMR 17.990 |
  | Jordan         | JOD 5.99   | JOD 24.99  |
  | Egypt          | EGP 249.99 | EGP 999.99 |

- **Tests**:
  - 718 Jest tests, including:
    - The Ramadan timeline, validation and reminders across midnight, and the Ramadan settings.
    - Rescan due dates, series, payload and plan changes, and chart geometry.
    - The Progress and Rescan screens and the rescan reminder.
    - UI accessibility.
  - 66 pgTAP tests (12 new for `record_scan`, history, other members' photos and the Ramadan columns).
  - 5 integration tests (onboarding now continues into a rescan).
  - 18 Deno tests (coach context with fasting times).
- **Verified**:
  - `npm run check` and `npx eslint .` pass. The iOS and Android bundles export.
  - In a temporary web preview (not committed), these all worked in English and Arabic: a due rescan on Today, the rescan with its plan preview, the new plan, the progress charts (including tapping a dot), the Ramadan settings and the fasting-day Today screen.
  - The preview found two bugs, now fixed: chart axis labels overlapping the first dot, and "kg" instead of "كغ" on Progress.

**Not verified**:

- VoiceOver and TalkBack, and the largest text sizes, on real devices.
- Delivery of the rescan reminder.
- These need a device build (`preview`).

**Decisions**

- Charts are drawn with Views rather than adding `react-native-svg`. If you want richer charts later (area fills, more scans), `react-native-svg` is the standard Expo module. Ask before adding it.
- The body charts are hidden for the eating-disorder answer. Pregnancy keeps them, because weight change is expected and the plan already avoids a deficit.
- Ramadan times are entered by hand.

**Open questions from phase 6**

1. Prayer times: should Ramadan mode fill suhoor and iftar automatically from the member's location? That needs `expo-location` and a prayer-time library such as `adhan`.
2. Do the per-country prices look right? Egypt in particular: at ≈ $5, a heavy coach user can cost more than they pay. Should Egypt get lower daily AI limits?
3. Should a rescan also let the member change their goal or training days? Today that needs onboarding again.
4. Still open from earlier phases: the terms and privacy URLs, whether to show the paywall once after onboarding, annual plans, the real bundle id and Apple team, fonts (Barlow plus an Arabic pairing), `expo-updates` for the language restart, native Google sign-in, email confirmation in production, the Arabic carb-day letters (ع/و/م), and EAS accounts.

### Phase 5: Monetisation — done (2026-10-06)

**Built**

- **RevenueCat** (`react-native-purchases` 10.11, as named in the brief): members are identified by their Supabase user id. `PurchasesSync` logs them in and out of RevenueCat with the session, and resyncs whenever RevenueCat reports a change while the app is open.
- **Server mirror**:
  - `revenuecat-webhook` checks the shared secret in the Authorization header with a constant-time comparison. It treats every event only as a trigger: it reads the subscriber's current state from RevenueCat's v1 API, so events arriving out of order can't apply stale state.
  - `sync-subscription` (called by the app after a purchase or restore) does the same for the caller, so the tier updates at once.
  - Both write `subscriptions` with the service role. Members still can't write their own tier.
  - Migration `20261006230000` adds `will_renew`, `management_url` and `synced_at`, plus a check constraint on `status`.
  - `delete-account` also deletes the member's RevenueCat record (best effort). The delete text now tells members to cancel any store subscription first.
- **Mapping** (`_shared/revenuecat.ts`, pure and tested): active entitlement `elite` → Elite, `pro` → Pro, otherwise Free. Billing grace periods keep access. Status is one of trial, active, cancelled (still active, won't renew), billing_issue, expired or none.
- **One entitlements helper** (`src/features/membership/entitlements.ts`): `can(tier, feature)` covers `ai_coach`, `scan_photo`, `meal_plans`, `meal_ai` and `coach_review` (Elite only, a later phase). `useEntitlements()` reads the server mirror. The Edge Functions keep their own tier and quota checks.
- **Gating** (as in the prototype):
  - Coach tab and scan-photo reading are Pro.
  - The Food tab (carb cycle and meal plans) is Pro, except for members whose plan is "balanced meals, no numbers", who keep the simple version for free.
  - Meal AI is Pro.
  - Every locked spot has a "Try Pro free" button that opens the paywall.
- **Paywall** (modal):
  - Pro and Elite with localized store prices and the trial length read from the store (iOS intro offer or the Google Play free phase).
  - Purchase, restore, a pending-payment state, plain-language errors, the store-required auto-renewal text for each platform, and terms and privacy links.
  - Disables the plan the member already has.
- **Me → Membership**: current plan, trial end, renewal or end date, a billing-issue warning, change plan, and manage subscription (store page).
- **Tests**:
  - 638 Jest tests, including the entitlements map, plan/trial parsing for both stores, the purchases wrapper (configure/logIn, cancel/pending/errors, sync after purchase and restore), the paywall, the membership panel, and `PurchasesSync`.
  - A **routing test that renders the real route files**: sign-up must land on onboarding, never the paywall. It fails if the bug below comes back.
  - 17 Deno tests (26 steps), including the webhook against local Supabase with a fake RevenueCat API: secret check, test events, trial → Pro unlocking AI quotas, out-of-order events, expiry → free, 500 on a RevenueCat outage so RevenueCat retries, anonymous ids ignored, sync after purchase, and members still unable to set their own tier.
  - 54 pgTAP tests and 5 integration tests.
- **Bug found and fixed**: the preview showed new members landing on the paywall instead of onboarding right after sign-up. Expo Router opens the first allowed screen when a guard changes, and the paywall route had been declared first.
- **Verified**:
  - All checks pass and the iOS and Android bundles export.
  - In a temporary web preview (not committed, with fake store plans), these all worked in English and Arabic: the locked Food tab, the paywall, Me before and after a trial, and Food unlocking once the mirror says Pro.

**Not verified**: real purchases. These need App Store Connect / Play Console products, a RevenueCat project and a device build (`preview` profile). The RevenueCat v1 subscriber response shape is coded from RevenueCat's documented format; confirm with a sandbox purchase.

**Decisions (defaults, since the open questions weren't answered)**

- Product ids `rafiq_pro_monthly` and `rafiq_elite_monthly`; entitlements `pro` and `elite`; one `default` offering. Prices come from the stores (the prototype showed $12.99 and $49).
- The 7-day free trial is set on Pro only, as a store introductory offer.
- No forced paywall after onboarding. Members meet it at locked features.

**Open questions for phase 6**

1. Confirm the prices per country (Saudi Arabia, UAE, Egypt, …) and whether to offer annual plans.
2. Terms of use and privacy policy URLs, which are required before store review.
3. Should the paywall also appear once, right after onboarding, offering the trial?

### Phase 4: AI features — done (2026-10-06)

**Built**

- **Edge Functions** (`supabase/functions`, Deno, `@anthropic-ai/sdk` 0.131.0). Each one:
  - verifies the member's JWT and reads data through their own RLS-scoped client;
  - checks the tier and takes one unit of today's quota (atomic SQL), refunding it if the AI call fails or finds nothing;
  - never logs message text or images.
- **`coach-chat`**: streams the reply as SSE.
  - Model: `claude-haiku-4-5-20251001`, as in the brief.
  - System prompt: stable rules first (reply in the member's language and dialect, about 120 words, no diagnosis, refer pain, injury, medication, pregnancy and eating-disorder concerns, never below BMR or extreme diets), then member data built on the server. That data covers the profile, today's workout with loads (lighter on a low-readiness day), the carb day and food eaten so far, readiness, Ramadan and local time. Careful flags remove every calorie number from the prompt.
  - Sends the last 20 messages as history. Both turns are saved to `chat_messages` with the model name and token counts.
  - Stops generating if the member leaves mid-reply.
- **`meal-estimate`**: text and/or a photo from the private `meal-photos` bucket.
  - Haiku with JSON structured output (name, kcal, protein, carbs, fat, confidence, is_food).
  - The server rejects implausible numbers. Careful members get the name only.
- **`scan-read`**: InBody photo from `scan-photos` to weight, body fat, skeletal muscle and BMR.
  - `claude-sonnet-5-5` at low effort with structured output. Server-side refusal fallback is on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): if Sonnet 5.5 declines, the API retries on a suitable model in the same call.
  - Out-of-range values become null. The member always confirms or corrects the numbers.
- **`export-data`** (all of the member's rows plus 1-hour photo links) and **`delete-account`** (removes Storage photos, then the auth user; every row cascades).
- **Database** (migration `20261006210000_ai_features.sql`):
  - `consume_ai_quota` / `refund_ai_quota` (service role only).
  - `complete_onboarding` now stores the scan photo path and what the AI read, and only accepts photos from the member's own folder.
- **App**:
  - Coach tab: history, streaming bubbles with per-message text direction, multilingual suggestion chips, stop button, and plain-language errors (limit reached, refused, offline, upgrade). Free members see a locked card and no chat data is loaded.
  - Food: "Estimate with AI" by description, camera or photo library. The estimate fills the log form for the member to edit; source, photo path and raw estimate are saved with the meal.
  - Onboarding scan step: read the scan from a photo, for Pro members. Free members are asked to type the numbers, and nothing is uploaded.
  - Me: Export my data (share sheet) and Delete my account (with confirmation).
- **Tier for display**: `useTier()` reads the member's own subscription row. The server always re-checks before any AI call.
- **Daily limits** (`_shared/entitlements.ts`, my suggested defaults): Free 0; Pro 50 coach / 20 meal / 5 scan; Elite 150 / 50 / 10. Days are UTC.
- **New dependency**: `expo-image-picker`, a first-party Expo module. Camera and photo-library permission text is in `app.json`.
- **Tests**:
  - 566 Jest tests, including the SSE parser, streaming client, photo upload, tier, and the Coach, Food-AI, scan-photo and privacy screens.
  - 12 Deno tests. 11 are unit tests for prompts and schema checks. The 12th runs every function's handler against the real local Supabase with a fake Messages API in 17 steps: auth, free → 402, the 50/day limit → 429, refunds on refusal and errors, streaming, history, image input, Sonnet 5.5 with low effort and fallbacks, other members' photos refused, careful members, export, and deletion.
  - 54 pgTAP tests, including quotas and the photo folder rule.
  - 5 local-Supabase integration tests.
- **Verified**:
  - `npm run check` and `npm run fn:check` pass. The iOS and Android bundles export.
  - `coach-chat`'s real entry point was served over HTTP under Deno and streamed chunked SSE to curl; both turns were saved.
  - In a temporary web preview (not committed) against the real handlers and a fake Claude, the Coach tab worked in English and Arabic: locked for free members, streaming, and correct per-message direction.

**Not verified**

- No real Claude call was made, because there's no Anthropic key in this environment. Request shapes were checked against the SDK types and a fake API. The first real run should check reply quality, Arabic dialect matching, and InBody reading accuracy on real sheets.
- The Supabase Edge Runtime container couldn't be pulled (Docker Hub rate limit), so the functions were run under plain Deno 2.9 instead. Run `npm run fn:serve` once before deploying.
- Camera and photo picking need a device build.

**Decisions**

- Prompt caching: the request sets top-level `cache_control`. Haiku 4.5 only caches prompts of at least 4,096 tokens, so short chats won't cache yet; long conversations will.
- Photo reading is a paid feature, including during onboarding, so free members never upload scan photos. Phase 5's free trial will unlock it during onboarding.
- Data export uses React Native's built-in share sheet with the JSON as text. Saving it as a `.json` file would need `expo-file-system` + `expo-sharing`. Do you want those?

**Open questions for phase 5**

1. Product IDs and prices for Pro and Elite (the prototype shows $12.99 and $49 per month). Should the 7-day trial apply to Pro only?
2. A RevenueCat project, plus App Store Connect and Google Play Console access, for real purchases. Until then, testing uses RevenueCat's sandbox or a hand-set `subscriptions.tier`.
3. Should the trial be offered during onboarding, so new members can use photo scan reading straight away?

### Phase 3: Daily experience — done (2026-10-06)

**Built**

- **Today tab**:
  - Date, greeting and the week strip. Tap a day to preview its timeline.
  - The day-type card with kcal, protein and carbs, hidden for careful flags.
  - Morning check-in, which gives the 40–100 readiness score.
  - Water tracker (10 glasses, or 8 in Ramadan).
  - The full-day timeline, with "now" highlighted and tap-to-complete. Ticking the check-in or finishing a workout marks it done automatically.
  - Timeline times follow the member's wake-up and workout times. With the defaults (06:30 and 17:30) the times are exactly the prototype's. A Ramadan variant exists; the toggle comes in phase 6.
  - Logic lives in `src/features/today/timeline.ts`.
- **Train tab**:
  - Today's workout from the plan. A light day (readiness below 60) means one less set and 10% less weight.
  - Each set row has an editable weight and reps (Arabic digits accepted) and a tick.
  - A 90-second rest timer, which also sends a local notification if the app is in the background.
  - "Machine busy?" swaps to the alternative exercise, saved on the session.
  - Smart-station badges, a "last time" line, and a workout-complete card.
  - A workout history screen.
- **Progression** (`src/features/train/progression.ts`): weights start from the last working weight, or the plan's starting weight if there's no history. When every prescribed set hit its target reps at the current weight in two sessions in a row, the app suggests +2.5 kg (+5 kg for squat, deadlift, RDL and leg press, set in `exercises.json` → `progressionKg`) with a "Use X kg" button. It never suggests on a light day.
- **Food tab**:
  - Today's targets against what's been eaten, with progress bars.
  - The meal plan for the day type, using local dishes from `meals.json` (English and Arabic). Each meal has its share of the day's macros and a one-tap "Log this meal".
  - Manual meal logging (name plus optional kcal and macros) and remove.
  - Careful flags hide every number and the number fields. AI estimation from text and photos is phase 4.
- **Reminders** (`expo-notifications`, listed in the brief):
  - The member opts in from a Today card or the Me tab.
  - Reminders are scheduled locally for the next 6 days and capped at 60 (iOS allows 64). They resync whenever the plan, schedule, language or completed items change.
  - Sleep is never reminded, and reminder text contains no health numbers.
  - Tapping a reminder opens Today or Train.
- **Me tab**: daily schedule (wake-up and workout times, checked to be 1–15 h apart) and a reminders switch.
- **Database**: migration `20261006180000_daily_experience.sql`:
  - One session per member, day and workout; `swaps` on sessions.
  - `meal_templates.key`, `share` and `ramadan_slot`; `meal_logs.template_key`; `exercises.progression_kg`.
  - The default workout time is now 17:30.
  - `seed.sql` now also seeds meal templates.
- **Tests**:
  - 480 Jest tests, including the timeline, progression, meals and reminder schedule.
  - Screen tests for Today, Train, Food and settings, including no calorie numbers for careful flags.
  - 5 integration tests, 45 pgTAP tests.
- **Verified**:
  - `npm run check` passes, including on a cold Jest cache.
  - The iOS and Android bundles export.
  - Integration tests pass against a local Supabase: the embedded session and set reads, the upserts, and the schedule round trip.
  - In a temporary web preview (not committed), the full day ran in English and Arabic: check-in, water, timeline, logging sets with an edited weight, the rest timer, and logging planned and manual meals. Everything was still there after a reload. The preview found one Arabic layout bug, now fixed: the Today stats ran together.

**Not verified**: actual notification delivery and permission prompts. Those need a device build (EAS `preview`). Expo Go on Android doesn't support push; local reminders should still work there, but this is untested.

**Decisions**

- Timeline offsets from wake-up: breakfast +0:30, move +3:30, lunch +6:30, dinner +13:00, wind-down +15:30, sleep +16:30. The pre-workout snack is 90 min before the workout; if that would fall within an hour of waking, the afternoon snack is used instead.
- The training session is created on the first logged set, so just opening the Train tab writes nothing.
- Account deletion and data export move to phase 4, because they need a service-role Edge Function, which phase 4 introduces.

**Open questions for phase 4**

1. Daily AI limits per tier for coach chat, meal estimates and scan reads. Suggestion: Pro 50 / 20 / 5 per day, Elite 150 / 50 / 10.
2. A Supabase project, plus an Anthropic API key to store as an Edge Function secret, for real testing of the AI features.

### Phase 2: Plan engine and onboarding — done (2026-10-06)

**Mobile only**: the web target has been removed (`react-native-web`, the `web` config and the web-only code paths). The app builds for iOS and Android only. `eas.json` has `preview` (an installable Android APK, plus an iOS build for test devices), `preview-simulator` and `production` (store builds) profiles. See README, "Building the Android and iOS apps".

**Built**

- **Plan engine** (`src/features/plan/engine.ts`): pure TypeScript, `ENGINE_VERSION` 1.0.0. It covers:
  - Lean body mass and BMR (from the scan, or Katch-McArdle).
  - TDEE, goal calories and protein.
  - High, medium and low carb days.
  - Splits, starting weights rounded to 2.5 kg, and goal rep schemes.
  - The readiness score (40–100); below 60 is a light day with one less set and 10% less weight.
  - Safety overrides.
- **Content as data**: `src/features/plan/data/{exercises,workouts,splits}.json` (English and Arabic names). `scripts/seed.js` generates `supabase/seed.sql` from these files for the `exercises` and `workout_templates` tables. A test fails if the seed file is out of date.
- **Onboarding** (`src/app/(onboarding)`):
  - Welcome screen with the not-medical-advice notice (must be accepted).
  - About you, with an 18+ block based on date of birth.
  - Manual InBody entry; every scan field is optional.
  - Health check.
  - Plan summary.

  "Start my day" saves everything in one transaction through a new `complete_onboarding()` database function (migration `20261006120000`). The function runs with the member's own permissions. Re-running it keeps scan and plan history and switches the active plan.

- **Routing**: a signed-in member without `onboarding_completed_at` is sent to onboarding; otherwise they go to the tabs. Me tab, then "View my plan", opens the saved active plan.
- The onboarding draft is kept in memory only and is never written to the device, because it contains health answers. It is cleared on sign-out.
- Number fields accept Arabic-Indic digits and the Arabic decimal separator (٨٢٫٥).
- **Tests**: 245 Jest, 1 integration and 38 pgTAP.
  - Jest: 46 for the engine, including a verbatim copy of the prototype's `plan()` run against the engine over 8,100 input combinations, plus a starting-weight parity check. The rest cover onboarding validation, the save payload, the screens, and a check that no calorie number renders for the pregnancy or eating-disorder flags.
  - Integration: `npm run test:integration` signs up and onboards against a local Supabase.
  - pgTAP: 24 for RLS and 14 for onboarding and the seed.
- **Verified**:
  - `npm run check` passes.
  - The iOS and Android JS bundles export.
  - Integration and database tests pass against a local Supabase.
  - The full onboarding flow worked in English and Arabic in a temporary web preview, which was not committed. That run found three layout bugs, now fixed: stale validation errors, the Arabic title direction, and carb rows wrapping.

**Not verified**: no Android emulator or APK build in this environment (no KVM, and the Android SDK download is blocked). The first real device test will be an EAS `preview` build.

**Decisions**

- Missing body fat now defaults by sex (20% men, 28% women, as in the prototype's onboarding), and the summary says it was assumed.
- "Keep training moderate" (heart, diabetes or injury) is defined as 10% lighter starting loads and at least 8 reps on main lifts. Nutrition is unchanged. **Please confirm or adjust.**
- The pregnancy and eating-disorder flags set the calorie factor to 1 for every goal, as the prototype did, so there's no deficit and no surplus.
- Calf raise counts as a main lift (prototype rule: ratio ≥ 0.6), so it gets 4 × 6 for recomp. Coaches can change `isMain` in `exercises.json`.
- Splits live only in app JSON, with no DB table yet. Meal templates are phase 3.

**Open questions for phase 3** (the phase 1 questions about bundle id, fonts, `expo-updates`, native Google sign-in, account deletion and email confirmation are still open)

1. Is the moderate-training rule above acceptable?
2. The Arabic carb-day letters are ع (high), و (medium) and م (low). Are these OK, or should we show coloured dots only?
3. Do you have an Expo account and Apple Developer account for EAS builds?

### Phase 1: Foundation — done (2026-10-06)

**Built**

- Expo SDK 57 app (React Native 0.86, TypeScript strict, Expo Router, React Compiler). Routes live in `src/app/`.
- Auth gate with `Stack.Protected`: signed-out members see `(auth)/sign-in`, signed-in members see the five tabs (Today, Train, Food, Coach, Me). Today/Train/Food/Coach are placeholders for phase 3–4.
- Sign-in: email and password (sign-up and sign-in), Sign in with Apple (native on iOS via `signInWithIdToken` with a nonce; browser OAuth on Android), Google (browser OAuth with PKCE). The session is stored in the keychain/keystore through a chunked SecureStore adapter (`src/lib/storage.ts`).
- Theming: light and dark tokens ported from the prototype, with a System/Light/Dark choice on the Me tab.
- i18n: i18next with `en` and `ar` and type-checked keys. Arabic switches the app to RTL (`I18nManager.forceRTL`, then a reload). Shared UI uses start/end spacing so it mirrors correctly.
- Supabase: `supabase/config.toml` (email, Apple and Google providers read from env, 8-character minimum password, `rafiq://auth/callback` redirect) and migration `20261006000000_initial_schema.sql`:
  - Tables: `profiles`, `subscriptions`, `body_scans`, `plans`, `daily_logs`, `workout_sessions`, `set_logs`, `meal_logs`, `chat_messages`, `ai_usage`, and the content tables `exercises`, `workout_templates`, `meal_templates`.
  - RLS is on for every table. Members only access their own rows. Content tables are read-only. `subscriptions` and `ai_usage` can only be written by the service role. Members can only update profile columns they own.
  - A signup trigger creates the profile and a free subscription. An 18+ trigger checks `date_of_birth`. `current_tier()` (service role only) treats a lapsed paid period as free.
  - Private `scan-photos` and `meal-photos` buckets. Files must sit under `<user id>/`.
  - Every user table cascades from `auth.users`, so deleting the auth user deletes their rows.
- Tests: 70 Jest tests (secure storage chunking, en/ar key and placeholder parity, theme, RTL switching, credential validation, OAuth redirect parsing, sign-in screen behaviour) and 24 pgTAP tests (RLS isolation, tier tampering, column guards, under-18 block, cross-member set logs, storage folders, anon access).
- Verified: `npm run check` passes. iOS, Android and web bundles export. In the web build against a local Supabase, these all worked: sign-up, the tabs, dark mode and the Arabic RTL layout.

**How to run**: see README.md (`npm install`, `cp .env.example .env`, `npm run db:start`, `npm start`; `npm run check` and `npm run db:test` for tests).

**Dependencies added beyond the brief (please confirm)**: `expo-localization` (device language and the native RTL config), `expo-secure-store` (session in the keychain), `expo-apple-authentication` and `expo-crypto` (native Apple sign-in and its nonce). All four are first-party Expo modules. The Expo template also brought `expo-web-browser` (OAuth), `expo-symbols` (tab icons) and `expo-linking`. The Supabase CLI runs through `npx supabase` and is not a project dependency.

**Decisions and refinements**

- The profile stores `date_of_birth`, not `age`, so the under-18 block stays correct over time. Onboarding should ask for a birth date, or for age and then store an estimated date.
- Added an `ai_usage` table for the daily per-tier AI rate limits planned for phase 4.
- `set_logs` has a composite foreign key to `(workout_sessions.id, user_id)`, so a set can never point at another member's session.
- Theme and language preferences stay on the device (Zustand persisted to SecureStore). `profiles.locale` also exists so the server can pick the coach and notification language.

**Open questions**

1. App identity: the bundle id and Android package are the placeholder `com.rafiq.app`. What are the real ones, and is there an Apple team?
2. Fonts: the prototype uses Barlow, which has no Arabic glyphs. Can I add `@expo-google-fonts` with Barlow and an Arabic pairing (for example IBM Plex Sans Arabic or Cairo) in phase 6, or earlier?
3. Language switch in release builds: React Native needs a reload to flip RTL. In dev it reloads automatically. In release the member is asked to restart. Can I add `expo-updates` so `reloadAsync()` restarts it seamlessly?
4. Google sign-in currently uses browser OAuth. The native Google sign-in sheet needs `@react-native-google-signin/google-signin`, a third-party dependency. Do you want it?
5. Account deletion: rows cascade from `auth.users`, but deleting the auth user and the member's Storage files needs a service-role Edge Function. I plan to build it alongside data export (phase 3 or 4). Is that OK?
6. Email confirmation is off in local config. Should it be on in production? It needs SMTP.
