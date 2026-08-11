import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono, Tajawal, Scheherazade_New } from 'next/font/google';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-playfair',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// Arabic body/UI face — replaces Inter (via a [dir="rtl"] var override in
// globals.css) when Arabic is active. Kept as its own var/loader rather
// than replacing the Inter loader outright, so English keeps using Inter
// exactly as before with zero risk of regression.
const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

// Arabic headline face — replaces Playfair Display the same way.
const scheherazade = Scheherazade_New({
  subsets: ['arabic'],
  weight: ['400', '600'],
  variable: '--font-scheherazade',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fiper Intelligence',
  description: 'AI-powered market intelligence terminal for retail traders.',
};

// Runs before hydration (same technique dark-mode libraries use to avoid
// a flash of the wrong theme) so a returning Arabic user doesn't see an
// English/LTR flash while React boots. Reads the same localStorage key
// LanguageContext.tsx reads client-side, so the two never disagree.
const SET_LANG_BEFORE_PAINT = `
(function () {
  try {
    var lang = localStorage.getItem('fiper-lang') === 'ar' ? 'ar' : 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} ${tajawal.variable} ${scheherazade.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SET_LANG_BEFORE_PAINT }} />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
