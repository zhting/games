import {createServer} from 'node:http';
import {createReadStream, existsSync, mkdirSync, rmSync} from 'node:fs';
import {rename, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const adRoot = path.resolve(here, '..');
const siteRoot = process.env.JELLY_SITE_ROOT
  ? path.resolve(process.env.JELLY_SITE_ROOT)
  : path.resolve(adRoot, '..');
const captureDir = path.join(adRoot, 'public', 'capture');
const rawRoot = path.join(captureDir, '.raw');
const rawDir = path.join(rawRoot, `run-${Date.now()}`);
mkdirSync(captureDir, {recursive: true});
mkdirSync(rawDir, {recursive: true});

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(siteRoot, `.${requestPath}`);
    if (!target.startsWith(siteRoot)) throw new Error('invalid path');
    if (!existsSync(target)) {
      const gamesTarget = path.resolve(siteRoot, 'games', `.${requestPath}`);
      if (gamesTarget.startsWith(siteRoot) && existsSync(gamesTarget)) {
        target = gamesTarget;
      } else {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
    }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(target).pipe(res);
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});

await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
  ],
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const movements = [
  ['ArrowLeft', 'ArrowUp'],
  ['ArrowRight'],
  ['ArrowRight', 'ArrowUp'],
  ['ArrowLeft'],
  ['ArrowLeft', 'ArrowLeft', 'ArrowUp'],
  ['ArrowRight', 'ArrowUp'],
  ['ArrowRight', 'ArrowRight'],
  ['ArrowLeft', 'ArrowUp'],
  ['ArrowRight'],
  ['ArrowLeft', 'ArrowLeft'],
  ['ArrowRight', 'ArrowUp'],
  ['ArrowLeft'],
];

async function playDrops(page, durationMs, is3d = false) {
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < durationMs) {
    const keys = movements[i % movements.length];
    for (const key of keys) {
      await page.keyboard.press(key);
      await sleep(45);
    }
    await page.keyboard.press('Space');
    await sleep(is3d ? 390 : 320);
    i += 1;
  }
}

async function capture2d(mode) {
  const context = await browser.newContext({
    viewport: {width: 1280, height: 720},
    deviceScaleFactor: 1,
    recordVideo: {dir: rawDir, size: {width: 1280, height: 720}},
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/games/game/', {waitUntil: 'networkidle'});
  await page.locator(`.modeOpt[data-mode="${mode}"]`).click();
  await page.locator('#ovBtn').click();
  await page.waitForTimeout(700);
  const video = page.video();
  await playDrops(page, 7200, false);
  await page.waitForTimeout(500);
  await context.close();
  const output = path.join(captureDir, `${mode}.webm`);
  await video.saveAs(output);
  process.stdout.write(`captured ${mode}\n`);
}

async function capture3d() {
  const context = await browser.newContext({
    viewport: {width: 1280, height: 720},
    deviceScaleFactor: 1,
    recordVideo: {dir: rawDir, size: {width: 1280, height: 720}},
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/games/game/3d/', {waitUntil: 'networkidle'});
  await page.locator('#btnStart').click();
  await page.waitForTimeout(900);
  const video = page.video();
  const cameraMove = (async () => {
    await page.mouse.move(640, 360);
    await page.mouse.down();
    for (let x = 640; x <= 890; x += 10) {
      await page.mouse.move(x, 330 + Math.sin(x / 50) * 24);
      await sleep(24);
    }
    await page.mouse.up();
  })();
  await Promise.all([cameraMove, playDrops(page, 8200, true)]);
  await page.waitForTimeout(500);
  await context.close();
  const output = path.join(captureDir, 'true3d.webm');
  await video.saveAs(output);
  process.stdout.write('captured true3d\n');
}

try {
  for (const mode of ['classic', 'melt', 'fluid', 'iso']) await capture2d(mode);
  await capture3d();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await sleep(800);
  try {
    rmSync(rawRoot, {recursive: true, force: true, maxRetries: 4, retryDelay: 350});
  } catch {
    // Windows may keep the Playwright encoder handle briefly. The raw folder is
    // throwaway data and is reset by run-local.ps1 on the next execution.
  }
}
