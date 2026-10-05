This is a [Next.js](https://nextjs.org/) project bootstrapped
with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and
load Inter, a custom Google Font.

## Building

`next build` prerenders pages wrapped in `<ClerkProvider>`, so it needs
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` even though nothing runs at build time.
The key is public and Next inlines it into the client bundle and the
prerendered HTML, so a deploy build must use the real key of the target Clerk
instance.

`npm run check` (also run by CI) builds through `scripts/check-build.mjs`,
which loads the `.env` files and fills in a well-formed placeholder for
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `PINECONE_API_KEY` and `OPENAI_API_KEY`
when they are unset. Never deploy the `.next` output of such a build: the
placeholder Clerk key is baked into it.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions
are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use
the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
from the creators of Next.js!

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Authors
Andreas Neofytou
Michael Michailidis
