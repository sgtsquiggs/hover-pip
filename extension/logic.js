// Pure decision logic shared by the content script, the background worker,
// and node:test. Thresholds are Firefox's (PictureInPictureChild.sys.mjs and
// videocontrols.js, Firefox 156).
(function (root) {
  const MIN_VIDEO_SECS = 45;
  const MIN_VIDEO_DIMENSION = 140;
  const SMALL_VIDEO_WIDTH_MAX = 320;
  const MEDIUM_VIDEO_WIDTH_MAX = 720;
  const HAVE_METADATA = 1;

  function isEligible(v) {
    if (v.inPip || !v.visible || v.readyState < HAVE_METADATA) return false;
    if (Number.isNaN(v.duration) || v.duration < MIN_VIDEO_SECS) return false;
    return v.clientWidth >= MIN_VIDEO_DIMENSION && v.clientHeight >= MIN_VIDEO_DIMENSION;
  }

  function toggleVariant(width, hasUsed) {
    const small = width <= SMALL_VIDEO_WIDTH_MAX;
    return { hasUsed, small, medium: !small && width <= MEDIUM_VIDEO_WIDTH_MAX };
  }

  function pickBestVideo(candidates) {
    let best = null;
    for (const c of candidates) {
      if (!c.visible || c.readyState < HAVE_METADATA || c.area <= 0) continue;
      if (!best || Number(c.playing) > Number(best.playing) ||
          (c.playing === best.playing && c.area > best.area)) {
        best = c;
      }
    }
    return best;
  }

  const api = { isEligible, toggleVariant, pickBestVideo };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HoverPip = Object.assign(root.HoverPip ?? {}, api);
})(globalThis);
