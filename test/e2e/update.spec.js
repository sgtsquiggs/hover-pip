const {
  test, expect, toggleIn, hoverCenter, hoverToggle, pipId, pressAltP, reloadExtension,
} = require('./fixtures');

const overlayCount = (page) => page.evaluate(() => document.querySelectorAll('hover-pip-overlay').length);

test('after an update, a tab opened before it has exactly one working toggle', async ({ page, context, sw }) => {
  const invalidated = [];
  page.on('console', (m) => {
    if (m.text().includes('Extension context invalidated')) invalidated.push(m.text());
  });
  await page.goto('/page.html');
  const long = page.locator('#long');
  await hoverCenter(page, long);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await page.mouse.move(5, 5);

  const sw2 = await reloadExtension(context, sw);
  await hoverCenter(page, long);
  await expect.poll(() => overlayCount(page)).toBe(1);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await hoverToggle(page, page);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => pipId(page)).toBe('long');
  // The new content script, not the orphan, handled the click.
  await expect.poll(() => sw2.evaluate(() => chrome.storage.local.get('hasUsed'))).toEqual({ hasUsed: true });
  expect(invalidated).toEqual([]);
});

test('after an update, Alt+P reaches a cross-origin iframe in a tab opened before it', async ({ page, context, sw }) => {
  await page.goto('/top.html');
  const frame = page.frame({ url: /frame\.html/ });
  await expect.poll(() => frame.locator('#v').evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(1);
  await reloadExtension(context, sw);
  await page.locator('#heading').click();
  pressAltP();
  await expect.poll(() => pipId(frame)).toBe('v');
});

test('uninstalling removes the toggle from open tabs', async ({ page, sw }) => {
  await page.goto('/page.html');
  const long = page.locator('#long');
  const box = await hoverCenter(page, long);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  const closed = new Promise((resolve) => sw.once('close', resolve));
  await sw.evaluate(() => { setTimeout(() => chrome.management.uninstallSelf(), 50); });
  await closed;
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 3 });
  await expect.poll(() => overlayCount(page)).toBe(0);
});
