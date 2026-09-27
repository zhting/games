// WebSocket 客户端：自动重连、请求/应答、服务器时钟校准。
export class Net {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
    this.pending = new Map();
    this.rid = 0;
    this.retry = 0;
    this.timer = 0;
    this.pinger = 0;
    this.state = 'idle';
    this.stopped = false;
    this.skew = 0;        // 服务器时间 - 本地时间
    this.rtt = null;      // 往返延迟（毫秒）
    this.synced = false;
    this.probe = 0;
    const wake = () => {
      if (this.stopped) return;
      if (!this.isOpen()) { if (this.state === 'reconnecting') this.connect(true); return; }
      // 手机切回前台时，连接可能已经悄悄断了：发个 ping，4 秒没回音就重连
      clearTimeout(this.probe);
      this.probe = setTimeout(() => this.forceReconnect(), 4000);
      this.ping();
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    window.addEventListener('online', wake);
  }

  on(t, fn) {
    if (!this.handlers.has(t)) this.handlers.set(t, []);
    this.handlers.get(t).push(fn);
    return this;
  }
  emit(t, m) { for (const fn of this.handlers.get(t) || []) fn(m); }
  setState(s) { if (this.state !== s) { this.state = s; this.emit('state', s); } }
  isOpen() { return !!this.ws && this.ws.readyState === 1; }
  serverNow() { return Date.now() + this.skew; }

  connect(now = false) {
    this.stopped = false;
    clearTimeout(this.timer);
    if (this.ws) { const old = this.ws; this.ws = null; try { old.close(); } catch { /* ignore */ } }
    if (now) this.retry = 0;
    this.setState(this.retry ? 'reconnecting' : 'connecting');
    let ws;
    try { ws = new WebSocket(this.url); } catch { this.later(); return; }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retry = 0;
      this.setState('open');
      this.emit('open');
      this.ping();
      clearInterval(this.pinger);
      this.pinger = setInterval(() => this.ping(), 15000);
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      if (typeof m.now === 'number' && !this.synced) this.skew = m.now - Date.now();
      if (m.t === 'pong') clearTimeout(this.probe);
      if (m.t === 'pong' && typeof m.c === 'number') {
        const rtt = Date.now() - m.c;
        if (rtt >= 0 && rtt < 20000) {
          this.rtt = rtt;
          this.skew = m.now - (m.c + rtt / 2);
          this.synced = true;
          this.emit('rtt', rtt);
        }
        return;
      }
      if (m.t === 'reply') {
        const p = this.pending.get(m.rid);
        if (p) { this.pending.delete(m.rid); clearTimeout(p.timer); p.resolve({ ok: !!m.ok, error: m.error, data: m.data }); }
        return;
      }
      this.emit(m.t, m);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      clearInterval(this.pinger);
      for (const [, p] of this.pending) { clearTimeout(p.timer); p.resolve({ ok: false, error: '网络断开了，请稍后重试' }); }
      this.pending.clear();
      this.emit('close', e);
      if (this.stopped) this.setState('closed');
      else this.later();
    };
    ws.onerror = () => {};
  }

  forceReconnect() {
    if (this.stopped || !this.ws) return;
    const ws = this.ws;
    ws.onclose = null;
    try { ws.close(); } catch { /* ignore */ }
    this.ws = null;
    clearInterval(this.pinger);
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.resolve({ ok: false, error: '网络断开了，请稍后重试' }); }
    this.pending.clear();
    this.emit('close', {});
    this.connect(true);
  }

  later() {
    const d = Math.min(8000, 400 * 2 ** this.retry) + Math.random() * 300;
    this.retry++;
    this.setState('reconnecting');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), d);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.pinger);
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(); } catch { /* ignore */ } }
    this.setState('closed');
  }

  send(t, o = {}) {
    if (!this.isOpen()) return false;
    this.ws.send(JSON.stringify({ t, ...o }));
    return true;
  }

  /** 发请求并等待服务器应答：resolve({ ok, error, data })，不会 reject */
  req(t, o = {}, timeout = 8000) {
    return new Promise((resolve) => {
      if (!this.isOpen()) { resolve({ ok: false, error: '还没连上服务器，请稍等' }); return; }
      const rid = ++this.rid;
      const timer = setTimeout(() => { this.pending.delete(rid); resolve({ ok: false, error: '服务器没有回应，请重试' }); }, timeout);
      this.pending.set(rid, { resolve, timer });
      this.ws.send(JSON.stringify({ t, ...o, rid }));
    });
  }

  ping() { this.send('ping', { c: Date.now() }); }
}
