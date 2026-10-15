const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extensionId, updateManifest, releaseUrl } = require('../../scripts/sign.js');

// The public half of a throwaway key. Chromium packed a CRX with the private
// half and wrote this ID into its header.
const TEST_KEY = fs.readFileSync(path.join(__dirname, '../fixtures/crx-test-key.pub.pem'));

test('the extension ID matches the one Chromium derives from the key', () => {
  assert.equal(extensionId(TEST_KEY), 'ooinpoipjpjnemdlienljbajgjmoifhb');
});

test('the update manifest offers the version at its release URL', () => {
  const xml = updateManifest({
    id: 'ooinpoipjpjnemdlienljbajgjmoifhb',
    version: '1.2.3',
    minimumChromeVersion: '153',
  });
  assert.match(xml, /^<\?xml version='1\.0' encoding='UTF-8'\?>\n<gupdate xmlns='http:\/\/www\.google\.com\/update2\/response' protocol='2\.0'>/);
  assert.match(xml, /<app appid='ooinpoipjpjnemdlienljbajgjmoifhb'>/);
  assert.match(xml, new RegExp(`codebase='${releaseUrl('1.2.3', 'hover-pip-1.2.3.crx')}'`));
  assert.match(xml, /version='1\.2\.3'/);
  assert.match(xml, /prodversionmin='153'/);
});

test('release URLs point at the tag for that version', () => {
  assert.equal(
    releaseUrl('1.2.3', 'hover-pip-1.2.3.crx'),
    'https://github.com/sgtsquiggs/hover-pip/releases/download/v1.2.3/hover-pip-1.2.3.crx',
  );
});
