importScripts('logic.js');

// Declared content scripts only reach pages loaded after an install or
// update, so inject them into open tabs. After an update those tabs still run
// the old copy, which retires itself (content.js).
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install' || reason === 'update') injectIntoOpenTabs();
});

async function injectIntoOpenTabs() {
  const { js } = chrome.runtime.getManifest().content_scripts[0];
  for (const tab of await chrome.tabs.query({ discarded: false })) {
    // Fails where extensions can't run (chrome:// pages, the Web Store); skip those.
    chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: js }).catch(() => {});
  }
}

// Alt+P: survey every frame, then exit PiP where it is open or enter it on the
// best video in the winning frame. The targeted second executeScript keeps the
// command's user activation (verified in Chromium 156, including cross-origin
// iframes).
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-pip' || tab?.id === undefined) return;
  togglePip(tab.id).catch((err) => console.warn('[hover-pip]', err));
});

// Frames without the content script (e.g. the Web Store) return null and are skipped.
async function inFrames(tabId, target, func) {
  const results = await chrome.scripting.executeScript({ target: { tabId, ...target }, func });
  return results.filter((r) => r.result).map((r) => ({ frameId: r.frameId, ...r.result }));
}

async function togglePip(tabId) {
  const frames = await inFrames(tabId, { allFrames: true }, () => globalThis.HoverPip?.survey?.() ?? null);
  const pipFrame = frames.find((f) => f.inPip);
  if (pipFrame) {
    await inFrames(tabId, { frameIds: [pipFrame.frameId] }, () => HoverPip.exitPip());
    return;
  }
  const best = HoverPip.pickBestVideo(
    frames.filter((f) => f.best).map((f) => ({ ...f.best, frameId: f.frameId })),
  );
  if (best) await inFrames(tabId, { frameIds: [best.frameId] }, () => HoverPip.enterBest());
}
