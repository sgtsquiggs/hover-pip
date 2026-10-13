const path = require('node:path');
const { execFileSync } = require('node:child_process');

module.exports = () => {
  execFileSync('sh', [path.resolve(__dirname, '../fixtures/make-videos.sh')], { stdio: 'inherit' });
};
