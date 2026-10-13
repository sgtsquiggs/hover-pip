const { test, expect, toggleIn, hoverCenter, hoverToggle, pipId } = require('./fixtures');

async function clickToggleOn(page, selector) {
  await hoverCenter(page, page.locator(selector));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await hoverToggle(page, page);
  await expect(toggleIn(page)).toHaveCSS('opacity', '1');
  await page.mouse.down();
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/page.html');
});

test('clicking the toggle opens PiP and the page never sees the click', async ({ page, sw }) => {
  await clickToggleOn(page, '#covered');
  await expect.poll(() => pipId(page)).toBe('covered');
  expect(await page.evaluate(() => window.pageEvents)).toEqual([]);
  await expect.poll(() => sw.evaluate(() => chrome.storage.local.get('hasUsed'))).toEqual({ hasUsed: true });
});

test('switches to the compact toggle after first use', async ({ page }) => {
  await clickToggleOn(page, '#covered');
  await expect.poll(() => pipId(page)).toBe('covered');
  await page.evaluate(() => document.exitPictureInPicture());
  await hoverCenter(page, page.locator('#wide'));
  await expect(toggleIn(page)).toHaveAttribute('has-used', '');
});

test('no toggle on the video that is already in PiP', async ({ page }) => {
  await clickToggleOn(page, '#covered');
  await expect.poll(() => pipId(page)).toBe('covered');
  await page.mouse.move(5, 5);
  await hoverCenter(page, page.locator('#covered'));
  await page.waitForTimeout(300);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0');
});

test('overrides disablePictureInPicture', async ({ page }) => {
  await clickToggleOn(page, '#nopip');
  await expect.poll(() => pipId(page)).toBe('nopip');
});
