// Sets the extension's version in manifest.json.
// Usage: npm run bump -- patch|minor|major|<x.y.z>
const fs = require('node:fs');
const path = require('node:path');

const VERSION = /^\d+\.\d+\.\d+$/;

function nextVersion(current, bump) {
  if (VERSION.test(bump)) return bump;
  if (!VERSION.test(current)) throw new Error(`current version ${current} isn't x.y.z`);
  const [major, minor, patch] = current.split('.').map(Number);
  switch (bump) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: throw new Error(`expected patch, minor, major or x.y.z, got ${bump}`);
  }
}

if (require.main === module) {
  const file = path.resolve(__dirname, '../extension/manifest.json');
  const source = fs.readFileSync(file, 'utf8');
  const { version } = JSON.parse(source);
  const next = nextVersion(version, process.argv[2]);
  // Replace just the value, keeping the manifest's formatting.
  fs.writeFileSync(file, source.replace(`"version": "${version}"`, `"version": "${next}"`));
  console.log(`${version} -> ${next}`);
}

module.exports = { nextVersion };
