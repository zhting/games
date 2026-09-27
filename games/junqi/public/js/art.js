// 美术素材：军衔徽章、Q 版头像、棋子。全部是内联 SVG 字符串，无外部图片。
import { NAMES, TIERS } from '../shared/rules.js';

export const INK = '#2A1D3D';
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function badgeSVG(tier, size) {
  const t = TIERS[tier] || TIERS[0];
  const h = Math.round(size * 154 / 132);
  const shield = 'M60 14C74 22 90 24 104 24C104 74 90 106 60 124C30 106 16 74 16 24C30 24 46 22 60 14Z';
  const wing = 'M34 38C20 30 4 34-2 46c8 1 12 4 11 9-7 2-11 7-11 12 8-1 13 2 14 6-6 3-8 7-7 11 11-2 21-6 29-14z';
  const n = tier === 2 || tier === 3 ? 1 : tier >= 6 && tier <= 8 ? tier - 5 : 0;
  let s = `<svg width="${size}" height="${h}" viewBox="-6 -16 132 154" role="img" aria-label="军衔 ${t.n}" style="display:block">`;
  if (tier >= 4) {
    const wc = tier >= 7 ? '#FFC83D' : '#FFF6E3';
    s += `<path d="${wing}" fill="${wc}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path><path d="${wing}" fill="${wc}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" transform="matrix(-1 0 0 1 120 0)"></path>`;
  }
  s += `<path d="${shield}" transform="translate(0 7)" fill="${t.d}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"></path>`;
  s += `<path d="${shield}" fill="${t.c}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"></path>`;
  s += `<path d="${shield}" transform="translate(60 68) scale(.8) translate(-60 -68)" fill="none" stroke="${t.l}" stroke-width="3.5" stroke-linejoin="round"></path>`;
  s += '<path d="M28 33C38 31 49 28 58 23" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"></path>';
  for (let i = 0; i < n; i++) s += `<path d="M0-8 2.4-2.5 8.3-2.3 3.8 1.4 5.2 7.2 0 4-5.2 7.2-3.8 1.4-8.3-2.3-2.4-2.5Z" transform="translate(${60 + (i - (n - 1) / 2) * 19} 3)" fill="${tier >= 6 ? '#FFC83D' : '#FFF6E3'}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"></path>`;
  if (tier === 9) s += `<path d="M38 19 40-4l10 12 10-18 10 18 10-12 2 23z" fill="#FFC83D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path><circle cx="40" cy="-4" r="3.6" fill="#E8453A" stroke="${INK}" stroke-width="2"></circle><circle cx="60" cy="-10" r="4" fill="#3D6BFF" stroke="${INK}" stroke-width="2"></circle><circle cx="80" cy="-4" r="3.6" fill="#E8453A" stroke="${INK}" stroke-width="2"></circle>`;
  s += `<text x="60" y="86" text-anchor="middle" font-size="46" font-family="'ZCOOL QingKe HuangYou','PingFang SC',sans-serif" fill="#FFF6E3" stroke="${INK}" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${t.ch}</text></svg>`;
  return s;
}

export const TONES = {
  red: { cap: '#E8453A', brim: '#A92A21', bg: '#FFE1D6', uni: '#6E9A45', tab: '#E8453A' },
  blue: { cap: '#3355E8', brim: '#1F3AAE', bg: '#DCE4FF', uni: '#5B7A3A', tab: '#3355E8' },
  jade: { cap: '#22B893', brim: '#0F7A5E', bg: '#D5F5EA', uni: '#6E9A45', tab: '#FFC83D' },
  gold: { cap: '#FFC83D', brim: '#C98A00', bg: '#FFF1C7', uni: '#6E9A45', tab: '#E8453A' },
  violet: { cap: '#9B5BFF', brim: '#5E2DB8', bg: '#EBDFFF', uni: '#5B7A3A', tab: '#FFC83D' }
};
const TONE_KEYS = Object.keys(TONES);
const MOODS = ['smile', 'happy', 'cool'];

/** 根据名字稳定地挑一个头像配色和表情 */
export function looksOf(seed) {
  let h = 2166136261;
  for (const ch of String(seed || '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  h >>>= 0;
  return { tone: TONE_KEYS[h % TONE_KEYS.length], mood: MOODS[(h >>> 8) % MOODS.length] };
}

export function avatarSVG(tone, mood, size) {
  const t = TONES[tone] || TONES.red;
  const fill = size === 'fill';
  const dim = fill ? 'width="100%" height="100%"' : `width="${size}" height="${size}"`;
  const ring = !fill && size < 48 ? 5 : 3;
  let eyes, mouth;
  if (mood === 'happy') {
    eyes = `<path d="M36.5 60.5c1.5-4.5 7.5-4.5 9 0M54.5 60.5c1.5-4.5 7.5-4.5 9 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"></path>`;
    mouth = `<path d="M44 67.5c0 7 12 7 12 0z" fill="#B52E25" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"></path>`;
  } else if (mood === 'cool') {
    eyes = `<path d="M33 56h34" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"></path><path d="M34 56h13c0 5-2 8-6.5 8S34 61 34 56zM53 56h13c0 5-2 8-6.5 8S53 61 53 56z" fill="${INK}"></path><path d="M37 58.5h4M56 58.5h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"></path>`;
    mouth = `<path d="M45 70c3 1 7 0 10-2.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"></path>`;
  } else {
    eyes = `<ellipse cx="41" cy="59" rx="3.4" ry="4.4" fill="${INK}"></ellipse><ellipse cx="59" cy="59" rx="3.4" ry="4.4" fill="${INK}"></ellipse><circle cx="42.2" cy="57.4" r="1.3" fill="#fff"></circle><circle cx="60.2" cy="57.4" r="1.3" fill="#fff"></circle>`;
    mouth = `<path d="M45.5 68.5c2.5 3 6.5 3 9 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"></path>`;
  }
  return `<svg ${dim} viewBox="0 0 100 100" aria-hidden="true" style="display:block">` +
    `<circle cx="50" cy="50" r="47" fill="${t.bg}" stroke="${INK}" stroke-width="${ring}"></circle>` +
    `<path d="M17 97c3-15 16-22 33-22s30 7 33 22z" fill="${t.uni}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path>` +
    `<path d="M40 77l10 9 10-9" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>` +
    `<rect x="27" y="82" width="9" height="6" rx="1.5" fill="${t.tab}" stroke="${INK}" stroke-width="2"></rect><rect x="64" y="82" width="9" height="6" rx="1.5" fill="${t.tab}" stroke="${INK}" stroke-width="2"></rect>` +
    `<circle cx="23.5" cy="57" r="5.5" fill="#FFD2B0" stroke="${INK}" stroke-width="2.5"></circle><circle cx="76.5" cy="57" r="5.5" fill="#FFD2B0" stroke="${INK}" stroke-width="2.5"></circle>` +
    `<ellipse cx="50" cy="55" rx="27" ry="25" fill="#FFDCC2" stroke="${INK}" stroke-width="3"></ellipse>` +
    `<path d="M22 45c0-19 12-29 28-29s28 10 28 29z" fill="${t.cap}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path>` +
    '<path d="M30 22c5-3 10-4 16-4" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".5"></path>' +
    `<path d="M19 45c10 5 52 5 62 0 1 4-1 7-4 8-12 4-42 4-54 0-3-1-5-4-4-8z" fill="${t.brim}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"></path>` +
    `<path d="M50 24.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#FFC83D" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"></path>` +
    '<ellipse cx="34" cy="66" rx="5.5" ry="3.2" fill="#FF8FA0" opacity=".8"></ellipse><ellipse cx="66" cy="66" rx="5.5" ry="3.2" fill="#FF8FA0" opacity=".8"></ellipse>' +
    eyes + mouth + '</svg>';
}

function pips(k, col) {
  const star = '<svg width="8" height="8" viewBox="0 0 10 10"><path d="M5 .4 6.4 3.4 9.6 3.8 7.2 6 7.9 9.3 5 7.7 2.1 9.3 2.8 6 .4 3.8 3.6 3.4Z" fill="#F29D00" stroke="#B86A00" stroke-width=".6"></path></svg>';
  const sn = { sl: 4, jz: 3, shz: 2, lvz: 1 }[k] || 0, dn = { tz: 3, yz: 2, lz: 1 }[k] || 0;
  if (sn) return star.repeat(sn);
  if (dn) return '<span class="pc-dot"></span>'.repeat(dn);
  if (k === 'pz') return '<span class="pc-bar"></span>';
  if (k === 'gb') return `<svg width="14" height="9" viewBox="0 0 14 9"><path d="M1 4.5h7" stroke="${col}" stroke-width="1.8" stroke-linecap="round"></path><path d="M8 1.5h3.2c1.4 0 2.3 1.4 2.3 3s-.9 3-2.3 3H8z" fill="${col}"></path></svg>`;
  if (k === 'dl') return `<svg width="12" height="9" viewBox="0 0 12 9"><path d="M2 8.5h8a4 4 0 0 0-8 0z" fill="${col}"></path><path d="M6 1v2M2.2 2.6l1.3 1.3M9.8 2.6 8.5 3.9" stroke="${col}" stroke-width="1.4" stroke-linecap="round"></path></svg>`;
  if (k === 'zd') return `<svg width="12" height="10" viewBox="0 0 12 10"><circle cx="5" cy="6" r="3.6" fill="${col}"></circle><path d="M7.4 3.4 9 1.8" stroke="${col}" stroke-width="1.4" stroke-linecap="round"></path><circle cx="10" cy="1.2" r="1.1" fill="#F29D00"></circle></svg>`;
  if (k === 'jq') return `<svg width="11" height="10" viewBox="0 0 11 10"><path d="M1.5 9.5V.8" stroke="${col}" stroke-width="1.5" stroke-linecap="round"></path><path d="M2 1h7.5L7.6 3.2 9.5 5.4H2z" fill="${col}"></path></svg>`;
  return '';
}

/**
 * 一枚棋子。side: 'red' | 'blue'；face: 'front' | 'back'；
 * mode: normal | selected | target | dim；mark: 背面上的猜测标记
 */
export function pieceHTML(k, side, face, mode, mark) {
  const red = side !== 'blue', back = face === 'back' || !k;
  const col = red ? '#C02A1E' : '#2442C8';
  const faceC = red ? '#E8453A' : '#3355E8';
  const cls = 'pc ' + (red ? 'red' : 'blue') + (back ? ' back' : '') + (mode === 'selected' ? ' is-sel' : mode === 'target' ? ' is-target' : mode === 'dim' ? ' is-dim' : '');
  const inner = back
    ? `<span class="pc-backline"></span><svg class="pc-emblem" width="34" height="22" viewBox="0 0 34 22"><path d="M5.5 17.5c-4 0-4.3-6.3-.2-6.4.2-4.7 6-6.6 8.9-3 1.8-5.2 10.4-5 11 1.3 5-.2 6 7.6.6 8.1z" fill="#FFF6E3"></path><path d="M12.4 13.6c-.2-2.6 3.6-3 3.8-.5.1 1.7-2.3 2.1-2.5.4" fill="none" stroke="${faceC}" stroke-width="1.6" stroke-linecap="round"></path><path d="M19.6 12.6c.1-2.1 3.3-2.2 3.4-.2" fill="none" stroke="${faceC}" stroke-width="1.6" stroke-linecap="round"></path></svg>`
    : `<span class="pc-name">${NAMES[k]}</span><span class="pc-pips">${pips(k, col)}</span>`;
  const mk = back && mark ? `<span class="pc-mark">${esc(mark)}</span>` : '';
  return `<span class="${cls}" aria-hidden="true"><span class="pc-shadow"></span><span class="pc-body"><span class="pc-side"></span><span class="pc-face"><span class="pc-gloss"></span>${inner}</span>${mk}</span></span>`;
}

export const pieceBox = (k, side, face, mode, mark, scale) =>
  `<span class="pc-box"${scale == null ? '' : ` style="transform:scale(${scale})"`}>${pieceHTML(k, side, face, mode, mark)}</span>`;

/** 把 data-badge / data-avatar / data-piece 占位符换成 SVG */
export function hydrate(root) {
  root.querySelectorAll('[data-badge]').forEach((el) => {
    el.innerHTML = badgeSVG(+el.dataset.badge, +el.dataset.size || 40);
    el.style.display = 'inline-flex';
    el.style.flex = 'none';
    el.removeAttribute('data-badge');
  });
  root.querySelectorAll('[data-avatar]').forEach((el) => {
    const fill = el.dataset.size === 'fill';
    el.innerHTML = avatarSVG(el.dataset.avatar, el.dataset.mood, fill ? 'fill' : (+el.dataset.size || 40));
    el.style.display = fill ? 'block' : 'inline-flex';
    if (fill) { el.style.width = '100%'; el.style.height = '100%'; } else el.style.flex = 'none';
    el.removeAttribute('data-avatar');
  });
  root.querySelectorAll('[data-piece]').forEach((el) => {
    el.innerHTML = pieceBox(el.dataset.piece, el.dataset.side || 'red', el.dataset.face || 'front', 'normal', '', +el.dataset.scale || 1);
    el.removeAttribute('data-piece');
  });
}

/** 往某个元素里放一个头像（fill = 撑满父元素） */
export function putAvatar(el, tone, mood, size) {
  if (!el) return;
  const fill = size === 'fill';
  el.innerHTML = avatarSVG(tone, mood, size);
  el.style.display = fill ? 'block' : 'inline-flex';
  if (fill) { el.style.width = '100%'; el.style.height = '100%'; } else el.style.flex = 'none';
}

export function putBadge(el, tier, size) {
  if (!el) return;
  el.innerHTML = badgeSVG(tier, size);
  el.style.display = 'inline-flex';
  el.style.flex = 'none';
}
