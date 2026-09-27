// 服务端集成测试：真实启动 HTTP + WebSocket，用 ws 客户端模拟两位玩家。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import WebSocket from 'ws';
import * as R from '../shared/rules.js';
import { createServer } from '../server/index.js';

let app, port;
const quiet = { log() {}, info() {}, error() {}, warn() {} };

before(async () => {
  app = createServer({
    timing: { foundMs: 20, deployMs: 4000, turnMs: 4000 },
    bot: { think: [20, 40], deployDelay: [20, 60] },
    log: quiet
  });
  port = await app.listen(0, '127.0.0.1');
});
after(() => app.close());

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

/** 一个测试用玩家：记录收到的所有消息，可以按条件等待 */
function player(name) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const msgs = [];
  const used = new Set();
  const waiters = [];
  let rid = 0;
  const check = () => {
    for (let w = waiters.length - 1; w >= 0; w--) {
      const { pred, resolve } = waiters[w];
      const i = msgs.findIndex((m, j) => !used.has(j) && pred(m));
      if (i >= 0) { used.add(i); waiters.splice(w, 1); resolve(msgs[i]); }
    }
  };
  ws.on('message', (d) => { msgs.push(JSON.parse(d)); check(); });
  const p = {
    ws,
    msgs,
    name,
    opened: new Promise((res) => ws.once('open', res)),
    send(t, o = {}) { ws.send(JSON.stringify({ t, ...o })); },
    wait(pred, ms = 4000) {
      if (typeof pred === 'string') { const t = pred; pred = (m) => m.t === t; }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name} 等待超时：${pred}`)), ms);
        waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); } });
        check();
      });
    },
    async req(t, o = {}) {
      const id = ++rid;
      p.send(t, { ...o, rid: id });
      return p.wait((m) => m.t === 'reply' && m.rid === id);
    },
    /** 丢弃目前为止收到的消息（之后的 wait 只看新消息） */
    drain() { msgs.forEach((_, i) => used.add(i)); },
    lastState() { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].t === 'match.state') return msgs[i].view; return null; },
    close() { ws.close(); }
  };
  return p;
}

async function login(name, token) {
  const p = player(name);
  await p.opened;
  p.send('hello', { token, name });
  p.welcome = await p.wait('welcome');
  p.token = p.welcome.token || token;
  return p;
}

/** 找一步合法的普通走法（不碰子） */
function anyMove(view) {
  const occ = {};
  for (const q of view.pieces) occ[q.at] = { s: q.side, k: q.k };
  for (const q of view.pieces) {
    if (q.side !== 'm') continue;
    const lg = R.legal(occ, q.at);
    if (lg.moves.length) return { from: q.at, to: lg.moves[0] };
  }
  return null;
}

async function matchPair(a, b, mode) {
  assert.equal((await a.req('queue.join', { mode })).ok, true);
  assert.equal((await b.req('queue.join', { mode })).ok, true);
  const fa = await a.wait('match.found');
  const fb = await b.wait('match.found');
  assert.equal(fa.match.id, fb.match.id);
  assert.notEqual(fa.match.seat, fb.match.seat);
  return fa.match;
}

async function deployBoth(a, b) {
  assert.equal((await a.req('deploy.submit', { layout: R.defaultLayout() })).ok, true);
  assert.equal((await b.req('deploy.submit', { layout: R.FORMS[1].lay })).ok, true);
  const sa = await a.wait((m) => m.t === 'match.state' && m.view.phase === 'battle');
  const sb = await b.wait((m) => m.t === 'match.state' && m.view.phase === 'battle');
  return [sa.view, sb.view];
}

test('静态文件与路径穿越防护', async () => {
  const r = await get('/shared/rules.js');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /javascript/);
  assert.match(r.body, /export function legal/);
  assert.equal((await get('/../package.json')).status, 404);
  assert.equal((await get('/%2e%2e/server/store.js')).status, 404);
  assert.equal((await get('/shared/%2e%2e/package.json')).status, 404);
  const h = await get('/healthz');
  assert.equal(h.status, 200);
  assert.equal(JSON.parse(h.body).ok, true);
});

test('新玩家登录拿到 token；错误消息不会让服务器出错', async () => {
  const a = await login('阿甲');
  assert.ok(a.token && a.token.length > 20);
  assert.equal(a.welcome.me.name, '阿甲');
  assert.equal(a.welcome.me.pts, 0);
  assert.equal(a.welcome.me.tokenHash, undefined, '不外泄凭证摘要');
  a.ws.send('不是 JSON');
  assert.equal((await a.wait('error')).error, '消息格式错误');
  const r = await a.req('nope');
  assert.equal(r.ok, false);
  const r2 = await a.req('rename', { name: '  <b>新名字</b>\u200b  ' });
  assert.equal(r2.ok, true);
  assert.equal(r2.data.name, 'b新名字/b');
  a.close();
});

test('休闲匹配 → 布阵 → 走子 → 认输，全程看不到对方兵种', async () => {
  const a = await login('甲');
  const b = await login('乙');
  const match = await matchPair(a, b, 'casual');
  assert.equal(match.mode, 'casual');
  const [va, vb] = await deployBoth(a, b);
  const first = va.turn === 'me' ? a : b;
  const second = first === a ? b : a;
  const v = first === a ? va : vb;
  const mv = anyMove(v);
  assert.equal((await first.req('move', { ...mv })).ok, true);
  const after = await second.wait((m) => m.t === 'match.state' && m.view.moveNo === 1);
  assert.equal(after.view.turn, 'me');
  assert.equal(after.view.last.to, R.flipId(mv.to));
  assert.equal((await first.req('move', { ...mv })).ok, false, '不是你的回合');
  for (const p of [a, b]) {
    for (const m of p.msgs) {
      if (m.t !== 'match.state' || m.view.phase !== 'battle') continue;
      assert.ok(m.view.pieces.filter((q) => q.side === 'o').every((q) => q.k === null), '对战中看不到对方兵种');
    }
  }
  assert.equal((await a.req('resign')).ok, true);
  const oa = await a.wait('match.over');
  const ob = await b.wait('match.over');
  assert.equal(oa.summary.outcome, 'lose');
  assert.equal(ob.summary.outcome, 'win');
  assert.equal(oa.points, null, '休闲局不计军功');
  assert.equal(ob.me.stats.games, 1);
  assert.equal(ob.me.stats.w, 1);
  assert.equal(ob.canRematch, true);
  a.close();
  b.close();
});

test('排位赛结算军功', async () => {
  const a = await login('丙');
  const b = await login('丁');
  await matchPair(a, b, 'rank');
  await deployBoth(a, b);
  await a.req('resign');
  const oa = await a.wait('match.over');
  const ob = await b.wait('match.over');
  assert.deepEqual([oa.points.before, oa.points.after, oa.points.delta], [0, 0, 0], '列兵输了不扣到负数');
  assert.deepEqual([ob.points.before, ob.points.after, ob.points.delta], [0, R.WIN_PTS, R.WIN_PTS]);
  assert.equal(ob.me.pts, R.WIN_PTS);
  assert.equal(ob.canRematch, false);
  // 排行榜里能看到赢家
  b.drain();
  await b.req('lobby.refresh');
  const lb = await b.wait('lobby');
  assert.ok(lb.leaderboard.some((e) => e.name === '丁' && e.pts === R.WIN_PTS));
  a.close();
  b.close();
});

test('断线重连回到原来的对局；同一账号只保留一个连接', async () => {
  const a = await login('戊');
  const b = await login('己');
  const match = await matchPair(a, b, 'casual');
  await deployBoth(a, b);
  a.close();
  const off = await b.wait((m) => m.t === 'match.event' && m.ev.type === 'opp_status');
  assert.equal(off.ev.online, false);
  const a2 = await login('戊', a.token);
  assert.equal(a2.welcome.token, undefined, '老玩家不再下发 token');
  assert.equal(a2.welcome.me.name, '戊');
  const found = await a2.wait('match.found');
  assert.equal(found.resume, true);
  assert.equal(found.match.id, match.id);
  const st = await a2.wait('match.state');
  assert.equal(st.view.phase, 'battle');
  const on = await b.wait((m) => m.t === 'match.event' && m.ev.type === 'opp_status');
  assert.equal(on.ev.online, true);
  // 同一 token 再登录一次：旧连接被踢下线
  const a3 = await login('戊', a.token);
  const kicked = await a2.wait('kicked');
  assert.match(kicked.reason, /另一个窗口/);
  await a3.req('resign');
  await b.wait('match.over');
  a3.close();
  b.close();
});

test('好友房：房间号加入、再来一局', async () => {
  const a = await login('庚');
  const b = await login('辛');
  const r = await a.req('room.create');
  assert.equal(r.ok, true);
  const code = r.data.code;
  assert.match(code, /^\d{4}$/);
  assert.equal((await a.wait('room')).code, code);
  const bad = await b.req('room.join', { code: code === '1000' ? '1001' : '1000' });
  assert.equal(bad.ok, false);
  assert.equal((await b.req('room.join', { code: 'abcd' })).ok, false);
  assert.equal((await b.req('room.join', { code })).ok, true);
  const fa = await a.wait('match.found');
  const fb = await b.wait('match.found');
  assert.equal(fa.match.mode, 'friend');
  assert.equal(fb.match.opp.name, '庚');
  await deployBoth(a, b);
  await b.req('resign');
  await a.wait('match.over');
  await b.wait('match.over');
  a.drain();
  b.drain();
  assert.equal((await a.req('match.rematch')).ok, true);
  const inv = await b.wait((m) => m.t === 'match.event' && m.ev.type === 'rematch');
  assert.equal(inv.ev.by, 'opp');
  assert.equal((await b.req('match.rematch')).ok, true);
  const n1 = await a.wait('match.found');
  const n2 = await b.wait('match.found');
  assert.notEqual(n1.match.id, fa.match.id);
  assert.equal(n1.match.id, n2.match.id);
  await a.req('resign');
  a.close();
  b.close();
});

test('人机练习：电脑会布阵、会走棋', async () => {
  const a = await login('壬');
  assert.equal((await a.req('bot.start')).ok, true);
  const f = await a.wait('match.found');
  assert.equal(f.match.mode, 'bot');
  assert.equal(f.match.opp.isBot, true);
  assert.equal((await a.req('deploy.submit', { layout: R.defaultLayout() })).ok, true);
  let v = (await a.wait((m) => m.t === 'match.state' && m.view.phase === 'battle')).view;
  // 双方各走几步
  for (let i = 0; i < 4; i++) {
    if (v.turn !== 'me') v = (await a.wait((m) => m.t === 'match.state' && m.view.turn === 'me' && m.view.moveNo > v.moveNo, 3000)).view;
    if (v.phase !== 'battle') break;
    const mv = anyMove(v);
    assert.equal((await a.req('move', mv)).ok, true);
    v = (await a.wait((m) => m.t === 'match.state' && m.view.turn === 'me' && m.view.moveNo > v.moveNo + 1, 3000)).view;
  }
  assert.ok(v.moveNo >= 8, '人机应答了每一步');
  assert.equal((await a.req('resign')).ok, true);
  const over = await a.wait('match.over');
  assert.equal(over.summary.outcome, 'lose');
  assert.equal(over.me.bot.games, 1);
  a.close();
});

test('畸形的请求地址不会让服务器崩溃', async () => {
  const raw = (line) => new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1', () => sock.write(line));
    let buf = '';
    sock.on('data', (d) => { buf += d; });
    sock.on('close', () => resolve(buf));
    sock.on('error', () => resolve(buf));
    setTimeout(() => sock.destroy(), 1500);
  });
  const r1 = await raw('GET //a:b HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
  assert.match(r1, /^HTTP\/1\.1 400/);
  await raw('GET //a:b HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n');
  assert.equal((await get('/healthz')).status, 200, '服务器还活着');
});

test('同一账号在新窗口登录时，旧窗口的排队被取消', async () => {
  const a = await login('癸');
  assert.equal((await a.req('queue.join', { mode: 'casual' })).ok, true);
  assert.equal(app.lobby.queue.length, 1);
  const a2 = await login('癸', a.token);
  await a.wait('kicked');
  assert.equal(app.lobby.queue.length, 0);
  a2.close();
});
