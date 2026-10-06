/* WebAudio 合成音效 + 《星门回环》循环背景音乐。 */
(function () {
  'use strict';

  var S = {
    music: 0.5,
    sfx: 0.7
  };
  try {
    var saved = JSON.parse(localStorage.getItem('gdg_settings') || '{}');
    if (typeof saved.music === 'number') S.music = saved.music;
    if (typeof saved.sfx === 'number') S.sfx = saved.sfx;
  } catch (e) {}

  var ctx = null, masterMusic = null, masterSfx = null, started = false;
  var bgmBuffer = null, bgmSource = null, bgmLoading = null;
  var bgmOffset = 0, bgmStartedAt = 0, bgmRetryAt = 0;
  var pendingLoginIntroAt = 0;

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    masterMusic = ctx.createGain();
    masterMusic.gain.value = S.music * 0.5;
    masterMusic.connect(ctx.destination);
    masterSfx = ctx.createGain();
    masterSfx.gain.value = S.sfx;
    masterSfx.connect(ctx.destination);
    loadBgm();
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    var resume = ctx.state !== 'running' ? ctx.resume() : Promise.resolve();
    started = true;
    Promise.resolve(resume).then(startBgm).catch(function () {});
    if (pendingLoginIntroAt) {
      var introStartedAt = pendingLoginIntroAt;
      pendingLoginIntroAt = 0;
      Promise.resolve(resume).then(function () {
        var elapsed = Math.max(0, (Date.now() - introStartedAt) / 1000);
        if (elapsed <= 0.8 && S.sfx > 0) playLoginIntroFrom(elapsed);
      }).catch(function () {});
    }
  }
  document.addEventListener('pointerdown', unlock, { once: false });
  document.addEventListener('keydown', unlock, { once: false });

  /* ---------- 基础音色 ---------- */
  function tone(freq, dur, opts) {
    if (!ensure() || S.sfx <= 0) return;
    opts = opts || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    var t = ctx.currentTime + (opts.delay || 0);
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(masterSfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, opts) {
    if (!ensure() || S.sfx <= 0) return;
    opts = opts || {};
    var t = ctx.currentTime + (opts.delay || 0);
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = opts.ftype || 'lowpass';
    f.frequency.value = opts.freq || 1000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(masterSfx);
    src.start(t);
  }

  function playLoginIntroFrom(elapsed) {
    var cues = [
      { at: 0, pitch: 176, slide: 78, impact: 58, air: 780 },
      { at: 0.18, pitch: 248, slide: 104, impact: 74, air: 1180 },
      { at: 0.36, pitch: 340, slide: 138, impact: 96, air: 1680 }
    ];
    cues.forEach(function (cue) {
      var delay = cue.at - elapsed;
      if (delay < 0) return;
      noise(0.12, { freq: cue.air, ftype: 'lowpass', vol: 0.12, delay: delay });
      tone(cue.pitch, 0.24, { type: 'sawtooth', slide: cue.slide, vol: 0.1, delay: delay });
      noise(0.055, { freq: 3600, ftype: 'highpass', vol: 0.065, delay: delay + 0.16 });
      tone(cue.impact, 0.13, { type: 'square', slide: cue.impact * 0.76, vol: 0.11, delay: delay + 0.17 });
    });
  }

  function loginIntro() {
    if (!ensure() || S.sfx <= 0) return;
    if (ctx.state !== 'running') {
      pendingLoginIntroAt = Date.now();
      return;
    }
    playLoginIntroFrom(0);
  }

  function loginOpen() {
    noise(0.24, { freq: 620, ftype: 'lowpass', vol: 0.16 });
    tone(185, 0.36, { type: 'sawtooth', slide: 82, vol: 0.11 });
    noise(0.05, { freq: 3200, ftype: 'highpass', vol: 0.065, delay: 0.34 });
    tone(78, 0.14, { type: 'square', slide: 56, vol: 0.12, delay: 0.34 });
  }

  /* ---------- 具体音效 ---------- */
  var sfx = {
    loginIntro: loginIntro,
    loginOpen: loginOpen,
    click:  function () { tone(880, 0.06, { type: 'triangle', vol: 0.12 }); },
    select: function () { tone(520 + Math.random() * 60, 0.07, { type: 'triangle', vol: 0.15 }); },
    deal:   function () { noise(0.08, { freq: 3200, ftype: 'highpass', vol: 0.12 }); },
    play:   function () { noise(0.06, { freq: 2600, ftype: 'highpass', vol: 0.2 }); tone(320, 0.08, { type: 'triangle', vol: 0.12, delay: 0.02 }); },
    pass:   function () { tone(300, 0.14, { type: 'sine', slide: 180, vol: 0.14 }); },
    draw:   function () { noise(0.09, { freq: 1800, vol: 0.16 }); },
    bomb:   function () { noise(0.6, { freq: 700, vol: 0.55 }); tone(120, 0.5, { type: 'sawtooth', slide: 40, vol: 0.4 }); tone(60, 0.7, { type: 'sine', vol: 0.5, delay: 0.05 }); },
    rocket: function () { noise(0.9, { freq: 1200, vol: 0.5 }); tone(200, 0.8, { type: 'sawtooth', slide: 900, vol: 0.3 }); },
    win:    function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.28, { type: 'triangle', vol: 0.22, delay: i * 0.13 }); }); },
    lose:   function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.3, { type: 'sine', vol: 0.2, delay: i * 0.16 }); }); },
    tick:   function () { tone(1200, 0.05, { type: 'square', vol: 0.06 }); },
    toast:  function () { tone(660, 0.09, { type: 'triangle', vol: 0.12 }); tone(880, 0.09, { type: 'triangle', vol: 0.12, delay: 0.08 }); }
  };
  Object.keys(sfx).forEach(function (k) {
    var fn = sfx[k];
    sfx[k] = function () { if (S.sfx > 0) fn(); };
  });

  /* ---------- 背景音乐：《星门回环》全曲循环 ---------- */
  function loadBgm() {
    if (bgmBuffer || bgmLoading || !ctx || Date.now() < bgmRetryAt) return;
    function decode(url) {
      return fetch(url).then(function (response) {
        if (!response.ok) throw new Error('BGM HTTP ' + response.status);
        return response.arrayBuffer();
      }).then(function (data) { return ctx.decodeAudioData(data); });
    }
    bgmLoading = decode('/games/gandengyan/assets/audio/stargate-loop.mp3')
      .then(function (buffer) {
        bgmBuffer = buffer;
        bgmLoading = null;
        startBgm();
      }).catch(function (error) {
        bgmLoading = null;
        bgmRetryAt = Date.now() + 5000;
        console.warn('背景音乐加载失败，将在下次操作时重试:', error.message);
      });
  }
  function startBgm() {
    if (!started || !ctx || ctx.state !== 'running' || S.music <= 0 || document.hidden || bgmSource) return;
    if (!bgmBuffer) { loadBgm(); return; }
    var source = ctx.createBufferSource();
    source.buffer = bgmBuffer;
    source.loop = true;
    source.loopEnd = bgmBuffer.duration;
    source.connect(masterMusic);
    bgmStartedAt = ctx.currentTime;
    source.start(0, bgmOffset);
    bgmSource = source;
  }
  function pauseBgm() {
    if (!bgmSource) return;
    bgmOffset = (bgmOffset + ctx.currentTime - bgmStartedAt) % bgmBuffer.duration;
    bgmSource.stop();
    bgmSource.disconnect();
    bgmSource = null;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseBgm();
    else if (started) unlock();
  });
  window.addEventListener('pagehide', pauseBgm);
  window.addEventListener('pageshow', function () { if (started) unlock(); });

  /* ---------- 音量设置 ---------- */
  function setVolume(kind, v) {
    v = Math.max(0, Math.min(1, v));
    S[kind] = v;
    if (kind === 'sfx' && masterSfx) masterSfx.gain.value = v;
    if (kind === 'music' && masterMusic) masterMusic.gain.value = v * 0.5;
    if (kind === 'music') {
      if (v <= 0) pauseBgm();
      else startBgm();
    }
    try { localStorage.setItem('gdg_settings', JSON.stringify(S)); } catch (e) {}
  }

  window.Sound = { sfx: sfx, setVolume: setVolume, volumes: S };
})();
