import localFont from 'next/font/local';

export const lemonMilkFont = localFont({
  src: [
    { path: '../fonts/lemon-milk/LEMONMILK-Regular.otf', weight: '400', style: 'normal' },
    { path: '../fonts/lemon-milk/LEMONMILK-RegularItalic.otf', weight: '400', style: 'italic' },
    { path: '../fonts/lemon-milk/LEMONMILK-Bold.otf', weight: '700', style: 'normal' },
    { path: '../fonts/lemon-milk/LEMONMILK-BoldItalic.otf', weight: '700', style: 'italic' },
    { path: '../fonts/lemon-milk/LEMONMILK-Light.otf', weight: '300', style: 'normal' },
    { path: '../fonts/lemon-milk/LEMONMILK-LightItalic.otf', weight: '300', style: 'italic' },
    { path: '../fonts/lemon-milk/LEMONMILK-Medium.otf', weight: '500', style: 'normal' },
    { path: '../fonts/lemon-milk/LEMONMILK-MediumItalic.otf', weight: '500', style: 'italic' }
  ],
  variable: '--font-lemon-milk'
});