const { test, expect, toggleIn, hoverCenter, hoverToggle, toggleBox, pipId } = require('./fixtures');

test('toggle works on a video in a cross-origin iframe', async ({ page }) => {
  await page.goto('/top.html');
  const frame = page.frame({ url: /frame\.html/ });
  await hoverCenter(page, frame.locator('#v'));
  await expect(toggleIn(frame)).toHaveCSS('opacity', '0.8');
  await hoverToggle(page, frame);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => pipId(frame)).toBe('v');
});

// Call with the toggle hovered: it only takes pointer events then.
async function expectToggleOnTop(page) {
  const box = await toggleBox(page);
  const topmost = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.localName,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(topmost).toBe('hover-pip-overlay');
}

// requestFullscreen() resolves before the window is resized; wait for the
// fullscreen element to fill the viewport so hover coordinates are right.
async function enterFullscreen(page, selector, id) {
  await page.locator(selector).evaluate((el) => el.requestFullscreen());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe(id);
  await expect.poll(() => page.evaluate(
    () => document.fullscreenElement.getBoundingClientRect().width === innerWidth,
  )).toBe(true);
}

test('toggle stays above, and clickable in, a fullscreen container', async ({ page }) => {
  await page.goto('/page.html');
  await hoverCenter(page, page.locator('#fsvideo'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await enterFullscreen(page, '#fsbox', 'fsbox');
  await hoverCenter(page, page.locator('#fsvideo'));
  // The overlay is laid out on the next mouse-move check.
  await expect.poll(async () => {
    const want = await page.locator('#fsvideo').boundingBox();
    const got = await page.evaluate(() => document.querySelector('hover-pip-overlay')
      .shadowRoot.querySelector('.controlsOverlay').getBoundingClientRect().toJSON());
    return got.x === want.x && got.y === want.y && got.width === want.width;
  }).toBe(true);
  // The toggle only takes pointer events once hovered, as in Firefox.
  await hoverToggle(page, page);
  await expectToggleOnTop(page);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => pipId(page)).toBe('fsvideo');
});

test('no toggle when the <video> itself is fullscreen', async ({ page }) => {
  await page.goto('/page.html');
  await hoverCenter(page, page.locator('#long'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await enterFullscreen(page, '#long', 'long');
  await hoverCenter(page, page.locator('#long'));
  await page.waitForTimeout(300);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0');
});

test('toggle works on a shadow-root video in a fullscreen container', async ({ page }) => {
  await page.goto('/layers.html');
  await enterFullscreen(page, '#sfsbox', 'sfsbox');
  await hoverCenter(page, page.locator('#sv'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await hoverToggle(page, page);
  await expectToggleOnTop(page);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(
    () => document.getElementById('shadowhost').shadowRoot.pictureInPictureElement?.id,
  )).toBe('sv');
});
