import type { Config } from 'tailwindcss'

export default <Config>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        'fc-blue': {
          50: '#E8F0FE',
          100: '#C5D9FC',
          200: '#8BB3F9',
          300: '#518DF6',
          400: '#1A6CF3',
          500: '#003DA5',
          600: '#002B75',
          700: '#001F55',
          800: '#001435',
          900: '#000A1A',
          DEFAULT: '#003DA5',
        },
        'fc-red': {
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
