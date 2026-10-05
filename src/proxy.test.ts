import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { config } from '@/proxy';

describe('proxy matcher', () => {
  it.each(['/', '/chat', '/chat/plato', '/admin', '/admin/prompt', '/admin/x.y', '/chat/a.b', '/admin.json'])(
    'runs for the page %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  );

  it.each(['/api/chat', '/api/prompt', '/api/prompt/42', '/api/indexes/a.b/toggle', '/api/indexes/upload'])(
    'runs for the API route %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  );

  it.each(['/_next/static/chunks/main.js', '/favicon.ico', '/images/logo.png', '/fonts/lemon.woff2', '/styles.css'])(
    'skips the static file %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  );
});
