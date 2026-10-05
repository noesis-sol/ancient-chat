// Next calls register() once when a server instance starts, before it serves
// requests. Validating the environment here makes a misconfigured deploy fail
// at startup with the names of the missing variables.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env, EnvError } = await import('@/lib/env');
    try {
      env();
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
  }
}
