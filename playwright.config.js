const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  // One Xvfb display; Alt+P is a real X key event delivered to the focused window.
  workers: 1,
  globalSetup: require.resolve('./test/e2e/global-setup.js'),
  webServer: {
    command: 'node test/fixtures/serve.js 18765',
    url: 'http://localhost:18765/page.html',
    reuseExistingServer: false,
  },
});
