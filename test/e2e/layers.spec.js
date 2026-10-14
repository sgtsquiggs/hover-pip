const { test, expect, toggleIn, hoverCenter, toggleBox, hoverToggle, pipId } = require('./fixtures');

const hostOpen = (page) => page.evaluate(
  () => document.querySelector('firefox-pip-overlay')?.matches(':popover-open') ?? false,
);

async function clickToggleOn(page, selector) {
  await hoverCenter(page, page.locator(selector));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  const box = await hoverToggle(page, page);
  await page.mouse.down();
  await page.mouse.up();
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/layers.html');
});

test('toggle works on a video inside a showModal() dialog; elements under it see nothing', async ({ page }) => {
  await page.locator('#dlg').evaluate((d) => d.showModal());
  await hoverCenter(page, page.locator('#inmodal'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  const box = await hoverToggle(page, page);
  const topmost = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.localName,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(topmost).toBe('firefox-pip-overlay');
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => pipId(page)).toBe('inmodal');
  expect(await page.evaluate(() => window.pageEvents)).toEqual([]);
});

test('host is open only while a video is hovered, and its backdrop never paints', async ({ page }) => {
  const video = page.locator('#plain');
  await video.scrollIntoViewIfNeeded();
  const vbox = await video.boundingBox();
  // A strip of page background right of the video; the page's red
  // ::backdrop rule would cover it if our host's backdrop painted.
  const clip = { x: vbox.x + vbox.width + 20, y: vbox.y, width: 40, height: 40 };
  const before = await page.screenshot({ clip });
  await hoverCenter(page, video);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  expect(await hostOpen(page)).toBe(true);
  await page.mouse.move(5, 5, { steps: 2 });
  await expect.poll(() => hostOpen(page)).toBe(false);
  await hoverCenter(page, video);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  const during = await page.screenshot({ clip });
  expect(during.equals(before), 'page pixels changed while the host was open').toBe(true);
});

test('no toggle where opaque page content covers the video; the click reaches it', async ({ page }) => {
  await hoverCenter(page, page.locator('#v-opaque'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  const box = await toggleBox(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // The fixture's menu must cover the toggle's spot for this test to mean anything.
  const menu = await page.locator('#opaque').boundingBox();
  expect(x > menu.x && x < menu.x + menu.width && y > menu.y && y < menu.y + menu.height).toBe(true);
  await page.mouse.move(x, y, { steps: 3 });
  await page.waitForTimeout(300);
  await expect(toggleIn(page)).toHaveCSS('opacity', '0');
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.pageEvents)).toContain('opaque:click');
  expect(await pipId(page)).toBe(null);
});

for (const id of ['alpha', 'faded']) {
  test(`toggle still works through translucent content (#${id})`, async ({ page }) => {
    await clickToggleOn(page, `#v-${id}`);
    await expect.poll(() => pipId(page)).toBe(`v-${id}`);
    expect(await page.evaluate(() => window.pageEvents)).toEqual([]);
  });
}

test('toggle comes back after the page removes the overlay host', async ({ page }) => {
  const box = await hoverCenter(page, page.locator('#plain'));
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  await page.evaluate(() => document.querySelector('firefox-pip-overlay').remove());
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 3 });
  await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
  expect(await page.locator('firefox-pip-overlay').count()).toBe(1);
});

test('toggle works on a video in an open shadow root', async ({ page }) => {
  await clickToggleOn(page, '#sv');
  // document.pictureInPictureElement is retargeted to the shadow host.
  await expect.poll(() => page.evaluate(
    () => document.getElementById('shadowhost').shadowRoot.pictureInPictureElement?.id,
  )).toBe('sv');
});

test('toggle works on a video under a display: contents shadow host in another shadow root', async ({ page }) => {
  await clickToggleOn(page, '#nv');
  await expect.poll(() => page.evaluate(
    () => document.getElementById('nesthost').shadowRoot.firstChild.shadowRoot.pictureInPictureElement?.id,
  )).toBe('nv');
});
