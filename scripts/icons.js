// Renders media/icon.svg to the extension's PNG icons with Chromium.
// Run with npm run icons after editing the SVG.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const SIZES = [16, 32, 48, 128];
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'extension', 'icons');
const svg = fs.readFileSync(path.join(ROOT, 'media', 'icon.svg'));
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0"><img src="${src}" width="${size}" height="${size}">`);
    await page.locator('img').evaluate((img) => img.decode());
    const file = path.join(OUT, `icon-${size}.png`);
    await page.screenshot({ path: file, omitBackground: true });
    console.log(path.relative(ROOT, file));
  }
  await browser.close();
})();
