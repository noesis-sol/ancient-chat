// Admin means publicMetadata.role === 'admin'. Only the backend can write public metadata,
// unlike email addresses, which users can add to their own account without verifying them.
export const ADMIN_ROLE = 'admin';

export const hasAdminRole = (metadata: unknown): boolean =>
  typeof metadata === 'object' && metadata !== null && 'role' in metadata && metadata.role === ADMIN_ROLE;

export type AdminAuthState = {
  userId: string | null;
  sessionClaims?: CustomJwtSessionClaims | null;
};

// The one admin decision. Reads the role from the session claims when the session token carries
// the metadata, otherwise from the user's public metadata, which the caller loads: route handlers
// use currentUser(), middleware the Backend API.
export const resolveAdminRole = async (
  { userId, sessionClaims }: AdminAuthState,
  loadPublicMetadata: (userId: string) => Promise<unknown>
): Promise<boolean> => {
  if (!userId) {
    return false;
  }

  if (sessionClaims?.metadata) {
    return hasAdminRole(sessionClaims.metadata);
  }

  return hasAdminRole(await loadPublicMetadata(userId));
};
