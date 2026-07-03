import type { Config } from 'tailwindcss'

export default <Config>{
  darkMode: 'class',
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
    // Nuxt UI runtime : ses classes (ps-*, pe-*, start-0, end-0, inset-y-0…)
    // ne sont générées que si Tailwind scanne ses fichiers. Sans ça, les icônes
    // des UInput sortent du champ et les paddings de positionnement disparaissent.
    './node_modules/@nuxt/ui/dist/runtime/**/*.{vue,mjs,js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        'fc-blue': {
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
          DEFAULT: '#C8102E',
        },
        // White-label FieldTrack : accent ardoise (les classes fc-red sont
        // conservées, seule la valeur change).
        'fc-red': {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#334155',
          600: '#1E293B',
          700: '#0F172A',
          800: '#0B1120',
          900: '#060911',
          DEFAULT: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Avenir Next', 'Avenir', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
