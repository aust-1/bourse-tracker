export interface Config {
  supabaseUrl: string;
  serviceRoleKey: string;
  pollIntervalMs: number;
  healthchecksUrl: string | null;
  resendApiKey: string | null;
  emailFrom: string;
  staleAfterMs: number;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`Variable d'environnement manquante : ${key}`);
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    supabaseUrl: required(env, 'SUPABASE_URL'),
    serviceRoleKey: required(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 30_000),
    healthchecksUrl: env.HEALTHCHECKS_PING_URL || null,
    resendApiKey: env.RESEND_API_KEY || null,
    emailFrom: env.EMAIL_FROM || 'Bourse Tracker <onboarding@resend.dev>',
    staleAfterMs: Number(env.STALE_AFTER_MS ?? 5 * 60_000),
  };
}
