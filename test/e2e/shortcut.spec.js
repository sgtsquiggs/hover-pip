const { test, expect, pipId, pressAltP } = require('./fixtures');

test('Alt+P opens PiP on the playing video and a second press closes it', async ({ page }) => {
  await page.goto('/page.html');
  const long = page.locator('#long');
  await expect.poll(() => long.evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(1);
  await long.evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.mouse.click(5, 5);
  pressAltP();
  await expect.poll(() => pipId(page)).toBe('long');
  pressAltP();
  await expect.poll(() => pipId(page)).toBe(null);
});

test('Alt+P reaches a video in a cross-origin iframe', async ({ page }) => {
  await page.goto('/top.html');
  const frame = page.frame({ url: /frame\.html/ });
  await expect.poll(() => frame.locator('#v').evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(1);
  await page.locator('#heading').click();
  pressAltP();
  await expect.poll(() => pipId(frame)).toBe('v');
});
