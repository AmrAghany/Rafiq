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

## Project layout

```
src/
  app/                 Expo Router routes: (auth) sign-in, (onboarding) 3 steps + summary,
                       (tabs) Today/Train/Food/Coach/Me, plan (my plan)
  components/          Shared UI primitives (RTL-safe: start/end, never left/right)
  features/auth/       Session provider, Apple/Google/email sign-in
  features/plan/       Plan engine (pure, tested), exercise/workout/split JSON, plan summary UI
  features/onboarding/ Onboarding draft, validation and save payload
  features/profile/    TanStack Query hooks for profile, active plan and onboarding save
  i18n/                i18next setup, en/ar strings, RTL handling
  lib/                 Supabase client, secure storage, env, generated DB types
  stores/              Zustand stores for device-local UI state
  theme/               Design tokens (light/dark) and ThemeProvider
supabase/
  migrations/          Database schema, RLS policies, storage buckets, complete_onboarding()
  seed.sql             Generated exercise library and workout templates
  tests/database/      pgTAP tests
reference/             Original HTML prototypes (source of truth for behaviour and UX)
```

## Security notes

- Only `EXPO_PUBLIC_*` variables reach the app bundle. The Anthropic key, Supabase service role
  key and RevenueCat secrets live only in Edge Function secrets.
- Every table has Row Level Security; members can only read and write their own rows. Tiers are
  written only by the server.
- Auth sessions are stored in the device keychain/keystore (expo-secure-store).
