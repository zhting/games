import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../shared/rules.js';
import { smartLayout } from '../server/bot.js';

const occOf = (pieces) => Object.fromEntries(Object.entries(pieces).map(([id, [s, k]]) => [id, { s, k }]));

test('预设阵型、随机阵型、人机阵型都符合布阵规则', () => {
  for (const f of R.FORMS) assert.deepEqual(R.validateLayout(f.lay), { ok: true }, f.id);
  for (let i = 0; i < 300; i++) {
    assert.equal(R.validateLayout(R.randomLayout()).ok, true);
    assert.equal(R.validateLayout(smartLayout()).ok, true);
  }
});

test('布阵校验能拦住各种违规', () => {
  const base = R.defaultLayout();
  assert.equal(R.validateLayout(null).ok, false);
  assert.equal(R.validateLayout([]).ok, false);
  const camp = { ...base };
  delete camp.m13;
  camp.m33 = 'gb';
  assert.equal(R.validateLayout(camp).ok, false, '行营不能放子');
  assert.equal(R.validateLayout({ ...base, m62: 'lz', m64: 'jq' }).ok, true, '旗可以在另一个大本营');
  assert.equal(R.validateLayout({ ...base, m62: 'lz', m11: 'jq' }).ok, false, '军旗必须在大本营');
  assert.equal(R.validateLayout({ ...base, m11: 'dl', m61: 'lz' }).ok, false, '地雷只能在后两排');
  assert.equal(R.validateLayout({ ...base, m11: 'zd', m53: 'lz' }).ok, false, '炸弹不能在第一排');
  assert.equal(R.validateLayout({ ...base, m11: 'sl' }).ok, false, '数量不对');
  const withProto = JSON.parse(JSON.stringify(base).replace('{', '{"__proto__":"sl",'));
  assert.equal(R.validateLayout(withProto).ok, false);
});

test('flipId 旋转 180° 且是自身的逆运算', () => {
  assert.equal(R.flipId('m11'), 'o15');
  assert.equal(R.flipId('o62'), 'm64');
  for (const id of R.IDS) assert.equal(R.flipId(R.flipId(id)), id);
});

test('地雷和大本营的普通棋子不能动，军旗可以离开大本营', () => {
  const occ = occOf({ m62: [0, 'sl'], m51: [0, 'dl'] });
  assert.deepEqual(R.legal(occ, 'm62').moves, []);
  assert.deepEqual(R.legal(occ, 'm51').moves, []);
  for (const side of ['m', 'o']) for (const c of [2, 4]) {
    const from = side + '6' + c;
    const flag = R.legal(occOf({ [from]: [0, 'jq'] }), from);
    assert.ok(flag.moves.includes(side + '5' + c), from + '军旗可以向前移动');
    assert.equal(flag.moves.length, 3);
  }
});

test('前线只有 1、3、5 路能通过，2、4 路是山界', () => {
  const occ = occOf({ m12: [0, 'pz'], m13: [0, 'pz'] });
  assert.ok(!R.legal(occ, 'm12').moves.includes('o14'));
  assert.ok(!R.legal(occ, 'm12').moves.some((id) => id[0] === 'o'));
  assert.ok(R.legal(occ, 'm13').moves.includes('o13'));
});

test('所有棋子在铁路上每步只能直行，包括工兵和军旗', () => {
  const occ = occOf({ m51: [0, 'lz'] });
  const lz = R.legal(occ, 'm51');
  assert.ok(lz.moves.includes('m55'), '沿第 5 排直行到底');
  assert.ok(lz.moves.includes('o51'), '沿左边竖线一路冲到对方底线铁路');
  assert.ok(!lz.moves.includes('m15'), '不能在铁路上拐弯');
  const occ2 = occOf({ m51: [0, 'gb'] });
  const gb = R.legal(occ2, 'm51');
  assert.ok(!gb.moves.includes('m15'), '工兵不能同一步拐弯');
  assert.ok(!gb.moves.includes('o55'));
  assert.ok(gb.moves.includes('m11'), '可以先停在转角');
  const afterStop = R.legal(occOf({ m11: [0, 'gb'] }), 'm11');
  assert.ok(afterStop.moves.includes('m15'), '下一回合可以从转角横向直行');
  assert.deepEqual(afterStop.paths.m15, ['m11', 'm12', 'm13', 'm14', 'm15']);
  const flag = R.legal(occOf({ m51: [0, 'jq'] }), 'm51');
  assert.ok(flag.moves.includes('o51'));
  assert.ok(!flag.moves.includes('m15'));
});

test('铁路被挡住就停下；行营里的子不能被攻击', () => {
  const occ = occOf({ m51: [0, 'lz'], m53: [1, null], m22: [1, null], m21: [0, 'jz'] });
  const lg = R.legal(occ, 'm51');
  assert.ok(lg.moves.includes('m52'));
  assert.ok(lg.attacks.includes('m53'));
  assert.ok(!lg.moves.includes('m54'));
  const lg2 = R.legal(occ, 'm21');
  assert.ok(!lg2.attacks.includes('m22'), '行营里的子受保护');
});

test('行营四角斜向相连', () => {
  const occ = occOf({ m22: [0, 'pz'] });
  const lg = R.legal(occ, 'm22');
  for (const id of ['m11', 'm13', 'm31', 'm33', 'm12', 'm21', 'm23', 'm32']) assert.ok(lg.moves.includes(id), id);
});

test('碰子判定', () => {
  assert.equal(R.fight('sl', 'jz'), 'win');
  assert.equal(R.fight('pz', 'lz'), 'lose');
  assert.equal(R.fight('tz', 'tz'), 'both');
  assert.equal(R.fight('zd', 'sl'), 'both');
  assert.equal(R.fight('gb', 'zd'), 'both');
  assert.equal(R.fight('sl', 'dl'), 'both');
  assert.equal(R.fight('gb', 'dl'), 'win');
  assert.equal(R.fight('zd', 'dl'), 'both');
  assert.equal(R.fight('gb', 'jq'), 'flag');
});

test('无子可走的判定会考虑军旗的活动空间', () => {
  const occ = occOf({ m61: [0, 'dl'], m62: [0, 'jq'], m63: [0, 'dl'], m52: [0, 'dl'], o11: [1, 'pz'] });
  assert.equal(R.hasAnyMove(occ, 0), false);
  assert.equal(R.hasAnyMove(occ, 1), true);
  delete occ.m52;
  assert.equal(R.hasAnyMove(occ, 0), true, '只有军旗可移动时也不算困毙');
});

test('中央公路与行营斜线的每段连线都可双向移动', () => {
  for (const side of ['m', 'o']) {
    for (const [a, b] of [['13', '23'], ['23', '33'], ['33', '43'], ['43', '53'], ['23', '22'], ['23', '24'], ['33', '22'], ['33', '24'], ['33', '42'], ['33', '44'], ['43', '42'], ['43', '44']]) {
      for (const [from, to] of [[side + a, side + b], [side + b, side + a]]) {
        const lg = R.legal(occOf({ [from]: [0, 'pz'] }), from);
        assert.ok(lg.moves.includes(to), from + ' → ' + to);
        assert.deepEqual(lg.paths[to], [from, to]);
      }
    }
  }
});

test('任何兵种踩雷只爆炸一次，工兵排雷后仍然存活', () => {
  for (const k of R.RANKS.filter(k => k !== 'dl' && k !== 'gb')) assert.equal(R.fight(k, 'dl'), 'both', k);
  assert.equal(R.fight('gb', 'dl'), 'win');
});

test('军功与军衔', () => {
  assert.equal(R.tierOf(0).label, '列兵');
  assert.equal(R.tierOf(99).label, '列兵');
  assert.equal(R.tierOf(100).label, '工兵 III');
  assert.equal(R.tierOf(399).label, '工兵 I');
  assert.equal(R.tierOf(400).label, '排长 III');
  assert.equal(R.tierOf(2499).label, '军长 I');
  assert.equal(R.tierOf(2500).label, '司令');
  assert.equal(R.tierOf(120).progress, 20);
  assert.equal(R.tierOf(120).nextLabel, '工兵 II');
});
