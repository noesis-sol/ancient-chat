// Clerk's sign-in and sign-up pages, the /chat guard and the admin checks, as the
// signed-out visitor and as the test user, who has no admin role.
describe('Clerk auth', () => {
  describe('signed out', () => {
    it('renders the sign-in and sign-up forms', () => {
      cy.visit('/sign-in');
      cy.get('.cl-signIn-root').should('be.visible');

      cy.visit('/sign-up');
      cy.get('.cl-signUp-root').should('be.visible');
    });

    it('sends /chat to sign-in', () => {
      cy.visit('/chat');
      cy.location('pathname').should('eq', '/sign-in');
    });

    it('answers the admin API with 401', () => {
      cy.request({ url: '/api/indexes', failOnStatusCode: false }).its('status').should('eq', 401);
    });
  });

  describe('signed in without the admin role', () => {
    beforeEach(() => {
      const email = Cypress.env('E2E_CLERK_USER_EMAIL');
      if (!email) {
        throw new Error('E2E_CLERK_USER_EMAIL is not set (see README.md, "End-to-end tests")');
      }

      // clerkSignIn needs a public page that has loaded Clerk.
      cy.visit('/');
      cy.clerkSignIn({ strategy: 'email_code', identifier: email });
    });

    it('shows the user menu without the Admin item', () => {
      cy.visit('/chat');
      cy.get('.cl-userButtonTrigger').click();
      cy.get('.cl-userButtonPopoverCard').should('contain', 'Manage account').and('not.contain', 'Admin');
    });

    it('sends /admin back home', () => {
      cy.visit('/admin');
      cy.location('pathname').should('eq', '/');
    });

    it('answers the admin API with 403', () => {
      cy.request({ url: '/api/indexes', failOnStatusCode: false }).its('status').should('eq', 403);
    });
  });
});
