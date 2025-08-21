import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.d.ts',
        'main.js',
        'esbuild.config.mjs',
        'version-bump.mjs',
        'coverage/**',
      ],
    },
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'lib/**'],
  },
  resolve: {
    alias: {
      obsidian: './test/mocks/obsidian.ts',
    },
  },
});
