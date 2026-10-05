# Talk with the Ancients

A Next.js app where signed-in users chat with an ancient philosopher. Answers
come from an OpenAI chat model, grounded in passages retrieved from Pinecone
vector indexes that admins build by uploading source texts.

## Architecture

- **Next.js 15 (App Router)**, React 19, Tailwind 4 with daisyUI.
  - `src/app/(main)`: public site, sign-in/up pages and the chat UI (`/chat`).
  - `src/app/(dashboard)`: admin pages (`/admin` for indexes, `/admin/prompt`
    for the system prompts).
  - `src/data/ancients.ts`: the philosophers, their slugs and which are
    enabled. The server rejects chats with unknown or disabled ones.
  - `src/app/api`: route handlers for chat, indexes, uploads and prompts.
- **Clerk** handles authentication. `src/middleware.ts` requires sign-in for
  `/chat`. Admins are the users whose email address is listed in
  `src/utils/emails.ts`.
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
   want (email address is needed for admins, see below).

5. Bootstrap an admin. Add your email address to `src/utils/emails.ts`, sign
   up in the app with that address, and open `/admin` (also linked from the
   user menu). Changing the list needs a rebuild and redeploy.

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

## Checks

```bash
npm run check      # everything CI runs: typecheck, lint, test, build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest run (src/**/*.test.ts)
```

CI (`.github/workflows/check.yml`) runs `npm ci && npm run check` on pushes
and pull requests to `main` and `dev`.

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
