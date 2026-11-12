import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Each test file gets fresh module state (ai.ts keeps a per-request deadline).
    isolate: true,
    testTimeout: 15000,
  },
})
