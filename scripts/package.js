// Builds dist/hover-pip-<version>.zip, the release zip: the
// extension directory plus LICENSE, after checking that every file the
// manifest names is there.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXTENSION = path.join(ROOT, 'extension');
const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest.json'), 'utf8'));

const referenced = [
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
  ...Object.values(manifest.icons ?? {}),
];
const missing = referenced.filter((file) => !fs.existsSync(path.join(EXTENSION, file)));
if (missing.length) {
  console.error(`manifest.json names missing files: ${missing.join(', ')}`);
  process.exit(1);
}

const zip = path.join(ROOT, 'dist', `hover-pip-${manifest.version}.zip`);
fs.mkdirSync(path.dirname(zip), { recursive: true });
fs.rmSync(zip, { force: true });
// -X leaves out extra file attributes; -D leaves out directory entries.
execFileSync('zip', ['-q', '-r', '-X', '-D', zip, '.'], { cwd: EXTENSION });
execFileSync('zip', ['-q', '-X', zip, 'LICENSE'], { cwd: ROOT });
console.log(path.relative(ROOT, zip));
