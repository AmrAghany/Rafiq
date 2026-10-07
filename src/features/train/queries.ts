// Shared with the integration tests, which run the same queries against a real database.

export const SESSION_COLUMNS =
  'id, workout_key, log_date, readiness_score, completed_at, swaps, set_logs(id, exercise_key, swapped_from_key, set_number, target_reps, target_weight_kg, actual_reps, actual_weight_kg, completed, source)';
