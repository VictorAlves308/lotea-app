import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // DB-backed invariant tests run sequentially against one real Postgres
    // database (see src/test/db.ts) — parallel test files would race on the
    // same tables via truncate-between-tests.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      // A real local Postgres database dedicated to tests — see
      // ARCHITECTURE.md §12 / DATABASE.md for how to stand one up locally
      // (docker run postgres:16-alpine + `prisma migrate deploy` against it).
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/lotea_test?schema=public',
      // Test-only secrets — never used outside this config. Real environments
      // generate their own; see .env.example.
      JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters-long',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long',
      JWT_ACCESS_TTL_SECONDS: '900',
      JWT_REFRESH_TTL_SECONDS: '2592000',
      CORS_ALLOWED_ORIGINS: '',
    },
  },
});
