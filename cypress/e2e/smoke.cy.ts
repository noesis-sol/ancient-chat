// Proves the E2E wiring: the app is up, and a Clerk test user can sign in and
// reach the protected chat page.
describe('smoke', () => {
  it('loads the home page', () => {
    cy.visit('/');
    cy.contains('h1', 'Chat with the ancients!');
  });

  it('signs in and reaches /chat', () => {
    const email = Cypress.env('E2E_CLERK_USER_EMAIL');
    if (!email) {
      throw new Error('E2E_CLERK_USER_EMAIL is not set (see README.md, "End-to-end tests")');
    }

    // clerkSignIn needs a public page that has loaded Clerk.
    cy.visit('/');
    cy.clerkSignIn({ strategy: 'email_code', identifier: email });
    cy.visit('/chat');
    cy.location('pathname').should('eq', '/chat');
    cy.contains('h1', 'Choose your philosopher!');
  });
});
