import { describe, expect, it } from 'vitest';
import { parseIndexAncientBody } from './index-ancient';

describe('parseIndexAncientBody', () => {
  it('accepts a known slug, normalised to lowercase', () => {
    expect(parseIndexAncientBody({ ancient: 'aristotle' })).toEqual({ ok: true, ancient: 'aristotle' });
    expect(parseIndexAncientBody({ ancient: 'Aristotle' })).toEqual({ ok: true, ancient: 'aristotle' });
  });

  it('accepts a disabled ancient, so an admin can prepare one', () => {
    expect(parseIndexAncientBody({ ancient: 'plato' })).toEqual({ ok: true, ancient: 'plato' });
  });

  it('accepts null to unassign the index', () => {
    expect(parseIndexAncientBody({ ancient: null })).toEqual({ ok: true, ancient: null });
  });

  it('rejects an unknown slug', () => {
    expect(parseIndexAncientBody({ ancient: 'zeno' })).toEqual({ ok: false, error: 'Unknown ancient' });
  });

  it('rejects a missing or non-string ancient', () => {
    for (const body of [{}, { ancient: 1 }, null, 'aristotle', []]) {
      expect(parseIndexAncientBody(body)).toEqual({ ok: false, error: 'ancient must be a slug or null' });
    }
  });
});
