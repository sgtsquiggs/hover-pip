// Screenshots Firefox's native PiP toggle and this extension's toggle on the
// same fixture video, for side-by-side comparison. Run under xvfb-run:
//   env -u WAYLAND_DISPLAY xvfb-run -a node test/visual/parity.js
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');
const { chromium, firefox } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'test-results/parity');
const PAGE_URL = 'http://localhost:18765/page.html';
const EXTENSION = path.join(ROOT, 'extension');

async function shoot(page, name) {
  const video = page.locator('#wide');
  await video.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#wide').readyState >= 1);
  const box = await video.boundingBox();
  await page.mouse.move(box.x + box.width / 2 - 10, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
  await page.waitForTimeout(600);
  // Right-hand band of the video where both browsers draw the toggle.
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: { x: box.x + box.width - 320, y: box.y + box.height * 0.7 - 80, width: 320, height: 160 },
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  execFileSync('sh', [path.join(ROOT, 'test/fixtures/make-videos.sh')], { stdio: 'inherit' });
  const server = spawn('node', [path.join(ROOT, 'test/fixtures/serve.js'), '18765'], { stdio: 'inherit' });
  await new Promise((r) => setTimeout(r, 300));
  try {
    for (const hasUsed of [false, true]) {
      const variant = hasUsed ? 'compact' : 'expanded';
      const ff = await firefox.launch({
        headless: false,
        firefoxUserPrefs: {
          'media.videocontrols.picture-in-picture.video-toggle.enabled': true,
          'media.videocontrols.picture-in-picture.video-toggle.has-used': hasUsed,
        },
      });
      const ffPage = await ff.newPage();
      await ffPage.goto(PAGE_URL);
      await shoot(ffPage, `firefox-${variant}`);
      await ff.close();

      const ctx = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless: false,
        args: ['--ozone-platform=x11', `--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
      });
      let [sw] = ctx.serviceWorkers();
      if (!sw) sw = await ctx.waitForEvent('serviceworker');
      await sw.evaluate((v) => chrome.storage.local.set({ hasUsed: v }), hasUsed);
      const page = await ctx.newPage();
      await page.goto(PAGE_URL);
      await shoot(page, `chromium-${variant}`);
      await ctx.close();
    }
  } finally {
    server.kill();
  }
})();
