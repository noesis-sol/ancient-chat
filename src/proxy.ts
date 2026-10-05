import { clerkMiddleware } from '@clerk/nextjs/server';

// The proxy only makes the session available to auth() and getAuth(); it does not decide who may
// see what. Each resource checks for itself: the /chat layout signs visitors in, the admin layout
// redirects non-admins, and every API route rejects callers it does not serve.
export default clerkMiddleware();

// Clerk's recommended matcher: skip Next.js internals and static files by extension, so other
// paths with a dot (/admin/x.y, /chat/a.b) still run through Clerk; always run for API routes.
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
