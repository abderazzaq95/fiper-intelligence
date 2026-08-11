import type { Config } from 'tailwindcss';

// Brand tokens sampled from the real Fiper logo (see /CLAUDE.md — "Brand").
// Do not eyeball or approximate these; they were pulled verbatim from the
// original fiper-terminal.html / mrkt-fiper-landing.html :root blocks.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#003364', // brand base
        'navy-deep': '#001F3F',
        shell: '#00101F', // dashboard surface gradient start
        panel: '#04192F', // dashboard surface gradient end
        panel2: '#072544',
        raised: '#0A2E52',
        red: '#C42626', // red base — primary accent, CTAs
        'red-hi': '#E53838', // red bright — gradient top
        'red-deep': '#971212', // red deep — gradient bottom
        bullish: '#00D084', // never repurpose for brand colour
        bearish: '#FF5470', // distinct from brand red on purpose
        amber: '#F0A500',
        ink: '#E6EFFA', // terminal body text
        muted: '#7FA2C9',
        muted2: '#4E7FB0',
        dim: '#47688F',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
