import { defineConfig } from 'vitest/config'

// Tests unitaires "purs" (logique métier, sans Nuxt ni Supabase).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
})
