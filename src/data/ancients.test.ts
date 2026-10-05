import { describe, expect, it } from 'vitest';
import { ancients, findAncient, findEnabledAncient } from './ancients';

describe('ancients', () => {
  it('has unique lowercase slugs', () => {
    const slugs = ancients.map((ancient) => ancient.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('findAncient', () => {
  it('finds an ancient by slug, ignoring case', () => {
    expect(findAncient('aristotle')?.name).toBe('Aristotle');
    expect(findAncient('Aristotle')?.name).toBe('Aristotle');
  });

  it('finds disabled ancients too', () => {
    expect(findAncient('plato')).toMatchObject({ name: 'Plato', isEnabled: false });
  });

  it('returns undefined for an unknown slug', () => {
    expect(findAncient('zeno')).toBeUndefined();
    expect(findAncient('')).toBeUndefined();
  });
});

describe('findEnabledAncient', () => {
  it('finds an enabled ancient', () => {
    expect(findEnabledAncient('aristotle')?.name).toBe('Aristotle');
  });

  it('rejects a disabled or unknown ancient', () => {
    expect(findEnabledAncient('plato')).toBeUndefined();
    expect(findEnabledAncient('zeno')).toBeUndefined();
  });
});
