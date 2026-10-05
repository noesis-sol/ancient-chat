// Production on Vercel must rate limit /api/chat (see src/lib/env.ts), so fail
// the deployment's build there rather than serve without Upstash Redis.
if (process.env.VERCEL_ENV === 'production') {
  const isSet = (name) => Boolean(process.env[name]?.trim());
  const hasUpstash =
    (isSet('UPSTASH_REDIS_REST_URL') && isSet('UPSTASH_REDIS_REST_TOKEN')) ||
    (isSet('KV_REST_API_URL') && isSet('KV_REST_API_TOKEN'));
  if (!hasUpstash) {
    throw new Error(
      'Production on Vercel needs Upstash Redis for rate limiting: set UPSTASH_REDIS_REST_URL and ' +
        'UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN), e.g. through the ' +
        'Vercel Marketplace "Upstash for Redis" integration.'
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
