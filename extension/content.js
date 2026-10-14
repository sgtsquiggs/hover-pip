/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Hover PiP: the Picture-in-Picture toggle ported from Firefox 156.0.1. Hover
// logic follows PictureInPictureChild.sys.mjs; markup and strings follow
// videocontrols.js; icon paths come from picture-in-picture-open.svg.
// Loaded after logic.js and toggle-styles.js in the same isolated world.
(() => {
  const { isEligible, toggleVariant, TOGGLE_CSS } = HoverPip;
  const MOUSEMOVE_PROCESSING_DELAY_MS = 50;
  const TOGGLE_HIDING_TIMEOUT_MS = 3000;
  // pipToggle.css's `transition: opacity 200ms` on .pip-wrapper.
  const TOGGLE_FADE_MS = 200;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Proton paths from picture-in-picture-open.svg (MPL-2.0).
  const ICON_PATHS = [
    'm15 10-4 0a1 1 0 0 0-1 1l0 3a1 1 0 0 0 1 1l4 0a1 1 0 0 0 1-1l0-3a1 1 0 0 0-1-1z',
    'M8.125 15a.625.625 0 0 0 0-1.25l-6.275 0-.6-.6 0-9.3.6-.6 10.3 0 .6.6 0 4.275a.625.625 0 0 0 1.25 0L14 4a2 2 0 0 0-2-2L2 2a2 2 0 0 0-2 2l0 9a2 2 0 0 0 2 2l6.125 0z',
    'm6.714 7.83.75-.75A.314.314 0 0 1 8 7.303l0 2.509-.189.188-2.509 0a.314.314 0 0 1-.222-.536l.75-.75-2.652-2.652a.618.618 0 0 1-.11-.718.496.496 0 0 1 .276-.276.618.618 0 0 1 .718.11L6.714 7.83z',
  ];
  // The host is a viewport-sized, click-through top-layer box. !important so
  // page CSS can't move or reveal it.
  const HOST_STYLE = [
    'all: initial', 'position: fixed', 'inset: 0', 'width: auto', 'height: auto',
    'max-width: none', 'max-height: none', 'margin: 0', 'padding: 0', 'border: 0',
    'background: transparent', 'overflow: visible', 'pointer-events: none',
    'z-index: 2147483647', 'color-scheme: normal',
  ].map((d) => `${d} !important`).join(';');

  let host = null;
  let overlay = null;
  let toggle = null;
  let overVideo = null;
  let lastPoint = null;
  let moveTimer = 0;
  let idleTimer = 0;
  let closeTimer = 0;
  let layoutFrame = 0;
  let hasUsed = false;

  chrome.storage.local.get('hasUsed').then((r) => {
    hasUsed = r.hasUsed === true;
    scheduleLayout();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'hasUsed' in changes) {
      hasUsed = changes.hasUsed.newValue === true;
      scheduleLayout();
    }
  });

  // DOM is built with createElement: innerHTML would trip Trusted Types on
  // pages like YouTube.
  function el(tag, className, ...children) {
    const node = document.createElement(tag);
    node.className = className;
    node.append(...children);
    return node;
  }

  function icon(tag, className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    for (const d of ICON_PATHS) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return el(tag, className, svg);
  }

  function buildToggle() {
    const wrapper = el('button', 'pip-wrapper',
      el('div', 'pip-small clickable'),
      el('div', 'pip-expanded clickable',
        el('span', 'pip-icon-label clickable',
          icon('span', 'pip-icon'),
          el('span', 'pip-label', 'Pop out this video')),
        el('div', 'pip-explainer clickable',
          'More screens are more fun. Play this video while you do other things.')),
      icon('div', 'pip-icon clickable'));
    wrapper.type = 'button';
    wrapper.tabIndex = -1;
    wrapper.setAttribute('position', 'right');
    return wrapper;
  }

  function markUsed() {
    if (hasUsed) return;
    hasUsed = true;
    chrome.storage.local.set({ hasUsed: true });
  }

  async function enterPip(video) {
    video.disablePictureInPicture = false;
    await video.requestPictureInPicture();
    markUsed();
  }

  function swallow(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // pointerdown carries the user activation requestPictureInPicture needs.
  function onTogglePointerDown(event) {
    swallow(event);
    // Page scripts can dispatch synthetic pointerdowns on our host.
    if (!event.isTrusted || event.button !== 0 || !overVideo) return;
    // leaveVideo() hides the host; capture keeps pointerup/click on the toggle.
    toggle.setPointerCapture(event.pointerId);
    const video = overVideo;
    leaveVideo();
    enterPip(video).catch((err) => console.warn('[hover-pip]', err));
  }

  const REPLACED = [HTMLVideoElement, HTMLImageElement, HTMLCanvasElement,
    HTMLIFrameElement, HTMLObjectElement, HTMLEmbedElement];

  // A page ::backdrop rule would otherwise paint over the page while we're open.
  const BACKDROP_SHEET = new CSSStyleSheet();
  BACKDROP_SHEET.replaceSync('hover-pip-overlay::backdrop { display: none !important; }');

  // closest(':modal'), climbing out of shadow roots: a player's shadow-DOM
  // video still sits inside the page's fullscreen container.
  function modalAncestor(node) {
    for (let at = node; at; at = at.getRootNode().host) {
      const found = at.closest(':modal');
      if (found) return found;
    }
    return null;
  }

  // A fullscreen element or modal dialog makes everything outside it inert, so
  // the host must live inside the one around the video to be clickable.
  // Replaced elements can't hold it: null.
  function hostParent(video) {
    const blocker = modalAncestor(video);
    if (!blocker) return document.documentElement;
    return REPLACED.some((type) => blocker instanceof type) ? null : blocker;
  }

  function buildHost(parent) {
    host = document.createElement('hover-pip-overlay');
    host.setAttribute('popover', 'manual');
    host.style.cssText = HOST_STYLE;
    const root = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(TOGGLE_CSS);
    root.adoptedStyleSheets = [sheet];
    toggle = buildToggle();
    toggle.addEventListener('pointerdown', onTogglePointerDown);
    for (const type of ['pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']) {
      toggle.addEventListener(type, swallow);
    }
    overlay = el('div', 'controlsOverlay', toggle);
    root.append(overlay);
    parent.append(host);
  }

  // Re-showing moves the host to the top of the top-layer stack, above
  // fullscreen elements and anything else the page promoted since.
  function raise() {
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  }

  // Puts the host, open and on top, where clicks over the video reach it.
  // False when there is no such place. Rebuilds a host the page removed.
  function placeHost(video) {
    const parent = hostParent(video);
    if (!parent) return false;
    clearTimeout(closeTimer);
    if (!document.adoptedStyleSheets.includes(BACKDROP_SHEET)) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, BACKDROP_SHEET];
    }
    if (!host?.isConnected) buildHost(parent);
    else if (host.parentNode !== parent) parent.append(host);
    raise();
    return true;
  }

  function describe(video) {
    return {
      readyState: video.readyState,
      duration: video.duration,
      clientWidth: video.clientWidth,
      clientHeight: video.clientHeight,
      visible: video.checkVisibility(),
      inPip: document.pictureInPictureElement === video,
    };
  }

  function isModal(node) {
    return (node instanceof HTMLDialogElement && node.open) || node.getAttribute('aria-modal') === 'true';
  }

  // Elements under the point, topmost first, descending into open shadow roots.
  // A shadow root's list also holds outer-tree elements, which the caller
  // already has; skip them rather than stop at the host, which is missing
  // when it has no box (display: contents) and would let us recurse back up.
  function elementsAt(root, x, y) {
    const out = [];
    for (const node of root.elementsFromPoint(x, y)) {
      if (node === host || node.getRootNode() !== root) continue;
      if (node.shadowRoot) out.push(...elementsAt(node.shadowRoot, x, y));
      out.push(node);
    }
    return out;
  }

  // Alpha of a computed color: rgb(r, g, b), rgba(r, g, b, a) or fn(... / a).
  function alpha(color) {
    const args = color.slice(color.indexOf('(') + 1, -1);
    const a = args.includes('/') ? args.split('/')[1] : args.split(',')[3];
    return a === undefined ? 1 : Number(a);
  }

  // A cheap stand-in for Firefox's only-visible hit test: a solid background
  // at full opacity hides what is under it. Gradients and images don't count.
  function isOpaque(node) {
    const style = getComputedStyle(node);
    return style.opacity === '1' && alpha(style.backgroundColor) === 1;
  }

  // The topmost video under the point, unless modal or opaque content covers it.
  function videoAt(x, y) {
    for (const node of elementsAt(document, x, y)) {
      if (node instanceof HTMLVideoElement) return node;
      if (isModal(node) || isOpaque(node)) return null;
    }
    return null;
  }

  // Union of the toggle's clickable parts, as in Firefox's isMouseOverToggle.
  function isOverToggle(x, y) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const node of [toggle, ...toggle.querySelectorAll('.clickable')]) {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  function layout() {
    if (!overVideo) return;
    if (!overVideo.isConnected) {
      leaveVideo();
      return;
    }
    const r = overVideo.getBoundingClientRect();
    Object.assign(overlay.style, {
      left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    });
    const variant = toggleVariant(r.width, hasUsed);
    toggle.toggleAttribute('has-used', variant.hasUsed);
    toggle.toggleAttribute('small-video', variant.small);
    toggle.toggleAttribute('medium-video', variant.medium);
  }

  function scheduleLayout() {
    if (!overVideo || layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layout();
    });
  }

  function resetIdleTimer() {
    overlay.removeAttribute('hidetoggle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => overlay.setAttribute('hidetoggle', 'true'), TOGGLE_HIDING_TIMEOUT_MS);
  }

  // The host leaves the top layer once the toggle has faded out, so it can't
  // hold page :popover-open or ::backdrop styling while no video is hovered.
  function leaveVideo() {
    if (!overVideo) return;
    overVideo = null;
    overlay.classList.remove('hovering');
    toggle.classList.remove('hovering');
    overlay.removeAttribute('hidetoggle');
    clearTimeout(idleTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!overVideo && host.matches(':popover-open')) host.hidePopover();
    }, TOGGLE_FADE_MS);
  }

  function checkLastMouseMove() {
    moveTimer = 0;
    const video = videoAt(lastPoint.x, lastPoint.y);
    if (!video || !isEligible(describe(video)) || !placeHost(video)) {
      leaveVideo();
      return;
    }
    overVideo = video;
    overlay.classList.add('hovering');
    layout();
    toggle.classList.toggle('hovering', isOverToggle(lastPoint.x, lastPoint.y));
    resetIdleTimer();
  }

  function onMouseMove(event) {
    lastPoint = { x: event.clientX, y: event.clientY };
    if (!moveTimer) moveTimer = setTimeout(checkLastMouseMove, MOUSEMOVE_PROCESSING_DELAY_MS);
  }

  let shortcutVideo = null;

  function allVideos(root, out = []) {
    for (const node of root.querySelectorAll('*')) {
      if (node instanceof HTMLVideoElement) out.push(node);
      if (node.shadowRoot) allVideos(node.shadowRoot, out);
    }
    return out;
  }

  function inViewport(video) {
    const r = video.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }

  // Alt+P helpers, called by background.js through chrome.scripting.executeScript.
  // Like Firefox's shortcut, they ignore the toggle's duration and size rules.
  HoverPip.survey = () => {
    const best = HoverPip.pickBestVideo(allVideos(document).map((video) => ({
      video,
      visible: video.checkVisibility() && inViewport(video),
      readyState: video.readyState,
      playing: !video.paused && !video.ended,
      area: video.clientWidth * video.clientHeight,
    })));
    shortcutVideo = best?.video ?? null;
    return {
      inPip: document.pictureInPictureElement !== null,
      best: best && { visible: true, readyState: best.readyState, playing: best.playing, area: best.area },
    };
  };
  HoverPip.enterBest = () =>
    shortcutVideo && enterPip(shortcutVideo).catch((err) => console.warn('[hover-pip]', err));
  HoverPip.exitPip = () =>
    document.exitPictureInPicture().catch((err) => console.warn('[hover-pip]', err));

  const passive = { capture: true, passive: true };
  window.addEventListener('mousemove', onMouseMove, passive);
  window.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) leaveVideo();
  }, passive);
  window.addEventListener('scroll', scheduleLayout, passive);
  window.addEventListener('resize', scheduleLayout, { passive: true });
  // Entering fullscreen puts the page's element above us in the top layer.
  document.addEventListener('fullscreenchange', () => {
    if (overVideo && !placeHost(overVideo)) leaveVideo();
  });
})();
