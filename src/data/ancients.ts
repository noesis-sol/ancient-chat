// The philosophers users can chat with. The slug identifies one in URLs, in
// /api/chat requests and in the database (Prompt.ancient, Index.ancient).
// Only enabled ones can be chatted with; the server enforces that too.
export interface Ancient {
  slug: string;
  name: string;
  image: string;
  year: string;
  isEnabled: boolean;
}

export const ancients: Ancient[] = [
  {
    slug: 'aristotle',
    name: 'Aristotle',
    image: '/ancients/aristotle.jpeg',
    year: '384-322 BC',
    isEnabled: true,
  },
  {
    slug: 'xenophon',
    name: 'Xenophon',
    image: '/ancients/xenophon.jpeg',
    year: '430-354 BC',
    isEnabled: false,
  },
  {
    slug: 'pythagoras',
    name: 'Pythagoras',
    image: '/ancients/pythagoras.jpeg',
    year: '570-495 BC',
    isEnabled: false,
  },
  {
    slug: 'plato',
    name: 'Plato',
    image: '/ancients/plato.jpeg',
    year: '427-348 BC',
    isEnabled: false,
  },
  {
    slug: 'socrates',
    name: 'Socrates',
    image: '/ancients/socrates.jpeg',
    year: '470-399 BC',
    isEnabled: false,
  },
  {
    slug: 'heraclitus',
    name: 'Heraclitus',
    image: '/ancients/heraclitus.jpeg',
    year: '540-480 BC',
    isEnabled: false,
  },
];

// Slugs are matched case-insensitively, so /chat/Aristotle keeps working.
export const findAncient = (slug: string): Ancient | undefined =>
  ancients.find((ancient) => ancient.slug === slug.toLowerCase());

export const findEnabledAncient = (slug: string): Ancient | undefined => {
  const ancient = findAncient(slug);
  return ancient?.isEnabled ? ancient : undefined;
};
