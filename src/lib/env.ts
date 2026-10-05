import { z } from 'zod';

// Server-side environment, validated once at startup (src/instrumentation.ts) so
// a missing or malformed variable stops the server with a message naming it,
// instead of failing later inside a client library. .env.example documents
// every variable.

// An empty value (`OPENAI_API_KEY=` in a .env file) counts as unset.
const unsetIfEmpty = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const required = () => z.preprocess(unsetIfEmpty, z.string({ required_error: 'not set' }).trim());

const withDefault = <T extends z.ZodTypeAny>(schema: T, value: z.input<T>) =>
  z.preprocess(unsetIfEmpty, schema.default(value));

const optional = () => z.preprocess(unsetIfEmpty, z.string().trim().optional());

const optionalHttpUrl = () =>
  z.preprocess(
    unsetIfEmpty,
    z
      .string()
      .trim()
      .refine((value) => /^https?:\/\/[^/]/.test(value) && URL.canParse(value), {
        message: 'must be an http:// or https:// URL',
      })
      .optional()
  );

const positiveInteger = (fallback: number) =>
  withDefault(
    z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/, { message: 'must be a whole number above 0' })
      .transform(Number),
    String(fallback)
  );

// Rate limiting of /api/chat (src/lib/rate-limit.ts). Upstash Redis keeps the
// counters. Its Vercel Marketplace integration sets either the UPSTASH_ or the
// KV_ pair; without either, rate limiting is off.
const rateLimitShape = {
  UPSTASH_REDIS_REST_URL: optionalHttpUrl(),
  UPSTASH_REDIS_REST_TOKEN: optional(),
  KV_REST_API_URL: optionalHttpUrl(),
  KV_REST_API_TOKEN: optional(),
  CHAT_RATE_LIMIT_PER_MINUTE: positiveInteger(20),
  CHAT_RATE_LIMIT_PER_DAY: positiveInteger(200),
  // Set by Vercel: production, preview or development.
  VERCEL_ENV: optional(),
};

type RateLimitEnv = z.infer<z.ZodObject<typeof rateLimitShape>>;

const upstashPairs = [
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
] as const;

// The Upstash Redis REST credentials, preferring the UPSTASH_ pair, or
// undefined when neither pair is set.
export function upstashRedis(env: RateLimitEnv): { url: string; token: string } | undefined {
  for (const [url, token] of upstashPairs) {
    const [urlValue, tokenValue] = [env[url], env[token]];
    if (urlValue && tokenValue) {
      return { url: urlValue, token: tokenValue };
    }
  }
  return undefined;
}

function checkRateLimitStore(env: RateLimitEnv, ctx: z.RefinementCtx) {
  for (const [url, token] of upstashPairs) {
    if (env[url] && !env[token]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [token], message: `not set, but ${url} is` });
    } else if (!env[url] && env[token]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [url], message: `not set, but ${token} is` });
    }
  }
  // Without the store, production would run without rate limiting.
  if (env.VERCEL_ENV === 'production' && !upstashRedis(env)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['UPSTASH_REDIS_REST_URL'],
      message:
        'not set: production on Vercel needs Upstash Redis for rate limiting ' +
        '(UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)',
    });
  }
}

const rateLimitSchema = z.object(rateLimitShape).superRefine(checkRateLimitStore);

const envSchema = z.object({
  DATABASE_URL: required().refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: 'must be a postgresql:// connection string',
  }),
  PINECONE_API_KEY: required(),
  OPENAI_API_KEY: required(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: required().refine((value) => value.startsWith('pk_'), {
    message: 'must be a Clerk publishable key (pk_...)',
  }),
  CLERK_SECRET_KEY: required().refine((value) => value.startsWith('sk_'), {
    message: 'must be a Clerk secret key (sk_...)',
  }),
  // Where the upload route creates new serverless Pinecone indexes.
  PINECONE_CLOUD: withDefault(
    z.enum(['aws', 'gcp', 'azure'], { errorMap: () => ({ message: 'must be aws, gcp or azure' }) }),
    'aws'
  ),
  PINECONE_REGION: withDefault(z.string().trim(), 'us-east-1'),
  // Pinecone Local's control plane (http://localhost:5080) for development
  // and tests. Unset means Pinecone's cloud.
  PINECONE_CONTROLLER_HOST: z.preprocess(
    unsetIfEmpty,
    z
      .string()
      .trim()
      .refine((value) => /^https?:\/\/[^/]/.test(value) && URL.canParse(value), {
        message: 'must be an http:// or https:// URL',
      })
      .optional()
  ),
  ...rateLimitShape,
}).superRefine(checkRateLimitStore);

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Invalid environment variables:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n` +
        'Set them in .env (see .env.example) or in the deployment environment.'
    );
    this.name = 'EnvError';
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  return result.data;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parse(envSchema, source);
}

// Only the rate limiting variables, which src/lib/rate-limit.ts reads without
// needing the others.
export function parseRateLimitEnv(source: Record<string, string | undefined>): RateLimitEnv {
  return parse(rateLimitSchema, source);
}

let cached: Env | undefined;

// Parsed on first call, not at import: `next build` imports route modules
// without any secrets set.
export function env(): Env {
  return (cached ??= parseEnv({
    ...process.env,
    // Next inlines NEXT_PUBLIC_ variables at build time, so read this one the
    // way Clerk does, by name, to check the value the app actually uses.
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }));
}
