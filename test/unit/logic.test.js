const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEligible, toggleVariant, pickBestVideo } = require('../../extension/logic.js');

const video = (overrides = {}) => ({
  readyState: 1, duration: 60, clientWidth: 640, clientHeight: 360,
  visible: true, inPip: false, ...overrides,
});

test('a 60 s 640x360 video is eligible', () => {
  assert.equal(isEligible(video()), true);
});

test('unknown duration (NaN) is not eligible', () => {
  assert.equal(isEligible(video({ duration: NaN })), false);
});

test('live streams (Infinity) are eligible', () => {
  assert.equal(isEligible(video({ duration: Infinity })), true);
});

test('45 s is the minimum duration', () => {
  assert.equal(isEligible(video({ duration: 44.9 })), false);
  assert.equal(isEligible(video({ duration: 45 })), true);
});

test('140 px is the minimum width and height', () => {
  assert.equal(isEligible(video({ clientWidth: 139 })), false);
  assert.equal(isEligible(video({ clientHeight: 139 })), false);
  assert.equal(isEligible(video({ clientWidth: 140, clientHeight: 140 })), true);
});

test('needs metadata, visibility, and not already in PiP', () => {
  assert.equal(isEligible(video({ readyState: 0 })), false);
  assert.equal(isEligible(video({ visible: false })), false);
  assert.equal(isEligible(video({ inPip: true })), false);
});

test('toggle variant follows Firefox width thresholds', () => {
  assert.deepEqual(toggleVariant(320, false), { hasUsed: false, small: true, medium: false });
  assert.deepEqual(toggleVariant(321, false), { hasUsed: false, small: false, medium: true });
  assert.deepEqual(toggleVariant(720, false), { hasUsed: false, small: false, medium: true });
  assert.deepEqual(toggleVariant(721, false), { hasUsed: false, small: false, medium: false });
  assert.deepEqual(toggleVariant(1280, true), { hasUsed: true, small: false, medium: false });
});

const candidate = (overrides = {}) => ({ visible: true, readyState: 1, playing: false, area: 1000, ...overrides });

test('best video: playing beats a larger paused one', () => {
  const playing = candidate({ playing: true, area: 10 });
  assert.equal(pickBestVideo([candidate({ area: 5000 }), playing]), playing);
});

test('best video: larger wins when both play or both pause', () => {
  const big = candidate({ area: 2000, id: 'big' });
  assert.equal(pickBestVideo([candidate(), big]), big);
});

test('best video: skips invisible, metadata-less, and zero-area videos', () => {
  assert.equal(pickBestVideo([
    candidate({ visible: false }),
    candidate({ readyState: 0 }),
    candidate({ area: 0 }),
  ]), null);
  assert.equal(pickBestVideo([]), null);
});
