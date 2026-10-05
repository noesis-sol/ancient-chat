import { auth } from '@clerk/nextjs/server';

// Sends signed-out visitors of /chat and /chat/[name] to sign in. The chat
// pages are client components, so the check lives here; /api/chat checks again.
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  await auth.protect();

  return children;
}
