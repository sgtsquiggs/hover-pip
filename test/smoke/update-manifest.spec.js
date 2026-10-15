// The update_url, fetched the way chromium-web-store fetches it: from an
// extension worker with no host permissions, so the response must allow
// cross-origin reads. Run with npm run test:smoke.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, chromium } = require('@playwright/test');

const MANIFEST = require('../../extension/manifest.json');
const PROBE = path.join(__dirname, '../fixtures/no-host-permissions');
const EXTENSION_ID = 'iklppbfbkekmbjalepgliappemgchmij';

test('an extension without host permissions can read the update manifest', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hover-pip-probe-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    args: [`--disable-extensions-except=${PROBE}`, `--load-extension=${PROBE}`],
  });
  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const result = await worker.evaluate(async (url) => {
      try {
        const response = await fetch(url);
        return { status: response.status, body: await response.text() };
      } catch (error) {
        return { error: String(error) };
      }
    }, MANIFEST.update_url);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.body).toContain(`<app appid='${EXTENSION_ID}'>`);
    expect(result.body).toMatch(/<updatecheck codebase='https:\/\/github\.com\/sgtsquiggs\/hover-pip\/releases\/download\/v\d+\.\d+\.\d+\/hover-pip-\d+\.\d+\.\d+\.crx' version='\d+\.\d+\.\d+'/);
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
