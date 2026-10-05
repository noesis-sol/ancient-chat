import { notFound } from 'next/navigation';

// The app has one root layout per route group and no top-level not-found, so
// unmatched URLs land here and render the branded (main)/not-found.tsx.
export default function CatchAll() {
  notFound();
}
