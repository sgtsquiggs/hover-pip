// Firefox-style Picture-in-Picture toggle. Hover logic follows Firefox's
// PictureInPictureChild.sys.mjs; markup follows videocontrols.js (Firefox 156).
// Loaded after logic.js and toggle-styles.js in the same isolated world.
(() => {
  const { isEligible, toggleVariant, TOGGLE_CSS } = FirefoxPip;
  const MOUSEMOVE_PROCESSING_DELAY_MS = 50;
  const TOGGLE_HIDING_TIMEOUT_MS = 3000;
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
    if (event.button !== 0 || !overVideo) return;
    // leaveVideo() makes the toggle pointer-events:none; capture keeps pointerup/click on it.
    toggle.setPointerCapture(event.pointerId);
    const video = overVideo;
    leaveVideo();
    enterPip(video).catch((err) => console.warn('[firefox-pip]', err));
  }

  const REPLACED = [HTMLVideoElement, HTMLImageElement, HTMLCanvasElement,
    HTMLIFrameElement, HTMLObjectElement, HTMLEmbedElement];

  // Chromium hit-tests only inside the fullscreen element, so the host must
  // live there to be clickable. Replaced elements can't hold it: null.
  function hostParent() {
    const full = document.fullscreenElement;
    if (!full) return document.documentElement;
    return REPLACED.some((type) => full instanceof type) ? null : full;
  }

  function ensureHost() {
    if (host?.isConnected) return;
    host = document.createElement('firefox-pip-overlay');
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
    hostParent()?.append(host);
  }

  // Re-showing moves the host to the top of the top-layer stack, above
  // fullscreen elements and anything else the page promoted since.
  function raise() {
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
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
  function elementsAt(root, x, y) {
    const out = [];
    for (const node of root.elementsFromPoint(x, y)) {
      if (node === host) continue;
      if (root instanceof ShadowRoot && node === root.host) break;
      if (node.shadowRoot) out.push(...elementsAt(node.shadowRoot, x, y));
      out.push(node);
    }
    return out;
  }

  function videoAt(x, y) {
    for (const node of elementsAt(document, x, y)) {
      if (node instanceof HTMLVideoElement) return node;
      if (isModal(node)) return null;
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

  function enterVideo(video) {
    ensureHost();
    raise();
    overVideo = video;
    overlay.classList.add('hovering');
  }

  function leaveVideo() {
    if (!overVideo) return;
    overVideo = null;
    overlay.classList.remove('hovering');
    toggle.classList.remove('hovering');
    overlay.removeAttribute('hidetoggle');
    clearTimeout(idleTimer);
  }

  function checkLastMouseMove() {
    moveTimer = 0;
    const video = videoAt(lastPoint.x, lastPoint.y);
    if (!video || !isEligible(describe(video)) || !hostParent()) {
      leaveVideo();
      return;
    }
    if (video !== overVideo) enterVideo(video);
    layout();
    toggle.classList.toggle('hovering', isOverToggle(lastPoint.x, lastPoint.y));
    resetIdleTimer();
  }

  function onMouseMove(event) {
    lastPoint = { x: event.clientX, y: event.clientY };
    if (!moveTimer) moveTimer = setTimeout(checkLastMouseMove, MOUSEMOVE_PROCESSING_DELAY_MS);
  }

  const passive = { capture: true, passive: true };
  window.addEventListener('mousemove', onMouseMove, passive);
  window.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) leaveVideo();
  }, passive);
  window.addEventListener('scroll', scheduleLayout, passive);
  window.addEventListener('resize', scheduleLayout, { passive: true });
  // Entering fullscreen puts the page's element above us in the top layer.
  document.addEventListener('fullscreenchange', () => {
    if (!host?.isConnected) return;
    const parent = hostParent();
    if (!parent) {
      leaveVideo();
      return;
    }
    if (host.parentNode !== parent) parent.append(host);
    raise();
  });
})();
