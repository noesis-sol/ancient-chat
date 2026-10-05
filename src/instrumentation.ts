// Next calls register() once when a server instance starts, before it serves
// requests. Validating the environment here makes a misconfigured deploy fail
// at startup with the names of the missing variables.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env, EnvError, upstashRedis } = await import('@/lib/env');
    let parsed;
    try {
      parsed = env();
    } catch (error) {
      // In development, rethrow so the dev server shows it. In production a
      // thrown error only fails each request with a 500 while the server stays
      // up, so stop the process instead.
      if (!(error instanceof EnvError) || process.env.NODE_ENV !== 'production') {
        throw error;
      }
      console.error(error.message);
      process.exit(1);
    }
    if (!upstashRedis(parsed)) {
      console.warn('Rate limiting is off: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set.');
    }
  }
}
