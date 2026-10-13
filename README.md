# firefox-pip-chrome

Firefox's Picture-in-Picture toggle for Chromium browsers. Hover a video and the
toggle appears on its right edge, as in Firefox. Click it to pop the video out;
elements under the toggle never see the click (page-level capture listeners
still observe an event targeted at the extension's overlay).
**Alt+P** toggles PiP on the most prominent video. Rebind it at
`chrome://extensions/shortcuts`.

Like Firefox, the toggle shows only on videos at least 45 seconds long and
140×140 px. It starts as the "Pop out this video" pill and switches to the
compact icon after the first use.

Tested on Chromium 153 and 156.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `extension/` directory.

Tabs that were open before installing, or before reloading the extension, need a
refresh before the toggle shows in them.

## Differences from Firefox

- The toggle also works on videos that set `disablePictureInPicture`. Firefox
  respects that attribute by default; this extension deliberately does not.
- No toggle when a `<video>` element itself is fullscreen (players that make a
  container fullscreen are fine). Use **Alt+P** or Chromium's own video controls
  there.

## Develop

```sh
npm install
npx playwright install chromium
npm test            # unit tests (node:test)
npm run test:e2e    # Playwright, headed under xvfb-run; needs ffmpeg, Xvfb, uv
```

`npm run test:e2e` clears `test-results/` before each run. To compare the toggle
with Firefox's own, screenshot both into `test-results/parity/`:

```sh
npx playwright install firefox
env -u WAYLAND_DISPLAY xvfb-run -a node test/visual/parity.js
```

## Credits

The toggle's styles, markup, icon, strings, and hover behaviour are ported from
Firefox 156 (`pipToggle.css`, `videocontrols.js`, `PictureInPictureChild.sys.mjs`,
`picture-in-picture-open.svg`), © Mozilla, under the
[Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/). Verbatim copies are
in `vendor/firefox-156.0.1/`. This project is MPL-2.0 too.
