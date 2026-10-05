import { findAncient } from '@/data/ancients';
import { notFound, redirect } from 'next/navigation';

// Rejects unknown and disabled ancients on the server, before the client chat
// page renders. /api/chat checks the slug again for each request.
export default async function ChatWithLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const ancient = findAncient(name);
  if (!ancient) {
    notFound();
  }
  if (!ancient.isEnabled) {
    redirect('/chat');
  }

  return children;
}
