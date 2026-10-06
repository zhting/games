/* UI 基础：牌面渲染、头像、弹窗、Toast */
(function () {
  'use strict';

  var GDY = window.GDY;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------- 头像：12 个机器人 ----------
   * 设计稿使用的是同一套机械头像的不同配色。这里用一枚透明机器人素材
   * 做基准，再以色相/亮度变体保持风格统一，同时避免 emoji 在不同设备上漂移。
   */
  var AVATARS = [
    { bg: '#4153a1', hue: '0deg' }, { bg: '#37415d', hue: '24deg' }, { bg: '#5141b2', hue: '48deg' },
    { bg: '#7d3b57', hue: '76deg' }, { bg: '#566578', hue: '102deg' }, { bg: '#2f785f', hue: '132deg' },
    { bg: '#4b5976', hue: '156deg' }, { bg: '#6740ad', hue: '184deg' }, { bg: '#3f4db5', hue: '208deg' },
    { bg: '#29364b', hue: '236deg' }, { bg: '#8c5630', hue: '270deg' }, { bg: '#41669c', hue: '300deg' }
  ];
  function avatarParts(avatarId) {
    var composite = /^p([1-5])-([1-5])-([1-5])$/.exec(avatarId || '');
    if (composite) return { head: +composite[1], eyes: +composite[2], mouth: +composite[3] };
    var legacy = /^a([1-9]|1[0-2])$/.exec(avatarId || '');
    var idx = legacy ? parseInt(legacy[1], 10) - 1 : 0;
    return {
      head: (idx % 5) + 1,
      eyes: (Math.floor(idx / 5) % 5) + 1,
      mouth: (Math.floor(idx / 2) % 5) + 1
    };
  }
  /* 设计稿的紫色胶囊面罩：眼部提供完整面罩，嘴部只叠加下半段，
   * 最上层安装头盔。缩略图保留完整面罩，便于对照原稿选择。 */
  var AVATAR_PARTS = {
    head: [[230, 296], [210, 277], [209, 275], [207, 284], [242, 270]],
    eyes: [[179, 267], [178, 267], [179, 267], [182, 267], [181, 267]],
    mouth: [[179, 262], [180, 262], [181, 263], [182, 263], [181, 262]]
  };
  var avatarMaskSerial = 0;
  function avatarPartSource(type, value) {
    return '/games/gandengyan/assets/layers/avatar-v3/' + type + '-' + value + '.png';
  }
  function avatarPartGeometry(type, value) {
    var index = Math.max(0, Math.min(4, (Number(value) || 1) - 1));
    var size = AVATAR_PARTS[type][index];
    var height = type === 'head' ? 435 : 380;
    var width = type === 'head' ? size[0] / size[1] * height : 255;
    return { x: 256 - width / 2, y: type === 'head' ? 30 : 92, width: width, height: height };
  }
  function avatarPartImage(type, value) {
    var g = avatarPartGeometry(type, value);
    return '<image class="avatar-part avatar-part-' + type + '" data-part-value="' + value + '"' +
      ' x="' + g.x + '" y="' + g.y + '" width="' + g.width + '" height="' + g.height + '"' +
      ' href="' + avatarPartSource(type, value) + '" preserveAspectRatio="none"/>';
  }
  function avatarPartHTML(type, value) {
    var g = avatarPartGeometry(type, value);
    var viewBox = [g.x - 10, g.y - 10, g.width + 20, g.height + 20].join(' ');
    return '<svg class="pf-part-swatch pf-part-swatch-' + type + '" viewBox="' + viewBox + '"' +
      ' aria-hidden="true" focusable="false">' +
      (type === 'head' ? avatarPartImage('mouth', 1) : '') + avatarPartImage(type, value) + '</svg>';
  }
  function avatarHTML(avatarId, extraCls) {
    var parts = /^p([1-5])-([1-5])-([1-5])$/.exec(avatarId || '');
    if (parts) {
      var maskId = 'avatar-mouth-' + (++avatarMaskSerial);
      return '<span class="avatar avatar-composite ' + (extraCls || '') + '" role="img" aria-label="组合机甲头像">' +
        '<svg class="avatar-art" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="' + maskId + '-fade" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="black"/><stop offset=".62" stop-color="black"/>' +
        '<stop offset=".75" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient>' +
        '<mask id="' + maskId + '"><rect width="512" height="512" fill="url(#' + maskId + '-fade)"/></mask></defs>' +
        avatarPartImage('eyes', parts[2]) + '<g mask="url(#' + maskId + ')">' + avatarPartImage('mouth', parts[3]) + '</g>' + avatarPartImage('head', parts[1]) +
        '</svg>' +
        '</span>';
    }
    var idx = 0;
    var m = /^a([1-9]|1[0-2])$/.exec(avatarId || '');
    if (m) idx = parseInt(m[1], 10) - 1;
    var a = AVATARS[idx] || AVATARS[0];
    return '<span class="avatar avatar-a' + (idx + 1) + ' ' + (extraCls || '') + '" style="--avatar-bg:' + a.bg + ';--avatar-hue:' + a.hue + '"><img src="/games/gandengyan/assets/robot-avatar.png" alt=""></span>';
  }

  /* ---------- 倒计时：金属外框 → 凹槽 → 立体进度条 → 上层银色圆盘 ---------- */
  var TIMER_RING_PATH = 'M200 76A124 124 0 1 0 200 324A124 124 0 1 0 200 76';
  var timerRingSerial = 0;
  function timerRingHTML(prefix) {
    var key = 'timer-ring-' + (++timerRingSerial);
    return '<svg viewBox="0 0 400 400" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="' + key + '-track" x2="0" y2="1"><stop stop-color="#344a57"/><stop offset=".6" stop-color="#516975"/><stop offset="1" stop-color="#627985"/></linearGradient>' +
      '<linearGradient id="' + key + '-side" x2="0" y2="1"><stop stop-color="#163b4e"/><stop offset=".55" stop-color="#103343"/><stop offset="1" stop-color="#0a2637"/></linearGradient>' +
      '<linearGradient id="' + key + '-face" x2="0" y2="1"><stop stop-color="#43c6ed"/><stop offset=".45" stop-color="#28addb"/><stop offset="1" stop-color="#178bb9"/></linearGradient>' +
      '<linearGradient id="' + key + '-rim" x2="0" y2="1"><stop stop-color="#f0f4f6"/><stop offset=".55" stop-color="#c7d0d6"/><stop offset="1" stop-color="#9daab4"/></linearGradient>' +
      '<linearGradient id="' + key + '-disc" x2="0" y2="1"><stop stop-color="#fcfdfd"/><stop offset=".45" stop-color="#e0e4e6"/><stop offset="1" stop-color="#bec7cd"/></linearGradient>' +
      '</defs>' +
      '<image class="timer-housing" href="/games/gandengyan/assets/layers/battle-v2/timer-housing-v2.png" x="-110.17" y="-3.01" width="621.15" height="414.10"/>' +
      '<path class="' + prefix + '-bg" d="' + TIMER_RING_PATH + '"/>' +
      '<path class="timer-track-bevel" d="' + TIMER_RING_PATH + '" stroke="url(#' + key + '-track)" stroke-width="32"/>' +
      '<path class="' + prefix + '-fg" data-timer-progress d="' + TIMER_RING_PATH + '" stroke="url(#' + key + '-side)" pathLength="100"/>' +
      '<path class="timer-progress-face" data-timer-progress d="' + TIMER_RING_PATH + '" stroke="url(#' + key + '-face)" stroke-width="23" pathLength="100"/>' +
      '<path class="timer-progress-shadow" data-timer-progress d="M200 63A137 137 0 1 0 200 337A137 137 0 1 0 200 63" stroke="#143e50" stroke-width="3" pathLength="100"/>' +
      '<g class="timer-center-disc">' +
      '<circle cx="200" cy="202" r="115" fill="#6f818f"/>' +
      '<circle cx="200" cy="200" r="113" fill="url(#' + key + '-rim)"/>' +
      '<circle cx="200" cy="200" r="106" fill="url(#' + key + '-disc)"/>' +
      '</g>' +
      '</svg>';
  }
  function updateTimerProgress(timer, seconds) {
    var remain = Math.min(30, Math.max(0, Number(seconds) || 0));
    timer.querySelectorAll('[data-timer-progress]').forEach(function (arc) {
      arc.style.strokeDashoffset = 100 * (1 - remain / 30);
      // Hide the side wall and contact shadow together at zero.
      arc.style.visibility = remain > 0 ? 'visible' : 'hidden';
    });
  }

  function battleAvatarHTML(avatarId) {
    var parts = /^p([1-5])-([1-5])-([1-5])$/.test(avatarId || '');
    var legacy = /^a([1-9]|1[0-2])$/.exec(avatarId || '');
    var variant = legacy ? AVATARS[+legacy[1] - 1] : AVATARS[0];
    return '<span class="battle-portrait" role="img" aria-label="机甲头像" style="--battle-avatar-hue:' + variant.hue + '">' +
      '<img class="battle-portrait-art" src="/games/gandengyan/assets/layers/battle-v2/player-module.png" alt="" aria-hidden="true">' +
      (parts ? '<span class="battle-custom-head">' + avatarHTML(avatarId) + '</span>' : '') + '</span>';
  }

  /* ---------- 扑克牌 ---------- */
  function cardHTML(id, extraCls) {
    var r = GDY.rankOf(id), suit = GDY.suitOf(id), red = GDY.isRed(id);
    var cls = 'card ' + (red ? 'red' : 'blk') + (extraCls ? ' ' + extraCls : '');
    if (id >= 52) {
      var big = id === 53;
      cls += ' joker' + (big ? ' joker-big' : ' joker-small');
      return '<div class="' + cls + '" data-id="' + id + '">' +
        '<span class="jk-label">' + (big ? 'JOKER' : 'joker') + '</span>' +
        '<span class="jk-crown"><img src="/games/gandengyan/assets/layers/battle-v2/joker-crown.png" alt="王冠"></span>' +
        '<span class="jk-corner">' + (big ? '王' : '王') + '</span></div>';
    }
    var name = GDY.rankName(id), sc = GDY.suitChar(id);
    return '<div class="' + cls + '" data-id="' + id + '">' +
      '<span class="corner">' + name + '<i>' + sc + '</i></span>' +
      '<span class="pip">' + sc + '</span>' +
      '<span class="corner c2">' + name + '<i>' + sc + '</i></span>' +
      '</div>';
  }
  function cardBackHTML(extraCls) {
    return '<div class="card back ' + (extraCls || '') + '"><span class="back-diamond">◆</span></div>';
  }
  function cardsHTML(ids, extraCls) {
    return ids.map(function (id) { return cardHTML(id, extraCls); }).join('');
  }

  /* ---------- 卡牌背面堆（显示数量） ---------- */
  function stackHTML(n, maxShow) {
    maxShow = maxShow || 5;
    var show = Math.min(n, maxShow);
    var html = '';
    for (var i = 0; i < show; i++) {
      html += '<div class="mini-back" style="left:' + (i * 14) + 'px;bottom:' + (i * 5) + 'px;z-index:' + i + '">' + cardBackHTML() + '</div>';
    }
    if (n > 0) html += '<b class="stack-n">' + n + '</b>';
    return '<div class="stack-wrap">' + html + '</div>';
  }

  /* ---------- Toast ---------- */
  function toast(msg, dur) {
    var wrap = $('#toast-wrap');
    var t = el('div', 'toast', msg);
    wrap.appendChild(t);
    window.Sound && Sound.sfx.toast();
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, dur || 1800);
  }

  /* ---------- 弹窗 ---------- */
  var modalStack = [];
  function modal(opts) {
    // opts: {title, banner, body(html or node), cls, onOk, okText, cancelText, okClass, cancelClass, okFirst, onClose, maskClose}
    // 结构：mask > sci-frame(装饰/标题/横幅，不裁剪) > sci-dialog(内容区，可滚动)
    var root = $('#modal-root');
    var mask = el('div', 'modal-mask');
    var frame = el('div', 'sci-frame ' + (opts.cls || ''));
    frame.innerHTML = '<div class="sd-deco tl"></div><div class="sd-deco tr"></div><div class="sd-deco bl"></div><div class="sd-deco br"></div>';
    if (opts.title) frame.insertAdjacentHTML('beforeend', '<div class="sd-title"><span>' + opts.title + '</span></div>');
    if (opts.banner) frame.insertAdjacentHTML('beforeend', opts.banner);
    var box = el('div', 'sci-dialog');
    var bodyWrap = el('div', 'sd-body');
    if (typeof opts.body === 'string') bodyWrap.innerHTML = opts.body;
    else if (opts.body) bodyWrap.appendChild(opts.body);
    box.appendChild(bodyWrap);

    if (opts.okText || opts.cancelText || opts.onOk) {
      var btns = el('div', 'sd-btns');
      if (opts.cancelText !== null) {
        var cBtn = el('button', 'btn-metal' + (opts.cancelClass ? ' ' + opts.cancelClass : ''), opts.cancelText || '取消');
        cBtn.onclick = function () { Sound.sfx.click(); close(); if (opts.onCancel) opts.onCancel(); };
        btns.appendChild(cBtn);
      }
      if (opts.okText !== null) {
        var okLabel = opts.okText || '确定';
        var oBtn = el('button', 'btn-metal primary' + (okLabel === '确定' ? ' btn-cylinder' : '') + (opts.okClass ? ' ' + opts.okClass : ''), okLabel);
        oBtn.onclick = function () { Sound.sfx.click(); if (opts.onOk) { if (opts.onOk(close) === false) return; } else close(); };
        btns.appendChild(oBtn);
        if (opts.okFirst && cBtn) btns.insertBefore(oBtn, cBtn);
      }
      box.appendChild(btns);
    }
    frame.appendChild(box);
    mask.appendChild(frame);
    mask.addEventListener('pointerdown', function (e) {
      if (e.target === mask && opts.maskClose !== false) close();
    });
    root.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('show'); });
    function close() {
      mask.classList.remove('show');
      setTimeout(function () { mask.remove(); }, 250);
      var i = modalStack.indexOf(api); if (i >= 0) modalStack.splice(i, 1);
      if (opts.onClose) opts.onClose();
    }
    var api = { close: close, box: box, frame: frame, body: bodyWrap };
    modalStack.push(api);
    return api;
  }
  function closeAllModals() {
    while (modalStack.length) modalStack.pop().close();
  }

  /* ---------- 通用确认框 ---------- */
  function confirmBox(text, onOk, options) {
    options = options || {};
    return modal({
      cls: options.cls,
      banner: options.banner,
      cancelClass: options.cancelClass,
      okFirst: options.okFirst,
      body: '<div class="confirm-text">' + text + '</div>',
      okText: '确定', cancelText: '取消',
      onOk: function () { closeAllModals(); if (onOk) onOk(); return false; }
    });
  }

  /* ---------- 时钟 ---------- */
  function tickClocks() {
    var d = new Date();
    var s = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    ['home-clock', 'wait-clock', 'battle-clock', 'leaderboard-clock', 'missions-clock'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.textContent = s;
    });
  }
  setInterval(tickClocks, 5000);
  tickClocks();

  /* ---------- 星空背景 ---------- */
  function initStars() {
    var screen = document.getElementById('scr-login');
    if (!screen || screen.dataset.spaceFxReady === 'true') return;
    screen.dataset.spaceFxReady = 'true';

    var fxRoot = el('div', 'login-space-fx');
    var starfield = el('div', 'space-starfield');
    var meteorLayer = el('div', 'space-meteor-layer');
    fxRoot.setAttribute('aria-hidden', 'true');
    starfield.setAttribute('aria-hidden', 'true');
    meteorLayer.setAttribute('aria-hidden', 'true');
    fxRoot.appendChild(starfield);
    fxRoot.appendChild(meteorLayer);
    var frameArt = screen.querySelector('.login-frame-art');
    screen.insertBefore(fxRoot, frameArt ? frameArt.nextSibling : screen.firstChild);

    var motionPreference = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var reducedMotion = motionPreference && motionPreference.matches;
    var resizeTimer = 0;
    function makeStars() {
      starfield.textContent = '';
      var count = Math.max(110, Math.min(300, Math.round(innerWidth * innerHeight / 6500)));
      // 明显的四角星芒放在封面留白处，避免随机落在标题和 Play 装甲背后。
      var phone = innerWidth < 600 && innerHeight > innerWidth;
      var flarePositions = phone
        ? [[13,31], [83,37], [24,49], [75,55], [11,66], [89,72], [33,84], [68,87]]
        : [[12,28], [87,33], [8,50], [26,52], [42,53], [63,48], [80,50], [92,61], [12,69], [29,74], [72,75], [87,83]];
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < count + flarePositions.length; i++) {
        var star = el('i', 'space-star');
        var flare = i >= count;
        var bright = flare || Math.random() < .18;
        var blue = Math.random() < .28;
        var twinkling = bright || Math.random() < .65;
        var size = (flare ? 3 + Math.random() * 1.5 : bright ? 1.15 + Math.random() * .6 : .55 + Math.random() * .75).toFixed(2);
        var dim = flare ? .06 + Math.random() * .06 : bright ? .18 + Math.random() * .16 : .12 + Math.random() * .22;
        var peak = flare ? 1 : bright ? .86 + Math.random() * .14 : .52 + Math.random() * .38;
        star.classList.toggle('is-bright', bright);
        star.classList.toggle('is-flare', flare);
        star.classList.toggle('is-blue', blue);
        star.classList.toggle('is-twinkling', twinkling && !reducedMotion);
        var position = flare && flarePositions[i - count];
        star.style.setProperty('--star-x', (flare ? position[0] + Math.random() * 3 - 1.5 : Math.random() * 100).toFixed(2) + '%');
        star.style.setProperty('--star-y', (flare ? position[1] + Math.random() * 3 - 1.5 : Math.random() * 100).toFixed(2) + '%');
        star.style.setProperty('--star-size', size + 'px');
        star.style.setProperty('--star-ray', (flare ? (phone ? 30 : 48) + Math.random() * (phone ? 18 : 28) : 20 + Math.random() * 16).toFixed(1) + 'px');
        star.style.setProperty('--star-ray-width', (flare ? 1.8 + Math.random() * .7 : 1.2 + Math.random() * .4).toFixed(2) + 'px');
        star.style.setProperty('--star-dim', dim.toFixed(2));
        star.style.setProperty('--star-peak', peak.toFixed(2));
        star.style.setProperty('--star-mid', (dim + (peak - dim) * .28).toFixed(2));
        star.style.setProperty('--star-period', (flare ? 3.4 + Math.random() * 2.6 : 3.2 + Math.random() * 4.8).toFixed(2) + 's');
        star.style.setProperty('--star-delay', (flare ? -(i - count) * .65 - Math.random() * .3 : -Math.random() * 10).toFixed(2) + 's');
        fragment.appendChild(star);
      }
      starfield.appendChild(fragment);
    }
    makeStars();
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(makeStars, 180);
    }, { passive: true });

    if (reducedMotion) return;
    function scheduleMeteor() {
      window.setTimeout(function () {
        if (!document.hidden && screen.classList.contains('active') && !(motionPreference && motionPreference.matches)) {
          var batch = Math.random() < .45 ? 2 : 1;
          for (var j = 0; j < batch && meteorLayer.childElementCount < 8; j++) {
            var meteor = el('i', 'space-meteor');
            var length = Math.min(520, Math.max(150, innerWidth * .18) + Math.random() * Math.min(180, innerWidth * .32));
            var duration = 1.9 + Math.random() * 1.05;
            meteor.style.setProperty('--meteor-x', (30 + Math.random() * 67).toFixed(1) + 'vw');
            meteor.style.setProperty('--meteor-y', (5 + Math.random() * 56).toFixed(1) + 'vh');
            meteor.style.setProperty('--meteor-length', length.toFixed(0) + 'px');
            meteor.style.setProperty('--meteor-width', (.65 + Math.random() * .4).toFixed(2) + 'px');
            meteor.style.setProperty('--meteor-angle', (-28 - Math.random() * 12).toFixed(1) + 'deg');
            meteor.style.setProperty('--meteor-travel', (-length * (1.15 + Math.random() * .5)).toFixed(0) + 'px');
            meteor.style.setProperty('--meteor-duration', duration.toFixed(2) + 's');
            meteorLayer.appendChild(meteor);
            meteor.addEventListener('animationend', function (event) { event.currentTarget.remove(); }, { once: true });
            window.setTimeout(function (node) { node.remove(); }, duration * 1000 + 400, meteor);
          }
        }
        scheduleMeteor();
      }, 1000 + Math.random() * 1000);
    }
    scheduleMeteor();
  }

  window.UI = {
    $: $, el: el, AVATARS: AVATARS, avatarParts: avatarParts, avatarPartHTML: avatarPartHTML,
    avatarHTML: avatarHTML, battleAvatarHTML: battleAvatarHTML, cardHTML: cardHTML, cardBackHTML: cardBackHTML,
    timerRingHTML: timerRingHTML, updateTimerProgress: updateTimerProgress,
    cardsHTML: cardsHTML, stackHTML: stackHTML,
    toast: toast, modal: modal, closeAllModals: closeAllModals,
    confirmBox: confirmBox, initStars: initStars
  };
})();
