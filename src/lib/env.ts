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
});

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

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  return result.data;
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
