import { resolveAdminRole } from '@/utils/admin-role';
import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/chat(.*)']);

// Defense in depth: the admin pages and APIs check the role themselves too.
const isAdminPage = createRouteMatcher(['/admin(.*)']);
const isAdminApi = createRouteMatcher(['/api/indexes(.*)', '/api/prompt(.*)']);

// currentUser() is not available in the proxy, so a session token without the metadata claim
// falls back to loading the user from the Backend API.
const loadPublicMetadata = async (userId: string): Promise<unknown> =>
  (await (await clerkClient()).users.getUser(userId)).publicMetadata;

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  if (isAdminPage(req) || isAdminApi(req)) {
    const authState = await auth();
    const api = isAdminApi(req);

    if (!authState.userId) {
      return api
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : authState.redirectToSignIn({ returnBackUrl: req.url });
    }

    if (!(await resolveAdminRole(authState, loadPublicMetadata))) {
      return api
        ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        : NextResponse.redirect(new URL('/', req.url));
    }
  }
});

// Clerk's recommended matcher: skip Next.js internals and static files by extension, so other
// paths with a dot (/admin/x.y, /chat/a.b) still run through Clerk; always run for API routes.
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
