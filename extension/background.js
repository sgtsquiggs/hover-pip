// Alt+P: survey every frame, then exit PiP where it is open or enter it on the
// best video in the winning frame. The targeted second executeScript keeps the
// command's user activation (verified in Chromium 156, including cross-origin
// iframes).
importScripts('logic.js');

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-pip' || tab?.id === undefined) return;
  togglePip(tab.id).catch((err) => console.warn('[firefox-pip]', err));
});

// Frames without the content script (e.g. the Web Store) return null and are skipped.
async function inFrames(tabId, target, func) {
  const results = await chrome.scripting.executeScript({ target: { tabId, ...target }, func });
  return results.filter((r) => r.result).map((r) => ({ frameId: r.frameId, ...r.result }));
}

async function togglePip(tabId) {
  const frames = await inFrames(tabId, { allFrames: true }, () => globalThis.FirefoxPip?.survey?.() ?? null);
  const pipFrame = frames.find((f) => f.inPip);
  if (pipFrame) {
    await inFrames(tabId, { frameIds: [pipFrame.frameId] }, () => FirefoxPip.exitPip());
    return;
  }
  const best = FirefoxPip.pickBestVideo(
    frames.filter((f) => f.best).map((f) => ({ ...f.best, frameId: f.frameId })),
  );
  if (best) await inFrames(tabId, { frameIds: [best.frameId] }, () => FirefoxPip.enterBest());
}
