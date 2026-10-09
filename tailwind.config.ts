import type { Config } from 'tailwindcss'

const BRAND = {
  50: '#FDE8EC',
  100: '#FAC5CF',
  200: '#F58B9F',
  300: '#F0516F',
  400: '#D92040',
  500: '#C8102E',
  600: '#9B0D23',
  700: '#6E0919',
  800: '#41060F',
  900: '#140305',
  950: '#0A0102',
  DEFAULT: '#C8102E',
}

export default {
  darkMode: 'class',
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './app.config.ts',
    // Nuxt UI runtime : ses classes (ps-*, pe-*, start-0, end-0, inset-y-0…)
    // ne sont générées que si Tailwind scanne ses fichiers. Sans ça, les icônes
    // des UInput sortent du champ et les paddings de positionnement disparaissent.
    './node_modules/@nuxt/ui/dist/runtime/**/*.{vue,mjs,js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        // Rouge Bonnet Rouge (DESIGN.md). `brand` est la couleur principale de
        // Nuxt UI (app.config.ts) ; fc-red et fc-blue (ancien alias, rouge
        // lui aussi) restent pour les classes existantes.
        brand: BRAND,
        'fc-red': BRAND,
        'fc-blue': BRAND,
      },
      fontFamily: {
        sans: ['"Nunito Sans Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
} as Config
