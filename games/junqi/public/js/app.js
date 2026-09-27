// 萌兵军棋 · 客户端主程序
// 所有对局状态都以服务器为准：这里只负责把服务器推来的状态画出来，并把玩家的操作发回去。
import * as R from '../shared/rules.js';
import { esc, badgeSVG, avatarSVG, pieceBox, hydrate, putAvatar, putBadge, looksOf } from './art.js';
import { Board, MARKS } from './board.js';
import { Net } from './net.js';
import { Sound } from './sound.js';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
const num = (n) => Number(n || 0).toLocaleString('en-US');
const MODE_NAME = { rank: '排位赛', casual: '休闲赛', friend: '好友房', bot: '人机练习' };

// ================= 本地存储（无痕模式下退化为内存） =================
const mem = new Map();
const store = {
  get(k) { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch { /* ignore */ } return mem.has(k) ? mem.get(k) : null; },
  set(k, v) { mem.set(k, v); try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  json(k, d) { try { const v = this.get(k); return v ? JSON.parse(v) : d; } catch { return d; } }
};
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }
};

// ================= 字体（不阻塞首屏） =================
(() => {
  const m = document.querySelector('meta[name="mbjq-fonts"]');
  if (!m || !m.content) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = m.content;
  document.head.appendChild(l);
})();

// ================= 设置 =================
const SET = { hints: true, reduce: false, sound: true };
(() => {
  const s = store.json('mbjq-settings', {});
  for (const k of Object.keys(SET)) if (typeof s[k] === 'boolean') SET[k] = s[k];
})();
function saveSettings() { store.set('mbjq-settings', JSON.stringify(SET)); }
function applySettings() {
  document.body.classList.toggle('reduce-motion', SET.reduce);
  Sound.on = SET.sound;
  $$('.sound-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(SET.sound));
    b.querySelector('use').setAttribute('href', SET.sound ? '#i-sound' : '#i-mute');
  });
  if (S.screen === 'battle') battleBoard.render();
}

// ================= 全局状态 =================
const S = {
  screen: null,
  conn: 'connecting',
  welcomed: false,
  kicked: false,
  me: null,
  timing: { foundMs: 3500, deployMs: 90000, turnMs: 30000, maxTimeouts: 3, drawGap: 10 },
  lobby: null,
  queue: null,
  room: null,
  match: null,
  view: null,
  over: null,
  skipVs: false,
  showResult: false,
  oppOnline: true,
  rematchSent: false,
  rematchFromOpp: false,
  oppLeft: false,
  awaitResume: null,
  tipAt: 0,
  tipIdx: 0
};
const net = new Net((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
const serverNow = () => net.serverNow();

// ================= 提示、对话框、底部抽屉 =================
let toastT = 0;
function toast(msg, ms) {
  const host = $('#toastHost');
  host.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toastT);
  toastT = setTimeout(() => { host.innerHTML = ''; }, ms || 2200);
}

const DLG = { kind: null, keep: false, sticky: false };
let dlgReturn = null;
const dialogOpen = () => !$('#dlg').hidden;
/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.tone] red | blue | ink | jade
 * @param {string} [o.body] HTML
 * @param {Array<{label:string, cls?:string, run?:Function, keep?:boolean}>} [o.actions]
 * @param {string} [o.kind] 用来识别当前是哪个对话框
 * @param {boolean} [o.keep] 切换界面时不自动关闭
 * @param {boolean} [o.sticky] 不能点背景或按 Esc 关闭
 */
function openDialog(o) {
  const ae = document.activeElement;
  if (ae && !$('#dlg').contains(ae)) dlgReturn = ae;
  DLG.kind = o.kind || null;
  DLG.keep = !!o.keep;
  DLG.sticky = !!o.sticky;
  const t = $('#dlgTitle');
  t.textContent = o.title;
  t.className = 'ribbon' + (o.tone ? ' r-' + o.tone : '');
  $('#dlgBody').innerHTML = o.body || '';
  hydrate($('#dlgBody'));
  const act = $('#dlgActions');
  act.innerHTML = '';
  (o.actions || []).forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.addEventListener('click', () => { if (!a.keep) closeDialog(); if (a.run) a.run(); });
    act.appendChild(b);
  });
  if (o.bind) o.bind($('#dlgBody'));
  $('#dlg').hidden = false;
  if (!o.noFocus) {
    const first = act.querySelector('.btn-primary') || act.querySelector('button') || $('#dlgBody button');
    if (first) first.focus();
  }
}
function closeDialog() {
  if (!dialogOpen()) return;
  $('#dlg').hidden = true;
  DLG.kind = null;
  DLG.keep = false;
  DLG.sticky = false;
  setTimeout(() => { if (!dialogOpen() && dlgReturn && document.contains(dlgReturn) && dlgReturn.offsetParent !== null) dlgReturn.focus(); }, 0);
}
const sheetOpen = () => !$('#logSheet').hidden;
let sheetReturn = null;
function openSheet() { sheetReturn = document.activeElement; renderLog(); $('#logSheet').hidden = false; $('#logSheet [data-close-sheet]').focus(); }
function closeSheet() { if (!sheetOpen()) return; $('#logSheet').hidden = true; if (sheetReturn && document.contains(sheetReturn)) sheetReturn.focus(); }

function rulesDialog() {
  openDialog({
    title: '玩法规则', tone: 'blue',
    body: '<ul class="rule-list">' +
      '<li><span class="pcmini" data-piece="sl" data-scale=".7"></span><span><b>大吃小</b>：司令 &gt; 军长 &gt; 师长 &gt; 旅长 &gt; 团长 &gt; 营长 &gt; 连长 &gt; 排长 &gt; 工兵，同级相碰同归于尽。</span></li>' +
      '<li><span class="pcmini" data-piece="gb" data-scale=".7"></span><span><b>工兵</b>在铁路上可以任意转弯，也是唯一能排除地雷的棋子。</span></li>' +
      '<li><span class="pcmini" data-piece="zd" data-scale=".7"></span><span><b>炸弹</b>与任何棋子相碰，双方一同阵亡；不能放在第一排。</span></li>' +
      '<li><span class="pcmini" data-piece="dl" data-scale=".7"></span><span><b>地雷</b>不能移动，只能放在最后两排；除工兵外，碰到它的棋子阵亡。</span></li>' +
      '<li><span class="pcmini" data-piece="jq" data-scale=".7"></span><span><b>军旗</b>放在大本营，被夺即判负；司令阵亡后，军旗位置会被亮出。</span></li>' +
      '</ul><p style="margin:14px 0 0">铁路上直行不限格数，公路每次走一格；<b>行营</b>里的棋子不会被攻击，进入<b>大本营</b>的棋子不能再移动。暗棋模式下，系统裁判只公布碰子的胜负，不公布对方棋子的身份。</p>' +
      `<p style="margin:10px 0 0">每步限时 ${Math.round(S.timing.turnMs / 1000)} 秒，超时 ${S.timing.maxTimeouts} 次判负；无子可走判负；连续 60 步无吃子判和。排位赛胜 +${R.WIN_PTS} 军功（3 连胜起每局再 +${R.STREAK_BONUS}），负 −${R.LOSS_PTS}。</p>`,
    actions: [{ label: '知道了', cls: 'btn-primary' }]
  });
}
function settingsDialog() {
  const row = (key, name, desc) => `<div class="toggle"><div><b>${name}</b><div class="muted" style="font-size:13px">${desc}</div></div><button type="button" data-setting="${key}" aria-pressed="${SET[key]}" aria-label="${name}"></button></div>`;
  openDialog({
    title: '设置', tone: 'ink',
    body: row('hints', '走子提示', '选中棋子后显示可走位置与路线') + row('sound', '音效', '走子、碰子、轮到你时的提示音') + row('reduce', '减少动效', '关闭浮动、脉冲等动画'),
    actions: [{ label: '完成', cls: 'btn-primary' }],
    bind(body) {
      $$('[data-setting]', body).forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.setting;
        SET[k] = !SET[k];
        b.setAttribute('aria-pressed', String(SET[k]));
        saveSettings();
        applySettings();
      }));
    }
  });
}
function menuDialog() {
  const v = S.view;
  const inGame = (S.screen === 'battle' || S.screen === 'deploy') && v && v.phase !== 'over';
  const info = S.screen === 'battle' && v ? `对局进行中，第 ${v.moveNo} 手。` : S.screen === 'deploy' && v ? `布阵还剩 ${fmt((v.deployDeadline - serverNow()) / 1000)}。` : '';
  openDialog({
    title: '菜单', tone: 'ink',
    body: info ? `<p>${info}</p>` : '',
    actions: [
      { label: '玩法规则', run: rulesDialog },
      { label: '设置', run: settingsDialog },
      inGame ? { label: S.screen === 'deploy' ? '退出对局' : '认输', cls: 'btn-danger', run: resignDialog } : { label: '返回大厅', run: goHome },
      { label: '继续', cls: 'btn-primary' }
    ]
  });
}
function resignDialog() {
  const m = S.match;
  if (!m) return;
  const stake = m.mode === 'rank' ? `排位赛扣除 ${R.LOSS_PTS} 军功，连胜会中断。` : '本局记为负。';
  openDialog({
    kind: 'resign',
    title: S.screen === 'deploy' ? '退出对局？' : '确定认输？', tone: 'red',
    body: `<p>${S.screen === 'deploy' ? '现在退出按认输处理，' : '本局将判负，'}${stake}</p>`,
    actions: [
      { label: '再想想', cls: 'btn-primary' },
      { label: S.screen === 'deploy' ? '退出' : '认输', cls: 'btn-danger', run: async () => { const r = await net.req('resign'); if (!r.ok) toast(r.error); } }
    ]
  });
}

// ================= 昵称、好友房、被踢下线 =================
function nameDialog(first) {
  const cur = S.me ? S.me.name : '';
  const save = async () => {
    const inp = $('#nameInput');
    if (!inp) return;
    const name = inp.value.trim();
    if (!name) { $('#nameErr').textContent = '昵称不能为空'; return; }
    const r = await net.req('rename', { name });
    if (!r.ok) { const e = $('#nameErr'); if (e) e.textContent = r.error; return; }
    if (S.me) S.me.name = r.data.name;
    if (S.screen === 'lobby') renderLobby(); else renderMe();
    closeDialog();
    toast('好的，' + r.data.name + '！', 1600);
  };
  openDialog({
    kind: 'name', keep: true,
    title: first ? '欢迎来到萌兵军棋' : '修改昵称', tone: first ? 'red' : 'ink',
    body: (first ? '<p>先给自己起个响亮的名字吧，对手和排行榜上都会看到它。</p>' : '') +
      `<div class="field"><label for="nameInput">昵称（最多 12 个字）</label><input id="nameInput" maxlength="12" autocomplete="nickname" value="${esc(cur)}"><div class="err" id="nameErr" aria-live="polite"></div></div>`,
    actions: [...(first ? [] : [{ label: '取消' }]), { label: first ? '就叫这个' : '保存', cls: 'btn-primary', keep: true, run: save }],
    noFocus: true,
    bind(body) {
      const inp = $('#nameInput', body);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
      setTimeout(() => { inp.focus(); inp.select(); }, 30);
    }
  });
}

function friendDialog() {
  openDialog({
    kind: 'friend', title: '好友房', tone: 'blue',
    body: '<p>创建房间后，把 4 位房间号或邀请链接发给好友，好友加入就立即开战（不计军功）。</p>' +
      '<button type="button" class="btn btn-primary wide" id="roomCreate"><svg width="22" height="22" aria-hidden="true"><use href="#i-users"></use></svg>创建房间</button>' +
      '<div class="dlg-or">或者加入好友的房间</div>' +
      '<div class="field"><div class="row2"><input id="roomInput" class="code-input" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="房间号" aria-label="房间号" autocomplete="off"><button type="button" class="btn" id="roomJoin">加入</button></div><div class="err" id="roomErr" aria-live="polite"></div></div>',
    actions: [{ label: '关闭' }],
    bind(body) {
      const err = (t) => { const e = $('#roomErr'); if (e) e.textContent = t; };
      $('#roomCreate', body).addEventListener('click', async () => {
        const r = await net.req('room.create');
        if (!r.ok) { err(r.error); return; }
        closeDialog();
      });
      const inp = $('#roomInput', body);
      const join = async () => {
        const code = inp.value.replace(/\D/g, '');
        if (code.length !== 4) { err('请输入 4 位房间号'); return; }
        const r = await net.req('room.join', { code });
        if (!r.ok) { err(r.error); return; }
        closeDialog();
      };
      $('#roomJoin', body).addEventListener('click', join);
      inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); err(''); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    }
  });
}

function drawOfferDialog() {
  openDialog({
    kind: 'draw', title: '对方请求和棋', tone: 'blue',
    body: `<p>对方提出和棋。接受后本局以和棋结束${S.match && S.match.mode === 'rank' ? '，不增减军功' : ''}；拒绝则继续对局。</p>`,
    actions: [
      { label: '拒绝', run: () => net.req('draw.answer', { accept: false }) },
      { label: '接受和棋', cls: 'btn-primary', run: () => net.req('draw.answer', { accept: true }) }
    ]
  });
}

// ================= 网络消息 =================
net.on('state', (st) => { S.conn = st; renderNet(); });
net.on('rtt', () => renderNet());
net.on('open', () => {
  net.send('hello', { token: store.get('mbjq-token') || undefined });
});
net.on('close', () => { renderNet(); });

net.on('welcome', (m) => {
  const isNew = !!m.token;
  if (m.token) store.set('mbjq-token', m.token);
  S.welcomed = true;
  S.me = m.me;
  if (m.timing) S.timing = { ...S.timing, ...m.timing };
  // 重连后服务器会重新推送排队/房间/对局；本地先清掉可能已经过期的排队和房间
  S.queue = null;
  S.room = null;
  if (S.match) {
    const id = S.match.id;
    S.awaitResume = id;
    setTimeout(() => {
      if (S.awaitResume !== id || !S.match || S.match.id !== id) return;
      S.awaitResume = null;
      leaveFinished(false);
      toast('这局已经结束了', 2000);
      route();
    }, 2500);
  }
  renderMe();
  renderNet();
  if (isNew) setTimeout(() => nameDialog(true), 400);
  handleInvite();
  route();
});

net.on('me', (m) => { S.me = m.me; if (S.screen === 'lobby') renderLobby(); else renderMe(); });
net.on('lobby', (m) => {
  S.lobby = m;
  if (m.me) S.me = m.me;
  renderMe();
  if (S.screen === 'lobby') renderLobby();
});
net.on('queue', (m) => {
  S.queue = m.state === 'searching' ? m : null;
  route();
});
net.on('room', (m) => {
  if (m.state === 'waiting') S.room = m;
  else {
    if (m.state === 'expired') toast('好友房已过期，请重新创建', 2400);
    S.room = null;
  }
  route();
});
net.on('error', (m) => toast(m.error || '出错了'));
net.on('kicked', (m) => {
  S.kicked = true;
  net.stop();
  renderNet();
  openDialog({
    kind: 'kicked', keep: true, sticky: true,
    title: '已在别处登录', tone: 'red',
    body: `<p>${esc(m.reason || '你的账号已在另一个窗口登录')}，这个页面已断开连接。</p>`,
    actions: [{ label: '在这里继续', cls: 'btn-primary', run: () => { S.kicked = false; net.connect(true); } }]
  });
});

net.on('match.found', (m) => {
  S.awaitResume = null;
  const same = S.match && S.match.id === m.match.id;
  if (same) {
    S.match = m.match;
    S.oppOnline = m.match.opp.online !== false;
    if (m.resume) S.skipVs = true;
  } else newMatch(m.match, !!m.resume);
  route();
});
net.on('match.state', (m) => {
  if (!S.match || !m.view || m.view.id !== S.match.id) return;
  const prev = S.view;
  S.view = m.view;
  if (m.view.phase === 'deploy') onDeployState(prev, m.view);
  else onBattleState(prev, m.view);
  route();
});
net.on('match.event', (m) => onEvent(m.ev || {}));
net.on('match.over', (m) => {
  if (!S.match) return;
  const first = !S.over;
  S.over = m;
  if (m.me) S.me = m.me;
  if (first) {
    const o = m.summary.outcome;
    setTimeout(() => Sound.play(o === 'win' ? 'victory' : o === 'lose' ? 'defeat' : 'draw'), 350);
  }
  renderMe();
  // 不重画棋盘，免得打断最后一步的动画
  if (S.showResult) route();
  else if (S.screen === 'battle') renderBattleSide();
  else route();
});

function newMatch(match, resume) {
  S.match = match;
  S.view = null;
  S.over = null;
  S.showResult = false;
  S.skipVs = resume;
  S.rematchSent = false;
  S.rematchFromOpp = false;
  S.oppLeft = false;
  S.oppOnline = match.opp.online !== false;
  S.queue = null;
  S.room = null;
  if (dialogOpen() && !DLG.keep) closeDialog();
  closeSheet();
  resetDeploy(match.id);
  resetBattle(match.id);
  if (!resume) Sound.play('found');
}

function leaveFinished(notify) {
  if (notify && S.match) net.send('match.leave');
  S.match = null;
  S.view = null;
  S.over = null;
  S.showResult = false;
  S.skipVs = false;
  S.rematchSent = false;
  S.rematchFromOpp = false;
  S.oppLeft = false;
  resetDeploy(null);
  resetBattle(null);
}

function goHome() {
  if (S.match && S.view && S.view.phase !== 'over') { resignDialog(); return; }
  leaveFinished(true);
  route();
  net.send('lobby.refresh');
}

let inviteHandled = false;
function handleInvite() {
  if (inviteHandled) return;
  inviteHandled = true;
  const code = new URLSearchParams(location.search).get('room');
  if (code === null) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch { /* ignore */ }
  if (!/^\d{4}$/.test(code)) { toast('邀请链接无效'); return; }
  setTimeout(async () => {
    if (S.match && !S.over) return;
    const r = await net.req('room.join', { code });
    if (!r.ok) toast(r.error, 2600);
  }, 200);
}

function onEvent(ev) {
  if (ev.type === 'combat') return onCombat(ev);
  if (ev.type === 'draw_offer') {
    if (ev.by === 'opp') drawOfferDialog();
    else toast('已向对方发起求和，等待回应…', 2000);
  } else if (ev.type === 'draw_declined') {
    if (ev.by === 'opp') toast('对方拒绝了和棋，对局继续', 2000);
  } else if (ev.type === 'opp_status') {
    S.oppOnline = !!ev.online;
    if (S.match && !S.over) toast(ev.online ? '对手已重新连接' : '对手掉线了，等待重连中（计时照常）', 2400);
    if (S.screen === 'battle') renderBattleSide();
    if (S.screen === 'deploy') renderDeployStatus();
  } else if (ev.type === 'rematch') {
    S.rematchFromOpp = true;
    S.oppLeft = false;
    toast('对方想再来一局！', 2000);
    if (S.screen === 'result') renderResultActions();
  } else if (ev.type === 'opp_left') {
    S.oppLeft = true;
    if (S.screen === 'result') { renderResultActions(); toast('对方已离开', 1600); }
  }
}

// ================= 路由 =================
const SCREENS = ['lobby', 'match', 'deploy', 'battle', 'result'];
function targetScreen() {
  if (!S.welcomed) return S.screen || 'lobby';
  if (S.match) {
    const v = S.view;
    if (S.showResult && S.over) return 'result';
    if (!v) return 'match';
    if (v.phase === 'deploy') return !S.skipVs && serverNow() < S.match.deployStart ? 'match' : 'deploy';
    return 'battle';
  }
  if (S.room || S.queue) return 'match';
  return 'lobby';
}
function route() {
  const t = targetScreen();
  if (t !== S.screen) show(t);
  else refresh();
}
function show(name) {
  if (!SCREENS.includes(name)) name = 'lobby';
  if (dialogOpen() && !DLG.keep) closeDialog();
  if (sheetOpen()) $('#logSheet').hidden = true;
  SCREENS.forEach((s) => { $('#scr-' + s).classList.toggle('on', s === name); });
  const prev = S.screen;
  S.screen = name;
  document.body.dataset.screen = name;
  const scr = $('#scr-' + name);
  scr.scrollTop = 0;
  refresh();
  if (name === 'lobby' && prev !== 'lobby') net.send('lobby.refresh');
  const h = scr.querySelector('h1, h2, .gh-title .t');
  if (h && document.activeElement && document.activeElement !== document.body && !scr.contains(document.activeElement) && !dialogOpen()) {
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }
}
function refresh() {
  switch (S.screen) {
    case 'lobby': renderLobby(); heroBoard.schedule(); break;
    case 'match': renderMatch(); break;
    case 'deploy': renderDeploy(); break;
    case 'battle': renderBattle(); break;
    case 'result': renderResult(); break;
    default: break;
  }
}

// ================= 连接状态 =================
function renderNet() {
  const bar = $('#netBar');
  const open = S.conn === 'open' && S.welcomed;
  if (S.kicked || open) bar.hidden = true;
  else {
    bar.hidden = false;
    const bad = S.conn === 'reconnecting' || S.conn === 'closed';
    bar.classList.toggle('bad', bad);
    $('#netText').textContent = bad ? '连接断开，正在重连…' : '正在连接服务器…';
  }
  const rtt = net.rtt;
  const note = open ? '已连接服务器' + (rtt != null ? ` · 延迟 ${rtt}ms` : '') : S.kicked ? '已在别处登录' : '正在连接服务器…';
  $('#lobbyNote').textContent = note;
  const p = $('#myPing');
  if (p) p.textContent = open ? (rtt != null ? rtt + 'ms' : '在线') : '离线';
  const myNet = $('#myNet');
  if (myNet) myNet.classList.toggle('off', !open);
}

// ================= 大厅 =================
const TIPS = [
  '司令阵亡后，他那一方的军旗位置会被亮出',
  '工兵在铁路上可以任意转弯，也是唯一能排除地雷的棋子',
  '行营里的棋子不会被攻击，是躲避炸弹的好地方',
  '炸弹碰到任何棋子都同归于尽，最适合对付对方的大子',
  '进入大本营的棋子就不能再移动了',
  '把地雷摆在军旗旁边，是最经典的守旗阵型',
  '点对方棋子可以贴上猜测标记，只有你自己看得见'
];

function renderMe() {
  const me = S.me;
  if (!me) return;
  const lk = looksOf(me.id || me.name);
  putAvatar($('#meAvatar'), lk.tone, lk.mood, 44);
  $('#meName').textContent = me.name;
  putBadge($('#meBadge'), me.tier, 18);
  $('#meTier').textContent = me.tierLabel;
}

function renderLobby() {
  renderMe();
  renderNet();
  const me = S.me;
  const lb = S.lobby;
  if (lb) {
    const line = `在线 ${num(lb.online)} 人 · ${num(lb.playing)} 桌对局中`;
    $('#onlineLine').textContent = line;
    $('#onlineMini').textContent = line;
  }
  if (!me) return;
  const t = R.tierOf(me.pts);
  putBadge($('#rankBadge'), t.tier, 120);
  $('#rankCn').textContent = R.TIERS[t.tier].n;
  $('#rankLv').textContent = t.sub;
  const prog = t.tier === 9 ? 100 : t.progress;
  $('#progNum').textContent = t.tier === 9 ? num(me.pts) : t.progress;
  const bar = $('#progBar');
  bar.setAttribute('aria-valuenow', String(prog));
  bar.querySelector('i').style.width = prog + '%';
  const rankGames = me.rank.w + me.rank.l + me.rank.d;
  let note;
  if (t.tier === 9) note = '已是最高军衔 · 全军司令';
  else if (!rankGames) note = '打一局排位赛，开始积累军功';
  else note = `再胜 ${Math.max(1, Math.ceil((t.next - me.pts) / R.WIN_PTS))} 局即可晋升 <b>${esc(t.nextLabel)}</b>`;
  $('#progNote').innerHTML = note;
  $('#stRate').textContent = rankGames ? Math.round((me.rank.w / rankGames) * 100) + '%' : '—';
  $('#stGames').textContent = num(me.stats.games + me.bot.games);
  $('#stPos').textContent = me.position ? '#' + num(me.position) : '—';
  $$('.streak-chip').forEach((c) => { c.hidden = !(me.streak >= 2); });
  $$('.streakN').forEach((c) => { c.textContent = me.streak; });
  renderLeaderboard();
  renderRecords();
  renderLadder(t);
}

function renderLeaderboard() {
  const me = S.me;
  const rows = (S.lobby && S.lobby.leaderboard) || [];
  const medal = ['#FFC83D', '#DCE4F0', '#F2B27A'];
  $('#lbRows').innerHTML = rows.length
    ? rows.map((e) => {
      const lk = looksOf(e.id || e.name);
      return `<div class="lb-row${me && e.id === me.id ? ' is-me' : ''}"><span class="lb-no num" style="background:${medal[e.pos - 1] || '#FFF6E3'}">${e.pos}</span><span class="av-slot">${avatarSVG(lk.tone, lk.mood, 32)}</span><span class="lb-name">${esc(e.name)}</span><span class="av-slot">${badgeSVG(e.tier, 22)}</span><span class="lb-pts">${num(e.pts)}</span></div>`;
    }).join('')
    : '<div class="empty">还没有人打过排位赛<br>第一名在等你</div>';
  if (me) {
    $('#lbMePos').textContent = me.position ? '#' + num(me.position) : '未上榜';
    $('#lbMeName').textContent = '我 · ' + me.name;
    putBadge($('#lbMeBadge'), me.tier, 22);
    $('#lbMePts').textContent = num(me.pts);
  }
}

const SHORT_REASON = {
  flag: { win: '夺旗', lose: '军旗被夺', draw: '' },
  nomoves: { win: '对方无子可走', lose: '无子可走', draw: '双方无子' },
  timeout: { win: '对方超时', lose: '超时判负', draw: '' },
  resign: { win: '对方认输', lose: '认输', draw: '' },
  leave: { win: '对方离开', lose: '中途离开', draw: '' },
  nocapture: { win: '', lose: '', draw: '久战和棋' },
  agreed: { win: '', lose: '', draw: '握手言和' }
};
function ago(ts) {
  const d = Math.max(0, Date.now() - ts) / 1000;
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
  if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
  return Math.floor(d / 86400) + ' 天前';
}
function renderRecords() {
  const rows = (S.lobby && S.lobby.history) || [];
  $('#recRows').innerHTML = rows.length
    ? rows.map((h) => {
      const o = h.outcome;
      const bg = o === 'win' ? 'var(--jade-d)' : o === 'lose' ? 'var(--red-d)' : '';
      const rs = (SHORT_REASON[h.reason] && SHORT_REASON[h.reason][o]) || '';
      const d = h.mode === 'rank'
        ? `<span class="rec-d num" style="color:${h.delta > 0 ? 'var(--jade-d)' : h.delta < 0 ? 'var(--red-d)' : 'var(--ink-2)'}">${h.delta > 0 ? '+' + h.delta : h.delta < 0 ? '−' + Math.abs(h.delta) : '±0'}</span>`
        : `<span class="rec-d plain">${MODE_NAME[h.mode] || ''}</span>`;
      return `<div class="rec-row"><span class="rec-res${o === 'draw' ? ' draw' : ''}"${bg ? ` style="background:${bg}"` : ''}>${o === 'win' ? '胜' : o === 'lose' ? '负' : '和'}</span><div class="rec-mid"><span class="n">${esc(h.opp)}${h.oppBot ? '' : ''}</span><span class="t">${ago(h.at)}${rs ? ' · ' + rs : ''} · ${h.moves} 手</span></div>${d}</div>`;
    }).join('')
    : '<div class="empty">还没有对局记录<br>来一局排位或人机练习吧</div>';
}

function renderLadder(t) {
  $('#ladderGrid').innerHTML = R.TIERS.map((x, i) => {
    const cur = i === t.tier;
    return `<div class="tier"><div class="bx">${cur ? '<span class="halo"></span>' : ''}<span class="b">${badgeSVG(i, cur ? 60 : 50)}</span>${cur ? '<span class="here">你在这里</span>' : ''}</div><span class="nm" style="color:${cur ? 'var(--red-d)' : i < t.tier ? 'var(--ink)' : 'var(--ink-2)'}">${x.n}</span></div>`;
  }).join('');
  const frac = t.tier + (t.tier < 9 ? t.progress / 100 : 0);
  $('#ladderFill').style.width = Math.min(90, Math.max(0, ((frac + 0.5) / 10) * 100 - 5)) + '%';
}

function setTab(tab) {
  const s = $('#scr-lobby');
  s.dataset.tab = tab;
  $$('.tabbar button').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  s.scrollTop = 0;
  if (tab === 'home') heroBoard.schedule();
}

async function joinQueue(mode) {
  if (S.match && S.over) leaveFinished(false);
  if (S.match) { toast('你还有一局没下完'); return; }
  // 先切到匹配画面，服务器的排队消息随后会覆盖这份本地状态
  S.room = null;
  S.queue = { state: 'searching', mode, since: serverNow() };
  route();
  const r = await net.req('queue.join', { mode });
  if (!r.ok) {
    if (!S.match) { S.queue = null; route(); }
    toast(r.error);
  }
}
async function startBot() {
  if (S.match && S.over) leaveFinished(false);
  const r = await net.req('bot.start');
  if (!r.ok) toast(r.error);
}

// ================= 匹配 / 好友房 / 对阵 =================
function rangeText(waited) {
  const pts = S.me ? S.me.pts : 0;
  const w = 200 + 40 * waited;
  const lo = R.tierOf(Math.max(0, pts - w)).label, hi = R.tierOf(pts + w).label;
  return lo === hi ? `匹配范围：${lo}` : `匹配范围：${lo} ～ ${hi}`;
}
function renderMatch() {
  const scr = $('#scr-match');
  const me = S.me;
  const lk = looksOf(me ? me.id : '');
  putAvatar($('#radarMe'), lk.tone, lk.mood, 'fill');
  if (S.match) {
    const was = scr.dataset.phase;
    scr.dataset.phase = 'found';
    $('#modeName').textContent = MODE_NAME[S.match.mode];
    $('#modeSub').textContent = S.match.mode === 'rank' ? '经典暗棋 · 系统裁判' : '经典暗棋 · 不计军功';
    $('#searchTitle').textContent = '匹配成功';
    $('#roomCard').hidden = true;
    $('#botSuggest').hidden = true;
    renderVs();
    tickMatch();
    if (was !== 'found') {
      const cta = $$('#scr-match [data-act="enter-deploy"]').find((b) => b.offsetParent !== null);
      if (cta && !dialogOpen()) cta.focus({ preventScroll: true });
    }
    return;
  }
  const room = S.room;
  scr.dataset.phase = room ? 'room' : 'searching';
  const mode = S.queue ? S.queue.mode : 'rank';
  $('#modeName').textContent = room ? '好友房' : MODE_NAME[mode];
  $('#modeSub').textContent = room ? '经典暗棋 · 不计军功' : mode === 'rank' ? '经典暗棋 · 系统裁判' : '经典暗棋 · 不计军功';
  $('#searchTitle').textContent = room ? '等待好友加入' : '正在寻找对手';
  $('#searchClock').setAttribute('aria-label', room ? '房间剩余有效时间' : '已等待时间');
  $('#roomCard').hidden = !room;
  if (room) $('#roomCode').textContent = room.code;
  $('#searchRange').textContent = room ? '好友输入房间号或打开邀请链接即可加入' : mode === 'casual' ? '休闲赛 · 不限军衔，先到先配' : rangeText(0);
  $('#cancelText').textContent = room ? '关闭房间' : '取消匹配';
  $('#botSuggest').hidden = true;
  tickMatch();
}
function vsStats(p, isMe) {
  if (p.isBot) return '<span class="g">电脑对手</span><span>只看得到自己的棋</span>';
  const games = p.games || 0;
  let s = `<span>胜率 <b>${games ? Math.round((p.w / games) * 100) + '%' : '—'}</b></span><span><b>${num(games)}</b> 场</span>`;
  if (p.streak >= 2) s += `<span class="y"><b>${p.streak}</b> 连胜</span>`;
  if (isMe && net.rtt != null) s += `<span class="g"><svg width="14" height="12" aria-hidden="true"><use href="#i-signal"></use></svg><b>${net.rtt}ms</b></span>`;
  else if (!isMe && !S.oppOnline) s += '<span>连接中…</span>';
  return s;
}
function renderVs() {
  const m = S.match;
  if (!m) return;
  const me = m.you, op = m.opp;
  $('#vsTitle').textContent = m.mode === 'friend' ? '好友房 · 对手已就位' : m.mode === 'bot' ? '人机练习 · 准备开战' : MODE_NAME[m.mode] + ' · 匹配成功';
  putAvatar($('#vsMeAv'), 'red', 'happy', 'fill');
  putAvatar($('#vsOppAv'), 'blue', op.isBot ? 'smile' : 'cool', 'fill');
  $('#vsMeName').textContent = me.name;
  $('#vsOppName').textContent = op.name;
  $('#vsMeTier').innerHTML = `<span class="av-slot">${badgeSVG(me.tier, 40)}</span>${esc(me.tierLabel)}`;
  $('#vsOppTier').innerHTML = `<span class="av-slot">${badgeSVG(op.tier, 40)}</span>${esc(op.tierLabel)}`;
  $('#vsMeStats').innerHTML = vsStats(me, true);
  $('#vsOppStats').innerHTML = vsStats(op, false);
  $$('.stakes-chip').forEach((c) => { c.hidden = m.mode !== 'rank'; });
  $$('#scr-match .rule-deploy').forEach((c) => { c.textContent = `布阵 ${Math.round(S.timing.deployMs / 1000)} 秒`; });
  $$('#scr-match .rule-turn').forEach((c) => { c.textContent = `每步 ${Math.round(S.timing.turnMs / 1000)} 秒`; });
  putAvatar($('#sheetMeAv'), 'red', 'happy', 44);
  putAvatar($('#sheetOppAv'), 'blue', op.isBot ? 'smile' : 'cool', 44);
  $('#sheetOppName').textContent = op.name;
  $('#sheetOppTier').innerHTML = `<span class="av-slot">${badgeSVG(op.tier, 16)}</span>${esc(op.tierLabel)}${op.isBot ? ' · 人机' : ''}`;
  $('#vsConn').textContent = op.isBot ? '电脑对手已就位，房间已锁定' : S.oppOnline ? '双方均已连接，房间已锁定' : '对手连接中…';
}
function tickMatch() {
  const now = serverNow();
  if (S.match) {
    const s = Math.max(0, Math.ceil((S.match.deployStart - now) / 1000));
    $('#vsCount').textContent = s;
    $('#sheetCount').textContent = s;
    return;
  }
  if (S.room) {
    $('#searchClock').textContent = fmt((S.room.expiresAt - now) / 1000);
  } else if (S.queue) {
    const waited = Math.max(0, (now - S.queue.since) / 1000);
    $('#searchClock').textContent = fmt(waited);
    $('#botSuggest').hidden = waited < 20;
    if (S.queue.mode === 'rank') $('#searchRange').textContent = rangeText(waited);
  }
  if (Date.now() - S.tipAt > 6000) {
    S.tipAt = Date.now();
    S.tipIdx = (S.tipIdx + 1) % TIPS.length;
    $('#tipText').textContent = TIPS[S.tipIdx];
  }
}
async function cancelWait() {
  if (S.room) {
    const r = await net.req('room.leave');
    if (!r.ok) { S.room = null; route(); }
  } else if (S.queue) {
    const r = await net.req('queue.leave');
    if (!r.ok) { S.queue = null; route(); }
  } else route();
}
async function copyInvite() {
  if (!S.room) return;
  const url = location.origin + location.pathname + '?room=' + S.room.code;
  const text = `来萌兵军棋和我下一盘！房间号 ${S.room.code}，打开链接直接加入：${url}`;
  try {
    await navigator.clipboard.writeText(text);
    toast('邀请已复制，发给好友吧', 1800);
  } catch {
    openDialog({
      title: '邀请好友', tone: 'blue',
      body: `<p>复制下面的链接发给好友：</p><div class="field"><input id="inviteInput" readonly value="${esc(url)}"></div>`,
      actions: [{ label: '好的', cls: 'btn-primary' }],
      bind(body) { const i = $('#inviteInput', body); setTimeout(() => { i.focus(); i.select(); }, 30); }
    });
  }
}

// ================= 布阵 =================
const DP = { mid: null, lay: null, sel: null, formation: 'default', ready: false, draftT: 0 };
const savedLayout = () => { const s = store.json('mbjq-layout', null); return s && R.validateLayout(s).ok ? s : null; };
const FORM_UI = () => [...R.FORMS, { id: 'mine', name: '我的阵型', short: '我的', tag: savedLayout() ? '自定义 · 已保存' : '还没有保存', lay: savedLayout() }];

function resetDeploy(mid) {
  DP.mid = mid;
  DP.lay = null;
  DP.sel = null;
  DP.ready = false;
  DP.formation = 'default';
  clearTimeout(DP.draftT);
}
function onDeployState(prev, v) {
  if (!DP.lay) {
    if (v.myLayout && R.validateLayout(v.myLayout).ok) { DP.lay = { ...v.myLayout }; DP.formation = 'custom'; }
    else {
      const s = savedLayout();
      if (s) { DP.lay = { ...s }; DP.formation = 'mine'; } else { DP.lay = R.defaultLayout(); DP.formation = 'default'; }
    }
    sendDraft(0);
  }
  if (v.ready.me && !DP.ready) { DP.ready = true; DP.sel = null; }
  if (prev && prev.phase === 'deploy' && !prev.ready.opp && v.ready.opp && !v.ready.me) toast('对手已布阵完毕，抓紧时间！', 2000);
}
function sendDraft(delay = 600) {
  clearTimeout(DP.draftT);
  DP.draftT = setTimeout(() => { if (!DP.ready && DP.lay) net.send('deploy.draft', { layout: DP.lay }); }, delay);
}
function miniCells(lay) {
  let out = '';
  for (let r = 1; r <= 6; r++) {
    for (let c = 1; c <= 5; c++) {
      const id = 'm' + r + c;
      if (R.typeOf(id) === 'camp') { out += '<i class="camp"></i>'; continue; }
      const k = lay ? lay[id] : null;
      const bg = k === 'jq' ? '#FFC83D' : k === 'dl' ? '#2A1D3D' : k === 'zd' ? '#E8453A' : (k === 'sl' || k === 'jz' || k === 'shz') ? '#FF9F2E' : k === 'gb' ? '#22B893' : '#FFF6E3';
      out += `<i style="background:${bg}"></i>`;
    }
  }
  return out;
}
const DTIPS = { jq: '军旗只能放在两个大本营之一', dl: '地雷只能放在最后两排', zd: '炸弹不能放在第一排', any: '除行营外，任何位置都可以放' };

function renderDeploySide() {
  const forms = FORM_UI();
  $('#formsGrid').innerHTML = forms.map((f) => `<button type="button" class="form-card" data-form="${f.id}" aria-pressed="${DP.formation === f.id}"${!f.lay || DP.ready ? ' disabled' : ''}><span class="mini" aria-hidden="true">${miniCells(f.lay)}</span><span class="nm">${f.name}</span><span class="tg">${f.tag}</span></button>`).join('');
  $('#dpChips').innerHTML = forms.map((f) => `<button type="button" data-form="${f.id}" aria-pressed="${DP.formation === f.id}" aria-label="${f.name}"${!f.lay || DP.ready ? ' disabled' : ''}>${f.short}</button>`).join('') +
    `<button type="button" data-form="random" aria-pressed="${DP.formation === 'random'}" aria-label="随机布阵"${DP.ready ? ' disabled' : ''}>随机</button>`;
  $$('#scr-deploy [data-act="random"], #scr-deploy [data-act="save"]').forEach((b) => { b.disabled = DP.ready; });
  const k = DP.sel && DP.lay ? DP.lay[DP.sel] : null;
  const swaps = k ? R.IDS.filter((b) => R.canSwap(DP.lay, DP.sel, b)).length : 0;
  const tip = k ? (DTIPS[k] || DTIPS.any) : '';
  let wide, narrow;
  if (DP.ready) {
    wide = '<div class="sel-empty"><svg width="40" height="40" aria-hidden="true"><use href="#i-okcircle"></use></svg><span>布阵已提交，对手看不到你的阵型。等对手就绪后自动开战。</span></div>';
    narrow = '<div class="sel-empty" style="min-height:58px;font-size:13px"><svg width="34" height="34" aria-hidden="true"><use href="#i-okcircle"></use></svg><span>布阵已提交，等对手就绪后自动开战</span></div>';
  } else if (k) {
    wide = `<div class="sel-row"><span class="big">${pieceBox(k, 'red', 'front', 'selected', '', 1.2)}</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="nm">${R.NAMES[k]}</span><span class="chip c-yellow" style="align-self:flex-start;height:24px;font-size:12px">可互换 <b class="num">${swaps}</b> 处</span></div></div><div class="sel-tip">${tip}。亮起的棋子可与它互换，变暗的位置不合规则。</div>`;
    narrow = `<div class="sel-row"><span class="big">${pieceBox(k, 'red', 'front', 'normal', '', 0.9)}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><div style="display:flex;align-items:center;gap:8px"><span class="nm">${R.NAMES[k]}</span><span class="chip c-yellow" style="height:22px;font-size:11px">可互换 ${swaps} 处</span></div><span class="sel-tip">${tip}</span></div></div>`;
  } else {
    wide = '<div class="sel-empty"><svg width="40" height="40" aria-hidden="true"><use href="#i-pointer"></use></svg><span>点一枚棋子，再点亮起的另一枚，两者就会互换位置</span></div>';
    narrow = '<div class="sel-empty" style="min-height:58px;font-size:13px"><svg width="34" height="34" aria-hidden="true"><use href="#i-pointer"></use></svg><span>点一枚棋子，再点亮起的另一枚即可互换；地雷、炸弹、军旗有位置限制</span></div>';
  }
  $('#dpSel').innerHTML = '<span class="ribbon">' + (DP.ready ? '已就绪' : '当前选中') + '</span>' + wide;
  $('#dpSelNarrow').innerHTML = narrow;
  const saved = savedLayout();
  const same = saved && DP.lay && Object.keys(saved).every((id) => saved[id] === DP.lay[id]);
  $$('.save-btn').forEach((b) => { b.setAttribute('aria-pressed', String(!!same)); b.querySelector('span').textContent = same ? '已保存' : '保存阵型'; });
}
function renderDeployStatus() {
  const v = S.view, m = S.match;
  if (!v || !m) return;
  $('#scr-deploy').dataset.ready = String(DP.ready);
  $('#dpSub').textContent = `${MODE_NAME[m.mode]} · 经典暗棋 · 对手看不到你的阵型`;
  $('#dpSubNarrow').textContent = DP.ready ? '已就绪，等待对手…' : '点两枚棋子互换位置';
  putAvatar($('#dpOppAv'), 'blue', m.opp.isBot ? 'smile' : 'cool', 40);
  $('#dpOppName').textContent = m.opp.name;
  $('#dpOppStatus').innerHTML = v.ready.opp ? '<span class="ok">已就绪 ✓</span>' : !S.oppOnline ? '掉线中，等待重连' : '布阵中<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  $$('.deploy-done span').forEach((s) => { s.textContent = DP.ready ? (v.ready.opp ? '马上开战' : '已就绪') : '布阵完成'; });
  $$('.deploy-done').forEach((b) => b.setAttribute('aria-disabled', String(DP.ready)));
  $('#dpHint').textContent = DP.ready ? (v.ready.opp ? '双方就绪，马上开战' : '等待对手布阵…') : v.ready.opp ? '对手已就绪，布好就能开战' : '双方都就绪后自动开战';
}
function renderDeploy() {
  if (!DP.lay) return;
  renderDeployStatus();
  deployBoard.render();
  renderDeploySide();
  tickDeploy();
}
function tickDeploy() {
  const v = S.view;
  if (!v || v.phase !== 'deploy') return;
  const left = (v.deployDeadline - serverNow()) / 1000;
  $('#deployClock').textContent = fmt(left);
}
function setFormation(id) {
  if (DP.ready) return;
  if (id === 'random') { DP.lay = R.randomLayout(); DP.formation = 'random'; toast('已随机生成一套合规阵型', 1400); }
  else if (id === 'mine') {
    const s = savedLayout();
    if (!s) { toast('还没有保存过阵型'); return; }
    DP.lay = { ...s };
    DP.formation = 'mine';
  } else {
    const f = R.FORMS.find((x) => x.id === id);
    if (!f) return;
    DP.lay = { ...f.lay };
    DP.formation = id;
  }
  DP.sel = null;
  deployBoard.render();
  renderDeploySide();
  sendDraft();
}
function deployClick(id) {
  if (DP.ready) return;
  const lay = DP.lay;
  if (!lay || !lay[id]) return;
  if (DP.sel && DP.sel !== id && R.canSwap(lay, DP.sel, id)) {
    const a = DP.sel, t = lay[a];
    lay[a] = lay[id];
    lay[id] = t;
    DP.sel = null;
    DP.formation = 'custom';
    Sound.play('move');
    toast('已交换：' + R.NAMES[lay[id]] + ' 与 ' + R.NAMES[lay[a]], 1300);
    sendDraft();
  } else {
    DP.sel = DP.sel === id ? null : id;
    if (DP.sel) Sound.play('select');
  }
  deployBoard.focusNext = { act: 'piece', id };
  deployBoard.render();
  renderDeploySide();
}
function saveFormation() {
  if (!DP.lay) return;
  store.set('mbjq-layout', JSON.stringify(DP.lay));
  DP.formation = 'mine';
  renderDeploySide();
  toast('已保存为「我的阵型」，下局自动使用', 1800);
}
async function submitDeploy() {
  if (DP.ready || !DP.lay) return;
  const chk = R.validateLayout(DP.lay);
  if (!chk.ok) { toast(chk.error); return; }
  clearTimeout(DP.draftT);
  const btns = $$('.deploy-done');
  btns.forEach((b) => { b.disabled = true; });
  const r = await net.req('deploy.submit', { layout: DP.lay });
  btns.forEach((b) => { b.disabled = false; });
  if (!r.ok) { toast(r.error); return; }
  DP.ready = true;
  DP.sel = null;
  Sound.play('select');
  if (S.screen === 'deploy') renderDeploy();
}

// ================= 对战 =================
const BT = { mid: null, sel: null, pop: null, marks: {}, duelT: 0, pending: false, review: false, anim: null, lastTick: -1 };
const CH = { win: ['胜', 'c-jade'], lose: ['阵亡', 'c-red'], repel: ['击退', 'c-jade'], both: ['同归', 'c-violet'], flag: ['夺旗', 'c-yellow'], warn: ['注意', 'c-yellow'] };
const CH_SYS = { win: ['胜利', 'c-jade'], lose: ['失败', 'c-red'], both: ['和棋', 'c-violet'], warn: ['注意', 'c-yellow'] };
const PIECE_TIPS = { gb: '铁路上可任意转弯，还能排除地雷', zd: '与任何棋子相碰都会同归于尽', sl: '全场最大；阵亡后我方军旗会被亮出', dl: '地雷不能移动', jq: '军旗不能移动，被夺即判负', any: '铁路上只能直行，公路每次走一格' };

function resetBattle(mid) {
  BT.mid = mid;
  BT.sel = null;
  BT.pop = null;
  clearTimeout(BT.duelT);
  hideDuel();
  BT.pending = false;
  BT.review = false;
  BT.anim = null;
  BT.lastTick = -1;
  BT.marks = {};
  if (mid) { try { BT.marks = JSON.parse(session.get('mbjq-marks-' + mid) || '{}') || {}; } catch { BT.marks = {}; } }
}
function saveMarks() { if (BT.mid) session.set('mbjq-marks-' + BT.mid, JSON.stringify(BT.marks)); }
function occOf(v) {
  const occ = {};
  for (const p of (v && v.pieces) || []) occ[p.at] = { s: p.side, k: p.k, pid: p.pid };
  return occ;
}
const myTurn = () => !!S.view && S.view.phase === 'battle' && S.view.turn === 'me';

function onBattleState(prev, v) {
  const occ = occOf(v);
  if (BT.sel && (!occ[BT.sel] || occ[BT.sel].s !== 'm')) BT.sel = null;
  if (BT.pop && (!occ[BT.pop] || occ[BT.pop].s !== 'o')) BT.pop = null;
  if (!prev || prev.phase === 'deploy') {
    BT.sel = null;
    if (v.phase === 'battle' && v.moveNo === 0) {
      const auto = prev && prev.phase === 'deploy' && !DP.ready;
      toast((auto ? '布阵时间到，已按当前阵型开战 · ' : '') + (v.turn === 'me' ? '对局开始，你先走！' : '对局开始，对方先走'), auto ? 2600 : 1800);
      if (v.turn === 'me') Sound.play('turn');
    }
  } else {
    if (v.moveNo !== prev.moveNo || v.phase !== 'battle') BT.pending = false;
    if (v.moveNo > prev.moveNo && v.last) {
      const p = occ[v.last.to];
      if (p && p.s === v.last.side) BT.anim = { pid: p.pid, path: v.last.path };
      if (!prev.pieces || !prev.pieces.some((q) => q.at === v.last.to)) Sound.play(v.last.side === 'm' ? 'move' : 'oppmove');
    }
    if (v.phase === 'battle' && v.turn === 'me' && prev.turn !== 'me') setTimeout(() => Sound.play('turn'), 300);
    const flagNow = v.pieces.some((p) => p.side === 'o' && p.k === 'jq');
    const flagBefore = (prev.pieces || []).some((p) => p.side === 'o' && p.k === 'jq');
    if (v.phase === 'battle' && flagNow && !flagBefore) toast('对方司令阵亡，军旗现形！', 2600);
    if (v.phase === 'battle' && v.lost.me.includes('sl') && !(prev.lost && prev.lost.me.includes('sl'))) toast('我方司令阵亡，军旗位置暴露了！', 2600);
    if (prev.timeouts && v.timeouts.me > prev.timeouts.me && v.phase === 'battle') toast(`你超时了（${v.timeouts.me}/${v.maxTimeouts}），满 ${v.maxTimeouts} 次判负`, 2600);
    if (prev.timeouts && v.timeouts.opp > prev.timeouts.opp && v.phase === 'battle') toast(`对方超时（${v.timeouts.opp}/${v.maxTimeouts}）`, 1800);
  }
  if (v.phase === 'over') {
    BT.sel = null;
    BT.pop = null;
    BT.pending = false;
    if (!(v.pieces || []).length) S.showResult = true;
  }
  if (DLG.kind === 'draw' && v.drawOffer !== 'opp') closeDialog();
  // 对方的求和还在等回应（例如刷新页面后）：补弹对话框
  if (v.phase === 'battle' && v.drawOffer === 'opp' && (!prev || prev.drawOffer !== 'opp') && DLG.kind !== 'draw') drawOfferDialog();
  if (DLG.kind === 'resign' && v.phase === 'over') closeDialog();
  const alive = new Set((v.pieces || []).map((p) => p.pid));
  let changed = false;
  for (const pid of Object.keys(BT.marks)) if (!alive.has(pid)) { delete BT.marks[pid]; changed = true; }
  if (changed) saveMarks();
}

function onCombat(ev) {
  const my = ev.my;
  const N = R.NAMES[my] || '棋子';
  let duel = null;
  const red = (k) => ({ k, side: 'red' });
  const blue = { k: null, side: 'blue' };
  if (ev.role === 'attacker') {
    if (ev.res === 'win') { duel = { left: red(my), right: blue, title: '胜！', color: '#0F8A6A', sub: `${N}击败了一枚对方棋子` }; Sound.play('win'); }
    else if (ev.res === 'lose') { duel = { left: red(my), right: blue, title: '败…', color: '#C8352B', sub: `我方${N}阵亡` }; Sound.play('lose'); }
    else if (ev.res === 'both') { duel = { left: red(my), right: blue, title: '同归于尽', color: '#7A3FE0', sub: `我方${N}与对方棋子一同阵亡` }; Sound.play('both'); }
  } else if (ev.role === 'defender') {
    if (ev.res === 'lose') { duel = { left: blue, right: red(my), title: '失守', color: '#C8352B', sub: `我方${N}被对方吃掉了` }; Sound.play('lose'); }
    else if (ev.res === 'repel') { duel = { left: blue, right: red(my), title: '击退！', color: '#0F8A6A', sub: `我方${N}守住了阵地` }; Sound.play('win'); }
    else if (ev.res === 'both') { duel = { left: blue, right: red(my), title: '同归于尽', color: '#7A3FE0', sub: `我方${N}与来犯棋子一同阵亡` }; Sound.play('both'); }
  }
  if (!duel) return;
  // 结果显示在棋盘外的提示条里，不遮挡棋盘
  const bar = $('#duelBar');
  const side = (x) => `<span class="pcm">${pieceBox(x.k, x.side, x.k ? 'front' : 'back', 'normal', '', 0.55)}</span>`;
  bar.innerHTML = `<span class="pcs" aria-hidden="true">${side(duel.left)}<span class="vs">VS</span>${side(duel.right)}</span><span class="t" style="color:${duel.color}">${esc(duel.title)}</span><span class="s">${esc(duel.sub)}</span>`;
  bar.hidden = false;
  clearTimeout(BT.duelT);
  BT.duelT = setTimeout(hideDuel, 1900);
}
function hideDuel() {
  const bar = $('#duelBar');
  if (bar) { bar.hidden = true; bar.innerHTML = ''; }
}

function battleView() {
  const v = S.view;
  if (!v || !v.pieces) return null;
  const occ = occOf(v);
  const lg = BT.sel && occ[BT.sel] && occ[BT.sel].s === 'm' ? R.legal(occ, BT.sel) : null;
  const marks = {};
  for (const p of v.pieces) if (p.side === 'o' && BT.marks[p.pid]) marks[p.at] = BT.marks[p.pid];
  let over = null;
  if (v.phase === 'over' && !BT.review && v.result) {
    const o = v.result.outcome, r = v.result.reason;
    over = { tone: o, title: o === 'win' ? (r === 'flag' ? '夺得军旗！' : '胜利！') : o === 'lose' ? (r === 'flag' ? '军旗失守' : '惜败') : '和棋', text: R.reasonText(r, o) };
  }
  return {
    occ, sel: BT.sel, lg, trail: SET.hints && v.phase === 'battle', hints: SET.hints, last: v.last, marks, pop: BT.pop, over,
    interactive: myTurn() && !BT.pending, locked: v.phase === 'over', pending: BT.pending
  };
}
function battleAct(act, id, val) {
  if (act === 'piece') clickPiece(id);
  else if (act === 'move') moveTo(id);
  else if (act === 'mark') setMark(val || '');
  else if (act === 'close-pop') { const id0 = BT.pop; BT.pop = null; battleBoard.focusNext = { act: 'piece', id: id0 }; battleBoard.render(); }
  else if (act === 'result') { S.showResult = true; route(); }
  else if (act === 'review') { BT.review = true; renderBattle(); toast('点「查看战绩」进入结算', 2000); }
}
function clickPiece(id) {
  const v = S.view;
  if (!v || v.phase !== 'battle') return;
  const occ = occOf(v);
  const p = occ[id];
  if (!p) return;
  if (p.s === 'm') {
    BT.sel = BT.sel === id ? null : id;
    BT.pop = null;
    if (BT.sel) Sound.play('select');
    battleBoard.focusNext = { act: 'piece', id };
    battleBoard.render();
    renderSel();
    return;
  }
  if (BT.sel && myTurn() && !BT.pending) {
    const lg = R.legal(occ, BT.sel);
    if (lg.attacks.includes(id)) { doMove(BT.sel, id); return; }
  }
  BT.pop = BT.pop === id ? null : id;
  BT.sel = null;
  battleBoard.focusNext = BT.pop ? { act: 'mark', v: BT.marks[p.pid] || MARKS[0] } : { act: 'piece', id };
  battleBoard.render();
  renderSel();
}
function moveTo(id) {
  if (!BT.sel || !myTurn() || BT.pending) return;
  const lg = R.legal(occOf(S.view), BT.sel);
  if (!lg.moves.includes(id) && !lg.attacks.includes(id)) return;
  doMove(BT.sel, id);
}
async function doMove(from, to) {
  BT.pending = true;
  BT.sel = null;
  BT.pop = null;
  battleBoard.render();
  renderSel();
  const r = await net.req('move', { from, to });
  if (BT.pending) {
    BT.pending = false;
    if (!r.ok) toast(r.error || '走子失败');
    if (S.screen === 'battle') renderBattle();
  } else if (!r.ok) toast(r.error || '走子失败');
}
function setMark(m) {
  const id = BT.pop;
  if (!id) return;
  const p = occOf(S.view)[id];
  if (p && p.pid) {
    if (m) BT.marks[p.pid] = m; else delete BT.marks[p.pid];
    saveMarks();
  }
  BT.pop = null;
  battleBoard.focusNext = { act: 'piece', id };
  battleBoard.render();
}
async function offerDraw() {
  const v = S.view;
  if (!v || v.phase !== 'battle') return;
  if (v.drawOffer === 'me') { toast('已经发起求和，等待对方回应'); return; }
  if (v.drawOffer === 'opp') { drawOfferDialog(); return; }
  if (!v.canOfferDraw) { toast(v.drawOffer ? '对方正在求和，请先回应' : `每 ${S.timing.drawGap} 手只能求和一次`); return; }
  const r = await net.req('draw.offer');
  if (!r.ok) toast(r.error);
}

function renderBattle() {
  if (!S.view || !S.view.pieces) return;
  battleBoard.render();
  if (BT.anim) { battleBoard.animatePath(BT.anim.pid, BT.anim.path); BT.anim = null; }
  renderBattleSide();
}
function renderSel() {
  const v = S.view;
  if (!v) return;
  const occ = occOf(v);
  const sel = BT.sel && occ[BT.sel] ? occ[BT.sel] : null;
  const lg = sel ? R.legal(occ, BT.sel) : null;
  $('#btSel').innerHTML = '<span class="ribbon">当前选中</span>' + (sel
    ? `<div class="sel-row"><span class="big">${pieceBox(sel.k, 'red', 'front', 'normal', '', 1.2)}</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="nm">${R.NAMES[sel.k]}</span><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip c-yellow" style="height:24px;font-size:12px">可走 <b class="num">${lg.moves.length}</b></span><span class="chip c-red" style="height:24px;font-size:12px">可攻 <b class="num">${lg.attacks.length}</b></span></div></div></div><div class="sel-tip">${PIECE_TIPS[sel.k] || PIECE_TIPS.any}${myTurn() ? '' : '（对方回合，只能看不能走）'}</div>`
    : `<div class="sel-empty"><svg width="40" height="40" aria-hidden="true"><use href="#i-pointer"></use></svg><span>${v.phase === 'over' ? '对局已结束，所有棋子已亮明' : '点一枚我方棋子，查看它能走到哪里'}</span></div>`);
  const sub = $('#meSub');
  if (sel) { sub.textContent = '已选 ' + R.NAMES[sel.k] + ' · 可走 ' + lg.moves.length + ' · 可攻 ' + lg.attacks.length; sub.classList.add('hot'); }
  else { sub.textContent = `${S.match ? S.match.you.tierLabel : ''} · 损失 ${v.lost.me.length} 子 · 超时 ${v.timeouts.me}/${v.maxTimeouts}`; sub.classList.remove('hot'); }
}
function renderBattleSide() {
  const v = S.view, m = S.match;
  if (!v || !m || !v.pieces) return;
  const scr = $('#scr-battle');
  const turn = v.phase === 'over' ? 'over' : v.turn === 'me' ? 'me' : 'opp';
  scr.dataset.turn = turn;
  $('#battleTitle').textContent = `${MODE_NAME[m.mode]} · 经典暗棋`;
  $$('.moveNo').forEach((e) => { e.textContent = v.moveNo; });
  const res = v.result;
  const overText = res ? (res.outcome === 'win' ? '胜利' : res.outcome === 'lose' ? '惜败' : '和棋') : '';
  const tb = $('#turnBanner');
  tb.disabled = turn !== 'over';
  $('#turnText').textContent = turn === 'over' ? overText + ' · 查看战绩 →' : turn === 'me' ? (BT.pending ? '裁判判定中…' : '轮到你走棋') : '对方思考中…';
  const mc = $('#meChip');
  mc.disabled = turn !== 'over';
  $('#meChipTx').textContent = turn === 'over' ? '查看战绩' : turn === 'me' ? '你的回合' : '对方回合';
  // 对手
  const op = m.opp;
  const oppMood = op.isBot ? 'smile' : 'cool';
  putAvatar($('#oppAv'), 'blue', oppMood, 64);
  putAvatar($('#osAv'), 'blue', oppMood, 38);
  $('#oppName').textContent = op.name;
  $('#osName').textContent = op.name;
  putBadge($('#oppBadge'), op.tier, 20);
  putBadge($('#osBadge'), op.tier, 14);
  $('#oppTier').textContent = op.tierLabel;
  $('#osTier').textContent = op.tierLabel;
  const on = op.isBot || S.oppOnline;
  const net1 = $('#oppNet');
  net1.classList.toggle('off', !on);
  net1.innerHTML = `<svg width="14" height="12" aria-hidden="true"><use href="#i-signal"></use></svg>${op.isBot ? '人机' : on ? '在线' : '掉线中'}`;
  const oppState = $('#oppState'), os = $('#osChip');
  const stTxt = turn === 'over' ? '已结束' : !on ? '掉线' : turn === 'opp' ? '思考中' : '等待中';
  for (const c of [oppState, os]) {
    c.textContent = stTxt;
    c.className = 'chip' + (turn === 'opp' && on ? ' c-blue' : !on && turn !== 'over' ? ' off' : '');
  }
  $('#oppCard').classList.toggle('active', turn === 'opp');
  $('#oppTimeouts').textContent = `${v.timeouts.opp}/${v.maxTimeouts}`;
  // 我方
  putAvatar($('#myAv'), 'red', 'smile', 64);
  putAvatar($('#meAvS'), 'red', 'smile', 40);
  $('#myName').textContent = m.you.name;
  $('#meNameS').textContent = m.you.name;
  putBadge($('#myBadge'), m.you.tier, 20);
  $('#myTier').textContent = m.you.tierLabel;
  const myState = $('#myState');
  myState.textContent = turn === 'over' ? '已结束' : turn === 'me' ? '思考中' : '等待中';
  myState.className = 'chip' + (turn === 'me' ? ' c-yellow' : '');
  $('#myCard').classList.toggle('active', turn === 'me');
  $$('#scr-battle .timeouts').forEach((e) => { e.textContent = `${v.timeouts.me}/${v.maxTimeouts}`; });
  // 阵亡与在场
  $('#casMine').innerHTML = v.lost.me.length ? v.lost.me.map((k) => `<span class="mini-pc">${pieceBox(k, 'red', 'front', 'dim', '', 0.8)}</span>`).join('') : '<span class="none">暂无</span>';
  $('#casFoe').innerHTML = v.lost.opp ? Array.from({ length: v.lost.opp }, () => `<span class="mini-pc">${pieceBox(null, 'blue', 'back', 'dim', '', 0.8)}</span>`).join('') : '<span class="none">暂无</span>';
  $('#myLostN').textContent = v.lost.me.length;
  $$('.foeLost').forEach((e) => { e.textContent = v.lost.opp; });
  let my = 0, foe = 0;
  for (const p of v.pieces) { if (p.side === 'm') my++; else foe++; }
  $('#myAlive').textContent = my;
  $('#foeAlive').textContent = foe;
  // 按钮
  const canDraw = v.phase === 'battle' && v.canOfferDraw;
  $$('#scr-battle .draw-btn').forEach((b) => { b.setAttribute('aria-disabled', String(!canDraw)); });
  $$('#scr-battle [data-act="resign"]').forEach((b) => { b.disabled = v.phase !== 'battle'; });
  if (v.phase !== 'battle') {
    $('#mySecs').textContent = '—';
    $('#oppSecs').textContent = '—';
    $('#osSec').textContent = '';
  }
  renderSel();
  renderLog();
  renderNet();
  tickBattle();
}
function renderLog() {
  const v = S.view;
  const log = (v && v.log) || [];
  const html = log.length ? log.map((e) => {
    const c = e.side === 'sys' ? CH_SYS[e.res] : CH[e.res];
    const dot = e.side === 'me' ? '#E8453A' : e.side === 'opp' ? '#3355E8' : '#FFC83D';
    return `<li class="log-item"><span class="no">${e.n ? '#' + e.n : '·'}</span><span class="dot" style="background:${dot}"></span><span class="tx">${esc(e.text)}</span>${c ? `<span class="chip ${c[1]}">${c[0]}</span>` : ''}</li>`;
  }).join('') : '<li class="empty">对局开始后，这里会记录每一步</li>';
  $('#logList').innerHTML = html;
  $('#logListSheet').innerHTML = html;
  const e0 = log[0];
  if (e0) {
    $('#toastNo').textContent = e0.n ? '#' + e0.n : '·';
    $('#toastNo').style.background = e0.side === 'me' ? '#E8453A' : e0.side === 'opp' ? '#3355E8' : '#8A6A00';
    $('#toastTx').textContent = e0.text;
  }
}
function tickBattle() {
  const v = S.view;
  if (!v || v.phase !== 'battle') return;
  const left = Math.max(0, (v.turnDeadline - serverNow()) / 1000);
  const secs = Math.ceil(left);
  const turnMs = v.turnMs || S.timing.turnMs;
  $$('#scr-battle .secs').forEach((e) => { e.textContent = secs; });
  $$('#scr-battle .ring-timer').forEach((r) => {
    r.classList.toggle('warn', secs <= 10);
    const arc = r.querySelector('.arc');
    if (arc) arc.setAttribute('stroke-dasharray', (88 * Math.min(1, (left * 1000) / turnMs)).toFixed(1) + ' 88');
  });
  $('#mySecs').textContent = v.turn === 'me' ? secs + 's' : '—';
  $('#oppSecs').textContent = v.turn === 'opp' ? secs + 's' : '—';
  $('#osSec').textContent = v.turn === 'opp' ? secs + 's' : '';
  if (v.turn === 'me' && secs <= 5 && secs > 0 && secs !== BT.lastTick) { BT.lastTick = secs; Sound.play('tick'); }
}

// ================= 结算 =================
const STAMP = {
  flag: { win: ['夺旗', '成功'], lose: ['军旗', '被夺'] },
  nomoves: { win: ['对方', '无子'], lose: ['无子', '可走'], draw: ['双方', '无子'] },
  timeout: { win: ['对方', '超时'], lose: ['超时', '判负'] },
  resign: { win: ['对方', '认输'], lose: ['主动', '认输'] },
  leave: { win: ['对方', '离开'], lose: ['中途', '离开'] },
  nocapture: { draw: ['久战', '和棋'] },
  agreed: { draw: ['握手', '言和'] },
  abort: { draw: ['对局', '作废'] }
};
function renderResult() {
  const o = S.over, m = S.match;
  if (!o || !m) return;
  const sum = o.summary;
  const out = sum.outcome;
  $('#scr-result').dataset.mode = out;
  $('#resTitle').textContent = out === 'win' ? '胜利' : out === 'lose' ? '失败' : '和棋';
  const st = (STAMP[sum.reason] && STAMP[sum.reason][out]) || (out === 'win' ? ['大获', '全胜'] : out === 'lose' ? ['下局', '再战'] : ['旗鼓', '相当']);
  $('#resStamp').innerHTML = '<span>' + st[0] + '</span><span>' + st[1] + '</span>';
  $('#resSub').textContent = `${sum.text} · ${MODE_NAME[m.mode]} · 共 ${sum.moves} 手`;
  const p = o.points;
  const me = o.me || S.me;
  const burst = (color) => `<svg class="burst" viewBox="0 0 150 150" aria-hidden="true" style="color:${color}"><use href="#i-burst"></use></svg>`;
  const arrow = '<svg width="64" height="36" viewBox="0 0 64 36" aria-hidden="true"><path d="M4 18h40" stroke="#2A1D3D" stroke-width="10" stroke-linecap="round"></path><path d="M4 18h40" stroke="#FFC83D" stroke-width="5" stroke-linecap="round"></path><path d="M38 5l20 13-20 13z" fill="#FFC83D" stroke="#2A1D3D" stroke-width="3.5" stroke-linejoin="round"></path></svg>';
  let ta, delta = 0;
  if (p) {
    const tb = R.tierOf(p.before);
    ta = R.tierOf(p.after);
    delta = p.delta;
    if (p.promo || p.demo) {
      $('#promoRow').innerHTML = `<span class="promo-old">${badgeSVG(tb.tier, 84)}</span>${arrow}<span class="promo-new">${burst('#FFE3A3')}<span class="b">${badgeSVG(ta.tier, 150)}</span></span>`;
      $('#promoTitle').innerHTML = `<span class="chip ${p.promo ? 'c-red' : 'c-violet'}" style="height:30px;font-family:var(--f-display);font-weight:400;font-size:18px">${p.promo ? '晋升' : '降级'}</span><span class="from">${esc(tb.label)}</span><span class="muted" style="font-size:22px">→</span><span class="to">${esc(ta.label)}</span>`;
    } else {
      $('#promoRow').innerHTML = `<span class="promo-new">${burst('#FCE9C4')}<span class="b">${badgeSVG(ta.tier, 150)}</span></span>`;
      $('#promoTitle').innerHTML = `<span class="from">${esc(ta.label)}</span><span class="muted" style="font-size:16px;font-weight:700">军衔保持</span>`;
    }
    const dEl = $('#resDelta');
    dEl.textContent = delta > 0 ? '+' + delta : delta < 0 ? '−' + Math.abs(delta) : '±0';
    dEl.style.color = delta > 0 ? 'var(--gold-t)' : delta < 0 ? 'var(--red-d)' : 'var(--ink-2)';
    $('#resDeltaLabel').textContent = '军功';
    let note;
    const need = ta.next ? Math.max(1, Math.ceil((ta.next - p.after) / R.WIN_PTS)) : 0;
    if (out === 'win') note = p.bonus ? `连胜加成 +${p.bonus} 已计入 · 当前 ${p.streak} 连胜` : p.streak >= 2 ? `当前 ${p.streak} 连胜 · 再赢一局起有连胜加成` : `胜利 +${R.WIN_PTS} 军功`;
    else if (out === 'lose') note = delta === 0 ? '列兵不扣军功，下局再来' : (need ? `连胜中断 · 再胜 ${need} 局可晋升 ${ta.nextLabel}` : '连胜中断');
    else note = '和棋不增减军功 · 连胜中断';
    $('#resNote').textContent = note;
  } else {
    ta = R.tierOf(me ? me.pts : 0);
    $('#promoRow').innerHTML = `<span class="promo-new">${burst('#FCE9C4')}<span class="b">${badgeSVG(ta.tier, 150)}</span></span>`;
    $('#promoTitle').innerHTML = `<span class="from">${esc(ta.label)}</span><span class="muted" style="font-size:16px;font-weight:700">${MODE_NAME[m.mode]}</span>`;
    const dEl = $('#resDelta');
    dEl.textContent = '—';
    dEl.style.color = 'var(--ink-2)';
    $('#resDeltaLabel').textContent = '不计军功';
    $('#resNote').textContent = m.mode === 'bot' ? '人机练习不影响军衔，去排位赛试试身手吧' : m.mode === 'friend' ? '好友房只论输赢，不计军功' : '休闲赛不计军功';
  }
  const prog = ta.tier === 9 ? 100 : ta.progress;
  $('#resPts').textContent = ta.tier === 9 ? num(p ? p.after : me.pts) : ta.progress;
  const bar = $('#resBar');
  bar.className = 'bar' + (out === 'win' ? ' jade' : '');
  bar.setAttribute('aria-valuenow', String(prog));
  bar.querySelector('i').style.width = prog + '%';
  $('#rsTime').textContent = fmt(sum.duration / 1000);
  $('#rsMoves').textContent = sum.moves;
  $('#rsKills').textContent = sum.kills;
  $('#rsLost').textContent = sum.lost;
  const mvp = $('#resMvp');
  if (out === 'win' && sum.flagBy) {
    mvp.classList.remove('res-opp');
    $('#mvpTag').textContent = '本局 MVP';
    $('#mvpPiece').innerHTML = pieceBox(sum.flagBy, 'red', 'front', 'selected', '', null);
    $('#mvpName').textContent = R.NAMES[sum.flagBy];
    $('#mvpLine').textContent = `拔旗一击 · 第 ${sum.moves} 手 · 全局吃子 ${sum.kills}`;
    $('#mvpNote').textContent = sum.flagBy === 'gb' ? '小兵立大功，最弱的棋子拿下了最后一击' : sum.flagBy === 'sl' ? '司令亲征，一锤定音' : '关键一击，锁定胜局';
  } else {
    // 没有夺旗 MVP 时，展示本局对手
    const pcs = (S.view && S.view.pieces) || [];
    const myLeft = pcs.filter((q) => q.side === 'm').length, oppLeft = pcs.length - myLeft;
    mvp.classList.add('res-opp');
    $('#mvpTag').textContent = '本局对手';
    $('#mvpPiece').innerHTML = `<span class="av-big">${avatarSVG('blue', m.opp.isBot ? 'smile' : 'cool', 'fill')}</span>`;
    $('#mvpName').textContent = m.opp.name;
    $('#mvpLine').textContent = (m.opp.isBot ? '电脑对手' : m.opp.tierLabel) + (pcs.length ? ` · 我方剩 ${myLeft} 子 · 对方剩 ${oppLeft} 子` : '');
    $('#mvpNote').textContent = out === 'win' ? '赢得漂亮！乘胜追击，再来一局' : out === 'lose' ? '胜败乃兵家常事，换个阵型再战' : '棋逢对手，下一局再分高下';
  }
  renderResultActions();
}
function renderResultActions() {
  const m = S.match, o = S.over;
  if (!m || !o) return;
  let text = '再来一局', disabled = false;
  if (m.mode === 'rank') text = '再来一局';
  else if (m.mode === 'bot') text = '再战人机';
  else if (S.oppLeft || !o.canRematch) { text = m.mode === 'casual' ? '重新匹配' : '对方已离开'; disabled = m.mode === 'friend'; }
  else if (S.rematchSent) { text = '等待对方…'; disabled = true; }
  else if (S.rematchFromOpp) text = '接受再战';
  $('#againText').textContent = text;
  $('#scr-result [data-act="again"]').disabled = disabled;
}
async function again() {
  const m = S.match, o = S.over;
  if (!m || !o) { leaveFinished(false); route(); return; }
  if (m.mode === 'rank' || (m.mode === 'casual' && (S.oppLeft || !o.canRematch))) {
    joinQueue(m.mode === 'rank' ? 'rank' : 'casual');
    return;
  }
  if (m.mode === 'friend' && S.oppLeft) { toast('对方已经离开了'); return; }
  if (S.rematchSent) return;
  const r = await net.req('match.rematch');
  if (!r.ok) {
    toast(r.error);
    if (/离开|过期/.test(r.error || '')) { S.oppLeft = true; renderResultActions(); }
    return;
  }
  if (m.mode !== 'bot' && S.match === m) {
    S.rematchSent = true;
    renderResultActions();
    if (!S.rematchFromOpp) toast('已邀请对方再来一局，等待回应…', 2000);
  }
}

// ================= 棋盘实例 =================
const HERO = (() => {
  const mine = { m61: 'dl', m62: 'jq', m63: 'dl', m64: 'lz', m65: 'pz', m51: 'tz', m52: 'dl', m53: 'zd', m54: 'gb', m55: 'yz', m41: 'shz', m45: 'lz', m31: 'gb', m32: 'lvz', m34: 'zd', m21: 'yz', m23: 'sl', m24: 'jz', m25: 'tz', m12: 'pz', m13: 'gb', o25: 'lvz' };
  const foe = ['o61', 'o62', 'o63', 'o64', 'o65', 'o51', 'o52', 'o53', 'o54', 'o55', 'o41', 'o43', 'o45', 'o31', 'o32', 'o34', 'o35', 'o21', 'o23', 'o12', 'o13', 'm11'];
  const occ = {};
  Object.keys(mine).forEach((id) => { occ[id] = { s: 'm', k: mine[id] }; });
  foe.forEach((id) => { occ[id] = { s: 'o', k: null }; });
  return { occ, sel: 'm13', lg: R.legal(occ, 'm13'), trail: true, hints: false, last: { from: 'o11', to: 'm11', side: 'o', path: ['o11', 'm11'] }, marks: {}, interactive: false };
})();
const heroBoard = new Board($('#heroBoard'), 'hero', { view: () => HERO });
const deployBoard = new Board($('#deployBoard'), 'deploy', {
  view() {
    if (!DP.lay) return null;
    const occ = {};
    Object.keys(DP.lay).forEach((id) => { occ[id] = { s: 'm', k: DP.lay[id] }; });
    const v = S.view;
    const oppReady = !!(v && v.ready && v.ready.opp);
    return { occ, sel: DP.sel, deploy: { lay: DP.lay }, interactive: !DP.ready, locked: DP.ready, fogText: oppReady ? '对手已布阵完毕' : '迷雾之后 · 对手正在布阵', fogDone: oppReady };
  },
  act(act, id) { if (act === 'piece') deployClick(id); }
});
const battleBoard = new Board($('#battleBoard'), 'battle', { view: battleView, act: battleAct });

// ================= 事件绑定 =================
document.addEventListener('click', (e) => {
  Sound.unlock();
  const t = e.target.closest('[data-act],[data-open],[data-form],[data-tab],[data-close-sheet]');
  if (!t || t.closest('.board') || t.disabled) return;
  if (t.dataset.open) { ({ rules: rulesDialog, settings: settingsDialog, menu: menuDialog })[t.dataset.open](); return; }
  if (t.dataset.form) { setFormation(t.dataset.form); return; }
  if (t.dataset.tab && t.closest('.tabbar')) { setTab(t.dataset.tab); return; }
  if (t.hasAttribute('data-close-sheet')) { closeSheet(); return; }
  switch (t.dataset.act) {
    case 'queue': joinQueue(t.dataset.mode); break;
    case 'friend': friendDialog(); break;
    case 'bot': startBot(); break;
    case 'rename': if (S.me) nameDialog(false); break;
    case 'cancel-wait': cancelWait(); break;
    case 'copy-link': copyInvite(); break;
    case 'enter-deploy': S.skipVs = true; route(); break;
    case 'random': setFormation('random'); break;
    case 'save': saveFormation(); break;
    case 'deploy-submit': submitDeploy(); break;
    case 'draw': offerDraw(); break;
    case 'resign': resignDialog(); break;
    case 'log': openSheet(); break;
    case 'turn-banner': if (S.view && S.view.phase === 'over') { S.showResult = true; route(); } break;
    case 'sound':
      SET.sound = !SET.sound;
      saveSettings();
      applySettings();
      toast(SET.sound ? '音效已开启' : '音效已关闭', 1200);
      break;
    case 'again': again(); break;
    case 'home': goHome(); break;
    default: break;
  }
});
document.addEventListener('keydown', () => Sound.unlock(), { once: true });
$('#dlg').addEventListener('click', (e) => { if (e.target.id === 'dlg' && !DLG.sticky) closeDialog(); });
$('#logSheet').addEventListener('click', (e) => { if (e.target.id === 'logSheet') closeSheet(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (dialogOpen()) { if (!DLG.sticky) closeDialog(); return; }
  if (sheetOpen()) { closeSheet(); return; }
  if (S.screen === 'battle' && BT.pop) { const id = BT.pop; BT.pop = null; battleBoard.focusNext = { act: 'piece', id }; battleBoard.render(); }
  else if (S.screen === 'battle' && BT.sel) { const id = BT.sel; BT.sel = null; battleBoard.focusNext = { act: 'piece', id }; battleBoard.render(); renderSel(); }
  else if (S.screen === 'deploy' && DP.sel) { const id = DP.sel; DP.sel = null; deployBoard.focusNext = { act: 'piece', id }; deployBoard.render(); renderDeploySide(); }
});

// 计时器：倒计时、对阵画面到布阵的切换、大厅在线人数刷新
let lobbyPollAt = 0;
setInterval(() => {
  switch (S.screen) {
    case 'match': tickMatch(); if (S.match && targetScreen() !== 'match') route(); break;
    case 'deploy': tickDeploy(); break;
    case 'battle': tickBattle(); break;
    case 'lobby':
      if (Date.now() - lobbyPollAt > 15000 && net.isOpen() && S.welcomed) { lobbyPollAt = Date.now(); net.send('lobby.refresh'); }
      break;
    default: break;
  }
}, 250);

// ================= 启动 =================
hydrate(document);
applySettings();
S.tipIdx = Math.floor(Math.random() * TIPS.length);
$('#tipText').textContent = TIPS[S.tipIdx];
show('lobby');
renderNet();
net.connect();

// 方便调试（控制台里可以看状态）
window.__mbjq = { S, net };
