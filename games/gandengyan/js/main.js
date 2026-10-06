/* 主逻辑：路由、socket、各页面与弹窗 */
(function () {
  'use strict';
  var UI = window.UI, GDY = window.GDY, Sound = window.Sound;
  var $ = UI.$;
  var PLAYER_LIMIT = 5;

  /* ================= 全局状态 ================= */
  var App = {
    socket: null,
    // 优先读每标签页独立的 sessionStorage，避免同浏览器多标签互相覆盖账号
    token: (function () {
      try { return sessionStorage.getItem('gdg_token') || localStorage.getItem('gdg_token') || ''; }
      catch (e) { return localStorage.getItem('gdg_token') || ''; }
    })(),
    user: null,
    seat: -1, state: null,        // 当前对局快照（针对自己裁剪）
    waitInfo: null,               // 等待房信息
    selected: [],                 // 已选手牌
    hintList: [], hintIdx: 0,
    auto: false, counterOn: false,
    seenIds: [],                  // 本局已出现的牌（记牌器）
    resultShownRound: -1,
    tickLast: -1,
    inBattle: false,
    passBubbleUntil: {},
    bootAuthPending: false,
    bootAuthExpired: false,
    bootAuthTimer: null
  };

  function saveToken(t) {
    App.token = t;
    try { localStorage.setItem('gdg_token', t); sessionStorage.setItem('gdg_token', t); } catch (e) {}
  }

  function clearStoredToken() {
    App.token = '';
    try { localStorage.removeItem('gdg_token'); sessionStorage.removeItem('gdg_token'); } catch (e) {}
  }

  function clearBootAuthTimer() {
    if (App.bootAuthTimer) window.clearTimeout(App.bootAuthTimer);
    App.bootAuthTimer = null;
    App.bootAuthPending = false;
  }

  var SCREENS = ['scr-splash', 'scr-login', 'scr-loading', 'scr-home', 'scr-waiting', 'scr-battle'];
  function initLoginOrbit() {
    var stage = $('#login-play-stage');
    if (!stage || stage.dataset.orbitReady === 'true') return;

    var orbit = document.createElement('div');
    orbit.className = 'login-orbit-fragments';
    orbit.setAttribute('aria-hidden', 'true');
    var centerX = 639, centerY = 615;
    var distance = Math.max(4, Math.min(7, stage.clientWidth * .008));
    /* 碎片来自独立透明装甲层，使用该层坐标拆分，各自只做平移。 */
    var pieces = [
      { x: 420, y: 43, w: 436, h: 165 },
      { x: 877, y: 101, w: 209, h: 277 },
      { x: 1063, y: 307, w: 165, h: 534 },
      { x: 814, y: 827, w: 331, h: 268 },
      { x: 466, y: 1025, w: 359, h: 154 },
      { x: 163, y: 811, w: 327, h: 276 },
      { x: 50, y: 377, w: 181, h: 432 },
      { x: 143, y: 114, w: 265, h: 229 }
    ];

    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      var shard = document.createElement('img');
      shard.className = 'login-orbit-shard';
      shard.src = '/games/gandengyan/assets/layers/login-play-pieces-v2/fragment-' + ('0' + (i + 1)).slice(-2) + '.png';
      shard.alt = '';
      shard.draggable = false;
      shard.setAttribute('aria-hidden', 'true');
      shard.style.left = (piece.x / 1278 * 100).toFixed(4) + '%';
      shard.style.top = (piece.y / 1230 * 100).toFixed(4) + '%';
      shard.style.width = (piece.w / 1278 * 100).toFixed(4) + '%';
      shard.style.height = (piece.h / 1230 * 100).toFixed(4) + '%';

      var dirX = piece.x + piece.w / 2 - centerX;
      var dirY = piece.y + piece.h / 2 - centerY;
      var magnitude = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      dirX /= magnitude; dirY /= magnitude;
      var inward = distance * (.65 + Math.random() * .22);
      var outward = distance * (1 + Math.random() * .22);
      var duration = 4.3 + Math.random() * 3.7;
      shard.style.setProperty('--shard-in-x', (-dirX * inward).toFixed(2) + 'px');
      shard.style.setProperty('--shard-in-y', (-dirY * inward).toFixed(2) + 'px');
      shard.style.setProperty('--shard-out-x', (dirX * outward).toFixed(2) + 'px');
      shard.style.setProperty('--shard-out-y', (dirY * outward).toFixed(2) + 'px');
      shard.style.setProperty('--shard-duration', duration.toFixed(2) + 's');
      shard.style.setProperty('--shard-delay', (-Math.random() * duration).toFixed(2) + 's');
      orbit.appendChild(shard);
    }

    stage.insertBefore(orbit, stage.querySelector('.login-play-control'));
    stage.dataset.orbitReady = 'true';
  }
  function startLoginIntro() {
    var login = document.getElementById('scr-login');
    initLoginOrbit();
    login.classList.remove('intro-sequence');
    void login.offsetWidth;
    login.classList.add('intro-sequence');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && Sound && Sound.sfx && typeof Sound.sfx.loginIntro === 'function') {
      Sound.sfx.loginIntro();
    }
  }
  function showScreen(id) {
    SCREENS.forEach(function (s) {
      var screen = document.getElementById(s), active = s === id;
      screen.classList.toggle('active', active);
      screen.inert = !active;
      screen.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    if (id !== 'scr-home') {
      var homeScreen = document.getElementById('scr-home');
      if (homeScreen) {
        homeScreen.classList.remove('menu-expanded');
        var homeMenuToggle = homeScreen.querySelector('[data-act="menu"]');
        var homeMenuDrawer = document.getElementById('home-menu-drawer');
        if (homeMenuToggle) {
          homeMenuToggle.setAttribute('aria-expanded', 'false');
          homeMenuToggle.setAttribute('aria-label', '菜单，展开更多菜单项');
        }
        if (homeMenuDrawer) {
          homeMenuDrawer.setAttribute('aria-hidden', 'true');
          homeMenuDrawer.inert = true;
        }
      }
    }
    App.inBattle = id === 'scr-battle';
    if (id === 'scr-login') startLoginIntro();
  }

  /* ================= Socket ================= */
  function connect() {
    if (typeof window.io !== 'function') {
      console.error('[startup] Socket.IO 客户端脚本未加载');
      return false;
    }
    var config = window.GAMES_BACKEND || {};
    App.socket = window.io(config.url || undefined, { path: config.gandengyanPath || '/games/gandengyan/socket.io' });
    var sk = App.socket;

    sk.on('login', function (res) {
      if (!res.ok) { UI.toast(res.msg || '登录失败'); return; }
      clearBootAuthTimer();
      App.bootAuthExpired = false;
      saveToken(res.token);
      App.user = res.user;
      gotoLoading();
    });

    sk.on('auth', function (res) {
      // 启动验证超时后忽略迟到的旧会话结果，避免登录页突然跳走。
      if (App.bootAuthExpired && !App.token) return;
      clearBootAuthTimer();
      App.bootAuthExpired = false;
      if (!res.ok) { clearStoredToken(); showScreen('scr-login'); return; }
      App.user = res.user;
      gotoLoading();
    });

    sk.on('syncUser', function (res) {
      if (res && res.ok) { App.user = res.user; if (App.inHome()) renderHomeUser(); }
    });

    sk.on('r', function (info) { onRoomInfo(info); });
    sk.on('g', function (p) { onGameState(p); });
    sk.on('evt', function (e) { onGameEvent(e); });
    sk.on('err', function (e) { UI.toast((e && e.msg) || '出错了'); });

    sk.on('disconnect', function () {
      if (App.token) UI.toast('连接断开，正在重连…');
    });
    // socket.io v4 重连成功后触发的是 connect（非 reconnect），需重新认证恢复会话
    var everConnected = false;
    sk.on('connect', function () {
      if (everConnected && App.token) {
        sk.emit('auth', { token: App.token });
      }
      everConnected = true;
    });
    return true;
  }

  App.inHome = function () {
    return document.getElementById('scr-home').classList.contains('active');
  };

  /* ================= 启动流程 ================= */
  function boot() {
    showScreen('scr-splash');
    var hasSavedToken = !!App.token;
    App.bootAuthPending = hasSavedToken;

    // 有旧会话时，服务器若未响应认证也必须退出启动封面，回到可操作的登录页。
    if (hasSavedToken) {
      App.bootAuthTimer = window.setTimeout(function () {
        if (!App.bootAuthPending) return;
        App.bootAuthTimer = null;
        App.bootAuthPending = false;
        App.bootAuthExpired = true;
        clearStoredToken();
        showScreen('scr-login');
        UI.toast('登录状态验证超时，请重新登录');
      }, 6500);
    }

    // 启动转场不依赖星空画布或 Socket.IO 是否成功初始化。
    setTimeout(function () {
      if (hasSavedToken) {
        if (App.token && App.socket) App.socket.emit('auth', { token: App.token });
      } else {
        showScreen('scr-login');
      }
    }, 1800);

    try { UI.initStars(); } catch (e) { console.error('[startup] 背景初始化失败:', e); }
    try { connect(); } catch (e) { App.socket = null; console.error('[startup] 游戏服务初始化失败:', e); }
  }

  function gotoLoading() {
    showScreen('scr-loading');
    var bar = $('#scr-loading .load-bar i');
    if (bar) { bar.style.width = '0'; requestAnimationFrame(function () { bar.style.width = '100%'; }); }
    setTimeout(function () {
      // 认证重连会立即收到房间状态，加载结束应回到该房间。
      if (App.state && /^(waiting|playing|over)$/.test(App.state.phase)) {
        onGameState({ seat: App.seat, state: App.state });
        return;
      }
      showScreen('scr-home');
      renderHomeUser();
    }, 1400);
  }

  /* ================= 首页 ================= */
  // 旧版整张机器人头像在此入口使用统一默认组合；不改写用户已保存的头像。
  function profileAvatarId(avatarId) {
    return /^p[1-5]-[1-5]-[1-5]$/.test(avatarId || '') ? avatarId : 'p1-1-1';
  }
  function renderHomeUser() {
    var u = App.user;
    if (!u) return;
    var hu = $('#home-user');
    hu.querySelector('.hu-avatar').outerHTML =
      '<span class="hu-avatar">' + UI.avatarHTML(profileAvatarId(u.avatar)) + '</span>';
    hu.querySelector('.hu-name').textContent = u.name;
    hu.querySelector('.hu-energy b').textContent = u.energy;
  }

  function bindHome() {
    var home = $('#scr-home');
    var menuToggle = home.querySelector('[data-act="menu"]');
    var menuDrawer = $('#home-menu-drawer');

    function setHomeMenuOpen(open, restoreFocus) {
      home.classList.toggle('menu-expanded', open);
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuToggle.setAttribute('aria-label', open ? '菜单，收起更多菜单项' : '菜单，展开更多菜单项');
      menuDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      menuDrawer.inert = !open;
      if (restoreFocus && !open) menuToggle.focus();
    }

    document.querySelectorAll('.mode-card').forEach(function (c) {
      c.addEventListener('click', function () {
        Sound.sfx.click();
        var mode = c.dataset.mode;
        App.socket.emit('enter', { mode: mode }, function (res) {
          if (!res || !res.ok) { UI.toast((res && res.msg) || '进入失败'); return; }
          if (res.phase === 'playing' || res.phase === 'over') {
            showScreen('scr-battle');
          } else {
            showScreen('scr-waiting');
          }
        });
      });
    });
    $('#home-user').addEventListener('click', openProfile);
    document.querySelectorAll('#scr-home [data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.dataset.act;
        if (act === 'exit') {
          openLogoutConfirm(false);
        } else if (act === 'menu') {
          Sound.sfx.click();
          setHomeMenuOpen(!home.classList.contains('menu-expanded'));
        } else if (act === 'tutorial') openTutorial();
        else if (act === 'help') openHelp();
        else if (act === 'missions') openMissions();
        else if (act === 'leaderboard') openLeaderboard();
      });
    });
    menuDrawer.addEventListener('click', function (event) {
      var button = event.target.closest('[data-home-menu]');
      if (!button) return;
      var action = button.dataset.homeMenu;
      setHomeMenuOpen(false);
      if (action === 'settings') openSettings();
      else if (action === 'feedback') openFeedback();
      else if (action === 'switch') openLogoutConfirm(true);
      else if (action === 'auto') UI.toast('对局中才能开启托管');
      else if (action === 'counter') UI.toast('对局中才能使用记牌器');
    });
    home.addEventListener('click', function (event) {
      if (!home.classList.contains('menu-expanded')) return;
      if (!menuDrawer.contains(event.target) && !event.target.closest('.topbar')) setHomeMenuOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && home.classList.contains('menu-expanded')) {
        event.preventDefault();
        setHomeMenuOpen(false, true);
      }
    });
  }

  function openLogoutConfirm(isSwitch) {
    var action = isSwitch ? '切换账号' : '退出游戏';
    return openExitConfirm(action, doLogout, isSwitch ? 'switch-dialog' : '');
  }

  function openExitConfirm(action, onOk, extraClass) {
    var dialog = UI.confirmBox('确定' + action + '吗？', onOk, {
      cls: 'exit-dialog' + (extraClass ? ' ' + extraClass : ''),
      banner: '<div class="exit-armor" aria-hidden="true"><img class="exit-corner exit-corner-tl" src="/games/gandengyan/assets/layers/result-v2/tl.png" alt=""><img class="exit-corner exit-corner-br" src="/games/gandengyan/assets/layers/result-v2/br.png" alt=""></div>',
      cancelClass: 'btn-cylinder',
      okFirst: true
    });
    dialog.frame.setAttribute('role', 'dialog');
    dialog.frame.setAttribute('aria-modal', 'true');
    dialog.frame.setAttribute('aria-label', action + '确认');
    return dialog;
  }

  function doLogout() {
    try { localStorage.removeItem('gdg_token'); sessionStorage.removeItem('gdg_token'); } catch (e) {}
    App.socket.emit('logout');
    App.token = ''; App.user = null; App.state = null; App.seat = -1;
    UI.closeAllModals();
    showScreen('scr-login');
  }

  /* ================= 登录页 ================= */
  function bindLogin() {
    var loginScreen = $('#scr-login');
    var loginForm = $('#login-form');
    var loginInputFrame = $('#login-input-frame');
    var loginPlayStage = $('#login-play-stage');
    var loginPlayControl = $('#login-play-control');
    var playButton = $('#btn-play');

    function setLoginFormOpen(open) {
      (open ? loginForm : loginPlayStage).appendChild(loginPlayControl);
      loginScreen.classList.toggle('auth-open', open);
      loginForm.setAttribute('aria-hidden', open ? 'false' : 'true');
      loginForm.inert = !open;
      loginInputFrame.setAttribute('aria-hidden', open ? 'false' : 'true');
      loginInputFrame.inert = !open;
      playButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      playButton.setAttribute('aria-label', open ? 'Play，提交登录' : 'Play，打开登录');
      window.setTimeout(function () {
        (open ? $('#in-user') : playButton).focus({ preventScroll: true });
      }, open ? 600 : 0);
    }

    $('#btn-play').addEventListener('click', function () {
      Sound.sfx.click();
      if (!loginScreen.classList.contains('auth-open')) {
        Sound.sfx.loginOpen();
        setLoginFormOpen(true);
        return;
      }
      if (!App.socket || !App.socket.connected) {
        UI.toast(App.socket ? '游戏服务连接中，请稍后重试' : '游戏服务未加载，请检查服务后重试');
        return;
      }
      App.socket.emit('login', {
        name: $('#in-user').value.trim(),
        pass: $('#in-pass').value
      });
    });
    $('#btn-login-back').addEventListener('click', function () {
      Sound.sfx.click();
      setLoginFormOpen(false);
    });
    $('#in-user').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#in-pass').focus(); }
    });
    $('#in-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#btn-play').click(); });
  }

  /* ================= 等待房 ================= */
  function onRoomInfo(info) {
    App.waitInfo = info;
    if (typeof info.seat === 'number') App.seat = info.seat;
    if (info.phase !== 'waiting') return; // 开局由 g 事件驱动
    if (!document.getElementById('scr-waiting').classList.contains('active')) return;
    renderWaiting(info);
  }

  function renderWaiting(info) {
    var wrap = $('#wait-seats');
    var seats = info.seats || [];
    var localSeat = typeof info.seat === 'number' ? info.seat : Math.max(0, App.seat);
    var key = JSON.stringify([localSeat, seats.map(function (s) { return s && [s.name, s.avatar, s.energy, s.connected]; })]);
    // 计时每半秒更新，头像只在座位信息变化时重新安装。
    if (wrap.dataset.seatsKey !== key) {
      wrap.dataset.seatsKey = key;
      wrap.innerHTML = '';
      for (var i = 0; i < PLAYER_LIMIT; i++) {
        var seatIndex = (localSeat + i) % PLAYER_LIMIT, s = seats[seatIndex];
        var node = UI.el('div', 'wseat ws-slot-' + i + (s ? '' : ' empty'));
        node.dataset.seat = seatIndex;
        node.innerHTML = '<img class="ws-podium-art" src="/games/gandengyan/assets/layers/waiting-v2/podium.png" alt="" aria-hidden="true">' +
          '<div class="ws-avatar">' + (s ? UI.avatarHTML(profileAvatarId(s.avatar)) : '<span class="ws-plus" aria-hidden="true">+</span>') + '</div>' +
          '<div class="ws-name"></div><div class="ws-energy"></div>';
        node.querySelector('.ws-name').textContent = s ? s.name : '等待玩家';
        node.querySelector('.ws-energy').textContent = s && s.connected === false ? '重连中' : s && s.energy != null ? String(s.energy) : '—';
        node.setAttribute('aria-label', s ? s.name + (s.connected === false ? '，等待重连' : i === 0 ? '，我的座位' : '，已加入') : '空位，等待玩家联机');
        wrap.appendChild(node);
      }
    }
    var cd = $('#wait-count b');
    if (cd && info.countdown != null) cd.textContent = Math.ceil(info.countdown / 1000);
    $('#wait-status').textContent = '等待玩家联机 · ' + seats.filter(Boolean).length + '/' + PLAYER_LIMIT;
    var modeLabels = { practice: '练习场', arena: '竞技场', master: '大师场' };
    $('#wait-room-label').textContent = (modeLabels[info.mode] || '联机房间') + (info.room || info.roomId ? ' · ' + (info.room || info.roomId) : '');
  }

  /* ================= 对局状态 ================= */
  function onGameState(p) {
    App.seat = p.seat;
    App.state = p.state;
    var st = p.state;
    if (st.phase === 'waiting') {
      showScreen('scr-waiting');
      App.waitInfo = { room: st.roomId, seat: p.seat, seats: st.seats, countdown: st.countdown, mode: st.mode, phase: st.phase };
      renderWaiting(App.waitInfo);
      return;
    }
    showScreen('scr-battle');
    renderBattle(st);
    renderResult(st);
  }

  function mySeat() { return App.state && App.state.seats[App.seat]; }
  function isMyTurn() { return App.state && App.state.phase === 'playing' && App.state.turn === App.seat; }

  /* 座位展示顺序：下家 → 对家 → 上家 */
  function oppOrder() {
    var s = App.seat, out = [];
    var count = Math.min(PLAYER_LIMIT, App.state.seats.length);
    for (var i = 1; i < count; i++) out.push((s + i) % count);
    return out;
  }

  var PASS_BUBBLE_MS = 1200;
  function passBubbleText(seatIdx, seat) {
    return seat && seat.bubble && App.passBubbleUntil[seatIdx] > Date.now() ? seat.bubble : '';
  }
  function showPassBubble(seatIdx) {
    var until = Date.now() + PASS_BUBBLE_MS;
    App.passBubbleUntil[seatIdx] = until;
    window.setTimeout(function () {
      if (App.passBubbleUntil[seatIdx] !== until) return;
      var bubble = seatIdx === App.seat
        ? document.querySelector('#battle-self-profile .self-bubble')
        : document.querySelector('.opp[data-seat="' + seatIdx + '"] .op-bubble');
      if (bubble) bubble.remove();
    }, PASS_BUBBLE_MS);
  }

  function renderBattle(st) {
    $('#bb-deck').textContent = st.deckCount;
    $('#bb-mult').textContent = st.mult;
    var meNow = mySeat();
    $('#self-dealer').style.display = meNow && meNow.dealer ? 'flex' : 'none';
    var selfProfile = $('#battle-self-profile');
    var selfBubbleText = passBubbleText(App.seat, meNow);
    selfProfile.innerHTML = meNow ? '<div class="op-ava">' + UI.battleAvatarHTML(meNow.avatar) + '</div>' +
      '<div class="op-name"></div>' + (selfBubbleText ? '<div class="op-bubble self-bubble"></div>' : '') : '';
    if (meNow) {
      selfProfile.querySelector('.op-name').textContent = meNow.name;
      var selfBubble = selfProfile.querySelector('.self-bubble');
      if (selfBubble) selfBubble.textContent = selfBubbleText;
    }

    // 对手
    var wrap = $('#opponents');
    wrap.innerHTML = oppOrder().map(function (idx, position) {
      var s = st.seats[idx];
      if (!s) return '';
      var active = st.phase === 'playing' && st.turn === idx;
      var bubbleText = passBubbleText(idx, s);
      var side = position < 2 ? 'left' : 'right';
      var distance = position === 0 || position === 3 ? 'near' : 'far';
      return '<div class="opp opp-' + side + ' opp-' + distance + (active ? ' active' : '') + (s.connected ? '' : ' off') + (s.dealer ? ' dealer-plate' : '') + '" data-seat="' + idx + '">' +
        '<span class="op-dealer" aria-label="庄家">庄</span>' +
        '<div class="op-ava">' + UI.battleAvatarHTML(s.avatar) +
          (s.auto ? '<i class="op-auto">托管</i>' : '') +
          (s.connected ? '' : '<i class="op-auto">离线</i>') + '</div>' +
        '<div class="op-name">' + s.name + '</div>' +
        '<div class="op-count">' + s.count + '</div>' +
        '<div class="op-timer' + (active ? ' on' : '') + '">' + UI.timerRingHTML('ot') + '<b class="op-timer-num"></b></div>' +
        (bubbleText ? '<div class="op-bubble">' + bubbleText + '</div>' : '') +
        '</div>';
    }).join('');

    // 中央牌堆（当前压牌）；飞行动画期间且内容未变时复用已渲染元素，避免重建打断动画
    var pile = $('#pile-area');
    var pendSeat = st.pending ? st.pending.seat : -1;
    var pendSeatData = pendSeat >= 0 ? st.seats[pendSeat] : null;
    var hasPend = !!(st.pending && pendSeatData && pendSeatData.lastPlay);
    var pileKey = hasPend ? st.pending.combo.cards.join(',') + '@' + st.roundNo : '';
    var reusePile = pileKey && pileKey === App.pileKey && pile.firstChild && Date.now() < (App.pileKeyUntil || 0);
    if (!reusePile) {
      if (hasPend) {
        pile.innerHTML = '<div class="pile-label">' + GDY.comboName(st.pending.combo) +
          ' · <i>' + (pendSeat === App.seat ? '你' : pendSeatData.name) + '</i></div>' +
          '<div class="pile-cards n' + st.pending.combo.n + '">' +
          UI.cardsHTML(st.pending.combo.cards) + '</div>';
        if (App.flyFrom) {
          animatePileFrom(App.flyFrom);
          App.flyFrom = null;
          App.pileKey = pileKey;
          App.pileKeyUntil = Date.now() + 420;
        }
      } else if (st.phase === 'playing') {
        pile.innerHTML = '<div class="pile-empty">' + (st.turn === App.seat ? '轮到你出牌' : '等待出牌…') + '</div>';
      } else {
        pile.innerHTML = '';
      }
    }

    // 手牌
    renderHand(st);

    // 操作栏
    var my = isMyTurn();
    var bar = $('#action-bar');
    bar.classList.toggle('my-turn', my);
    $('#btn-pass').disabled = !my || !st.pending;
    $('#btn-hint').disabled = !my;
    $('#btn-clear').disabled = !my || !App.selected.length;
    var selCombo = GDY.parseCombo(App.selected);
    var canPlay = my && selCombo && (!st.pending || GDY.beats(selCombo, st.pending.combo));
    $('#btn-play-cards').disabled = !canPlay;

    // 计时环
    startTimerLoop(st);

    // 记牌器
    if (App.counterOn) renderCounter();
    else $('#counter-panel').innerHTML = '';
  }

  function renderHand(st) {
    var me = mySeat();
    var area = $('#hand-area');
    if (!me || !me.hand) { area.innerHTML = ''; return; }
    var selSet = {};
    App.selected.forEach(function (id) { selSet[id] = 1; });
    var myTurn = isMyTurn();
    area.innerHTML = me.hand.map(function (id) {
      var cls = 'in-hand' + (selSet[id] ? ' sel' : '') + (myTurn ? ' canpick' : '');
      return UI.cardHTML(id, cls);
    }).join('');
    // 开局发牌逐张飞入
    if (Date.now() < (App.dealAnimUntil || 0)) {
      area.querySelectorAll('.card').forEach(function (c, i) {
        c.classList.add('dealing');
        c.style.setProperty('--i', i);
      });
    } else if (App.drawPulse) {
      // 摸牌弹入
      App.drawPulse = false;
      var cards = area.querySelectorAll('.card');
      if (cards.length) cards[cards.length - 1].classList.add('drawn');
    }
    area.querySelectorAll('.card').forEach(function (c) {
      c.addEventListener('click', function () {
        if (!isMyTurn()) return;
        var id = +c.dataset.id;
        Sound.sfx.select();
        var k = App.selected.indexOf(id);
        if (k >= 0) { App.selected.splice(k, 1); c.classList.remove('sel'); }
        else { App.selected.push(id); c.classList.add('sel'); }
        updatePlayBtn();
      });
    });
  }

  function updatePlayBtn() {
    var st = App.state;
    if (!st) return;
    var selCombo = GDY.parseCombo(App.selected);
    var canPlay = isMyTurn() && selCombo && (!st.pending || GDY.beats(selCombo, st.pending.combo));
    $('#btn-play-cards').disabled = !canPlay;
    $('#btn-clear').disabled = !isMyTurn() || !App.selected.length;
  }

  /* ---------- 计时环 ---------- */
  var timerRaf = null;
  function startTimerLoop(st) {
    if (timerRaf) cancelAnimationFrame(timerRaf);
    var timer = $('#turn-timer'), num = $('#tt-num');
    function frame() {
      var st2 = App.state;
      if (!st2 || st2.phase !== 'playing') { timerRaf = null; return; }
      var remain = Math.min(30, Math.max(0, (st2.deadline - Date.now()) / 1000));
      var my = isMyTurn();
      // 中央大计时器：我的回合显示
      if (my) {
        num.textContent = Math.ceil(remain);
        UI.updateTimerProgress(timer, remain);
        var sec = Math.ceil(remain);
        if (sec <= 5 && sec >= 1 && sec !== App.tickLast) {
          App.tickLast = sec; Sound.sfx.tick();
        }
      } else {
        num.textContent = '·';
        UI.updateTimerProgress(timer, 0);
      }
      // 对手小计时环
      document.querySelectorAll('.opp .op-timer.on').forEach(function (t) {
        var idx = +t.closest('.opp').dataset.seat;
        var r = remainFor(st2, idx);
        UI.updateTimerProgress(t, r);
        t.querySelector('.op-timer-num').textContent = Math.ceil(r);
      });
      timerRaf = requestAnimationFrame(frame);
    }
    timerRaf = requestAnimationFrame(frame);
  }
  function remainFor(st, idx) {
    return Math.max(0, (st.deadline - Date.now()) / 1000) * (st.turn === idx ? 1 : 0);
  }

  /* ---------- 事件特效 ---------- */
  function captureSourceRect(seat) {
    var el = null;
    if (seat === App.seat) {
      el = document.querySelector('#hand-area .card.sel') || document.querySelector('#hand-area .card');
    } else {
      el = document.querySelector('.opp[data-seat="' + seat + '"] .op-ava');
    }
    return el ? el.getBoundingClientRect() : null;
  }

  function onGameEvent(e) {
    if (e.type === 'deal') {
      App.passBubbleUntil = {};
      App.seenIds = [];
      App.selected = [];
      App.resultShownRound = -1;
      App.hintList = []; App.hintIdx = 0;
      App.dealAnimUntil = Date.now() + 950;
      Sound.sfx.deal();
      setTimeout(Sound.sfx.deal, 140);
      setTimeout(Sound.sfx.deal, 280);
      setTimeout(Sound.sfx.deal, 420);
      showDealTip(App.state && App.state.modeLabel);
    } else if (e.type === 'play') {
      Sound.sfx.play();
      App.flyFrom = captureSourceRect(e.seat);
      if (e.seat === App.seat) App.selected = [];
    } else if (e.type === 'bomb') {
      (e.combo.type === 'rocket' ? Sound.sfx.rocket : Sound.sfx.bomb)();
      App.flyFrom = captureSourceRect(e.seat);
      bombFx(GDY.comboName(e.combo));
      (e.cards || []).forEach(function (id) { App.seenIds.push(id); });
    } else if (e.type === 'pass') {
      showPassBubble(e.seat);
      Sound.sfx.pass();
      if (e.drew && e.seat === App.seat) { Sound.sfx.draw(); App.drawPulse = true; }
    } else if (e.type === 'over') {
      // 结算由 g.phase==='over' 驱动
    }
    if (e.cards && e.type !== 'bomb') {
      (e.cards || []).forEach(function (id) { App.seenIds.push(id); });
    }
  }

  /* 出牌飞行动画：牌堆从出牌者位置飞入中央（FLIP） */
  function animatePileFrom(src) {
    var pileEl = document.querySelector('#pile-area .pile-cards');
    if (!pileEl || !src) return;
    var dest = pileEl.getBoundingClientRect();
    if (!dest.width) return;
    var dx = (src.left + src.width / 2) - (dest.left + dest.width / 2);
    var dy = (src.top + src.height / 2) - (dest.top + dest.height / 2);
    var scale = Math.max(0.4, Math.min(1, (src.width || 120) / (dest.width || 300)));
    pileEl.style.transition = 'none';
    pileEl.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px) scale(' + scale.toFixed(2) + ')';
    pileEl.style.opacity = '0.4';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pileEl.style.transition = 'transform .3s ease-out, opacity .26s ease-out';
        pileEl.style.transform = '';
        pileEl.style.opacity = '1';
      });
    });
  }

  function showDealTip(modeLabel) {
    var t = $('#deal-tip');
    t.textContent = modeLabel ? modeLabel + ' · 开局' : '';
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function bombFx(text) {
    var fx = $('#bomb-fx');
    fx.textContent = text + ' !';
    fx.classList.remove('go');
    void fx.offsetWidth;
    fx.classList.add('go');
    var sc = document.getElementById('scr-battle');
    sc.classList.remove('shake');
    void sc.offsetWidth;
    sc.classList.add('shake');
  }

  /* ---------- 记牌器 ---------- */
  function renderCounter() {
    var seen = App.seenIds.slice();
    var me = mySeat();
    if (me && me.hand) seen = seen.concat(me.hand);
    var rows = GDY.counterRanks(seen);
    $('#counter-panel').innerHTML = '<div class="cp-title">记牌器</div><div class="cp-grid">' +
      rows.map(function (r) {
        return '<div class="cp-cell' + (r.left === 0 ? ' out' : '') + '"><b>' + r.name + '</b><i>' + r.left + '</i></div>';
      }).join('') + '</div>';
  }

  /* ---------- 结算窗口 ---------- */
  function renderResult(st) {
    if (st.phase !== 'over' || !st.result) return;
    if (st.resultShownRound === st.roundNo) return;
    st.resultShownRound = st.roundNo;
    var r = st.result, me = mySeat();
    var myR = r.results[App.seat];
    var win = myR.win;
    var loserRemain = 0;
    r.results.forEach(function (x) { if (!x.win) loserRemain += x.remain; });
    var remainStat = win ? loserRemain : myR.remain;

    var body =
      '<div class="rt-stats">' +
        '<div class="rt-stat"><div class="rt-stat-line"><img class="rt-ico ico-remain" src="/games/gandengyan/assets/layers/battle-v2/count-badge.png" alt=""><div class="rt-v"><small>+</small><b>' + remainStat + '</b></div></div><div class="rt-label">剩余牌数</div></div>' +
        '<div class="rt-stat"><div class="rt-stat-line"><img class="rt-ico ico-bomb" src="/games/gandengyan/assets/layers/result-v2/bomb.png" alt=""><div class="rt-v"><small>×</small><b>' + r.bombs.bomb + '</b></div></div><div class="rt-label">炸弹</div></div>' +
        '<div class="rt-stat"><div class="rt-stat-line"><img class="rt-ico ico-hbomb" src="/games/gandengyan/assets/layers/result-v2/hbomb.png" alt=""><div class="rt-v"><small>×</small><b>' + r.bombs.hbomb + '</b></div></div><div class="rt-label">氢弹</div></div>' +
        '<div class="rt-stat"><div class="rt-stat-line"><img class="rt-ico ico-rocket" src="/games/gandengyan/assets/layers/result-v2/rocket.png" alt=""><div class="rt-v"><small>×</small><b>' + r.bombs.rocket + '</b></div></div><div class="rt-label">火箭</div></div>' +
      '</div>' +
      '<div class="rt-total-label">您总共' + (win ? '赢得' : '输了') + '</div>' +
      '<div class="rt-total"><b>' + Math.abs(myR.delta) + '</b><i>瓦能量</i></div>' +
      '<div class="rt-next">下一局 <b id="rt-cd">8</b> 秒后自动开始</div>';

    var dlg = UI.modal({
      cls: 'result-dialog',
      banner: '<img class="rt-frame-corner rt-frame-tl" src="/games/gandengyan/assets/layers/result-v2/tl.png" alt="" aria-hidden="true">' +
        '<img class="rt-frame-corner rt-frame-tr" src="/games/gandengyan/assets/layers/result-v2/tr.png" alt="" aria-hidden="true">' +
        '<img class="rt-frame-corner rt-frame-bl" src="/games/gandengyan/assets/layers/result-v2/bl.png" alt="" aria-hidden="true">' +
        '<img class="rt-frame-corner rt-frame-br" src="/games/gandengyan/assets/layers/result-v2/br.png" alt="" aria-hidden="true">' +
        '<div class="rt-banner ' + (win ? 'rt-win' : 'rt-lose') + '"><img src="/games/gandengyan/assets/layers/result-v2/crest-' + (win ? 'win' : 'lose') + '.png" alt="" aria-hidden="true"><strong>' + (win ? '赢' : '输') + '</strong></div>',
      body: body,
      okText: '继续玩',
      cancelText: '退出',
      okClass: 'btn-cylinder',
      cancelClass: 'btn-cylinder',
      okFirst: true,
      maskClose: false,
      onOk: function (close) { close(); },
      onCancel: function () { leaveBattle(); },
      onClose: function () { clearInterval(iv); clearTimeout(autoClose); }
    });
    dlg.box.setAttribute('role', 'dialog');
    dlg.box.setAttribute('aria-modal', 'true');
    dlg.box.setAttribute('aria-label', '对局结算：' + (win ? '赢' : '输'));
    Sound.sfx[win ? 'win' : 'lose']();
    var cd = dlg.body.querySelector('#rt-cd');
    var n = 8;
    var iv = setInterval(function () {
      n--;
      if (cd) cd.textContent = n;
      if (n <= 0) clearInterval(iv);
    }, 1000);
    var autoClose = setTimeout(function () {
      if (document.body.contains(dlg.box)) dlg.close();
    }, 7800);
  }

  function leaveBattle() {
    App.socket.emit('leaveRoom');
    App.state = null; App.seat = -1; App.selected = [];
    UI.closeAllModals();
    showScreen('scr-home');
    renderHomeUser();
    App.socket.emit('syncUser', function (res) {
      if (res && res.ok) { App.user = res.user; renderHomeUser(); }
    });
  }

  /* ================= 对局操作 ================= */
  function bindBattle() {
    $('#turn-timer').insertAdjacentHTML('afterbegin', UI.timerRingHTML('tt'));
    $('#btn-pass').addEventListener('click', function () {
      App.socket.emit('pass', {}, function (res) {
        if (!res.ok) UI.toast(res.msg || '无法出牌');
        else { App.selected = []; }
      });
    });
    $('#btn-play-cards').addEventListener('click', function () {
      var cards = App.selected.slice();
      App.socket.emit('play', { cards: cards }, function (res) {
        if (!res.ok) UI.toast(res.msg || '无法出牌');
        else App.selected = [];
      });
    });
    $('#btn-clear').addEventListener('click', function () {
      App.selected = [];
      renderHand(App.state);
      updatePlayBtn();
    });
    $('#btn-hint').addEventListener('click', function () {
      var st = App.state;
      if (!st || !isMyTurn()) return;
      var me = mySeat();
      App.hintList = GDY.candidates(me.hand, st.pending ? st.pending.combo : null);
      if (!App.hintList.length) { UI.toast('没有能压过的牌，点「不出」摸牌'); return; }
      App.hintIdx = App.hintIdx % App.hintList.length;
      var c = App.hintList[App.hintIdx++];
      App.selected = c.cards.slice();
      renderHand(st);
      updatePlayBtn();
      Sound.sfx.select();
    });

    // 顶部按钮（退出/菜单）— 事件委托到两个对战入口
    $('#scr-battle [data-act="leave-battle"]').addEventListener('click', function () {
      var dialog = openExitConfirm('退出对局', leaveBattle, 'leave-dialog');
      dialog.body.appendChild(UI.el('div', 'exit-note', '退出将由电脑代打。'));
    });
    $('#scr-battle [data-act="menu"]').addEventListener('click', openMenu);
  }

  /* ================= 弹窗们 ================= */

  /* 菜单下拉 */
  function openMenu() {
    Sound.sfx.click();
    var inBattle = App.inBattle && App.state;
    var body = UI.el('div', 'menu-drop');
    body.innerHTML =
      '<div class="md-col">' +
        '<button class="md-item" data-m="auto"><i>🎛️</i>托管' + (App.auto ? '<b class="on">开</b>' : '<b>关</b>') + '</button>' +
        '<button class="md-item" data-m="counter"><i>🧮</i>记牌器' + (App.counterOn ? '<b class="on">开</b>' : '<b>关</b>') + '</button>' +
      '</div>' +
      '<div class="md-col">' +
        '<button class="md-item" data-m="settings"><i>⚙️</i>设置</button>' +
        '<button class="md-item" data-m="feedback"><i>💬</i>反馈意见</button>' +
        '<button class="md-item" data-m="switch"><i>🔄</i>切换账号</button>' +
      '</div>';
    var dlg = UI.modal({ cls: 'menu-dialog', body: body, okText: null, cancelText: null, maskClose: true });
    body.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.md-item');
      if (!btn) return;
      var m = btn.dataset.m;
      dlg.close();
      if (m === 'settings') openSettings();
      else if (m === 'feedback') openFeedback();
      else if (m === 'switch') openLogoutConfirm(true);
      else if (m === 'auto') {
        if (!inBattle) { UI.toast('对局中才能开启托管'); return; }
        App.auto = !App.auto;
        App.socket.emit('auto', { on: App.auto });
        UI.toast(App.auto ? '托管已开启' : '托管已关闭');
      } else if (m === 'counter') {
        if (!inBattle) { UI.toast('对局中才能使用记牌器'); return; }
        App.counterOn = !App.counterOn;
        if (App.counterOn) renderCounter();
        else $('#counter-panel').innerHTML = '';
      }
    });
  }

  /* 设置 */
  function openSettings() {
    Sound.sfx.click();
    var v = Sound.volumes;
    var body = UI.el('div', 'settings-body');
    body.innerHTML =
      ['music', 'sfx'].map(function (kind) {
        var value = Math.round(v[kind] * 100);
        return '<div class="set-row"><label for="set-' + kind + '">' + (kind === 'music' ? '音乐' : '声效') + '</label>' +
          '<div class="set-slider" style="--volume:' + value + '%"><span class="set-slider-track" aria-hidden="true"><span class="set-slider-fill"></span></span>' +
          '<input type="range" id="set-' + kind + '" data-volume="' + kind + '" min="0" max="100" value="' + value + '"></div></div>';
      }).join('');
    var corners = UI.el('div', 'settings-armor');
    corners.setAttribute('aria-hidden', 'true');
    corners.innerHTML = ['tl', 'tr', 'bl', 'br'].map(function (corner) {
      return '<img class="settings-corner settings-corner-' + corner + '" src="/games/gandengyan/assets/layers/result-v2/' + corner + '.png" alt="">';
    }).join('');
    var dialog = UI.modal({ title: '设 置', banner: corners.outerHTML, body: body, okText: '确定', cancelText: null, cls: 'settings-dialog' });
    dialog.frame.setAttribute('role', 'dialog');
    dialog.frame.setAttribute('aria-modal', 'true');
    dialog.frame.setAttribute('aria-label', '设置');
    body.querySelectorAll('input[data-volume]').forEach(function (input) {
      input.addEventListener('input', function () {
        this.parentNode.style.setProperty('--volume', this.value + '%');
        Sound.setVolume(this.dataset.volume, this.value / 100);
      });
    });
  }

  /* 帮助 */
  function openHelp() {
    Sound.sfx.click();
    UI.modal({
      title: '帮 助',
      cls: 'help-dialog',
      okText: null, cancelText: null,
      body:
        '<div class="help-sec"><b>玩法</b>每人发 5 张牌，轮流出牌。压不上（或不想压）时摸一张牌并过，先出完手牌者获胜。</div>' +
        '<div class="help-sec"><b>牌型</b>单张 &lt; 对子 &lt; <em>炸弹</em>(三张相同) &lt; <em>氢弹</em>(四张相同) &lt; <em>火箭</em>(大小王)。<br>点数：3&lt;4&lt;…&lt;K&lt;A&lt;2&lt;小王&lt;大王。</div>' +
        '<div class="help-sec"><b>压牌</b>必须出与上家相同张数且点数更大的牌；炸弹/氢弹/火箭可越序压制任意非炸弹牌型。</div>' +
        '<div class="help-sec"><b>计分</b>输家支付（剩余牌数 + 炸弹×2 + 氢弹×4 + 火箭×8）× 赔率；赢家另收全场底注。练习场免费不结算能量。</div>'
    });
  }

  /* 新手指导 */
  function openTutorial() {
    Sound.sfx.click();
    var steps = [
      { t: '1 · 目标', b: '把手里 5 张牌全部出完！每回合可以出牌压过对手，或摸一张牌跳过。' },
      { t: '2 · 牌型', b: '可以出单张、对子；三张相同是炸弹，四张相同是氢弹，双王是火箭，越往后越强。' },
      { t: '3 · 压牌', b: '出牌必须和上家张数相同、点数更大。压不住就点「不出」——摸一张牌，看看手气！' },
      { t: '4 · 得分', b: '对手手里剩的牌越多，你赢得越多；打出炸弹还能翻倍收益。祝你好运！' }
    ];
    var i = 0;
    var body = UI.el('div', 'tutorial-body');
    function render() {
      body.innerHTML = '<div class="tu-step">' + steps[i].t + '</div><div class="tu-text">' + steps[i].b + '</div>' +
        '<div class="tu-dots">' + steps.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>';
      prevB.textContent = i === 0 ? '跳过' : '上一步';
      nextB.textContent = i === steps.length - 1 ? '开始游戏' : '下一步';
    }
    var dlg = UI.modal({ title: '新手指导', body: body, okText: null, cancelText: null, maskClose: true });
    var btns = UI.el('div', 'sd-btns tu-btns');
    var prevB = UI.el('button', 'btn-metal', '跳过');
    var nextB = UI.el('button', 'btn-metal primary', '下一步');
    prevB.onclick = function () { dlg.close(); };
    nextB.onclick = function () {
      Sound.sfx.click();
      if (i === steps.length - 1) dlg.close(); else { i++; render(); }
    };
    btns.appendChild(prevB); btns.appendChild(nextB);
    dlg.box.appendChild(btns);
    render();
  }

  /* 首页、英雄榜和接任务共用顶部栏结构。 */
  function createSectionHeader(name, clockId, cls) {
    var header = document.querySelector('#scr-home > .topbar').cloneNode(true);
    header.classList.add('section-header', cls);
    var back = header.querySelector('.tb-exit');
    back.textContent = '返回';
    back.dataset.act = 'back';
    back.setAttribute('aria-label', '返回上一页');
    var title = header.querySelector('.tb-title');
    title.textContent = name;
    title.setAttribute('aria-label', name + '，打开菜单');
    title.removeAttribute('aria-controls');
    title.removeAttribute('aria-expanded');
    header.querySelector('.tb-clock').id = clockId;
    return header.outerHTML;
  }
  function bindSectionHeader(dialog) {
    dialog.frame.setAttribute('role', 'dialog');
    dialog.frame.setAttribute('aria-modal', 'true');
    dialog.frame.setAttribute('aria-label', dialog.frame.querySelector('.tb-title').textContent);
    dialog.frame.querySelector('.section-header').addEventListener('click', function (event) {
      var button = event.target.closest('[data-act]');
      if (!button) return;
      var action = button.dataset.act;
      if (action === 'back') { Sound.sfx.click(); dialog.close(); }
      else if (action === 'tutorial') openTutorial();
      else if (action === 'help') openHelp();
      else if (action === 'menu') openMenu();
    });
    function onKeydown(event) {
      if (event.key === 'Escape' && dialog.frame.parentNode === document.querySelector('#modal-root .modal-mask:last-child')) {
        event.preventDefault(); dialog.close();
      }
    }
    document.addEventListener('keydown', onKeydown);
    return function () { document.removeEventListener('keydown', onKeydown); };
  }

  /* 英雄榜 */
  function openLeaderboard(kind) {
    Sound.sfx.click();
    kind = kind || 'war';
    var TABS = [
      { k: 'war', n: '战神榜', u: '赢', unit: '次' }, { k: 'streak', n: '连胜榜', u: '连胜', unit: '次' },
      { k: 'energy', n: '能量榜', u: '能量', unit: '瓦' }, { k: 'trophy', n: '奖杯榜', u: '奖杯', unit: '个' },
      { k: 'mission', n: '任务榜', u: '任务', unit: '个' }
    ];
    var body = UI.el('div', 'lb-body');
    body.innerHTML = '<nav class="lb-tabs" aria-label="榜单类型">' + TABS.map(function (tab) {
      return '<button class="lb-tab" type="button" data-k="' + tab.k + '" aria-pressed="false">' + tab.n + '</button>';
    }).join('') + '</nav><div class="lb-list" role="list" aria-label="排名前十"></div><aside class="lb-me" aria-label="我的成绩"></aside>';
    var requestId = 0, closed = false, cleanupHeader;
    var dlg = UI.modal({ banner: createSectionHeader('英雄榜', 'leaderboard-clock', 'lb-header'), body: body, okText: null, cancelText: null, cls: 'lb-dialog', maskClose: false, onClose: function () {
      closed = true;
      requestId++;
      if (cleanupHeader) cleanupHeader();
    } });
    cleanupHeader = bindSectionHeader(dlg);
    function escapeText(value) {
      var span = document.createElement('span');
      span.textContent = value == null ? '' : String(value);
      return span.innerHTML;
    }
    body.querySelectorAll('.lb-tab').forEach(function (button) {
      button.onclick = function () { Sound.sfx.click(); load(button.dataset.k); };
    });
    function load(k) {
      var tab = TABS.filter(function (t) { return t.k === k; })[0] || TABS[0];
      k = tab.k;
      var id = ++requestId;
      var list = body.querySelector('.lb-list');
      list.setAttribute('aria-busy', 'true');
      list.innerHTML = '<div class="lb-empty" role="status">正在加载榜单…</div>';
      body.querySelectorAll('.lb-tab').forEach(function (button) {
        var active = button.dataset.k === k;
        button.classList.toggle('on', active);
        button.setAttribute('aria-pressed', String(active));
      });
      App.socket.emit('leaderboard', { kind: k }, function (res) {
        // 快速切换时，旧请求不能覆盖当前榜单；关闭后不再更新窗口。
        if (closed || id !== requestId) return;
        list.setAttribute('aria-busy', 'false');
        if (!res || !res.ok) { list.innerHTML = '<div class="lb-empty" role="status">榜单加载失败，请点击榜单重试</div>'; return; }
        var d = res.data;
        list.innerHTML = d.top.length ? d.top.map(function (row) {
          return '<div class="lb-row" role="listitem"><i class="lb-rank r' + row.rank + '">' + row.rank + '</i>' +
            '<span class="lb-name">' + escapeText(row.name) + '</span>' +
            '<span class="lb-val">' + tab.u + '：<b>' + row.value + '</b><small> ' + tab.unit + '</small></span></div>';
        }).join('') : '<div class="lb-empty" role="status">暂无数据，快来抢占榜首！</div>';
        var parts = UI.avatarParts(d.myAvatar);
        var avatarId = 'p' + parts.head + '-' + parts.eyes + '-' + parts.mouth;
        body.querySelector('.lb-me').innerHTML =
          '<div class="lb-portrait"><img class="lb-pedestal" src="/games/gandengyan/assets/layers/home-user-pedestal-v2.png" alt="" aria-hidden="true">' +
          '<div class="lb-avatar">' + UI.avatarHTML(avatarId) + '</div><div class="lb-me-name">' + escapeText(d.myName || '游客') + '</div></div>' +
          '<div class="lb-me-panel"><img class="lb-panel-tl" src="/games/gandengyan/assets/layers/result-v2/tl.png" alt="" aria-hidden="true">' +
          '<img class="lb-panel-br" src="/games/gandengyan/assets/layers/result-v2/br.png" alt="" aria-hidden="true">' +
          '<div class="lb-me-stat"><span>' + tab.u + '</span><b>' + d.myVal + '<small>' + tab.unit + '</small></b></div>' +
          '<div class="lb-me-stat"><span>排名</span><b>' + (d.myRank || '—') + '</b></div></div>';
      });
    }
    load(kind);
  }

  /* 接任务 */
  function openMissions() {
    Sound.sfx.click();
    var MISSIONS = [
      { id: 'm1', scene: '竞技场', verb: '连赢', unit: '场', goal: 3, reward: 200 },
      { id: 'm2', scene: '任意场', verb: '打出', unit: '炸弹', goal: 3, reward: 50 },
      { id: 'm3', scene: '任意场', verb: '完成', unit: '场对局', goal: 3, reward: 30 },
      { id: 'm4', scene: '练习场', verb: '赢', unit: '场', goal: 1, reward: 20 }
    ];
    var pageSize = 3, pageCount = Math.ceil(MISSIONS.length / pageSize);
    var body = UI.el('div', 'ms-body');
    body.innerHTML = '<nav class="ms-tabs" aria-label="任务分类">' +
      '<button class="ms-tab on" type="button" data-category="daily" aria-pressed="true">每日任务</button>' +
      '<button class="ms-tab" type="button" data-category="activity" aria-pressed="false">最新活动</button>' +
      '<button class="ms-tab" type="button" data-category="trophy" aria-pressed="false">挑战奖杯</button></nav>' +
      '<section class="ms-workspace" aria-label="每日任务"></section>';
    var closed = false, cleanupHeader, page = 0, category = 'daily', claiming = {};
    var dlg = UI.modal({ banner: createSectionHeader('接任务', 'missions-clock', 'ms-header'), body: body, okText: null, cancelText: null, cls: 'ms-dialog', maskClose: false, onClose: function () {
      closed = true;
      if (cleanupHeader) cleanupHeader();
    } });
    cleanupHeader = bindSectionHeader(dlg);
    var workspace = body.querySelector('.ms-workspace');
    function frameArt() {
      return '<img class="ms-corner-tl" src="/games/gandengyan/assets/layers/result-v2/tl.png" alt="" aria-hidden="true">' +
        '<img class="ms-corner-br" src="/games/gandengyan/assets/layers/result-v2/br.png" alt="" aria-hidden="true">';
    }
    function render() {
      if (closed) return;
      body.querySelectorAll('.ms-tab').forEach(function (button) {
        var active = button.dataset.category === category;
        button.classList.toggle('on', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (category !== 'daily') {
        var name = category === 'activity' ? '最新活动' : '挑战奖杯';
        workspace.setAttribute('aria-label', name);
        workspace.innerHTML = '<div class="ms-cards"><article class="ms-card ms-empty">' + frameArt() +
          '<h3 class="ms-title">' + name + '</h3><p class="ms-empty-text">' + (category === 'activity' ? '暂无进行中的活动' : '暂无开放的奖杯挑战') + '</p></article></div>';
        return;
      }
      workspace.setAttribute('aria-label', '每日任务');
      var ms = App.user && App.user.missions || { progress: {}, claimed: {} };
      workspace.innerHTML =
        '<div class="ms-cards">' +
        MISSIONS.slice(page * pageSize, (page + 1) * pageSize).map(function (m) {
          var p = Math.min(m.goal, ms.progress && ms.progress[m.id] || 0);
          var claimed = ms.claimed && ms.claimed[m.id];
          var done = p >= m.goal;
          return '<article class="ms-card' + (done && !claimed ? ' ready' : '') + '" data-mission="' + m.id + '">' + frameArt() +
            '<h3 class="ms-title">' + m.scene + '</h3>' +
            '<div class="ms-goal">' + m.verb + '<strong>' + m.goal + '</strong>' + m.unit + '</div>' +
            '<div class="ms-progress-label">进度 <b>' + p + '</b> / ' + m.goal + '</div>' +
            '<div class="ms-progress"><i style="width:' + (p / m.goal * 100) + '%"></i></div>' +
            '<div class="ms-reward">奖励能量 <b>' + m.reward + '</b> 瓦</div>' +
            '<div class="ms-action">' + (claimed ? '<span class="ms-claimed">已领取</span>'
              : done ? '<button class="btn-metal btn-cylinder ms-btn" type="button" data-id="' + m.id + '"' + (claiming[m.id] ? ' disabled' : '') + '>' + (claiming[m.id] ? '领取中…' : '领取奖励') + '</button>'
              : '<span class="ms-state">进行中</span>') + '</div></article>';
        }).join('') + '</div>' +
        '<nav class="ms-pagination" aria-label="每日任务分页"><button type="button" data-page="prev"' + (page === 0 ? ' disabled' : '') + '>上一页</button>' +
        '<span>' + (page + 1) + ' / ' + pageCount + '</span><button type="button" data-page="next"' + (page >= pageCount - 1 ? ' disabled' : '') + '>下一页</button></nav>' +
        '<div class="ms-tip">每日任务 0 点刷新 · 战绩可在「英雄榜」查看</div>';
      workspace.querySelectorAll('[data-page]').forEach(function (button) {
        button.onclick = function () { Sound.sfx.click(); page = Math.max(0, Math.min(pageCount - 1, page + (button.dataset.page === 'next' ? 1 : -1))); render(); };
      });
      workspace.querySelectorAll('.ms-btn[data-id]').forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.id;
          if (claiming[id]) return;
          claiming[id] = true;
          b.disabled = true;
          b.textContent = '领取中…';
          Sound.sfx.click();
          App.socket.emit('claimMission', { id: id }, function (res) {
            delete claiming[id];
            if (res && res.ok) {
              if (App.user && App.user.missions) App.user.missions.claimed[id] = true;
              UI.toast('领取成功 +' + res.reward + ' 瓦');
              render();
              App.socket.emit('syncUser', function (sync) {
                if (sync && sync.ok) App.user = sync.user;
                render();
              });
            } else { UI.toast((res && res.msg) || '领取失败'); render(); }
          });
        };
      });
    }
    body.querySelectorAll('.ms-tab').forEach(function (button) {
      button.onclick = function () { Sound.sfx.click(); category = button.dataset.category; render(); };
    });
    render();
    App.socket.emit('syncUser', function (res) {
      if (res && res.ok) { App.user = res.user; }
      render();
    });
  }

  /* 个人中心 */
  function openProfile() {
    Sound.sfx.click();
    var body = UI.el('div', 'pf-body');
    var profileClosed = false, saveTimer = null;
    var dlg = UI.modal({ title: '个人中心', body: body, okText: null, cancelText: null, cls: 'pf-dialog', onClose: function () {
      profileClosed = true;
      if (saveTimer) window.clearTimeout(saveTimer);
    } });
    dlg.box.setAttribute('role', 'dialog');
    dlg.box.setAttribute('aria-modal', 'true');
    dlg.box.setAttribute('aria-label', '个人中心');
    var user = App.user || { name: '玩家', energy: 0, avatar: 'a1', stats: {} };
    var picked = profileAvatarId(user.avatar);
    var parts = UI.avatarParts(picked);
    picked = 'p' + parts.head + '-' + parts.eyes + '-' + parts.mouth;
    var tab = 'info';

    function partIcon(type, value) {
      return UI.avatarPartHTML(type, value);
    }

    body.innerHTML = '<div class="pf-shell">' +
      '<aside class="pf-sidebar">' +
        '<nav class="pf-tabs" aria-label="个人中心栏目">' +
          '<button class="pf-tab on" data-t="info">基本信息</button>' +
          '<button class="pf-tab" data-t="stats">游戏记录</button>' +
        '</nav>' +
      '</aside>' +
      '<section class="pf-workspace" aria-live="polite"></section>' +
      '</div>';

    var workspace = body.querySelector('.pf-workspace');

    function renderInfo() {
      var rows = [
        { id: 'head', name: '头部', desc: '装甲模块', value: parts.head },
        { id: 'eyes', name: '眼睛', desc: '视觉模块', value: parts.eyes },
        { id: 'mouth', name: '嘴部', desc: '下颌模块', value: parts.mouth }
      ];
      workspace.innerHTML = '<div class="pf-info-view">' +
        '<div class="pf-preview-row" data-avatar="' + picked + '" aria-label="当前头像预览"><div class="pf-preview-orbit">' +
          '<img class="pf-orbit-art" src="/games/gandengyan/assets/layers/profile-preview-ring.svg" alt="" aria-hidden="true">' +
          '<div class="pf-avatar-preview">' + UI.avatarHTML(picked) + '</div></div></div>' +
        '<div class="pf-part-list">' + rows.map(function (row) {
          var choices = '';
          // 当前部件始终位于中央安装框，其余四件分布在两侧。
          var others = [1, 2, 3, 4, 5].filter(function (value) { return value !== row.value; });
          var order = others.slice(0, 2).concat([row.value], others.slice(2));
          order.forEach(function (i) {
            choices += '<button class="pf-part-choice' + (row.value === i ? ' on' : '') + '" data-part="' + row.id + '" data-value="' + i + '" aria-label="' + row.name + '模块 ' + i + '" aria-pressed="' + (row.value === i) + '">' +
              partIcon(row.id, i) + '</button>';
          });
          return '<div class="pf-part-row">' +
            '<div class="pf-part-choices" role="group" aria-label="选择' + row.name + '">' + choices + '</div></div>';
        }).join('') + '</div>' +
        '<footer class="pf-actions"><button class="btn-metal btn-cylinder" id="pf-rand">随机生成</button>' +
          '<button class="btn-metal btn-cylinder" id="pf-save">保存头像</button>' +
          '<button class="btn-metal btn-cylinder" id="pf-cancel">取消</button></footer>' +
        '</div>';

      workspace.querySelectorAll('.pf-part-choice').forEach(function (button) {
        button.onclick = function () {
          parts[button.dataset.part] = Number(button.dataset.value);
          picked = 'p' + parts.head + '-' + parts.eyes + '-' + parts.mouth;
          Sound.sfx.select();
          renderInfo();
        };
      });
      workspace.querySelector('#pf-rand').onclick = function () {
        var next;
        do {
          next = { head: 1 + Math.floor(Math.random() * 5), eyes: 1 + Math.floor(Math.random() * 5), mouth: 1 + Math.floor(Math.random() * 5) };
        } while (next.head === parts.head && next.eyes === parts.eyes && next.mouth === parts.mouth);
        parts = next;
        picked = 'p' + parts.head + '-' + parts.eyes + '-' + parts.mouth;
        Sound.sfx.select();
        renderInfo();
      };
      workspace.querySelector('#pf-cancel').onclick = function () { Sound.sfx.click(); dlg.close(); };
      workspace.querySelector('#pf-save').onclick = function () {
        Sound.sfx.click();
        var button = workspace.querySelector('#pf-save');
        var originalLabel = button.innerHTML;
        var completed = false;
        button.disabled = true;
        button.textContent = '正在保存…';
        saveTimer = window.setTimeout(function () {
          if (profileClosed || completed) return;
          completed = true;
          button.disabled = false;
          button.innerHTML = originalLabel;
          UI.toast('保存超时，请检查连接后重试');
        }, 5000);
        App.socket.emit('setAvatar', { avatar: picked }, function (res) {
          if (profileClosed || completed) return;
          completed = true;
          if (saveTimer) window.clearTimeout(saveTimer);
          if (!res || !res.ok || !res.user || res.user.avatar !== picked) {
            button.disabled = false;
            button.innerHTML = originalLabel;
            UI.toast((res && res.msg) || '头像保存失败，请稍后重试');
            return;
          }
          UI.toast('组合头像已保存');
          dlg.close();
        });
      };
    }

    function renderStats() {
      var stats = user.stats || {};
      var modes = [['practice', '练习场', 'cyan'], ['arena', '竞技场', 'gold'], ['master', '大师场', 'magenta']];
      function row(label, key, format) {
        return '<div class="gs-row"><span class="gs-label">' + label + '</span>' + modes.map(function (mode) {
          var value = (stats[mode[0]] || {})[key] || 0;
          return '<b class="' + mode[2] + '">' + format(value, stats[mode[0]] || {}) + '</b>';
        }).join('') + '</div>';
      }
      workspace.innerHTML = '<div class="pf-stats-view"><header class="pf-work-head"><h2>游戏记录</h2></header>' +
        '<div class="gs-table"><div class="gs-row gs-head"><span></span>' + modes.map(function (mode) { return '<b class="' + mode[2] + '">' + mode[1] + '</b>'; }).join('') + '</div>' +
        row('比赛', 'games', function (n) { return n + ' 次'; }) +
        row('胜利', 'wins', function (n) { return n + ' 次'; }) +
        row('失败', 'losses', function (n) { return n + ' 次'; }) +
        row('胜率', 'games', function (n, s) { return (n ? Math.round((s.wins || 0) / n * 100) : 0) + '%'; }) +
        row('赢得能量', 'wonE', function (n) { return n; }) +
        row('失去能量', 'lostE', function (n) { return n; }) +
        row('积分', 'points', function (n) { return n; }) + '</div>' +
        '<footer class="pf-actions"><button class="btn-metal" id="pf-stats-close">取消</button></footer></div>';
      workspace.querySelector('#pf-stats-close').onclick = function () { Sound.sfx.click(); dlg.close(); };
    }

    function render() {
      body.querySelectorAll('.pf-tab').forEach(function (button) {
        button.classList.toggle('on', button.dataset.t === tab);
        button.setAttribute('aria-current', button.dataset.t === tab ? 'page' : 'false');
      });
      if (tab === 'info') renderInfo(); else renderStats();
    }
    body.querySelectorAll('.pf-tab').forEach(function (button) {
      button.onclick = function () { Sound.sfx.click(); tab = button.dataset.t; render(); };
    });
    render();
  }

  /* 反馈意见 */
  function openFeedback() {
    Sound.sfx.click();
    var body = UI.el('div', 'fb-body');
    body.innerHTML = '<textarea id="fb-text" maxlength="200" placeholder="欢迎告诉我你的建议或遇到的问题…"></textarea>';
    UI.modal({
      title: '反馈意见', body: body, okText: '提交', cancelText: '取消',
      onOk: function (close) {
        var t = body.querySelector('#fb-text').value.trim();
        if (!t) { UI.toast('请填写反馈内容'); return false; }
        App.socket.emit('feedback', { text: t });
        UI.toast('感谢你的反馈！');
        close();
      }
    });
  }

  /* ================= 全局顶部按钮（等待页退出） ================= */
  function bindWaiting() {
    $('#scr-waiting [data-act="leave-room"]').addEventListener('click', leaveBattle);
    $('#scr-waiting [data-act="waiting-menu"]').addEventListener('click', openMenu);
    var change = $('#btn-change-table');
    var start = $('#btn-start-now');
    function requestWaitingAction(event, failure, button) {
      if (change.disabled || start.disabled) return;
      Sound.sfx.click();
      change.disabled = start.disabled = true;
      var label = button.textContent;
      if (event === 'startNow') button.textContent = '开始中…';
      App.socket.timeout(5000).emit(event, {}, function (err, res) {
        change.disabled = start.disabled = false;
        if (event === 'startNow') button.textContent = label;
        if (err || !res || !res.ok) { UI.toast(res && res.msg || failure); return; }
        if (res.state) onGameState({ seat: res.seat, state: res.state });
        if (event === 'changeTable') UI.toast('已更换房间');
      });
    }
    change.addEventListener('click', function () { requestWaitingAction('changeTable', '换桌失败，请重试', change); });
    start.addEventListener('click', function () { requestWaitingAction('startNow', '开始失败，请重试', start); });
  }

  /* ================= go ================= */
  window.__GDG = App; // 调试用
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/games/gandengyan/sw.js').catch(function (e) {
        console.warn('SW 注册失败（不影响游戏）:', e.message);
      });
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    bindLogin();
    bindHome();
    bindWaiting();
    bindBattle();
    boot();
  });
})();
