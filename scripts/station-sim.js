#!/usr/bin/env node
// Smart-station simulator: plays a partner station against station-api, signing each
// request the way docs/smart-stations.md describes. For local testing and partner demos.
//
//   node scripts/station-sim.js register <station-id> "<label>" "<gym>" back_squat,deadlift
//   node scripts/station-sim.js code
//   node scripts/station-sim.js set back_squat 100 5
//   node scripts/station-sim.js end
//
// Env: SUPABASE_URL (default http://127.0.0.1:54321), STATION_ID, STATION_SECRET, and
// optionally STATION_API_URL to call the function somewhere else (e.g. `deno run` locally).
// `register` also needs SUPABASE_SERVICE_ROLE_KEY and prints a new secret.

const crypto = require('node:crypto');

const base = (process.env.SUPABASE_URL || 'http://127.0.0.1:54321').replace(/\/$/, '');

function sign(secret, timestamp, body) {
  return 'v1=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function call(body) {
  const id = process.env.STATION_ID;
  const secret = process.env.STATION_SECRET;
  if (!id || !secret) throw new Error('Set STATION_ID and STATION_SECRET (see `register`).');
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const url = process.env.STATION_API_URL || `${base}/functions/v1/station-api`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Rafiq-Station': id,
      'X-Rafiq-Timestamp': timestamp,
      'X-Rafiq-Signature': sign(secret, timestamp, raw),
    },
    body: raw,
  });
  console.log(res.status, JSON.stringify(await res.json()));
}

async function register(id, label, gym, keys) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY to register a station.');
  const secret = crypto.randomBytes(32).toString('hex');
  const res = await fetch(`${base}/rest/v1/stations`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ id, label, gym_name: gym, exercise_keys: keys.split(','), secret }),
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  console.log(`export STATION_ID=${id}\nexport STATION_SECRET=${secret}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'register' && args.length === 4) return register(...args);
  if (command === 'code') return call({ type: 'pairing_code' });
  if (command === 'end') return call({ type: 'end' });
  if (command === 'set' && args.length === 3) {
    return call({
      type: 'set',
      event_id: `${process.env.STATION_ID}-${Date.now()}`,
      exercise_key: args[0],
      weight_kg: Number(args[1]),
      reps: Number(args[2]),
      performed_at: new Date().toISOString(),
    });
  }
  console.log('Usage: station-sim.js register|code|set <exercise> <kg> <reps>|end');
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
