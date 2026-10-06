import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../shared/rules.js';
import { Game } from '../server/game.js';
import { Bot } from '../server/bot.js';

function clock(t = 1_000_000) {
  const c = () => c.t;
  c.t = t;
  return c;
}

function newGame(opts = {}) {
  const now = clock();
  const g = new Game({ id: 't', mode: 'casual', players: [{ name: 'A' }, { name: 'B' }], now, rnd: () => 0.1, ...opts });
  return { g, now };
}

function battle(opts) {
  const x = newGame(opts);
  assert.equal(x.g.submitDeploy(0, R.defaultLayout()).ok, true);
  assert.equal(x.g.submitDeploy(1, R.FORMS[1].lay).ok, true);
  return x;
}

/** 清空棋盘，按权威坐标摆几枚子（测试专用） */
function setBoard(g, pieces, turn = 0) {
  g.occ = {};
  let n = 0;
  for (const [id, [s, k]] of Object.entries(pieces)) g.occ[id] = { s, k, pid: 'p' + n++, moved: false, rv: false };
  g.turn = turn;
  g.turnDeadline = g.now() + g.T.turnMs;
}

test('双方布阵完成后进入对战，视图里看不到对方兵种', () => {
  const { g } = battle();
  assert.equal(g.phase, 'battle');
  assert.equal(Object.keys(g.occ).length, 50);
  for (const seat of [0, 1]) {
    const v = g.viewFor(seat);
    const mine = v.pieces.filter((p) => p.side === 'm');
    const opp = v.pieces.filter((p) => p.side === 'o');
    assert.equal(mine.length, 25);
    assert.equal(opp.length, 25);
    assert.ok(mine.every((p) => p.k && p.at[0] === 'm'), '自己的子都在下方且有兵种');
    assert.ok(opp.every((p) => p.k === null && p.at[0] === 'o'), '对方的子都在上方且没有兵种');
  }
  // 座位 1 看到的自己的布阵与提交的一致（视角旋转正确）
  const v1 = g.viewFor(1);
  for (const p of v1.pieces.filter((q) => q.side === 'm')) assert.equal(p.k, R.FORMS[1].lay[p.at]);
});

test('布阵：不合规、重复提交会被拒绝', () => {
  const { g } = newGame();
  assert.equal(g.submitDeploy(0, { m11: 'sl' }).ok, false);
  assert.equal(g.submitDeploy(0, R.defaultLayout()).ok, true);
  assert.equal(g.submitDeploy(0, R.defaultLayout()).ok, false);
  assert.equal(g.draftDeploy(0, R.defaultLayout()).ok, false, '提交后不能再改草稿');
  assert.equal(g.phase, 'deploy');
  assert.equal(g.viewFor(1).ready.opp, true);
});

test('布阵超时：用草稿或默认阵型自动开战', () => {
  const { g, now } = newGame();
  const draft = R.FORMS[2].lay;
  assert.equal(g.draftDeploy(1, draft).ok, true);
  now.t = g.deployDeadline + 1;
  g.tick();
  assert.equal(g.phase, 'battle');
  const v1 = g.viewFor(1);
  for (const p of v1.pieces.filter((q) => q.side === 'm')) assert.equal(p.k, draft[p.at]);
  const v0 = g.viewFor(0);
  for (const p of v0.pieces.filter((q) => q.side === 'm')) assert.equal(p.k, R.defaultLayout()[p.at]);
});

test('走子：轮次、归属、合法性校验', () => {
  const { g } = battle();
  const t = g.turn;
  const o = 1 - t;
  const v = g.viewFor(t);
  // 找一步合法的走法
  const occ = {};
  for (const p of v.pieces) occ[p.at] = { s: p.side, k: p.k };
  let mv = null;
  for (const p of v.pieces.filter((q) => q.side === 'm')) {
    const lg = R.legal(occ, p.at);
    if (lg.moves.length) { mv = { from: p.at, to: lg.moves[0] }; break; }
  }
  assert.ok(mv);
  assert.equal(g.move(o, mv.from, mv.to).ok, false, '不是你的回合');
  assert.equal(g.move(t, 'm62', 'm52').ok, false, '军旗前方有己方棋子，不能直接移动');
  assert.equal(g.move(t, 'o11', 'o21').ok, false, '不能动对方的子');
  assert.equal(g.move(t, 'x', 'y').ok, false);
  assert.equal(g.move(t, mv.from, mv.to).ok, true);
  assert.equal(g.turn, o);
  assert.equal(g.moveNo, 1);
  const vo = g.viewFor(o);
  assert.equal(vo.turn, 'me');
  assert.equal(vo.last.side, 'o');
  assert.equal(vo.last.to, R.flipId(mv.to), '对手看到的落点经过旋转');
  assert.equal(vo.log[0].side, 'opp');
});

test('碰子：大吃小、同归于尽、地雷、炸弹', () => {
  const { g } = battle();
  const events = [];
  g.on('event', (e) => events.push(e));
  setBoard(g, { m13: [0, 'shz'], o13: [1, 'tz'], m62: [0, 'jq'], o62: [1, 'jq'], m11: [0, 'zd'], o11: [1, 'sl'], m15: [0, 'jz'], o15: [1, 'dl'], o35: [1, 'pz'] });
  assert.equal(g.move(0, 'm13', 'o13').ok, true);
  assert.equal(g.occ.o13.k, 'shz');
  assert.deepEqual(g.lost[1], ['tz']);
  assert.equal(events.at(-1).type, 'combat');
  assert.deepEqual(g.combatFor(events.at(-1).entry, 0), { role: 'attacker', my: 'shz', res: 'win', at: 'o13' });
  assert.deepEqual(g.combatFor(events.at(-1).entry, 1), { role: 'defender', my: 'tz', res: 'lose', at: 'm13' });
  // 对方回合：让它随便走一步回来
  g.turn = 0;
  assert.equal(g.move(0, 'm11', 'o11').ok, true, '炸弹炸司令');
  assert.equal(g.occ.o11, undefined);
  assert.equal(g.occ.m11, undefined);
  // 司令阵亡：对方军旗亮出
  const v0 = g.viewFor(0);
  assert.equal(v0.pieces.find((p) => p.at === 'o62').k, 'jq');
  assert.equal(g.viewFor(1).pieces.find((p) => p.at === R.flipId('o62')).k, 'jq', '自己的旗当然看得见');
  g.turn = 0;
  assert.equal(g.move(0, 'm15', 'o15').ok, true, '军长踩雷');
  assert.equal(g.occ.m15, undefined);
  assert.equal(g.occ.o15, undefined, '爆炸后的地雷消失');
  assert.equal(g.kills[1], 2);
});

test('夺旗获胜', () => {
  const { g } = battle();
  let over = 0;
  g.on('over', () => over++);
  setBoard(g, { m13: [0, 'gb'], o52: [0, 'pz'], o62: [1, 'jq'], o11: [1, 'pz'], m62: [0, 'jq'] });
  assert.equal(g.move(0, 'o52', 'o62').ok, true);
  assert.equal(g.phase, 'over');
  assert.deepEqual(g.result, { winner: 0, reason: 'flag' });
  assert.equal(over, 1);
  assert.equal(g.viewFor(0).result.outcome, 'win');
  assert.equal(g.viewFor(1).result.outcome, 'lose');
  assert.equal(g.summaryFor(0).flagBy, 'pz');
  assert.equal(g.move(1, 'o11', 'o21').ok, false, '结束后不能再走');
  // 终局复盘：双方兵种全部公开
  assert.ok(g.viewFor(1).pieces.every((p) => p.k));
});

test('工兵排雷保留工兵，其他棋子踩雷后落点腾空且可以再次经过', () => {
  for (const k of ['gb', 'sl', 'pz', 'zd']) {
    const { g } = battle();
    setBoard(g, { m51: [0, k], m45: [0, 'pz'], m55: [1, 'dl'], m62: [0, 'jq'], o62: [1, 'jq'], o13: [1, 'lz'] });
    assert.equal(g.move(0, 'm51', 'm55').ok, true, k);
    assert.ok(g.lost[1].includes('dl'));
    if (k === 'gb') {
      assert.equal(g.occ.m55.k, 'gb');
      assert.deepEqual(g.lost[0], []);
    } else {
      assert.equal(g.occ.m55, undefined);
      assert.ok(g.lost[0].includes(k));
      assert.equal(g.move(1, R.flipId('o13'), R.flipId('o23')).ok, true);
      assert.equal(g.move(0, 'm45', 'm55').ok, true, '另一枚棋子再次经过爆炸地点时不会受伤');
      assert.equal(g.occ.m55.k, 'pz');
    }
  }
});

test('军旗离开大本营后仍保持暗棋，并能在新位置被夺', () => {
  const { g } = battle();
  setBoard(g, { m62: [0, 'jq'], o62: [1, 'jq'], m42: [1, 'pz'] });
  assert.equal(g.move(0, 'm62', 'm52').ok, true);
  assert.equal(g.occ.m52.k, 'jq');
  assert.equal(g.viewFor(1).pieces.find(p => p.at === R.flipId('m52')).k, null);
  assert.equal(g.move(1, R.flipId('m42'), R.flipId('m52')).ok, true);
  assert.deepEqual(g.result, { winner: 1, reason: 'flag' });
  assert.equal(g.summaryFor(1).flagBy, 'pz');
});

test('双方视角的军旗都可离开大本营并在下一回合继续移动', () => {
  const { g } = battle();
  setBoard(g, { m62: [0, 'jq'], o62: [1, 'jq'] });
  assert.equal(g.move(0, 'm62', 'm52').ok, true);
  assert.equal(g.move(1, R.flipId('o62'), R.flipId('o52')).ok, true);
  assert.equal(g.move(0, 'm52', 'm53').ok, true);
  assert.equal(g.occ.m53.k, 'jq');
  assert.equal(g.occ.o52.k, 'jq');
});

test('军旗主动碰到敌子而阵亡时判负，战绩归属于防守方', () => {
  for (const k of ['pz', 'dl', 'zd']) {
    const { g } = battle();
    setBoard(g, { m62: [0, 'jq'], m52: [1, k], o62: [1, 'jq'] });
    assert.equal(g.move(0, 'm62', 'm52').ok, true);
    assert.deepEqual(g.result, { winner: 1, reason: 'flag' });
    assert.equal(g.summaryFor(1).flagBy, k);
    assert.ok(g.lost[0].includes('jq'));
  }
});

test('军旗被亮出后仍可移动，对方看到的新位置保持亮旗', () => {
  const { g } = battle();
  setBoard(g, { m62: [0, 'jq'], o62: [1, 'jq'] });
  g.revealFlag(0);
  assert.equal(g.move(0, 'm62', 'm52').ok, true);
  assert.equal(g.viewFor(1).pieces.find(p => p.at === R.flipId('m52')).k, 'jq');
});

test('工兵在铁路转角必须等待下一次自己的回合，后台拒绝一次转弯', () => {
  const { g } = battle();
  setBoard(g, { m51: [0, 'gb'], m62: [0, 'jq'], o62: [1, 'jq'], o63: [1, 'pz'] });
  assert.equal(g.move(0, 'm51', 'm15').ok, false);
  assert.equal(g.moveNo, 0);
  assert.equal(g.occ.m51.k, 'gb');
  assert.equal(g.move(0, 'm51', 'm11').ok, true);
  assert.equal(g.move(0, 'm11', 'm15').ok, false, '不能在同一回合继续转弯');
  assert.equal(g.move(1, R.flipId('o63'), R.flipId('o53')).ok, true);
  assert.equal(g.move(0, 'm11', 'm15').ok, true);
  assert.deepEqual(g.last.path, ['m11', 'm12', 'm13', 'm14', 'm15']);
});

test('人机会考虑移动过的暗子可能是军旗，但不会把它当成地雷', () => {
  const { g } = battle();
  setBoard(g, { m62: [0, 'jq'], o23: [1, 'jq'], m13: [0, 'pz'] });
  g.occ.o23.moved = true;
  const bot = new Bot(g, 0);
  const view = g.viewFor(0);
  const target = view.pieces.find(p => p.at === 'o23');
  assert.equal(target.k, null, '人机只能看到暗子');
  const distribution = bot.dist(target, bot.context(view));
  assert.ok(distribution.some(([k, probability]) => k === 'jq' && probability > 0));
  assert.ok(!distribution.some(([k]) => k === 'dl'));
});

test('人机知道打赢普通棋子后仍存活的敌子不可能是一次性地雷', () => {
  const { g } = battle();
  setBoard(g, { o51: [0, 'pz'], o55: [1, 'lz'], m62: [0, 'jq'], o62: [1, 'jq'] });
  const pid = g.occ.o55.pid;
  const bot = new Bot(g, 0);
  assert.equal(g.move(0, 'o51', 'o55').ok, true);
  assert.equal(bot.info.get(pid).notMine, true);
  const view = g.viewFor(0);
  const distribution = bot.dist(view.pieces.find(p => p.at === 'o55'), bot.context(view));
  assert.ok(!distribution.some(([k]) => k === 'dl'));
});

test('无子可走判负', () => {
  const { g } = battle();
  setBoard(g, { m13: [0, 'pz'], o23: [1, 'lz'], o62: [1, 'jq'], m62: [0, 'jq'], m61: [0, 'dl'], m63: [0, 'dl'], m52: [0, 'dl'], o61: [1, 'dl'] });
  // 我方唯一的活子越过前线，被对方吃掉（座位 1 用自己的视角坐标走子）
  assert.equal(g.move(0, 'm13', 'o13').ok, true);
  assert.equal(g.turn, 1);
  assert.equal(g.move(1, R.flipId('o23'), R.flipId('o13')).ok, true);
  assert.equal(g.phase, 'over');
  assert.deepEqual(g.result, { winner: 1, reason: 'nomoves' });
});

test('超时三次判负', () => {
  const { g, now } = battle();
  const first = g.turn;
  for (let i = 0; i < 5 && g.phase === 'battle'; i++) {
    now.t = g.turnDeadline + 1;
    g.tick();
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.result.reason, 'timeout');
  assert.equal(g.result.winner, 1 - first, '先超时满三次的一方判负');
  assert.equal(g.timeouts[first], 3);
});

test('求和与认输', () => {
  const { g } = battle();
  const s = g.turn;
  assert.equal(g.offerDraw(s).ok, true);
  assert.equal(g.viewFor(1 - s).drawOffer, 'opp');
  assert.equal(g.answerDraw(s, true).ok, false, '不能自己回应自己的求和');
  assert.equal(g.answerDraw(1 - s, false).ok, true);
  assert.equal(g.drawOffer, null);
  assert.equal(g.offerDraw(s).ok, false, '冷却中');
  assert.equal(g.offerDraw(1 - s).ok, true);
  assert.equal(g.answerDraw(s, true).ok, true);
  assert.deepEqual(g.result, { winner: null, reason: 'agreed' });

  const b = battle().g;
  assert.equal(b.resign(1).ok, true);
  assert.deepEqual(b.result, { winner: 0, reason: 'resign' });
  assert.equal(b.resign(0).ok, false);
});

test('连续无吃子判和', () => {
  const { g } = battle({ timing: { noCaptureLimit: 4 } });
  setBoard(g, { m31: [0, 'pz'], o31: [1, 'pz'], m62: [0, 'jq'], o62: [1, 'jq'] });
  const steps = [[0, 'm31', 'm41'], [1, 'o31', 'o41'], [0, 'm41', 'm31'], [1, 'o41', 'o31']];
  for (const [s, a, b] of steps) {
    const from = s === 0 ? a : R.flipId(a), to = s === 0 ? b : R.flipId(b);
    assert.equal(g.move(s, from, to).ok, true);
  }
  assert.deepEqual(g.result, { winner: null, reason: 'nocapture' });
});

test('战报文字：对手只知道“对方棋子”', () => {
  const { g } = battle();
  setBoard(g, { m13: [0, 'shz'], o13: [1, 'tz'], m62: [0, 'jq'], o62: [1, 'jq'], o21: [1, 'pz'] });
  g.move(0, 'm13', 'o13');
  const mine = g.viewFor(0).log[0];
  const theirs = g.viewFor(1).log[0];
  assert.match(mine.text, /师长 进攻 · 胜/);
  assert.match(theirs.text, /对方棋子击败我方团长/);
  assert.doesNotMatch(theirs.text, /师长/);
});

test('视图里棋子按棋盘位置排序，不泄露布阵时的键顺序', () => {
  const { g } = newGame();
  // 故意把军旗、地雷、炸弹放在对象最前面
  const lay = R.randomLayout();
  const tricky = {};
  for (const k of ['jq', 'dl', 'zd']) for (const [id, v] of Object.entries(lay)) if (v === k) tricky[id] = v;
  Object.assign(tricky, lay);
  assert.equal(g.submitDeploy(0, R.defaultLayout()).ok, true);
  assert.equal(g.submitDeploy(1, tricky).ok, true);
  const v0 = g.viewFor(0);
  const order = v0.pieces.map((p) => p.at);
  const expected = R.IDS.filter((id) => order.includes(id));
  assert.deepEqual(order, expected);
  const v1 = g.viewFor(1);
  const idx = (id) => R.IDS.indexOf(R.flipId(id));
  const canon = v1.pieces.map((p) => idx(p.at));
  assert.deepEqual(canon, [...canon].sort((a, b) => a - b));
});
