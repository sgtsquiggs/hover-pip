const { test, expect, toggleIn, hoverCenter, setHasUsed } = require('./fixtures');

test.beforeEach(async ({ page }) => {
  await page.goto('/page.html');
});

test('shows the toggle at 0.8 opacity while hovering an eligible video', async ({ page }) => {
  await hoverCenter(page, page.locator('#long'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
});

test('finds a video under a transparent overlay', async ({ page }) => {
  await hoverCenter(page, page.locator('#covered'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
});

test('hides the toggle when the mouse leaves the video', async ({ page }) => {
  const box = await hoverCenter(page, page.locator('#long'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await page.mouse.move(box.x + box.width + 100, box.y + 10, { steps: 2 });
  await expect(toggleIn(page)).toHaveCSS('opacity', '0');
});

test('fades out after 3 s without mouse movement and returns on movement', async ({ page }) => {
  const box = await hoverCenter(page, page.locator('#long'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await page.waitForTimeout(3300);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0');
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
});

for (const id of ['short', 'tiny']) {
  test(`no toggle on the ineligible #${id} video`, async ({ page }) => {
    await hoverCenter(page, page.locator('#long'));
    await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
    await hoverCenter(page, page.locator(`#${id}`));
    await page.waitForTimeout(300);
    await expect(toggleIn(page)).toHaveCSS('opacity', '0');
  });
}

test('no toggle where an open dialog covers the video', async ({ page }) => {
  await hoverCenter(page, page.locator('#long'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await page.mouse.move(5, 5);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0');
  await page.locator('#modal').evaluate((d) => d.show());
  const dialog = await page.locator('#modal').boundingBox();
  await page.mouse.move(dialog.x + dialog.width / 2 - 10, dialog.y + dialog.height / 2);
  await page.mouse.move(dialog.x + dialog.width / 2, dialog.y + dialog.height / 2, { steps: 2 });
  await page.waitForTimeout(300);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0');
});

test('first-time toggle on a wide video: expanded cyan pill with label', async ({ page }) => {
  await hoverCenter(page, page.locator('#wide'));
  const toggle = toggleIn(page);
  await expect(toggle).toHaveCSS('opacity', '0.8');
  for (const attr of ['has-used', 'small-video', 'medium-video']) {
    await expect(toggle).not.toHaveAttribute(attr);
  }
  await expect(toggle.locator('.pip-label')).toHaveText('Pop out this video');
  await expect(toggle.locator('.pip-expanded')).toHaveCSS('border-top-color', 'rgb(0, 254, 255)');
});

test('first-time toggle on a 640px video uses medium fonts', async ({ page }) => {
  await hoverCenter(page, page.locator('#long'));
  const toggle = toggleIn(page);
  await expect(toggle).toHaveAttribute('medium-video', '');
  await expect(toggle.locator('.pip-label')).toHaveCSS('font-size', '13px');
});

test('first-time toggle on a 300px video is compact with the cyan border', async ({ page }) => {
  await hoverCenter(page, page.locator('#small'));
  const toggle = toggleIn(page);
  await expect(toggle).toHaveAttribute('small-video', '');
  await expect(toggle.locator('.pip-small')).toHaveCSS('border-top-color', 'rgb(0, 254, 255)');
});

test("after first use: compact 40px toggle at Firefox's position", async ({ page, sw }) => {
  await setHasUsed(sw, true);
  await page.reload();
  const video = await hoverCenter(page, page.locator('#wide'));
  const toggle = toggleIn(page);
  await expect(toggle).toHaveAttribute('has-used', '');
  await expect(toggle).toHaveCSS('opacity', '0.8');
  const small = await toggle.locator('.pip-small').boundingBox();
  expect(small.width).toBeCloseTo(40, 0);
  expect(small.height).toBeCloseTo(40, 0);
  // Right edge 18px in from the video's right edge; top at 70% - 40px.
  expect(video.x + video.width - (small.x + small.width)).toBeCloseTo(18, 0);
  expect(small.y - video.y).toBeCloseTo(video.height * 0.7 - 40, 0);
});

test("fades out over Firefox's 200 ms when the mouse leaves, then closes the host", async ({ page }) => {
  const box = await hoverCenter(page, page.locator('#long'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  // Sample, every frame while the mouse leaves, whether the toggle is on screen
  // (host still open) and its opacity: a hidden host shows no fade at all.
  const samples = page.evaluate(() => new Promise((resolve) => {
    const host = document.querySelector('firefox-pip-overlay');
    const wrapper = host.shadowRoot.querySelector('.pip-wrapper');
    const seen = [];
    const end = performance.now() + 600;
    (function sample() {
      const opacity = Number(getComputedStyle(wrapper).opacity);
      seen.push(host.matches(':popover-open') ? opacity : -1);
      if (performance.now() < end) requestAnimationFrame(sample);
      else resolve(seen);
    })();
  }));
  await page.mouse.move(box.x + box.width + 100, box.y + 10, { steps: 2 });
  const seen = await samples;
  expect(seen.some((o) => o > 0 && o < 0.8), `no visible fade (-1 = host hidden) in ${seen}`).toBe(true);
  await expect.poll(() => page.evaluate(
    () => document.querySelector('firefox-pip-overlay').matches(':popover-open'),
  )).toBe(false);
});
