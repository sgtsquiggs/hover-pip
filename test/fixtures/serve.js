// Static file server for e2e fixtures. Usage: node serve.js <port>
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = { '.html': 'text/html; charset=utf-8', '.webm': 'video/webm' };
const port = Number(process.argv[2] ?? 18765);

http.createServer((req, res) => {
  const file = path.join(__dirname, path.normalize(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  });
}).listen(port);
