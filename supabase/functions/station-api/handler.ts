// POST /station-api
// Called by partner smart stations, not by the app. Every request is signed with the
// station's secret (see docs/smart-stations.md). Request bodies are never logged.

import type { Deps } from '../_shared/context.ts';
import { json } from '../_shared/http.ts';
import { parseStationRequest, verifyStationRequest } from '../_shared/station.ts';

const MAX_BODY = 4_096;

const fail = (status: number, code: string) => json({ error: { code } }, status);

/** Database errors raised by the station functions, mapped to contract codes. */
const DB_ERRORS: Record<string, number> = {
  not_paired: 409,
  exercise_not_tracked: 422,
  implausible_set: 422,
  too_many_sets: 422,
  unknown_station: 401,
};

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed');
    try {
      const stationId = req.headers.get('x-rafiq-station') ?? '';
      const timestamp = req.headers.get('x-rafiq-timestamp') ?? '';
      const signature = req.headers.get('x-rafiq-signature') ?? '';
      const raw = await req.text();
      if (raw.length > MAX_BODY) return fail(413, 'payload_too_large');

      const db = deps.serviceClient();
      const { data: station } = await db
        .from('stations')
        .select('id, secret, active')
        .eq('id', stationId)
        .maybeSingle();
      // Unknown, inactive and badly signed requests look the same from outside.
      if (!station?.active) return fail(401, 'unauthorized');
      const check = await verifyStationRequest(
        station.secret,
        timestamp,
        raw,
        signature,
        deps.now(),
      );
      if (check === 'stale_timestamp') return fail(401, 'stale_timestamp');
      if (check !== 'ok') return fail(401, 'unauthorized');

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return fail(400, 'bad_request');
      }
      const request = parseStationRequest(parsed);
      if (!request) return fail(400, 'bad_request');

      if (request.type === 'pairing_code') {
        const { data, error } = await db.rpc('station_pairing_code', {
          p_station_id: station.id,
        });
        if (error) return fail(500, 'internal');
        return json(data);
      }
      if (request.type === 'end') {
        const { error } = await db.rpc('station_end_pairing', {
          p_station_id: station.id,
        });
        if (error) return fail(500, 'internal');
        return json({ status: 'ended' });
      }

      const { data, error } = await db.rpc('station_log_set', {
        p_station_id: station.id,
        p_event_id: request.event_id,
        p_exercise_key: request.exercise_key,
        p_weight_kg: request.weight_kg,
        p_reps: request.reps,
        p_performed_at: request.performed_at,
      });
      if (error) {
        const status = DB_ERRORS[error.message];
        return status ? fail(status, error.message) : fail(500, 'internal');
      }
      return json(data);
    } catch (e) {
      console.error('station-api failed', e instanceof Error ? e.name : 'unknown');
      return fail(500, 'internal');
    }
  };
}
