import { defineConfig } from 'vitest/config';

// Root suite covers the backend only. The client has its own vitest config
// (jsdom + testing-library) under client/.
export default defineConfig({
  test: {
    include: ['server/**/*.test.js'],
  },
});
