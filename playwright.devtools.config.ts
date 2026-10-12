import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/devtools",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3102",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "ORBIT_DATA_DIR=test-results/spec-cache-dev-records NITRO_HOST=127.0.0.1 NITRO_PORT=3102 bun run nuxt dev --host 127.0.0.1 --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
