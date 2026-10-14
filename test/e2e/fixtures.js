// Playwright fixtures: headed Chromium (under xvfb-run) with the unpacked extension.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test: base, expect, chromium } = require('@playwright/test');

const EXTENSION = path.resolve(__dirname, '../../extension');
const PORT = 18765;
const ORIGIN = `http://localhost:${PORT}`;
const CROSS_ORIGIN = `http://127.0.0.1:${PORT}`;

const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false,
      baseURL: ORIGIN,
      env: { ...process.env, WAYLAND_DISPLAY: '' },
      args: [
        '--ozone-platform=x11',
        `--disable-extensions-except=${EXTENSION}`,
        `--load-extension=${EXTENSION}`,
      ],
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },
  page: async ({ context }, use) => {
    await use(await context.newPage());
  },
});

const toggleIn = (scope) => scope.locator('hover-pip-overlay .pip-wrapper');

// Moves the mouse onto the video's centre (two moves, so the content script
// sees movement inside the video). Returns the video's bounding box.
async function hoverCenter(page, video) {
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(1);
  const box = await video.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x - 10, y);
  await page.mouse.move(x, y, { steps: 2 });
  return box;
}

// The visible part of the toggle: the compact square or the expanded pill.
async function toggleBox(scope) {
  const wrapper = toggleIn(scope);
  const compact = await wrapper.evaluate((w) => w.hasAttribute('has-used') || w.hasAttribute('small-video'));
  return wrapper.locator(compact ? '.pip-small' : '.pip-expanded').boundingBox();
}

async function hoverToggle(page, scope) {
  const box = await toggleBox(scope);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  await expect(toggleIn(scope)).toHaveClass(/hovering/);
  return box;
}

async function setHasUsed(sw, value) {
  await sw.evaluate((v) => chrome.storage.local.set({ hasUsed: v }), value);
}

const pipId = (scope) => scope.evaluate(() => document.pictureInPictureElement?.id ?? null);

function pressAltP() {
  execFileSync('uvx', ['--with', 'python-xlib', 'python', path.join(__dirname, 'xkey.py')], { stdio: 'inherit' });
}

module.exports = {
  test, expect, ORIGIN, CROSS_ORIGIN,
  toggleIn, hoverCenter, toggleBox, hoverToggle, setHasUsed, pipId, pressAltP,
};
