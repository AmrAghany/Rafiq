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

### Phase 2: Plan engine and onboarding — done (2026-10-06), waiting for approval to start phase 3

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
