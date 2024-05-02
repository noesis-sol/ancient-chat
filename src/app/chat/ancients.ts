export interface Ancient {
  name: string;
  image: string;
  year: string;
  isEnabled: boolean;
}

export const ancients: Ancient[] = [
  {
    name: 'Aristotle',
    image: '/ancients/aristotle.jpeg',
    year: '384-322 BC',
    isEnabled: true,
  },
  {
    name: 'Xenophon',
    image: '/ancients/xenophon.jpeg',
    year: '430-354 BC',
    isEnabled: false,
  },
  {
    name: 'Pythagoras',
    image: '/ancients/pythagoras.jpeg',
    year: '570-495 BC',
    isEnabled: false,
  },
  {
    name: 'Plato',
    image: '/ancients/plato.jpeg',
    year: '427-348 BC',
    isEnabled: false,
  },
  {
    name: 'Socrates',
    image: '/ancients/socrates.jpeg',
    year: '470-399 BC',
    isEnabled: false,
  },
  {
    name: 'Heraclitus',
    image: '/ancients/heraclitus.jpeg',
    year: '540-480 BC',
    isEnabled: false,
  },
];
