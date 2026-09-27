// 端到端冒烟测试：启动服务器，用两个浏览器（桌面 + 手机尺寸）开一局好友房，
// 布阵、走几步、认输、看结算。需要先安装 Playwright：
//   npm i -D playwright && npx playwright install chromium
//   npm run e2e
import { createServer } from '../server/index.js';
import * as R from '../shared/rules.js';

let chromium, devices;
try {
  ({ chromium, devices } = await import('playwright'));
} catch {
  console.error('没有找到 Playwright。请先运行：npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const quiet = { log() {}, info() {}, error: console.error, warn() {} };
const app = createServer({ timing: { foundMs: 800, deployMs: 30000, turnMs: 20000 }, log: quiet });
const port = await app.listen(0, '127.0.0.1');
const URL = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch();
const errors = [];
const step = (s) => console.log('  ✓', s);

async function open(name, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(URL);
  await page.waitForSelector('#nameInput');
  await page.fill('#nameInput', name);
  await page.click('#dlgActions .btn-primary');
  await page.waitForSelector('#dlg', { state: 'hidden' });
  return page;
}

/** 在自己的回合走一步合法的棋（通过点击棋盘） */
async function playOne(page) {
  const v = await page.evaluate(() => window.__mbjq.S.view);
  if (!v || v.phase !== 'battle' || v.turn !== 'me') return false;
  const occ = {};
  for (const q of v.pieces) occ[q.at] = { s: q.side, k: q.k };
  for (const q of v.pieces) {
    if (q.side !== 'm') continue;
    const lg = R.legal(occ, q.at);
    const to = lg.moves[0] || lg.attacks[0];
    if (!to) continue;
    await page.click(`#battleBoard [data-act="piece"][data-id="${q.at}"]`);
    await page.click(`#battleBoard [data-act="move"][data-id="${to}"]`);
    return true;
  }
  return false;
}

try {
  const A = await open('桌面玩家', { viewport: { width: 1440, height: 900 } });
  const B = await open('手机玩家', { ...devices['iPhone 13'] });
  step('两位玩家登录并起好昵称');

  await A.click('[data-act="friend"]');
  await A.click('#roomCreate');
  await A.waitForSelector('#scr-match.on[data-phase="room"]');
  const code = (await A.textContent('#roomCode')).trim();
  await B.click('[data-act="friend"]');
  await B.fill('#roomInput', code);
  await B.click('#roomJoin');
  await A.waitForSelector('#scr-match.on[data-phase="found"]');
  await B.waitForSelector('#scr-match.on[data-phase="found"]');
  step(`好友房 ${code} 配对成功`);

  await A.waitForSelector('#scr-deploy.on');
  await B.waitForSelector('#scr-deploy.on');
  await A.click('#deployBoard [data-act="piece"][data-id="m11"]');
  await A.click('#deployBoard [data-act="piece"][data-id="m12"]');
  await A.click('#scr-deploy .cta-stack .deploy-done');
  await B.click('#dpChips [data-form="fortress"]');
  await B.click('#scr-deploy .dp-sheet .deploy-done');
  await A.waitForSelector('#scr-battle.on');
  await B.waitForSelector('#scr-battle.on');
  step('双方布阵完成，进入对战');

  for (let i = 0; i < 8; i++) {
    const va = await A.evaluate(() => window.__mbjq.S.view);
    const p = va.turn === 'me' ? A : B;
    const before = va.moveNo;
    if (!(await playOne(p))) break;
    await A.waitForFunction((n) => window.__mbjq.S.view.moveNo > n, before);
  }
  const hidden = await B.evaluate(() => window.__mbjq.S.view.pieces.filter((q) => q.side === 'o').every((q) => q.k === null || q.k === 'jq'));
  if (!hidden) throw new Error('对战中看到了对方兵种');
  step('走了 8 步，对方兵种始终不可见');

  await A.click('#scr-battle .bt-btns [data-act="resign"]');
  await A.click('#dlgActions .btn-danger');
  await A.click('#battleBoard [data-act="result"]');
  await B.click('#battleBoard [data-act="result"]');
  await A.waitForSelector('#scr-result.on[data-mode="lose"]');
  await B.waitForSelector('#scr-result.on[data-mode="win"]');
  step('认输后双方看到正确的结算');

  if (errors.length) throw new Error('页面报错：\n' + errors.join('\n'));
  console.log('\n端到端冒烟测试通过');
} catch (e) {
  console.error('\n端到端测试失败：', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
}
