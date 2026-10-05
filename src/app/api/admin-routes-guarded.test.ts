import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The proxy no longer checks the admin APIs, so each route has to guard itself. The behavior is
// tested per route (index-admin-auth, prompt-admin-auth); this catches a new route that forgets.
const adminApiDirs = ['indexes', 'prompt'].map((dir) => path.join(import.meta.dirname, dir));

const routeFiles = adminApiDirs.flatMap((dir) =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => path.basename(file) === 'route.ts')
    .map((file) => path.relative(import.meta.dirname, path.join(dir, file)))
);

describe('admin API routes', () => {
  it('are all found', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(7);
  });

  it.each(routeFiles)('%s checks for an admin', (file) => {
    const source = readFileSync(path.join(import.meta.dirname, file), 'utf8');

    expect(source).toMatch(/\b(withAdmin|requireAdmin)\(/);
  });
});
