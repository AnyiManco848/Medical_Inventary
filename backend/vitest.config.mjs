import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/middlewares/**', 'src/controllers/**', 'src/app.js'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
