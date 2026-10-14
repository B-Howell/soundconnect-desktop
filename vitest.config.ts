import { defineConfig } from 'vitest/config'

// Two projects: pure logic runs in `node`; component tests (`*.test.tsx`) run
// in `jsdom` with the jest-dom matchers. `environmentMatchGlobs` no longer
// exists in Vitest 5, so the split is by project rather than by glob.
export default defineConfig({
  test: {
    // Keeps `pnpm test` green if a task temporarily leaves no renderer tests.
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'node',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'dom',
          include: ['tests/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/setup/dom.ts'],
        },
      },
    ],
  },
})
