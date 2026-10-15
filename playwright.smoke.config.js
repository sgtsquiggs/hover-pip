const { defineConfig } = require('@playwright/test');

// Live-site smoke tests: opt-in, never part of CI (sites change, and many
// block datacenter IPs).
module.exports = defineConfig({
  testDir: 'test/smoke',
  timeout: 90_000,
  workers: 1,
  retries: 1,
  outputDir: 'test-results/smoke',
  use: { screenshot: 'only-on-failure' },
});
