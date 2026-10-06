// Public client configuration. Only EXPO_PUBLIC_* variables are inlined into
// the app bundle, so nothing secret (service role key, Anthropic key,
// RevenueCat secret) may ever be read here.

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
