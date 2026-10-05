import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vercel fails a deployment whose route asks for more time than the plan
// allows, which `next build` does not check. On the Hobby plan that is 300 s
// with fluid compute and 60 s without it.
const HOBBY_MAX_DURATION = { fluid: 300, legacy: 60 };

const root = process.cwd();
const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

const routeDurations = (readdirSync(join(root, 'src/app'), { recursive: true }) as string[])
  .filter((file) => /(^|\/)route\.ts$/.test(file))
  .flatMap((file) => {
    const match = readFileSync(join(root, 'src/app', file), 'utf8').match(/export const maxDuration = (\d+);/);
    return match ? [[file, Number(match[1])] as const] : [];
  });

describe('function durations', () => {
  it('turns on fluid compute', () => {
    expect(vercelConfig.fluid).toBe(true);
  });

  it('gives the upload route the most the Hobby plan allows', () => {
    expect(Object.fromEntries(routeDurations)).toMatchObject({ 'api/indexes/upload/route.ts': 300 });
  });

  it('keeps every route within the Hobby limit', () => {
    const limit = vercelConfig.fluid ? HOBBY_MAX_DURATION.fluid : HOBBY_MAX_DURATION.legacy;
    for (const [file, seconds] of routeDurations) {
      expect(seconds, file).toBeLessThanOrEqual(limit);
    }
  });
});
