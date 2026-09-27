// 用 WebAudio 现场合成的小音效（不需要音频文件）。
export const Sound = {
  on: true,
  ctx: null,

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* 浏览器不支持就静音 */ }
  },

  tone(freq, at, dur, type = 'triangle', vol = 0.1, slide = 0) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + dur + 0.02);
  },

  play(name) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.01;
    const seq = (notes, gap, dur, type, vol) => notes.forEach((f, i) => this.tone(f, t + i * gap, dur, type, vol));
    switch (name) {
      case 'select': this.tone(880, t, 0.05, 'sine', 0.05); break;
      case 'move': this.tone(430, t, 0.08, 'triangle', 0.09, 120); break;
      case 'oppmove': this.tone(330, t, 0.08, 'triangle', 0.07, -60); break;
      case 'turn': seq([660, 880], 0.1, 0.12, 'sine', 0.08); break;
      case 'win': seq([523, 659, 784], 0.07, 0.12, 'triangle', 0.1); break;
      case 'lose': seq([392, 311], 0.1, 0.16, 'triangle', 0.1); break;
      case 'both': this.tone(220, t, 0.28, 'sawtooth', 0.05, -120); break;
      case 'found': seq([392, 523, 659, 784], 0.08, 0.14, 'triangle', 0.09); break;
      case 'tick': this.tone(1200, t, 0.03, 'square', 0.03); break;
      case 'victory': seq([523, 659, 784, 1047, 784, 1047], 0.11, 0.18, 'triangle', 0.11); break;
      case 'defeat': seq([392, 349, 311, 262], 0.16, 0.24, 'sine', 0.09); break;
      case 'draw': seq([440, 440, 523], 0.14, 0.16, 'sine', 0.08); break;
      default: break;
    }
  }
};
