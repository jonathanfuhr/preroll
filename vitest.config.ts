import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Derselbe Alias wie in tsconfig.json.
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Der Standalone-Build kopiert die Quellen nach .next/standalone —
    // ohne diesen Ausschluss liefe jeder Test doppelt, und zwar gegen einen
    // eingefrorenen Stand.
    exclude: ['node_modules/**', '.next/**', 'design/**'],
  },
})
