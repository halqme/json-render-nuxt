import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun .output/server/index.mjs",
    env: { NITRO_HOST: "127.0.0.1", NITRO_PORT: "3100", ORBIT_DATA_DIR: "test-results/records" },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
