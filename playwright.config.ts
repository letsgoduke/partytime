import { defineConfig } from "@playwright/test";
// The AWS contract server uses a separate port so it cannot disturb the user's demo preview.
const contract = !!process.env.TEST_LIVE_CONTRACT;
const port = contract ? 5174 : 5173;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI && !contract,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
