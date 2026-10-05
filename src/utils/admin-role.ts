// Admin means publicMetadata.role === 'admin'. Only the backend can write public metadata,
// unlike email addresses, which users can add to their own account without verifying them.
export const ADMIN_ROLE = 'admin';

export const hasAdminRole = (metadata: unknown): boolean =>
  typeof metadata === 'object' && metadata !== null && 'role' in metadata && metadata.role === ADMIN_ROLE;
