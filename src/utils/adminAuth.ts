import { AdminAuthState, resolveAdminRole } from '@/utils/admin-role';
import { auth, currentUser, getAuth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';

// The one admin check, for whatever auth() or getAuth() returned.
export const isAdmin = (authState: AdminAuthState): Promise<boolean> =>
  resolveAdminRole(authState, async () => (await currentUser())?.publicMetadata);

// For admin pages and layouts: sends anyone who is not an admin back to the home page.
export const redirectNonAdmin = async (): Promise<void> => {
  if (!(await isAdmin(await auth()))) {
    redirect('/');
  }
};

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401; error: 'Unauthorized' }
  | { ok: false; status: 403; error: 'Forbidden' };

// 401 when signed out, 403 when signed in but not an admin.
export const checkAdmin = async (request: NextRequest): Promise<AdminAuthResult> => {
  const authState = getAuth(request);
  if (!authState.userId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  if (!(await isAdmin(authState))) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true };
};

// Returns an error response for non-admins, or null when the request may proceed.
export const requireAdmin = async (request: NextRequest): Promise<NextResponse | null> => {
  const result = await checkAdmin(request);
  if (result.ok) {
    return null;
  }

  return NextResponse.json({ error: result.error }, { status: result.status });
};

// Wraps a route handler so it runs only for admins; others get the 401/403 from requireAdmin.
export const withAdmin =
  <Args extends unknown[]>(handler: (request: NextRequest, ...args: Args) => Promise<Response>) =>
  async (request: NextRequest, ...args: Args): Promise<Response> =>
    (await requireAdmin(request)) ?? handler(request, ...args);
