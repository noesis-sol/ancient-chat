# Talk with the Ancients

A Next.js app where signed-in users chat with an ancient philosopher. Answers
come from an OpenAI chat model, grounded in passages retrieved from Pinecone
vector indexes that admins build by uploading source texts.

## Architecture

- **Next.js 16 (App Router)**, React 19, Tailwind 4 with daisyUI.
  - `src/app/(main)`: public site, sign-in/up pages and the chat UI (`/chat`).
  - `src/app/(dashboard)`: admin pages (`/admin` for indexes, `/admin/prompt`
    for the system prompts).
  - `src/data/ancients.ts`: the philosophers, their slugs and which are
    enabled. The server rejects chats with unknown or disabled ones.
  - `src/app/api`: route handlers for chat, indexes, uploads and prompts.
- **Clerk** handles authentication. `src/proxy.ts` requires sign-in for
  `/chat`. Admins are the users whose Clerk public metadata has
  `"role": "admin"`; `isAdmin` in `src/utils/adminAuth.ts` is the one check,
  used by the admin pages, the `(dashboard)` layout and the admin APIs.
- **PostgreSQL via Prisma 7** (`prisma/schema.prisma`, `prisma.config.ts`)
  stores the indexes' ancient, active flag and weight (`Index`) and each
  ancient's system prompt (`Prompt`).
- **Pinecone** holds one serverless vector index per uploaded source folder.
  An upload splits each file into chunks, embeds them with OpenAI
  (`text-embedding-ada-002`, 1536 dimensions) and upserts them into the index
  named after the folder, creating it if needed.
- **Chat** (`src/app/api/chat/route.ts`, `POST /api/chat?ancient=<slug>`):
  embeds the user's last message, queries that ancient's active indexes for 10
  passages split by index weight (`src/utils/pinecone.ts`), and streams a
  `gpt-4o-mini` answer through the Vercel AI SDK, with the ancient's active
  prompt and the passages as the system message.
- **Environment** is validated at server startup (`src/instrumentation.ts`,
  `src/lib/env.ts`).
- **Rate limiting** (`src/lib/rate-limit.ts`): `/api/chat` allows each
  signed-in user a number of messages per minute and per day, counted in
  Upstash Redis.

## Setup

You need Node 24 (see `.nvmrc`), a PostgreSQL database, and accounts with
Pinecone, OpenAI and Clerk.

1. Install dependencies:

   ```bash
   npm ci
   ```

   This also generates the Prisma client into `src/generated/prisma`
   (gitignored) through the `postinstall` script. Run `npx prisma generate`
   after changing `prisma/schema.prisma`.

2. Configure the environment. Copy `.env.example` to `.env` and fill it in:

   | Variable | Required | Purpose |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | PostgreSQL connection string (`postgresql://...`) |
   | `PINECONE_API_KEY` | yes | Pinecone API key |
   | `OPENAI_API_KEY` | yes | OpenAI API key, for embeddings and chat |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key (`pk_...`); also needed by `next build` |
   | `CLERK_SECRET_KEY` | yes | Clerk secret key (`sk_...`) |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | no | `/sign-in`, to use the app's sign-in page instead of Clerk's hosted one |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | no | `/sign-up`, likewise for sign-up |
   | `PINECONE_CLOUD` | no | Cloud for new Pinecone indexes: `aws` (default), `gcp` or `azure` |
   | `PINECONE_REGION` | no | Region for new Pinecone indexes (default `us-east-1`) |
   | `PINECONE_CONTROLLER_HOST` | no | Pinecone Local's URL (`http://localhost:5080`) instead of Pinecone's cloud, see [Local Pinecone](#local-pinecone) |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | production on Vercel | Upstash Redis for rate limiting `/api/chat`, see [Rate limiting](#rate-limiting); `KV_REST_API_URL`/`KV_REST_API_TOKEN` work too |
   | `CHAT_RATE_LIMIT_PER_MINUTE` | no | Messages a user may send per minute (default 20) |
   | `CHAT_RATE_LIMIT_PER_DAY` | no | Messages a user may send per day (default 200) |

   When a required variable is missing or malformed, the server stops at
   startup with an error that names it:

   ```text
   Invalid environment variables:
     - DATABASE_URL: not set
   Set them in .env (see .env.example) or in the deployment environment.
   ```

   Prisma CLI commands read `DATABASE_URL` from `.env` (loaded by
   `prisma.config.ts`), not `.env.local`, so keep it there or export it in
   your shell.

3. Create the database schema:

   ```bash
   npx prisma migrate deploy
   ```

   This applies `prisma/migrations` in order. For a database that was created
   earlier with `prisma db push`, mark the baseline as applied first, then
   deploy the rest:

   ```bash
   npx prisma migrate resolve --applied 0_init
   npx prisma migrate deploy
   ```

   To change the schema, edit `prisma/schema.prisma` and run
   `npx prisma migrate dev --name <change>` against a development database.
   Since Prisma 7, `migrate dev` no longer regenerates the client: run
   `npx prisma generate` afterwards.

   A database from before the baseline may still have an unused `Message`
   table. The migrations neither create nor drop it; drop it by hand once you
   have checked it holds nothing you need.

4. Configure Clerk. In the Clerk dashboard, enable the sign-in methods you
   want. Under Sessions > Customize session token, add
   `{ "metadata": "{{user.public_metadata}}" }` so the admin role travels in
   the session token; without it, every admin check loads the user from Clerk.

5. Bootstrap an admin. Sign up in the app, then in the Clerk dashboard set the
   user's public metadata (Users > user > Metadata > Public) to
   `{ "role": "admin" }`. Sign out and back in (or wait for the session token
   to refresh) and open `/admin` (also linked from the user menu). No rebuild
   is needed.

6. Load content. On `/admin`, upload a folder of text files: the folder name
   becomes the Pinecone index name. Assign each index to an ancient (new
   indexes start unassigned and unused), switch it on or off and give it a
   weight, which sets its share of the passages retrieved for a question to
   that ancient. On `/admin/prompt`, pick an ancient and edit their system
   prompt; until one is saved, the first chat request creates a default one
   ("You are <name>, ..."). To open a philosopher to users, set `isEnabled`
   in `src/data/ancients.ts`.

## Running

```bash
npm run dev     # development server on http://localhost:3000
npm run build   # production build
npm start       # serve the production build
```

### Local Pinecone

For development and tests the app can use
[Pinecone Local](https://docs.pinecone.io/guides/operations/local-development),
an in-memory emulator in Docker, instead of a Pinecone account. Start it:

```bash
docker run -d --name pinecone-local -e PORT=5080 -e PINECONE_HOST=localhost \
  -p 5080-5090:5080-5090 --platform linux/amd64 \
  ghcr.io/pinecone-io/pinecone-local:latest
```

Then set `PINECONE_CONTROLLER_HOST=http://localhost:5080` and any value for
`PINECONE_API_KEY` (Pinecone Local ignores keys). The control plane runs on
port 5080 and each index gets its own port from 5081 up, which the app reads
from the index description and reaches over the controller's `http://`
scheme. Without `PINECONE_CONTROLLER_HOST`, the app uses Pinecone's cloud.

Pinecone Local is not the real service:

- It keeps everything in memory, so indexes are gone when the container stops.
- Each index holds at most 100,000 records.
- It emulates an older Pinecone API version than the SDK targets, so
  behaviour can differ from the cloud.
- It doesn't replace a manual pass against real Pinecone before a release.

### Rate limiting

Each chat message costs an OpenAI embedding, Pinecone queries and a
completion, so `/api/chat` limits every signed-in user, by Clerk user ID, to
`CHAT_RATE_LIMIT_PER_MINUTE` (default 20) messages a minute and
`CHAT_RATE_LIMIT_PER_DAY` (default 200) a day, in sliding windows. Past a
limit it answers `429 Too Many Requests` with a `Retry-After` header, and the
chat asks the user to wait that long.

The counters live in Upstash Redis. On Vercel, add the "Upstash for Redis"
integration from the Marketplace, which sets `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`).
Without them, rate limiting is off, which suits local development and tests;
the server says so in one line at startup. A production deployment on Vercel
(`VERCEL_ENV=production`) fails its build and startup without them. If Redis
is unreachable, requests go through and the error is logged, so an Upstash
outage doesn't take the chat down.

## Checks

```bash
npm run check      # everything CI runs: typecheck, lint, test, build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest run (src/**/*.test.ts)
```

CI (`.github/workflows/check.yml`) runs `npm ci && npm run check` on pushes
and pull requests to `main` and `dev`.

### Integration tests

The unit tests mock Pinecone, so they pass even when an SDK upgrade breaks
the app at runtime. `src/**/*.integration.test.ts` runs the app's own
Pinecone code (the upload route, the index sync, retrieval and deletes)
against [Pinecone Local](#local-pinecone), with an in-memory database, a
signed-in admin and fake embeddings, so it needs no secrets. Start Pinecone
Local, then:

```bash
PINECONE_CONTROLLER_HOST=http://localhost:5080 npm run test:integration
```

Without `PINECONE_CONTROLLER_HOST` the suite is skipped, and `npm run check`
never runs it. CI (`.github/workflows/integration.yml`) runs it against a
Pinecone Local service container on the same pushes and pull requests.

## End-to-end tests

Cypress specs in `cypress/e2e` drive the production build (`next start`)
against a Clerk development instance, PostgreSQL and
[Pinecone Local](#local-pinecone). They need secrets and Docker, so
`npm run check` doesn't run them.

CI runs them in `.github/workflows/e2e.yml` on pushes to `main` and `dev`, on
pull requests from branches of this repository, and on demand (Actions > E2E >
Run workflow). Pull requests from forks and from Dependabot are skipped,
because GitHub withholds secrets from them. Failure screenshots and the
videos are uploaded as the run's `cypress-<attempt>` artifact.

Pinecone Local is not the real service, so one manual pass against real
Pinecone is still expected before each release.

### Clerk development instance

1. In the [Clerk dashboard](https://dashboard.clerk.com), create an
   application for testing, or use the development instance of the existing
   one. Use a development instance: Clerk only issues the testing tokens that
   let Cypress past its bot protection to development instances.
2. Under the instance's email settings, allow email addresses as an
   identifier and the email verification code as a sign-in method. The specs
   sign in with `cy.clerkSignIn({ strategy: 'email_code' })`.
3. Create the test user (Users > Create user) with an email address
   containing `+clerk_test`, such as `e2e+clerk_test@example.com`. Clerk sends
   no mail to such addresses and accepts the code `424242` for them (test
   mode, on by default in development instances).
4. Copy the publishable and secret keys from the instance's API keys page.

### Secrets

Set these in the repository's `e2e` environment (Settings > Environments >
`e2e`):

| Secret | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Publishable key of the Clerk development instance (`pk_test_...`), for the build and for Cypress |
| `CLERK_SECRET_KEY` | Secret key of that instance (`sk_test_...`), for the server and for fetching Clerk's testing token |
| `OPENAI_API_KEY` | OpenAI API key: the server won't start without one, and the chat specs call OpenAI with it |
| `E2E_CLERK_USER_EMAIL` | The test user's `+clerk_test` email address, signed in by `cy.clerkSignIn` |

The workflow sets the other variables itself: `DATABASE_URL` for its
PostgreSQL container, `PINECONE_CONTROLLER_HOST` and a placeholder
`PINECONE_API_KEY` for Pinecone Local, and the sign-in and sign-up URLs.

### Running locally

1. Start [Pinecone Local](#local-pinecone) and a PostgreSQL container:

   ```bash
   docker run -d --name ancient-chat-postgres -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=ancient_chat -p 5432:5432 postgres:16
   ```

2. In `.env`, which both the app and Cypress read, set:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ancient_chat
   PINECONE_CONTROLLER_HOST=http://localhost:5080
   PINECONE_API_KEY=pinecone-local
   OPENAI_API_KEY=...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...  # the development instance's
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   E2E_CLERK_USER_EMAIL=e2e+clerk_test@example.com
   ```

3. Create the schema, build and run the specs:

   ```bash
   npx prisma migrate deploy
   npm run build
   npm run e2e
   ```

`npm run e2e` starts `next start` on port 3000 (which must be free), runs
`cypress run` once the server answers, then stops the server. `npm run e2e:open`
does the same with the development server and Cypress's interactive runner.
Both wait for `/favicon.ico` rather than `/`, because Clerk's proxy
answers HTML requests for pages with a handshake redirect on development
instances. If Cypress reports that its binary is missing (npm can skip the
download on install), run `npx cypress install`.

## Building

`next build` prerenders pages wrapped in `<ClerkProvider>`, so it needs
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` even though nothing runs at build time.
The key is public and Next inlines it into the client bundle and the
prerendered HTML, so a deploy build must use the real key of the target Clerk
instance. The other variables are only checked when the server starts.

`npm run check` (also run by CI) builds through `scripts/check-build.mjs`,
which loads the `.env` files and fills in a well-formed placeholder for
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` when it is unset. Never deploy the `.next`
output of such a build: the placeholder Clerk key is baked into it.

## Deploying

Any Node host that runs `next build` and `next start` works, as does Vercel.
Set the variables from `.env.example` in the host's environment, run
`npx prisma migrate deploy` against the production database before starting
the new version, and build with the production Clerk publishable key.

## Authors

Andreas Neofytou
Michael Michailidis
