# <img src="media/icon.svg" width="48" height="48" alt="" align="absmiddle"> Hover PiP

A Picture-in-Picture button for Chromium browsers, ported from Firefox's toggle.
Hover a video and the toggle appears on its right edge, as in Firefox. Click it
to pop the video out; elements under the toggle never see the click (page-level
capture listeners still observe an event targeted at the extension's overlay).
**Alt+P** toggles PiP on the most prominent video. Rebind it at
`chrome://extensions/shortcuts`.

![Hovering a video shows the toggle; clicking it pops the video out into a floating window that keeps playing while the page scrolls](media/demo.gif)

Like Firefox, the toggle shows only on videos at least 45 seconds long and
140×140 px. It starts as the "Pop out this video" pill and switches to the
compact icon after the first use.

<img src="media/toggle.png" width="480" alt="The Pop out this video pill, hovered, with its explainer"> <img src="media/toggle-compact.png" width="256" alt="The compact toggle icon after first use">

Needs Chromium 153 or later; tested on 153, 154 and 156.

## Install

Hover PiP is published on
[GitHub Releases](https://github.com/sgtsquiggs/hover-pip/releases), not in
any browser's extension store.

**ungoogled-chromium:** set `chrome://flags/#extension-mime-request-handling`
to **Always prompt for install**, then open the `.crx` link on the latest
release and accept the prompt. ungoogled-chromium never checks for extension
updates itself; with
[chromium-web-store](https://github.com/NeverDecaf/chromium-web-store)
installed, new versions show up on its badge.

**Other Chromium browsers** generally refuse a `.crx` from outside their store:

1. Unzip `hover-pip-<version>.zip` from the latest release.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder (or `extension/` in a
   clone of this repository).

An unpacked copy doesn't update; repeat with each release.

Tabs that are already open get the toggle right away, after an install or an
update.

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
npm run test:smoke  # live sites (YouTube, Vimeo, Twitch, Commons, Internet Archive)
```

CI runs `npm test` and `npm run test:e2e` on every pull request; `main` only
takes pull requests that pass. The smoke tests stay out of CI, since live sites
change and many block datacenter IPs. They use `/usr/bin/chromium`, which has
the proprietary codecs Playwright's Chromium lacks; set `CHROMIUM_PATH` for
another build.

Before a release, also check by hand what automation can't reach: a signed-in
DRM site (Netflix, Disney+ or Prime Video), Reddit and X feeds, a site with a
cookie or consent wall, and Edge and Brave as well as Chromium.

`npm run test:e2e` clears `test-results/` before each run. To compare the toggle
with Firefox's own, screenshot both into `test-results/parity/`:

```sh
npx playwright install firefox
env -u WAYLAND_DISPLAY xvfb-run -a node test/visual/parity.js
```

## Demo media

`media/` holds the README demo and screenshots for release pages, all from one
scripted recording: a real X pointer hovers a video on `scripts/demo/page.html`,
opens Picture-in-Picture from the toggle and browses on, while ffmpeg grabs the
whole Xvfb screen, PiP window and cursor included. To regenerate (needs ffmpeg,
Xvfb, uv, ImageMagick; the first run downloads the footage):

```sh
npm run demo         # records test-results/demo/raw.mkv
npm run demo:media   # media/demo.mp4, demo.gif, toggle zooms, media/store/
```

`media/store/` has five 1280×800 screenshots and a 440×280 small promo tile;
`media/demo.mp4` is 1280×800 too.

The icon's source is `media/icon.svg`. After editing it, `npm run icons`
renders `extension/icons/icon-{16,32,48,128}.png`.

## Release

1. In a pull request, bump the version: `npm run bump -- patch` (or `minor`,
   `major`, or an exact `x.y.z`).
2. After it merges, tag that commit and push the tag:

   ```sh
   git fetch origin && git tag vX.Y.Z origin/main && git push origin vX.Y.Z
   ```

The tag starts the Release workflow. It checks that the tag matches the
manifest version and is on `main`, then runs the CI job: unit tests,
`npm run package` and the e2e suite against the packaged zip. It signs that zip
into `hover-pip-<version>.crx`, publishes a GitHub release with the `.crx`,
the `.zip` and `update.xml`, and deploys `update.xml` to GitHub Pages. The
manifest's `update_url` is <https://sgtsquiggs.github.io/hover-pip/update.xml>:
Pages allows cross-origin reads, which chromium-web-store needs, and a release
asset doesn't. `npm run test:smoke` checks that an extension without host
permissions can read it.

`npm run package` writes `dist/hover-pip-<version>.zip`: the extension plus
`LICENSE`, after checking that every file the manifest names exists. CI builds
it on every run and keeps it as the `hover-pip-extension` artifact for 30 days.
`npm run sign -- <dir> <key.pem>` signs an unpacked copy with Chromium's own
packer and writes `dist/update.xml` next to the `.crx`.

The signing key is the `HOVER_PIP_CRX_KEY` Actions secret, with a copy kept by
the maintainer. It fixes the extension ID, `iklppbfbkekmbjalepgliappemgchmij`:
a release signed with any other key installs as a different extension, and
existing copies stop updating.

## Authors

Hover PiP is by Matthew Crenshaw, co-written with Claude, Anthropic's AI model,
using [Claude Code](https://claude.com/claude-code).

## Credits

The toggle's styles, markup, icon, strings, and hover behaviour are ported from
Firefox 156 (`pipToggle.css`, `videocontrols.js`, `PictureInPictureChild.sys.mjs`,
`picture-in-picture-open.svg`), © Mozilla, under the
[Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/). Verbatim copies are
in `vendor/firefox-156.0.1/`. This project is MPL-2.0 too.

The demo footage is from [Big Buck Bunny](https://peach.blender.org/), © 2008
Blender Foundation, under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
