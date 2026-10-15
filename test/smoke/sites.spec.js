// Hover PiP on real sites: start the page's main video, hover it, click the
// toggle, expect Picture-in-Picture. Run with npm run test:smoke.
const { test, expect, toggleIn, hoverToggle } = require('../e2e/fixtures');

const SITES = [
  { name: 'YouTube', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
  { name: 'Vimeo', url: 'https://vimeo.com/1084537' },
  {
    name: 'Twitch (live)',
    // Any channel that's live right now: the first stream in the directory.
    url: async (page) => {
      await page.goto('https://www.twitch.tv/directory/all', { waitUntil: 'domcontentloaded' });
      const card = page.locator('a[data-a-target="preview-card-image-link"]').first();
      return new URL(await card.getAttribute('href', { timeout: 30_000 }), page.url()).href;
    },
  },
  { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_4K.webm' },
  // Its player stalls on a scripted play(); a click starts it.
  { name: 'Internet Archive', url: 'https://archive.org/details/BigBuckBunny_124', play: false },
];

// The page's largest video, descending into open shadow roots, scrolled into
// view and muted (and started, if play): its rect and whether it's ready to
// hover, or null.
// A fresh profile blocks autoplay with sound, and a paused YouTube player
// parks its video above the viewport.
function mainVideo(play) {
  const videos = [];
  const walk = (root) => {
    for (const node of root.querySelectorAll('*')) {
      if (node instanceof HTMLVideoElement) videos.push(node);
      if (node.shadowRoot) walk(node.shadowRoot);
    }
  };
  walk(document);
  const video = videos.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (!video || video.clientWidth < 140) return null;
  video.muted = true;
  if (play && video.paused) video.play().catch(() => {});
  video.scrollIntoView({ block: 'center' });
  const r = video.getBoundingClientRect();
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return {
    x: r.x, y: r.y, width: r.width, height: r.height,
    ready: video.readyState >= 1 && video.duration >= 45 &&
      cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight,
  };
}

const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

for (const site of SITES) {
  test(site.name, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const url = typeof site.url === 'function' ? await site.url(page) : site.url;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    let box = null;
    await expect.poll(async () => (box = await page.evaluate(mainVideo, site.play ?? true)), {
      message: 'a video at least 140 px wide', timeout: 30_000,
    }).not.toBeNull();
    if (!box.ready) {
      // Lazy players load on a click, as for a user pressing play.
      await page.waitForTimeout(3000);
      box = await page.evaluate(mainVideo, site.play ?? true);
      if (!box.ready) await page.mouse.click(centre(box).x, centre(box).y);
    }
    await expect.poll(async () => (box = await page.evaluate(mainVideo, site.play ?? true))?.ready, {
      message: 'video metadata loaded, at least 45 s long, centre on screen', timeout: 30_000,
    }).toBe(true);
    const { x, y } = centre(box);
    // Away first, so moving onto the video's centre is a fresh hover.
    await page.mouse.move(5, 5);
    await page.mouse.move(x - 10, y);
    await page.mouse.move(x, y, { steps: 2 });
    await expect(toggleIn(page)).toHaveCSS('opacity', '0.8');
    await hoverToggle(page, page);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => document.pictureInPictureElement !== null)).toBe(true);
  });
}
