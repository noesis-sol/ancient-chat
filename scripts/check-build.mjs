// Runs `next build` for `npm run check`. The build evaluates route modules
// that create Pinecone and OpenAI clients at import time and prerenders pages
// that need a Clerk publishable key, so it fails without those variables.
// Load the .env files the way Next does, then fill in placeholders only for
// what is still missing, so the check also runs in CI and fresh checkouts.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import nextEnv from '@next/env';

const placeholders = {
  PINECONE_API_KEY: 'placeholder',
  OPENAI_API_KEY: 'placeholder',
  // Clerk checks the format: pk_test_ + base64("<frontend api host>$").
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('clerk.example.com$').toString('base64')}`,
};

nextEnv.loadEnvConfig(process.cwd());

const env = { ...process.env };
for (const [name, value] of Object.entries(placeholders)) {
  if (!env[name]) {
    console.log(`check-build: ${name} is not set, using a placeholder`);
    env[name] = value;
  }
}

// Lint already ran as its own step of `npm run check`.
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const result = spawnSync(process.execPath, [nextBin, 'build', '--no-lint'], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
