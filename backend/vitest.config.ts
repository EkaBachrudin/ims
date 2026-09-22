import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_ACCESS_SECRET: "test_access_secret",
      JWT_REFRESH_SECRET: "test_refresh_secret",
      JWT_ACCESS_TTL: "15m",
      JWT_REFRESH_TTL: "7d",
      CORS_ORIGIN: "http://localhost:5173",
      INTERNAL_API_KEY: "test_internal_key",
    },
  },
});
