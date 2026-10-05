import { findAncient } from '@/data/ancients';

export type IndexAncientBody = { ok: true; ancient: string | null } | { ok: false; error: string };

/**
 * Reads the body of PATCH /api/indexes/:name/ancient: { ancient: <slug> } to
 * assign the index to that ancient's chat, or { ancient: null } to unassign it.
 * Disabled ancients are accepted, so an admin can prepare one before enabling it.
 */
export const parseIndexAncientBody = (body: unknown): IndexAncientBody => {
  const ancient = body && typeof body === 'object' ? (body as { ancient?: unknown }).ancient : undefined;
  if (ancient === null) {
    return { ok: true, ancient: null };
  }
  if (typeof ancient !== 'string') {
    return { ok: false, error: 'ancient must be a slug or null' };
  }
  const found = findAncient(ancient);
  return found ? { ok: true, ancient: found.slug } : { ok: false, error: 'Unknown ancient' };
};
