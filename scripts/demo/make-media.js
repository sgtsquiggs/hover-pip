// Turns the recording from record.js into README and release-page media:
// media/demo.mp4 and demo.gif, 1280x800 screenshots, native-resolution
// zooms of the toggle, and a 440x280 small promo tile. Run with
// npm run demo:media after npm run demo.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const OUT = path.resolve(__dirname, '../../test-results/demo');
const MEDIA = path.resolve(__dirname, '../../media');
const STORE = path.join(MEDIA, 'store');
const RAW = path.join(OUT, 'raw.mkv');
const { screen, markers, toggles } = JSON.parse(fs.readFileSync(path.join(OUT, 'markers.json')));

const ffmpeg = (...args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const magick = (...args) => execFileSync('magick', args, { stdio: 'inherit' });
const frame = (name, filter, file) => ffmpeg('-ss', String(markers[name]), '-i', RAW, '-frames:v', '1', '-vf', filter, file);

// A w x h crop with the toggle at the given marker at (fx, fy) of it, kept
// inside the frame.
function cropAround(name, w, h, fx = 0.5, fy = 0.5) {
  const t = toggles[name];
  const x = Math.round(Math.min(Math.max(t.x + t.width / 2 - w * fx, 0), screen.width - w));
  const y = Math.round(Math.min(Math.max(t.y + t.height / 2 - h * fy, 0), screen.height - h));
  return `crop=${w}:${h}:${x}:${y}`;
}

fs.mkdirSync(STORE, { recursive: true });
const span = ['-ss', String(markers.start), '-to', String(markers.end), '-i', RAW];

ffmpeg(...span, '-vf', 'scale=1280:800:flags=lanczos', '-r', '30', '-c:v', 'libx264', '-preset', 'slow',
  '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(MEDIA, 'demo.mp4'));
// Ordered dithering and 128 colours keep the GIF near 4 MB.
ffmpeg(...span, '-vf', 'fps=10,scale=800:500:flags=lanczos,split[a][b];'
  + '[a]palettegen=stats_mode=diff:max_colors=128[p];'
  + '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', path.join(MEDIA, 'demo.gif'));

const shots = ['toggle', 'explainer', 'pip', 'browsing', 'compact'];
for (const [i, name] of shots.entries()) {
  frame(name, 'scale=1280:800:flags=lanczos', path.join(STORE, `screenshot-${i + 1}-${name}.png`));
}

frame('explainer', cropAround('explainer', 1200, 750), path.join(MEDIA, 'toggle.png'));
frame('compact', cropAround('compact', 640, 400, 0.7), path.join(MEDIA, 'toggle-compact.png'));

// Small promo tile: the toggle over the video on the right, the icon and name
// on a scrim on the left.
const tileBg = path.join(OUT, 'tile-bg.png');
frame('toggle', `${cropAround('toggle', 1320, 840, 0.76)},scale=440:280:flags=lanczos`, tileBg);
magick(tileBg,
  '(', '-size', '280x440', 'gradient:rgba(10,10,14,0.92)-rgba(10,10,14,0)', '-rotate', '-90', ')',
  '-gravity', 'west', '-composite',
  '(', path.resolve(__dirname, '../../extension/icons/icon-128.png'), '-resize', '72x72', ')',
  '-geometry', '+14-82', '-composite',
  '-fill', 'white', '-font', 'Noto-Sans-Bold', '-pointsize', '40', '-annotate', '+22-18', 'Hover PiP',
  '-fill', '#d6d6dc', '-font', 'Noto-Sans-Regular', '-pointsize', '17', '-annotate', '+24+22', 'Pop out any video',
  path.join(STORE, 'promo-small-440x280.png'));

for (const file of [path.join(MEDIA, 'demo.mp4'), path.join(MEDIA, 'demo.gif')]) {
  console.log(path.relative(process.cwd(), file), `${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
}
