// 2.5D 棋盘：透视投影 + SVG 棋盘底座 + 立起来的棋子按钮。
// 控制器提供 view()（当前要画什么）和 act(动作, 位置, 值)（点击回调）。
import * as R from '../shared/rules.js?v=20261006-rules';
import { INK, esc, pieceHTML, pieceBox } from './art.js';

export const MARKS = ['司', '军', '师', '旅', '团', '营', '连', '排', '工', '雷', '炸', '旗'];

const MTN = `<path d="M4 58C12 40 22 24 34 24c8 0 13 10 19 17 6-10 13-16 22-16 10 0 17 18 21 33z" fill="#1E9E7C" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path><path d="M16 60C24 40 35 15 50 15s27 25 35 45z" fill="#2FC596" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path><path d="M39 24c3-5 7-9 11-9 5 0 9 4 12 9-3 3-6 0-9 3-3-4-6 1-9-2-2 1-4 1-5-1z" fill="#FFF6E3" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"></path><path d="M31 45c3-6 6-10 10-13" fill="none" stroke="#9AF2D2" stroke-width="3" stroke-linecap="round"></path><path d="M8 60h84" stroke="${INK}" stroke-width="3" stroke-linecap="round"></path>`;
const RETICLE = `<circle cx="20" cy="20" r="14" fill="none" stroke="${INK}" stroke-width="7"></circle><circle cx="20" cy="20" r="14" fill="none" stroke="#FF5A48" stroke-width="3.5"></circle><path d="M20 1v9M20 30v9M1 20h9M30 20h9" stroke="${INK}" stroke-width="6" stroke-linecap="round"></path><path d="M20 2.5v6M20 31.5v6M2.5 20h6M31.5 20h6" stroke="#FF5A48" stroke-width="3" stroke-linecap="round"></path><circle cx="20" cy="20" r="3.2" fill="#FF5A48" stroke="${INK}" stroke-width="1.6"></circle>`;
const FLAG_ICON = `<svg width="64" height="58" viewBox="0 0 64 58" aria-hidden="true"><path d="M14 54V6" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><path d="M16 7h38l-9 12 9 12H16z" fill="#E8453A" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"></path><path d="M30 13.5l2 4 4.4.5-3.3 3 .9 4.4-4-2.3-4 2.3.9-4.4-3.3-3 4.4-.5z" fill="#FFC83D"></path></svg>`;
const WHITE_FLAG = `<svg width="64" height="58" viewBox="0 0 64 58" aria-hidden="true"><path d="M14 54V6" stroke="${INK}" stroke-width="5" stroke-linecap="round"></path><path d="M16 8c8-4 14 3 22 0s12-3 12-3v22s-4-1-12 2-14-4-22 0z" fill="#FFF6E3" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"></path></svg>`;
const SCALE_ICON = `<svg width="64" height="58" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#7A3FE0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M7 20h10M4 8h16"></path><path d="M6 8l-3 6h6zM18 8l-3 6h6z" fill="#EBDFFF"></path></g></svg>`;
const EMPTY_LG = { moves: [], attacks: [], paths: {} };

function camFn(o) {
  const a = o.tilt * Math.PI / 180, b = (o.yaw || 0) * Math.PI / 180;
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
  return (X, Y) => {
    const x = (X * cb - Y * sb) * o.U, y = (X * sb + Y * cb) * o.U;
    const k = o.P / (o.P - y * sa);
    return { x: o.cx + x * k, y: o.cy + y * ca * k, k };
  };
}
function fitCam(o) {
  const corners = [[o.x0, o.y0], [o.x1, o.y0], [o.x1, o.y1], [o.x0, o.y1]];
  const box = (U) => {
    const pr = camFn({ tilt: o.tilt, yaw: o.yaw, P: o.P, U, cx: 0, cy: 0 });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    corners.forEach((c) => { const p = pr(c[0], c[1]); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + o.T * U * p.k); });
    return { x0, x1, y0, y1 };
  };
  let lo = 5, hi = 400;
  for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; const b = box(m); if (b.x1 - b.x0 <= o.w - 2 * o.pad && b.y1 - b.y0 <= o.h - 2 * o.pad) lo = m; else hi = m; }
  const b = box(lo);
  return { U: lo, cx: o.w / 2 - (b.x0 + b.x1) / 2, cy: o.h / 2 - (b.y0 + b.y1) / 2 };
}
function hull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  p.forEach((q) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
  p.slice().reverse().forEach((q) => { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const R1 = (v) => Math.round(v * 10) / 10;
const PT = (p) => R1(p.x) + ' ' + R1(p.y);
const POLY = (ps) => 'M' + ps.map(PT).join('L') + 'Z';
const ELL = (x, y, rx, ry) => 'M' + R1(x - rx) + ' ' + R1(y) + 'a' + R1(rx) + ' ' + R1(ry) + ' 0 1 0 ' + R1(2 * rx) + ' 0a' + R1(rx) + ' ' + R1(ry) + ' 0 1 0 ' + R1(-2 * rx) + ' 0Z';

export class Board {
  /**
   * @param {HTMLElement} el
   * @param {'hero'|'deploy'|'battle'} scene
   * @param {{view: () => object, act?: (act:string, id:string|null, v:string|undefined) => void}} ctl
   */
  constructor(el, scene, ctl) {
    this.el = el;
    this.scene = scene;
    this.ctl = ctl;
    this.geo = null;
    this.gkey = '';
    this.focusNext = null;
    this.raf = 0;
    if (scene !== 'hero') {
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act]');
        if (t && el.contains(t)) this.ctl.act(t.dataset.act, t.dataset.id || null, t.dataset.v);
      });
    }
    if (window.ResizeObserver) new ResizeObserver(() => this.schedule()).observe(el);
    else window.addEventListener('resize', () => this.schedule());
  }

  schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  camera(W, H) {
    const narrow = W < 560;
    if (this.scene === 'hero') {
      if (W / H > 1.2) return { tilt: 52, yaw: -35, P: 1800, y0: -2.8, y1: 3.2, pad: 0 };
      return { tilt: 52, yaw: -24, P: 1800, y0: -6.75, y1: 6.75, pad: 8 };
    }
    const P = Math.round(Math.max(1300, Math.min(2400, H * 2.5)));
    if (this.scene === 'deploy') return { tilt: narrow ? 40 : 42, yaw: 0, P, y0: -1.9, y1: 6.75, pad: narrow ? 6 : 10 };
    return { tilt: narrow ? 36 : 42, yaw: 0, P, y0: -6.75, y1: 6.75, pad: narrow ? 4 : 10 };
  }

  geometry(W, H) {
    const cam = this.camera(W, H);
    const key = [W, H, cam.tilt, cam.yaw, cam.P, cam.y0, cam.y1, cam.pad].join(',');
    if (this.geo && this.gkey === key) return this.geo;
    const X0 = -2.95, X1 = 2.95, Y0 = -6.75, Y1 = 6.75;
    const f = fitCam({ w: W, h: H, pad: cam.pad, tilt: cam.tilt, yaw: cam.yaw, P: cam.P, x0: X0, x1: X1, y0: cam.y0, y1: cam.y1, T: 0.32 });
    const U = f.U;
    const pr = camFn({ tilt: cam.tilt, yaw: cam.yaw, P: cam.P, U, cx: f.cx, cy: f.cy });
    const A = cam.tilt * Math.PI / 180, sinA = Math.sin(A), cosA = Math.cos(A);
    const rect = (a, b, c, d) => POLY([pr(a, b), pr(c, b), pr(c, d), pr(a, d)]);
    const rr = (cx, cy, w, h, r) => {
      const ps = [];
      [[cx + w / 2 - r, cy - h / 2 + r, -90], [cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, 90], [cx - w / 2 + r, cy - h / 2 + r, 180]].forEach((q) => {
        for (let i = 0; i <= 3; i++) { const an = (q[2] + i * 30) * Math.PI / 180; ps.push(pr(q[0] + r * Math.cos(an), q[1] + r * Math.sin(an))); }
      });
      return POLY(ps);
    };
    const thick = 0.42;
    const c4 = [pr(X0, Y0), pr(X1, Y0), pr(X1, Y1), pr(X0, Y1)];
    const b4 = c4.map((p) => ({ x: p.x, y: p.y + thick * U * p.k * sinA, k: p.k }));
    const quad = (i, j) => POLY([c4[i], c4[j], b4[j], b4[i]]);
    const off = 0.32 * U;
    const shadow = POLY(hull(c4.concat(b4).map((p) => ({ x: p.x + off * 0.3, y: p.y + off }))));
    const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const sideLine = 'M' + PT(mid(c4[0], b4[0])) + 'L' + PT(mid(c4[3], b4[3])) + 'L' + PT(mid(c4[2], b4[2]));
    const cp = {};
    R.IDS.forEach((id) => { const w = R.world(id); cp[id] = pr(w.X, w.Y); });
    const railKey = {};
    R.LINES.forEach((l) => { for (let i = 0; i + 1 < l.length; i++) railKey[R.ek(l[i], l[i + 1])] = 1; });
    let roads = '';
    R.IDS.forEach((a) => R.ROAD[a].forEach((b) => { if (a < b && !railKey[R.ek(a, b)]) roads += 'M' + PT(cp[a]) + 'L' + PT(cp[b]); }));
    const rails = R.LINES.map((l) => 'M' + l.map((id) => PT(cp[id])).join('L')).join('');
    let pads = '', camps = '', rings = '', hqs = '';
    R.IDS.forEach((id) => {
      const t = R.typeOf(id), w = R.world(id), p = cp[id];
      if (t === 'camp') { const rx = 0.3 * U * p.k; camps += ELL(p.x, p.y, rx, rx * cosA); rings += ELL(p.x, p.y, rx * 0.68, rx * 0.68 * cosA); }
      else if (t === 'hq') hqs += rr(w.X, w.Y, 0.68, 0.48, 0.16);
      else pads += rr(w.X, w.Y, 0.5, 0.32, 0.09);
    });
    const studs = [[-2.78, -6.58], [2.78, -6.58], [2.78, 6.58], [-2.78, 6.58], [-2.78, 0], [2.78, 0]].map((q) => { const p = pr(q[0], q[1]); const r = 0.075 * U * p.k; return ELL(p.x, p.y, r, r * cosA); }).join('');
    const railW = Math.max(4, 0.1 * U);
    const base =
      `<path d="${shadow}" fill="#06463D" opacity=".5"></path>` +
      `<path d="${quad(1, 2) + quad(3, 0)}" fill="#8A2019" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path>` +
      `<path d="${quad(2, 3)}" fill="#B3322A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path>` +
      `<path d="${sideLine}" fill="none" stroke="#FFC83D" stroke-width="${R1(Math.max(1.5, 0.035 * U))}" stroke-linecap="round" opacity=".9"></path>` +
      `<path d="${POLY(c4)}" fill="#E8453A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path>` +
      `<path d="${rect(-2.78, -6.58, 2.78, 6.58)}" fill="none" stroke="#FFC83D" stroke-width="${R1(Math.max(1.8, 0.035 * U))}" stroke-linejoin="round"></path>` +
      `<path d="${rect(-2.6, -6.4, 2.6, 6.4)}" fill="#FFDB94" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"></path>` +
      `<path d="${rect(-2.6, -0.34, 2.6, 0.34)}" fill="#8FE0C4" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"></path>` +
      `<path d="${roads}" fill="none" stroke="#CF9446" stroke-width="${R1(Math.max(2, 0.045 * U))}" stroke-linecap="round"></path>` +
      `<path d="${rails}" fill="none" stroke="${INK}" stroke-width="${R1(railW)}" stroke-linecap="round" stroke-linejoin="round"></path>` +
      `<path d="${rails}" fill="none" stroke="#FFF6E3" stroke-width="${R1(railW * 0.42)}" stroke-dasharray="${R1(railW * 1.1)} ${R1(railW * 1.1)}"></path>` +
      `<path d="${pads}" fill="#F6C46A" stroke="#CF9446" stroke-width="1.5" stroke-linejoin="round"></path>` +
      `<path d="${camps}" fill="#22B893" stroke="${INK}" stroke-width="2.2"></path>` +
      `<path d="${rings}" fill="none" stroke="#FFF6E3" stroke-width="1.6"></path>` +
      `<path d="${hqs}" fill="#FF7A6B" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"></path>` +
      `<path d="${studs}" fill="#FFC83D" stroke="${INK}" stroke-width="1.5"></path>`;
    const mountains = [-1, 1].map((X) => { const p = pr(X, 0.05); const w = 0.98 * U * p.k; return { left: R1(p.x - w / 2), top: R1(p.y - w * 0.56), w: R1(w), h: R1(w * 0.64), z: Math.round(p.y) + 100 }; });
    let fog = null;
    if (this.scene === 'deploy') {
      const fy = pr(0, -0.62).y;
      const n = Math.max(5, Math.round(W / 80)), seg = (W + 20) / n, amp = Math.min(24, seg * 0.35);
      let d = 'M-10 -10H' + R1(W + 10) + 'V' + R1(fy);
      for (let i = n; i > 0; i--) { const xa = -10 + (i - 1) * seg; d += 'Q' + R1(xa + seg / 2) + ' ' + R1(fy + amp * 1.6) + ' ' + R1(xa) + ' ' + R1(fy); }
      d += 'Z';
      let curls = '';
      [[0.14, 0.42], [0.36, 0.2], [0.63, 0.46], [0.86, 0.24]].forEach((q) => {
        const cx = q[0] * W, cy = q[1] * fy, s = Math.max(10, W / 52);
        curls += 'M' + R1(cx - 2 * s) + ' ' + R1(cy + s * 0.6) + 'c' + R1(-s * 0.6) + ' ' + R1(-s * 1.6) + ' ' + R1(s * 1.4) + ' ' + R1(-s * 2.2) + ' ' + R1(s * 2) + ' ' + R1(-s * 0.6) + 'c' + R1(s * 0.5) + ' ' + R1(s * 1.1) + ' ' + R1(-s * 0.9) + ' ' + R1(s * 1.5) + ' ' + R1(-s * 1.2) + ' ' + R1(s * 0.5) + 'M' + R1(cx + s * 0.4) + ' ' + R1(cy - s * 0.4) + 'c' + R1(s * 0.4) + ' ' + R1(-s * 1.4) + ' ' + R1(s * 2.4) + ' ' + R1(-s * 1.4) + ' ' + R1(s * 2.6) + ' ' + R1(s * 0.4);
      });
      const fs = Math.round(Math.max(16, Math.min(26, W / 30)));
      fog = { d, curls, ty: R1(Math.max(8, fy * 0.5 - fs * 0.6)), fs };
    }
    this.geo = { U, cosA, cp, base, mountains, fog };
    this.gkey = key;
    return this.geo;
  }

  render() {
    const W = Math.round(this.el.clientWidth), H = Math.round(this.el.clientHeight);
    if (W < 60 || H < 60) return;
    const g = this.geometry(W, H);
    const v = this.ctl.view();
    if (!v) return;
    const { U, cp, cosA } = g;
    const occ = v.occ, scene = this.scene, lg = v.lg || EMPTY_LG;
    const tileU = 0.78, compact = W < 560, interactive = scene !== 'hero' && !v.locked;
    let fx = '';
    if (v.sel && occ[v.sel]) { const p = cp[v.sel], rx = 0.42 * U * p.k; fx += `<path d="${ELL(p.x, p.y + 2, rx, rx * cosA)}" fill="#FFC83D" fill-opacity=".45" stroke="#FFC83D" stroke-width="3"></path>`; }
    let last = '';
    if (v.last && v.last.path && v.last.path.length > 1) {
      const ch = v.last.path.map((id) => cp[id]);
      const E = ch[ch.length - 1], B = ch[ch.length - 2];
      const dx = E.x - B.x, dy = E.y - B.y, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L;
      const back = Math.min(0.3 * U * E.k, L * 0.4);
      const tip = { x: E.x - ux * back, y: E.y - uy * back };
      const hs = Math.max(6, 0.11 * U * E.k);
      const base = { x: tip.x - ux * hs * 1.5, y: tip.y - uy * hs * 1.5 };
      const col = v.last.side === 'm' ? '#E8453A' : '#3355E8';
      const line = 'M' + ch.slice(0, -1).concat([base]).map(PT).join('L');
      if (!occ[v.last.path[0]]) { const o = ch[0], rx = 0.34 * U * o.k; fx += `<path d="${ELL(o.x, o.y, rx, rx * cosA)}" fill="none" stroke="${col}" stroke-width="2.5" stroke-dasharray="5 5"></path>`; }
      last = `<path d="${line}" fill="none" stroke="${INK}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="${line}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path><path d="${POLY([tip, { x: base.x - uy * hs, y: base.y + ux * hs }, { x: base.x + uy * hs, y: base.y - ux * hs }])}" fill="${col}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"></path>`;
    }
    if (v.trail && v.sel && occ[v.sel]) {
      const seen = {};
      let tr = '';
      Object.keys(lg.paths).forEach((t) => { const ch = lg.paths[t]; for (let i = 0; i + 1 < ch.length; i++) { const k = R.ek(ch[i], ch[i + 1]); if (seen[k]) continue; seen[k] = 1; tr += 'M' + PT(cp[ch[i]]) + 'L' + PT(cp[ch[i + 1]]); } });
      if (tr) {
        const tw = R1(Math.max(4, 0.075 * U));
        const op = v.interactive ? 1 : 0.45;
        fx += `<g opacity="${op}"><path d="${tr}" fill="none" stroke="${INK}" stroke-width="${R1(tw + 3.5)}" stroke-linecap="round" stroke-dasharray="0.1 11.9" style="animation:jqDash .9s linear infinite"></path><path d="${tr}" fill="none" stroke="#FFC83D" stroke-width="${tw}" stroke-linecap="round" stroke-dasharray="0.1 11.9" style="animation:jqDash .9s linear infinite"></path></g>`;
      }
    }
    let html = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g.base}${fx}${last}</svg>`;
    html += g.mountains.map((m) => `<svg class="bd-mtn" viewBox="0 0 100 64" style="left:${m.left}px;top:${m.top}px;width:${m.w}px;height:${m.h}px;z-index:${m.z}" aria-hidden="true">${MTN}</svg>`).join('');
    const showT = scene === 'battle' && v.interactive;
    if (showT) {
      html += lg.moves.map((id) => {
        const p = cp[id], d = 0.34 * U * p.k;
        const hw = Math.max(0.72 * U * p.k, compact ? 44 : 34), hh = Math.max(0.5 * U * p.k * cosA + 8, compact ? 40 : 30);
        const dot = v.hints ? `<span class="bd-ring" style="left:${R1(hw / 2 - d / 2)}px;top:${R1(hh / 2 - d * 0.3)}px;width:${R1(d)}px;height:${R1(d * 0.6)}px"></span><span class="bd-disc" style="left:${R1(hw / 2 - d / 2)}px;top:${R1(hh / 2 - d * 0.3)}px;width:${R1(d)}px;height:${R1(d * 0.6)}px"></span>` : '';
        return `<button type="button" class="bd-btn" data-act="move" data-id="${id}" aria-label="移动到${R.label(id)}" style="left:${R1(p.x - hw / 2)}px;top:${R1(p.y - hh / 2)}px;width:${R1(hw)}px;height:${R1(hh)}px;z-index:${Math.round(p.y) + 101}">${dot}</button>`;
      }).join('');
    }
    // 手机上棋子画得小：可点区域扩大到接近一个格子（不和相邻格子重叠），棋子本身仍居中显示
    const hit = (p, s) => {
      const w = Math.max(64 * s, Math.min(U * p.k * 0.9, 56)), h = Math.max(58 * s, Math.min(U * p.k * cosA * 0.9, 50));
      const left = p.x - w / 2, top = p.y - s - h / 2;
      return { w, h, left, top, dx: p.x - 32 * s - left, dy: p.y - 30 * s - top };
    };
    html += Object.keys(occ).map((id) => {
      const p = cp[id], q = occ[id], s = tileU * U * p.k / 64;
      let mode = 'normal';
      if (v.deploy) { if (v.sel) mode = id === v.sel ? 'selected' : R.canSwap(v.deploy.lay, v.sel, id) ? 'target' : 'dim'; }
      else if (id === v.sel) mode = 'selected';
      const mine = q.s === 'm';
      const mk = v.marks && !mine ? (v.marks[id] || '') : '';
      const face = (mine || q.k) ? 'front' : 'back';
      const z = Math.round(p.y) + 100 + (mode === 'selected' ? 3000 : 0);
      const style = `left:${R1(p.x - 32 * s)}px;top:${R1(p.y - 30 * s)}px;width:${R1(64 * s)}px;height:${R1(58 * s)}px;z-index:${z}`;
      const inner = `<span class="pc-box" style="transform:scale(${Math.round(s * 1000) / 1000})">${pieceHTML(q.k, mine ? 'red' : 'blue', face, mode, mk)}</span>`;
      const pid = q.pid ? ` data-pid="${esc(q.pid)}"` : '';
      if (!interactive) return `<span class="bd-static"${pid} style="${style}">${inner}</span>`;
      const hb = hit(p, s);
      const bstyle = `left:${R1(hb.left)}px;top:${R1(hb.top)}px;width:${R1(hb.w)}px;height:${R1(hb.h)}px;z-index:${z}`;
      const binner = `<span class="pc-box" style="position:absolute;left:${R1(hb.dx)}px;top:${R1(hb.dy)}px;transform:scale(${Math.round(s * 1000) / 1000})">${pieceHTML(q.k, mine ? 'red' : 'blue', face, mode, mk)}</span>`;
      let label;
      if (v.deploy) label = R.NAMES[q.k] + '，' + R.label(id) + (v.sel ? (id === v.sel ? '，已选中' : mode === 'target' ? '，可与所选棋子交换' : '，不能与所选棋子交换') : '');
      else label = (mine ? '我方' + R.NAMES[q.k] : q.k ? '对方' + R.NAMES[q.k] : '对方棋子') + (mk ? '（标记：' + mk + '）' : '') + '，' + R.label(id) + (lg.attacks.indexOf(id) >= 0 && v.interactive ? '，可进攻' : '');
      return `<button type="button" class="bd-btn" data-act="piece" data-id="${id}"${pid} aria-label="${esc(label)}"${mode === 'selected' ? ' aria-pressed="true"' : ''} style="${bstyle}">${binner}</button>`;
    }).join('');
    if (showT) {
      html += lg.attacks.map((id) => {
        const p = cp[id], s = tileU * U * p.k / 64, rs = 36 * s;
        const hb = hit(p, s);
        const ret = v.hints ? `<svg width="${R1(rs)}" height="${R1(rs)}" viewBox="0 0 40 40" style="left:${R1(hb.dx + 32 * s - rs / 2)}px;top:${R1(hb.dy + 21 * s - rs / 2)}px" aria-hidden="true">${RETICLE}</svg>` : '';
        return `<button type="button" class="bd-btn bd-reticle" data-act="move" data-id="${id}" aria-label="进攻${R.label(id)}的对方棋子" style="left:${R1(hb.left)}px;top:${R1(hb.top)}px;width:${R1(hb.w)}px;height:${R1(hb.h)}px;z-index:${Math.round(p.y) + 102}">${ret}</button>`;
      }).join('');
    }
    if (g.fog) {
      html += `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="z-index:5000" aria-hidden="true"><path d="${g.fog.d}" fill="#E4F7F0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path><path d="${g.fog.curls}" fill="none" stroke="#A6E2D0" stroke-width="3" stroke-linecap="round"></path></svg>`;
      const ft = v.fogText || '迷雾之后 · 对手正在布阵';
      html += `<div class="bd-fog-label" style="top:${g.fog.ty}px;font-size:${g.fog.fs}px"><span>${esc(ft)}</span>${v.fogDone ? '' : '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>'}</div>`;
    }
    if (v.pop && occ[v.pop]) {
      const p = cp[v.pop], s = tileU * U * p.k / 64;
      const cols = compact ? 5 : 7, cell = compact ? 44 : 34, gap = 6;
      const pw = cols * cell + (cols - 1) * gap + 30;
      const rows = Math.ceil((MARKS.length + 1) / cols);
      const ph = (compact ? 60 : 50) + rows * cell + (rows - 1) * gap + 18;
      const left = Math.max(8, Math.min(W - pw - 8, p.x - pw / 2));
      let top = p.y - 34 * s - ph - 4;
      if (top < 8) top = Math.min(H - ph - 8, p.y + 30 * s + 8);
      const cur = (v.marks && v.marks[v.pop]) || '', xs = compact ? 44 : 30;
      html += `<div class="bd-pop" role="dialog" aria-label="标记这枚对方棋子" style="left:${R1(left)}px;top:${R1(top)}px;width:${R1(pw)}px"><div class="bd-pop-head"><b>标记这枚对方棋子</b><button type="button" class="bd-pop-x" data-act="close-pop" aria-label="关闭标记面板" style="width:${xs}px;height:${xs}px"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"></path></svg></button></div><div class="bd-pop-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">` +
        MARKS.map((m) => `<button type="button" data-act="mark" data-v="${m}" aria-pressed="${cur === m}" aria-label="标记为${m}" style="height:${cell}px">${m}</button>`).join('') +
        `<button type="button" class="clear" data-act="mark" data-v="" aria-label="清除标记" style="height:${cell}px">清除</button></div></div>`;
    }
    if (v.over) {
      const o = v.over;
      html += `<div class="bd-win"><div class="bd-win-card" role="status">${o.tone === 'lose' ? WHITE_FLAG : o.tone === 'draw' ? SCALE_ICON : FLAG_ICON}<div class="t ${o.tone}">${esc(o.title)}</div><div class="muted" style="font-size:15px">${esc(o.text)}</div><div class="btns"><button type="button" class="btn btn-primary" data-act="result">查看战绩</button><button type="button" class="btn" data-act="review">复盘棋盘</button></div></div></div>`;
    }
    if (v.pending) html += '<div class="bd-pending" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>裁判判定中</div>';
    const ae = document.activeElement;
    let want = this.focusNext;
    if (!want && ae && this.el.contains(ae) && ae.dataset && ae.dataset.act) want = { act: ae.dataset.act, id: ae.dataset.id, v: ae.dataset.v };
    this.focusNext = null;
    this.el.innerHTML = html;
    if (want) {
      let sel = `[data-act="${want.act}"]`;
      if (want.id) sel += `[data-id="${want.id}"]`;
      if (want.v !== undefined && want.v !== null) sel += `[data-v="${want.v}"]`;
      const q = this.el.querySelector(sel);
      if (q) q.focus({ preventScroll: true });
    }
  }

  /** 让刚走过的那枚棋子沿路径滑到终点（只是视觉效果） */
  animatePath(pid, path) {
    if (!pid || !path || path.length < 2 || !this.geo) return;
    if (document.body.classList.contains('reduce-motion') || !Element.prototype.animate) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = this.el.querySelector(`[data-pid="${CSS.escape(pid)}"]`);
    if (!el) return;
    const cp = this.geo.cp, end = cp[path[path.length - 1]];
    const frames = path.map((id) => ({ transform: `translate(${R1(cp[id].x - end.x)}px, ${R1(cp[id].y - end.y)}px)` }));
    el.classList.add('moving');
    const anim = el.animate(frames, { duration: Math.min(900, 170 * (path.length - 1) + 90), easing: 'ease-in-out' });
    anim.onfinish = anim.oncancel = () => el.classList.remove('moving');
  }
}
