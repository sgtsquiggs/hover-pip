const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextVersion } = require('../../scripts/bump-version.js');

test('patch, minor and major bumps reset the lower parts', () => {
  assert.equal(nextVersion('1.4.2', 'patch'), '1.4.3');
  assert.equal(nextVersion('1.4.2', 'minor'), '1.5.0');
  assert.equal(nextVersion('1.4.2', 'major'), '2.0.0');
});

test('an explicit x.y.z is taken as is', () => {
  assert.equal(nextVersion('0.1.0', '1.0.0'), '1.0.0');
});

test('anything else is rejected', () => {
  assert.throws(() => nextVersion('0.1.0', 'huge'), /expected patch/);
  assert.throws(() => nextVersion('0.1.0', '1.0'), /expected patch/);
  assert.throws(() => nextVersion('0.1', 'patch'), /isn't x\.y\.z/);
});
