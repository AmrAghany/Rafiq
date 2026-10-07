# Rafiq smart-station API (v1)

This is the contract for partner smart stations: racks, platforms and benches that measure
barbell sets. A paired station logs each set into the member's workout in Rafiq, and the
member sees it on the Train tab within about 10 seconds.

## How a session works

1. The station asks Rafiq for a **pairing code** and shows it on its screen. The code is
   6 digits and lasts 2 minutes.
2. The member types the code on the Train tab in the Rafiq app (Arabic-Indic digits work
   too). The station is now paired with that member.
3. The station posts each **set** it measures. Rafiq logs it in the member's session for
   today's planned workout, as the next set of that lift. If today is a rest day, the set
   goes into a free-training session.
4. The pairing ends when the station sends **end**, when the member taps "End pairing",
   when another member pairs with the station, or after **20 minutes without a set**.

A station is paired with one member at a time, and a member with one station at a time.

## Endpoint and signing

```
POST https://<project>.supabase.co/functions/v1/station-api
Content-Type: application/json
X-Rafiq-Station:   <station id>          e.g. fitzone-olaya-rack-3
X-Rafiq-Timestamp: <unix time, seconds>  e.g. 1791367200
X-Rafiq-Signature: v1=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>
```

- Sign the **exact bytes** you send as the body.
- The timestamp must be within **5 minutes** of Rafiq's clock. Keep the station's clock in
  sync over NTP.
- Unknown stations, inactive stations and bad signatures all get `401 unauthorized`.
  A timestamp that is too old or too far ahead gets `401 stale_timestamp`.
- Bodies are limited to 4 KB.
- Rafiq never logs request bodies.

Example in Node:

```js
const body = JSON.stringify({ type: 'pairing_code' });
const ts = String(Math.floor(Date.now() / 1000));
const sig = 'v1=' + crypto.createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
```

## Requests

### Get a pairing code

```json
{ "type": "pairing_code" }
```

`200 {"code": "482913", "expires_at": "2026-10-07T10:02:00Z"}`. Asking again retires the
previous unused code. A member who is already paired stays paired until someone uses the
new code.

### Log a set

```json
{
  "type": "set",
  "event_id": "rack3-000123",
  "exercise_key": "back_squat",
  "weight_kg": 100,
  "reps": 5,
  "performed_at": "2026-10-07T10:05:12Z"
}
```

- `event_id`: unique per station, up to 100 characters from `A-Z a-z 0-9 _ . : -`. If you
  repeat an `event_id` (for example, a retry after a timeout), Rafiq answers
  `200 {"status": "duplicate"}` and doesn't log the set twice. **Always retry with the
  same `event_id`.**
- `exercise_key`: one of the lifts registered for this station (see below).
- `weight_kg`: the total load, bar included, from 0 to 500. Rafiq stores it to 0.1 kg.
- `reps`: a whole number from 1 to 100.
- `performed_at`: optional, ISO 8601.

`200 {"status": "logged", "set_log_id": "…", "set_number": 2}`

| Status | `error.code`           | Meaning                                               |
| ------ | ---------------------- | ----------------------------------------------------- |
| 409    | `not_paired`           | No member is paired with this station. Show the code. |
| 422    | `exercise_not_tracked` | That lift isn't registered for this station.          |
| 422    | `implausible_set`      | The weight or reps are out of range.                  |
| 422    | `too_many_sets`        | That lift already has 20 sets in today's session.     |
| 400    | `bad_request`          | The body isn't one of the requests on this page.      |
| 500    | `internal`             | Retry with the same `event_id`, using backoff.        |

### End the pairing

```json
{ "type": "end" }
```

`200 {"status": "ended"}`. Send this when the member taps logout on the station, or when
the station's own idle timer runs out.

## Exercise keys

The barbell lifts in Rafiq's library that stations can track (marked `smartStation` in the library):

| Key                   | Lift                |
| --------------------- | ------------------- |
| `back_squat`          | Back squat          |
| `deadlift`            | Deadlift            |
| `bench_press`         | Flat bench press    |
| `incline_bench_press` | Incline bench press |
| `overhead_press`      | Overhead press      |
| `barbell_row`         | Barbell row         |

The full library is in `src/features/plan/data/exercises.json`. Check there for the exact
keys before registering a station.

## Registering a station (Rafiq admin)

Each station gets an id and a secret. Store the secret on the station only; never put it
in an app.

```bash
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
  npm run station:sim -- register fitzone-olaya-rack-3 "Rack 3" "FitZone Olaya" back_squat,deadlift
```

This prints the `STATION_ID` and a new random `STATION_SECRET`. To retire a station, set
`active = false` on its row in `public.stations`. To rotate a secret, update `secret`;
the old one stops working at once.

## Trying it locally

```bash
npm run db:start && npx supabase functions serve station-api --no-verify-jwt
eval "$(SUPABASE_SERVICE_ROLE_KEY=<local service key> npm run -s station:sim -- register test-rack "Rack 3" "Test Gym" back_squat,deadlift)"
npm run station:sim -- code                 # type the code into the app's Train tab
npm run station:sim -- set back_squat 100 5
npm run station:sim -- end
```
