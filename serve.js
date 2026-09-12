/**
 * =============================================
 *  FOODIES.COM — Full Dev Server
 *  Serves frontend + proxies API to backend
 *
 *  HOW TO RUN:
 *    node serve.js
 *  Open: http://localhost:3000
 *
 *  If backend is running on port 5000:
 *    API calls are automatically forwarded.
 *  If backend is NOT running:
 *    UI works, API calls return friendly error.
 * =============================================
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT         = 3000;
const BACKEND_PORT = 5000;
const ROOT         = __dirname;

const MIME_TYPES = {
  '.html' : 'text/html; charset=utf-8',
  '.css'  : 'text/css; charset=utf-8',
  '.js'   : 'application/javascript; charset=utf-8',
  '.json' : 'application/json',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.gif'  : 'image/gif',
  '.svg'  : 'image/svg+xml',
  '.ico'  : 'image/x-icon',
  '.woff' : 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf'  : 'font/ttf',
  '.webp' : 'image/webp',
  '.map'  : 'application/json',
};

// ── API Proxy ──────────────────────────────────────────────────────────────
function proxyToBackend(req, res) {
  const options = {
    hostname: 'localhost',
    port:     BACKEND_PORT,
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: `localhost:${BACKEND_PORT}` }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    // Backend not running — return helpful JSON error
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Backend server is not running. Start it with: cd backend && npm run dev'
    }));
  });

  req.pipe(proxyReq);
}

// ── Static File Server ─────────────────────────────────────────────────────
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'text/plain';

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('403 Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try adding .html extension
      fs.readFile(filePath + '.html', (err2, data2) => {
        if (!err2) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2); return;
        }
        // Serve custom 404
        fs.readFile(path.join(ROOT, '404.html'), (err3, data3) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(err3 ? '404 Not Found' : data3);
        });
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type' : mimeType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

// ── Main Server ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Route: /api/* → proxy to backend:5000
  if (req.url.startsWith('/api/')) {
    proxyToBackend(req, res);
  } else {
    // Everything else → serve static files
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🍽️  FOODIES.COM Dev Server Running!    ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  🌐  Frontend:  http://localhost:${PORT}     ║`);
  console.log(`║  🔀  API Proxy: → localhost:${BACKEND_PORT}       ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Pages:                                  ║');
  console.log(`║  Home     →  http://localhost:${PORT}/       ║`);
  console.log(`║  Login    →  http://localhost:${PORT}/login.html    ║`);
  console.log(`║  Register →  http://localhost:${PORT}/register.html ║`);
  console.log(`║  Admin    →  http://localhost:${PORT}/admin.html    ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  🛑  Press Ctrl+C to stop                ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Check if backend is up
  const check = http.request({ hostname: 'localhost', port: BACKEND_PORT, path: '/api/menu', method: 'GET' }, (r) => {
    console.log(`✅ Backend detected on port ${BACKEND_PORT} — API calls will work!\n`);
  });
  check.on('error', () => {
    console.log(`⚠️  Backend NOT running on port ${BACKEND_PORT}`);
    console.log('   Login/Register/Orders will show error until you run:');
    console.log('   cd backend && npm run dev\n');
  });
  check.end();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is busy. Close other servers and try again.\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
