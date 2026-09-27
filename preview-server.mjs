import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);

// 读取 vercel.json 规则实现精准的本地路由模拟
let rewrites = [];
try {
  const vercelConfig = JSON.parse(readFileSync(path.join(rootDir, 'vercel.json'), 'utf8'));
  rewrites = vercelConfig.rewrites || [];
} catch (e) {
  rewrites = [];
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

const server = createServer((req, res) => {
  try {
    let reqUrl = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(reqUrl.pathname);

    // 0. 特殊容错：如果客户端无斜杠访问导致请求 /games/css/* 或 /games/js/* 或 /games/*.webmanifest
    if (pathname.startsWith('/games/css/') || pathname.startsWith('/games/js/') || pathname.startsWith('/games/favicon.svg') || pathname.startsWith('/games/manifest.webmanifest')) {
      const fixedPath = pathname.replace('/games/', '/games/junqi/');
      const checkTarget = path.join(rootDir, fixedPath.replace(/^\//, ''));
      if (existsSync(checkTarget) && !statSync(checkTarget).isDirectory()) {
        pathname = fixedPath;
      }
    }

    // 1. 尝试根据 rewrites 规则重写路径
    let matchedDest = null;
    for (const rule of rewrites) {
      if (rule.source === pathname || (rule.source.endsWith('/') && pathname + '/' === rule.source)) {
        matchedDest = rule.destination;
        break;
      }
    }

    let filePath;
    if (matchedDest) {
      filePath = path.join(rootDir, matchedDest.replace(/^\//, ''));
    } else {
      filePath = path.join(rootDir, pathname.replace(/^\//, ''));
    }

    // 2. 目录规范：若缺少尾部斜杠，301 重定向以修正浏览器的 Base URL
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      if (!reqUrl.pathname.endsWith('/')) {
        res.writeHead(301, {
          'Location': reqUrl.pathname + '/' + (reqUrl.search || '')
        });
        res.end();
        return;
      }
      filePath = path.join(filePath, 'index.html');
    }

    // 3. 尝试干净 URL (.html 后缀)
    if (!existsSync(filePath) && existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }

    // 4. 尝试 games/ 子目录容错（例如 /junqi/js/* 映射到 games/junqi/js/*）
    if (!existsSync(filePath) && !pathname.startsWith('/games/')) {
      const fallback = path.join(rootDir, 'games', pathname.replace(/^\//, ''));
      if (existsSync(fallback)) {
        if (statSync(fallback).isDirectory()) {
          if (!reqUrl.pathname.endsWith('/')) {
            res.writeHead(301, {
              'Location': reqUrl.pathname + '/' + (reqUrl.search || '')
            });
            res.end();
            return;
          }
          filePath = path.join(fallback, 'index.html');
        } else {
          filePath = fallback;
        }
      }
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`500 Server Error: ${err.message}`);
  }
});

// 挂载萌兵军棋 WebSocket 服务（若具备环境）
try {
  const wsPath = path.join(rootDir, 'games/junqi/node_modules/ws/wrapper.mjs');
  if (existsSync(wsPath)) {
    const { WebSocketServer } = await import(pathToFileURL(wsPath).href);
    const { Store } = await import(pathToFileURL(path.join(rootDir, 'games/junqi/server/store.js')).href);
    const { Lobby } = await import(pathToFileURL(path.join(rootDir, 'games/junqi/server/lobby.js')).href);
    const store = new Store({ file: path.join(rootDir, 'games/junqi/data/players.json') });
    const lobby = new Lobby({ store });
    const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

    server.on('upgrade', (req, socket, head) => {
      socket.on('error', () => {});
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname !== '/ws') { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const conn = {
          id: Math.random().toString(36).slice(2, 10),
          ip: req.socket.remoteAddress || '127.0.0.1',
          alive: true,
          send(obj) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); },
          close(code, reason) { try { ws.close(code, reason); } catch { ws.terminate(); } }
        };
        ws.conn = conn;
        lobby.connect(conn);
        ws.on('message', (data, isBinary) => { if (!isBinary) lobby.message(conn, data.toString()); });
        ws.on('pong', () => { conn.alive = true; });
      });
    });
    console.log(`[WS] 萌兵军棋 WebSocket 服务已挂载于 /ws (支持实时对弈与人机练习)`);
  }
} catch (e) {
  console.log(`[WS] 军棋 WebSocket 挂载提示:`, e.message);
}

const defaultPort = 3000;
function tryListen(port, maxAttempts = 10) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxAttempts > 0) {
      tryListen(port + 1, maxAttempts - 1);
    } else {
      console.error(`无法启动服务:`, err);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`🎮 本地小游戏站点预览服务已启动！`);
    console.log(`> 本地访问地址: http://localhost:${port}`);
    console.log(`> 局域网访问地址: http://127.0.0.1:${port}`);
    console.log(`========================================\n`);
  });
}

tryListen(defaultPort);
