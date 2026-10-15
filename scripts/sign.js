// Signs an unpacked extension into dist/hover-pip-<version>.crx with Chromium's
// own packer, and writes dist/update.xml, the manifest that the update_url
// names. Usage: npm run sign -- <extension-dir> <key.pem>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO = 'https://github.com/sgtsquiggs/hover-pip';

// Chromium's extension ID: the first 16 bytes of the SHA-256 of the public
// key, with each hex digit 0-f written as a letter a-p.
function extensionId(pem) {
  const spki = crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' });
  const hex = crypto.createHash('sha256').update(spki).digest('hex').slice(0, 32);
  return [...hex].map((digit) => String.fromCharCode(97 + parseInt(digit, 16))).join('');
}

function releaseUrl(version, file) {
  return `${REPO}/releases/download/v${version}/${file}`;
}

function updateManifest({ id, version, minimumChromeVersion }) {
  const codebase = releaseUrl(version, `hover-pip-${version}.crx`);
  return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${id}'>
    <updatecheck codebase='${codebase}' version='${version}' prodversionmin='${minimumChromeVersion}' status='ok' />
  </app>
</gupdate>
`;
}

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return require('@playwright/test').chromium.executablePath();
}

if (require.main === module) {
  const [dir, keyFile] = process.argv.slice(2);
  if (!dir || !keyFile) {
    console.error('usage: npm run sign -- <extension-dir> <key.pem>');
    process.exit(1);
  }
  const ROOT = path.resolve(__dirname, '..');
  const source = path.resolve(dir).replace(/\/+$/, '');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  const packed = `${source}.crx`;
  fs.rmSync(packed, { force: true });
  // Chromium writes <dir>.crx next to the directory and exits without a window.
  // Packing renders nothing, so the sandbox, which Ubuntu 24.04's AppArmor
  // blocks for unprivileged users, isn't needed.
  execFileSync(chromiumPath(), [
    '--no-sandbox',
    `--pack-extension=${source}`,
    `--pack-extension-key=${path.resolve(keyFile)}`,
    '--no-message-box',
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (!fs.existsSync(packed)) {
    console.error(`Chromium didn't write ${packed}`);
    process.exit(1);
  }

  const dist = path.join(ROOT, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const crx = path.join(dist, `hover-pip-${manifest.version}.crx`);
  fs.renameSync(packed, crx);
  fs.writeFileSync(path.join(dist, 'update.xml'), updateManifest({
    id: extensionId(fs.readFileSync(keyFile)),
    version: manifest.version,
    minimumChromeVersion: manifest.minimum_chrome_version,
  }));
  console.log(path.relative(ROOT, crx));
  console.log('dist/update.xml');
}

module.exports = { extensionId, updateManifest, releaseUrl };
