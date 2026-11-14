import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  globalTeardown: "./e2e/restore-tsconfig.ts",
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npx next dev -p ${port}`,
    url: `http://127.0.0.1:${port}/desk`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "demo",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "demo",
      DEMO_AS_OF: "2026-11-12",
      NEXT_PUBLIC_DEMO_AS_OF: "2026-11-12",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
