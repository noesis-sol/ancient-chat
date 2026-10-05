export {};

declare global {
  // The session token carries the user's public metadata once it is customized with
  // { "metadata": "{{user.public_metadata}}" } in the Clerk dashboard.
  interface CustomJwtSessionClaims {
    metadata?: { role?: string };
  }
}
