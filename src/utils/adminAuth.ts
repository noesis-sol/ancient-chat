import { adminEmails } from '@/utils/emails';
import { currentUser, getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401; error: 'Unauthorized' }
  | { ok: false; status: 403; error: 'Forbidden' };

// 401 when signed out, 403 when signed in but not an admin.
export const checkAdmin = async (request: NextRequest): Promise<AdminAuthResult> => {
  const { userId } = getAuth(request);
  if (!userId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const user = await currentUser();

  if (!user?.emailAddresses?.some((email) => adminEmails.includes(email.emailAddress))) {
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
