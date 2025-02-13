import { adminEmails } from '@/utils/emails';
import { currentUser, getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

export const secureEndpoint = async (request: NextRequest): Promise<boolean> => {
  const { userId } = getAuth(request);
  if (!userId) {
    return false;
  }

  const user = await currentUser();

  if (!user?.emailAddresses?.some((email) => adminEmails.includes(email.emailAddress))) {
    return false;
  }

  return true;
};