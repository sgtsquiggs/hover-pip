// Records the demo: a real X pointer hovers a video on page.html, opens
// Picture-in-Picture from the toggle, browses on, then hovers again for the
// compact toggle. ffmpeg grabs the whole X screen, so the PiP window and the
// cursor are in the shot. Run with npm run demo (Xvfb at 2560x1600, device
// scale factor 2: full frames scale to 1280x800, crops stay sharp).
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { execFileSync, spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const ROOT = __dirname;
const MEDIA = path.join(ROOT, 'media');
const OUT = path.resolve(ROOT, '../../test-results/demo');
const EXTENSION = path.resolve(ROOT, '../../extension');
const SCREEN = { width: 2560, height: 1600 };
const SCALE = 2;
const PORT = 18766;
// Served on port 80 of a *.localhost name: a secure context, so the address
// bar shows no "Not secure" chip, and neither it nor the PiP window shows a
// port.
const HOST = 'openmovies.localhost';
// Big Buck Bunny, (c) Blender Foundation, CC BY 3.0: 80 s from the middle.
const FOOTAGE = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.vp9.webm';
const USER_AGENT = 'hover-pip-demo (https://github.com/sgtsquiggs/hover-pip)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function prepareMedia() {
  fs.mkdirSync(MEDIA, { recursive: true });
  const footage = path.join(MEDIA, 'bbb.webm');
  if (!fs.existsSync(footage)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-user_agent', USER_AGENT, '-ss', '75', '-i', FOOTAGE,
      '-t', '80', '-an', '-c:v', 'copy', footage], { stdio: 'inherit' });
  }
  for (const [i, at] of [10, 30, 50, 70].entries()) {
    const thumb = path.join(MEDIA, `thumb-${i + 1}.jpg`);
    if (fs.existsSync(thumb)) continue;
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(at), '-i', footage,
      '-frames:v', '1', '-vf', 'scale=256:-1', thumb], { stdio: 'inherit' });
  }
}

function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.webm': 'video/webm', '.jpg': 'image/jpeg' };
  return http.createServer((req, res) => {
    const file = path.join(ROOT, path.normalize(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(PORT);
}

// The pointer.py process; send() resolves once a command has finished.
function startPointer() {
  const proc = spawn('uvx', ['--with', 'python-xlib', 'python', path.join(ROOT, 'pointer.py')],
    { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: proc.stdout });
  const waiting = [];
  lines.on('line', () => waiting.shift()?.());
  return {
    send: (cmd) => new Promise((resolve) => {
      waiting.push(resolve);
      proc.stdin.write(`${cmd}\n`);
    }),
    stop: () => proc.stdin.end(),
  };
}

// Resolves once ffmpeg is capturing; stop() ends the file cleanly.
function startRecording(file) {
  const proc = spawn('ffmpeg', ['-y', '-f', 'x11grab', '-framerate', '30',
    '-video_size', `${SCREEN.width}x${SCREEN.height}`, '-draw_mouse', '1', '-i', process.env.DISPLAY,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  const exited = new Promise((resolve) => proc.on('exit', resolve));
  return new Promise((resolve, reject) => {
    let log = '';
    proc.stderr.on('data', (chunk) => {
      log += chunk;
      if (log.includes('Press [q]')) {
        resolve({
          stop: () => {
            proc.stdin.write('q');
            return exited;
          },
        });
      }
    });
    proc.on('exit', (code) => reject(new Error(`ffmpeg exited (${code}):\n${log}`)));
  });
}

// The toggle's extent in CSS pixels once it has faded in (0.8, or 1 while
// hovered): the union of its clickable parts.
function toggleRect() {
  const toggle = document.querySelector('hover-pip-overlay')?.shadowRoot.querySelector('.pip-wrapper');
  if (!toggle || Number(getComputedStyle(toggle).opacity) < 0.8) return null;
  const rects = [toggle, ...toggle.querySelectorAll('.clickable')]
    .map((n) => n.getBoundingClientRect()).filter((r) => r.width && r.height);
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { x: left, y: top, width: right - left, height: bottom - top, hovering: toggle.matches('.hovering') };
}

async function main() {
  prepareMedia();
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hover-pip-demo-'));
  fs.mkdirSync(path.join(profile, 'Default'));
  fs.writeFileSync(path.join(profile, 'Default', 'Preferences'),
    JSON.stringify({ extensions: { ui: { developer_mode: true } } }));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: false,
    viewport: null,
    chromiumSandbox: true,
    ignoreDefaultArgs: ['--enable-automation'],
    // A cursor that reads at scale factor 2.
    env: { ...process.env, WAYLAND_DISPLAY: '', XCURSOR_THEME: 'Adwaita', XCURSOR_SIZE: '48' },
    args: [
      '--ozone-platform=x11',
      `--force-device-scale-factor=${SCALE}`,
      `--host-resolver-rules=MAP ${HOST}:80 127.0.0.1:${PORT}`,
      '--window-position=0,0',
      `--window-size=${SCREEN.width / SCALE},${SCREEN.height / SCALE}`,
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(`http://${HOST}/page.html`);
  await page.waitForFunction(() => document.getElementById('v').currentTime > 1);
  const geo = await page.evaluate(() => ({ x: screenX, y: screenY + outerHeight - innerHeight }));
  const toScreen = (x, y) => [(geo.x + x) * SCALE, (geo.y + y) * SCALE];
  const pointer = startPointer();
  const moveTo = (x, y, ms) => pointer.send(`move ${toScreen(x, y).join(' ')} ${ms}`);
  const centre = (r) => [r.x + r.width / 2, r.y + r.height / 2];
  const videoRect = () => page.locator('#v').evaluate((v) => v.getBoundingClientRect().toJSON());
  const waitToggle = (test) => page.waitForFunction(
    `(${toggleRect})()` + (test ? `?.${test}` : ''), null, { polling: 50 });
  const rects = {};

  // A click on the page takes focus from the address bar, unselecting the URL.
  await moveTo(700, 115, 0);
  await pointer.send('click');
  await moveTo(260, 760, 0);
  const recording = await startRecording(path.join(OUT, 'raw.mkv'));
  const t0 = Date.now();
  const markers = {};
  const mark = async (name) => {
    markers[name] = (Date.now() - t0) / 1000;
    rects[name] = await page.evaluate(toggleRect);
  };

  await sleep(1200);
  await mark('start');
  await moveTo(...centre(await videoRect()), 1100);
  await waitToggle();
  await sleep(500);
  await mark('toggle');
  await sleep(1000);
  await moveTo(...centre(await page.evaluate(toggleRect)), 700);
  await waitToggle('hovering');
  await sleep(900);
  await mark('explainer');
  await sleep(1000);
  await pointer.send('click');
  await page.waitForFunction(() => document.pictureInPictureElement !== null);
  await sleep(1500);
  await mark('pip');
  await sleep(800);
  await moveTo(420, 700, 800);
  await pointer.send('scroll 5');
  await sleep(1500);
  await mark('browsing');
  await sleep(1200);
  await page.evaluate(() => document.exitPictureInPicture());
  await pointer.send('scroll -8');
  await sleep(1200);
  await moveTo(...centre(await videoRect()), 1000);
  await waitToggle();
  await sleep(500);
  await mark('compact');
  await sleep(800);
  await moveTo(...centre(await page.evaluate(toggleRect)), 600);
  await waitToggle('hovering');
  await sleep(800);
  await mark('compact-hover');
  await sleep(700);
  await mark('end');

  await recording.stop();
  pointer.stop();
  await context.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  // Toggle rects in screen pixels, for crops.
  const toScreenRect = (r) => r && {
    x: toScreen(r.x, r.y)[0], y: toScreen(r.x, r.y)[1], width: r.width * SCALE, height: r.height * SCALE,
  };
  const toggles = Object.fromEntries(Object.entries(rects).map(([k, r]) => [k, toScreenRect(r)]));
  fs.writeFileSync(path.join(OUT, 'markers.json'), JSON.stringify({ screen: SCREEN, markers, toggles }, null, 2));
  console.log(JSON.stringify(markers));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
