const { test, expect, hoverCenter, pipId, pressAltP } = require('./fixtures');

test('a page that breaks the toggle gets one warning, not an error per mouse move', async ({ page }) => {
  const errors = [];
  const warnings = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (m) => {
    if (m.text().startsWith('[hover-pip]')) warnings.push(m.text());
  });
  await page.goto('/hostile.html');
  const video = page.locator('#v');
  const box = await hoverCenter(page, video);
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(box.x + 100 + i * 10, box.y + 100);
    await page.waitForTimeout(120);
  }
  expect(errors).toEqual([]);
  expect(warnings).toHaveLength(2);
  expect(warnings[0]).toContain('attachShadow');
  expect(warnings[1]).toContain('turned off on this page');
  expect(await page.locator('hover-pip-overlay').count()).toBe(0);

  // Alt+P doesn't need the toggle and still works.
  await video.evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.mouse.click(5, 5);
  pressAltP();
  await expect.poll(() => pipId(page)).toBe('v');
});
