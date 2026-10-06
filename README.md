# Rafiq

An all-day AI personal trainer and nutrition coach for gym members. React Native (Expo) + Supabase.
The full brief, build phases and current status are in [CLAUDE.md](CLAUDE.md). The original
prototype lives in [`reference/`](reference/).

## Requirements

- Node 20+ and npm
- Docker (for the local Supabase stack)
- iOS Simulator / Android emulator, or a phone with a [development build](https://docs.expo.dev/develop/development-builds/introduction/)

## Getting started

```bash
npm install
cp .env.example .env          # then fill in the values below

npm run db:start              # starts local Supabase and applies supabase/migrations
# copy the printed API URL and anon key into EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY

npm start                     # Expo dev server (press i / a, or scan the QR code)
```

Apple and Google sign-in need provider credentials in `.env` (see `.env.example`) and a development
build; Expo Go can't run native Sign in with Apple. Email sign-in works everywhere, including
`npm run web` for a quick look.

## Scripts

| Script              | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `npm start`         | Expo dev server                                                |
| `npm test`          | Jest unit and component tests                                  |
| `npm run typecheck` | TypeScript (strict)                                            |
| `npm run lint`      | ESLint                                                         |
| `npm run format`    | Prettier (write); `format:check` to verify                     |
| `npm run check`     | typecheck + lint + format check + tests                        |
| `npm run db:start`  | Start local Supabase (Docker)                                  |
| `npm run db:reset`  | Recreate the local database from migrations                    |
| `npm run db:test`   | pgTAP tests for RLS and triggers (`supabase/tests/database`)   |
| `npm run db:types`  | Regenerate `src/lib/database.types.ts` from the local database |

## Project layout

```
src/
  app/                 Expo Router routes: (auth) sign-in, (tabs) Today/Train/Food/Coach/Me
  components/          Shared UI primitives (RTL-safe: start/end, never left/right)
  features/auth/       Session provider, Apple/Google/email sign-in
  i18n/                i18next setup, en/ar strings, RTL handling
  lib/                 Supabase client, secure storage, env, generated DB types
  stores/              Zustand stores for device-local UI state
  theme/               Design tokens (light/dark) and ThemeProvider
supabase/
  migrations/          Database schema, RLS policies, storage buckets
  tests/database/      pgTAP tests
reference/             Original HTML prototypes (source of truth for behaviour and UX)
```

## Security notes

- Only `EXPO_PUBLIC_*` variables reach the app bundle. The Anthropic key, Supabase service role
  key and RevenueCat secrets live only in Edge Function secrets.
- Every table has Row Level Security; members can only read and write their own rows. Tiers are
  written only by the server.
- Auth sessions are stored in the device keychain/keystore (expo-secure-store).
