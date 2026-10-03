// 由 client/build.mjs 生成，请勿手改。修改 client/src 后运行 npm run build。
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/core/geom.ts
  var rect = (x, y, w, h) => ({ x, y, w, h });
  function contains(r, px, py) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  // src/core/node.ts
  function drawNodes(ctx2, nodes, pressed = null, shade) {
    var _a;
    for (const n of nodes) {
      ctx2.save();
      if (n === pressed) ctx2.translate(0, 1);
      if (n.clip) {
        ctx2.beginPath();
        ctx2.rect(n.rect.x, n.rect.y, n.rect.w, n.rect.h);
        ctx2.clip();
      }
      (_a = n.draw) == null ? void 0 : _a.call(n, ctx2);
      if (n.children) drawNodes(ctx2, n.children, pressed, shade);
      if (n === pressed && shade) shade(ctx2, n.rect);
      ctx2.restore();
    }
  }
  function hitTest(nodes, x, y, key) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.children) {
        const hit = hitTest(n.children, x, y, key);
        if (hit) return hit;
      }
      if (n[key] && contains(n.rect, x, y)) return n;
    }
    return null;
  }

  // src/core/tween.ts
  var easeOutCubic = (t) => 1 - (1 - t) ** 3;
  var Animator = class {
    constructor() {
      __publicField(this, "items", /* @__PURE__ */ new Map());
    }
    start(key, now, dur = 300, data) {
      this.items.set(key, { start: now, dur, data });
    }
    progress(key, now) {
      const it = this.items.get(key);
      if (!it) return 1;
      const t = (now - it.start) / it.dur;
      return t >= 1 ? 1 : easeOutCubic(Math.max(0, t));
    }
    /** 未缓动的线性进度 0→1；没有这个动画或已结束时返回 1 */
    linear(key, now) {
      const it = this.items.get(key);
      if (!it) return 1;
      return Math.min(1, Math.max(0, (now - it.start) / it.dur));
    }
    data(key) {
      var _a;
      return (_a = this.items.get(key)) == null ? void 0 : _a.data;
    }
    running(key, now) {
      const it = this.items.get(key);
      return !!it && now < it.start + it.dur;
    }
    /** 延后开始的动画是否已经开始；没有这个动画时为 true */
    started(key, now) {
      const it = this.items.get(key);
      return !it || now >= it.start;
    }
    /** 是否还有动画在进行；顺便清理已结束的动画 */
    active(now) {
      let any = false;
      for (const [key, it] of this.items) {
        if (now >= it.start + it.dur) this.items.delete(key);
        else any = true;
      }
      return any;
    }
    keys() {
      return [...this.items.keys()];
    }
  };

  // src/core/app.ts
  var App = class {
    constructor(ctx2, screen2, raf, clock, shade) {
      __publicField(this, "ctx", ctx2);
      __publicField(this, "screen", screen2);
      __publicField(this, "raf", raf);
      __publicField(this, "clock", clock);
      __publicField(this, "shade", shade);
      __publicField(this, "animator", new Animator());
      __publicField(this, "scene", null);
      __publicField(this, "nodes", []);
      __publicField(this, "scheduled", false);
      __publicField(this, "touch", null);
      __publicField(this, "drag", null);
      __publicField(this, "press", null);
    }
    setScene(scene) {
      this.scene = scene;
      this.render();
    }
    /** 请求在下一帧重画；同一帧内多次调用只画一次 */
    render() {
      if (this.scheduled) return;
      this.scheduled = true;
      this.raf(() => {
        this.scheduled = false;
        this.draw();
      });
    }
    draw() {
      var _a, _b;
      if (!this.scene) return;
      const now = this.clock();
      (_b = (_a = this.drag) == null ? void 0 : _a.frame) == null ? void 0 : _b.call(_a);
      this.nodes = this.scene.build(now);
      this.ctx.clearRect(0, 0, this.screen.W, this.screen.H);
      const hit = this.press ? hitTest(this.nodes, this.press.x, this.press.y, "onTap") : null;
      drawNodes(this.ctx, this.nodes, hit && !hit.noPress ? hit : null, this.shade);
      if (this.animator.active(now) || this.drag) this.render();
    }
    get current() {
      return this.nodes;
    }
    touchStart(x, y) {
      var _a;
      const press = hitTest(this.nodes, x, y, "onPress");
      if (press) {
        this.touch = null;
        (_a = this.drag) == null ? void 0 : _a.end();
        this.drag = press.onPress(x, y);
        this.render();
        return;
      }
      this.touch = { x0: x, y0: y, lastY: y, moved: false, scroll: hitTest(this.nodes, x, y, "onScroll") };
      this.press = { x, y };
      this.render();
    }
    touchMove(x, y) {
      if (this.drag) {
        this.drag.move(x, y);
        this.render();
        return;
      }
      const t = this.touch;
      if (!t) return;
      if (!t.moved && Math.abs(x - t.x0) + Math.abs(y - t.y0) > 8) {
        t.moved = true;
        if (this.press) {
          this.press = null;
          this.render();
        }
      }
      if (t.moved && t.scroll) {
        t.scroll.onScroll(y - t.lastY);
        this.render();
      }
      t.lastY = y;
    }
    /** 系统打断触摸（来电、弹窗等）：结束拖动，丢弃未完成的点击和滚动 */
    touchCancel() {
      this.touch = null;
      if (this.press) {
        this.press = null;
        this.render();
      }
      if (this.drag) {
        const d = this.drag;
        this.drag = null;
        d.end();
        this.render();
      }
    }
    touchEnd(x, y) {
      if (this.drag) {
        const d = this.drag;
        this.drag = null;
        d.end();
        this.render();
        return;
      }
      if (this.press) {
        this.press = null;
        this.render();
      }
      const t = this.touch;
      this.touch = null;
      if (!t || t.moved) return;
      const n = hitTest(this.nodes, x, y, "onTap");
      if (n) {
        n.onTap();
        this.render();
      }
    }
  };

  // src/controller.ts
  var STALE_ERROR = "\u72B6\u6001\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u8BD5";
  var OUTDATED_ERROR = "\u4E91\u51FD\u6570\u7248\u672C\u8FC7\u65E7\uFF0C\u8BF7\u5728\u5F00\u53D1\u8005\u5DE5\u5177\u91CC\u91CD\u65B0\u90E8\u7F72 game";
  var LEAVE_ERRORS = ["\u623F\u95F4\u4E0D\u5B58\u5728", "\u623F\u95F4\u5DF2\u7ED3\u675F", "\u4F60\u4E0D\u5728\u8FD9\u4E2A\u623F\u95F4\u91CC"];
  var Controller = class {
    constructor(d) {
      __publicField(this, "d", d);
      __publicField(this, "openid", null);
      __publicField(this, "code", null);
      __publicField(this, "busy", false);
      __publicField(this, "session", null);
      __publicField(this, "ticker", null);
    }
    get nickname() {
      return this.d.store.nickname();
    }
    get room() {
      var _a, _b;
      return (_b = (_a = this.session) == null ? void 0 : _a.room) != null ? _b : null;
    }
    get hand() {
      var _a, _b;
      return (_b = (_a = this.session) == null ? void 0 : _a.hand) != null ? _b : null;
    }
    setNickname(name) {
      const n = name.trim();
      const len = [...n].length;
      if (len < 1 || len > 12) {
        this.d.toast("\u6635\u79F0\u9700\u8981 1\u201312 \u4E2A\u5B57");
        return false;
      }
      this.d.store.setNickname(n);
      this.d.render();
      return true;
    }
    async createRoom() {
      const r = await this.run({ type: "createRoom", profile: this.profile() });
      if (r) this.enterFrom(r);
    }
    async joinRoom(code) {
      if (!/^\d{4}$/.test(code)) {
        this.d.toast("\u8BF7\u8F93\u5165 4 \u4F4D\u623F\u95F4\u53F7");
        return;
      }
      const r = await this.run({ type: "joinRoom", code, profile: this.profile() });
      if (r) this.enterFrom(r);
    }
    async leaveRoom() {
      if (!this.code) return;
      if (!this.room || this.room.status === "lobby") {
        const r = await this.run({ type: "leaveRoom", code: this.code });
        if (r !== null) this.backHome();
        return;
      }
      this.backHome();
    }
    async addBot() {
      if (this.code) await this.run({ type: "addBots", code: this.code, count: 1 });
    }
    async moveSeat(index, dir) {
      var _a;
      const seats = (_a = this.room) == null ? void 0 : _a.seats;
      const j = index + dir;
      if (!this.code || !seats || j < 0 || j >= seats.length) return;
      const order = seats.map((s) => s.openid);
      [order[index], order[j]] = [order[j], order[index]];
      await this.run({ type: "reorderSeats", code: this.code, order });
    }
    async startGame() {
      if (this.code) await this.run({ type: "startGame", code: this.code });
    }
    async act(action) {
      var _a, _b;
      if (!this.code) return;
      await this.run({ type: "act", code: this.code, action, version: (_b = (_a = this.room) == null ? void 0 : _a.view) == null ? void 0 : _b.version });
    }
    backHome() {
      var _a, _b;
      (_a = this.session) == null ? void 0 : _a.stop();
      (_b = this.ticker) == null ? void 0 : _b.stop();
      this.session = null;
      this.ticker = null;
      this.code = null;
      this.d.store.clearLastRoom();
      this.d.render();
    }
    onShow() {
      var _a;
      void ((_a = this.session) == null ? void 0 : _a.refresh());
    }
    profile() {
      var _a;
      return { name: (_a = this.nickname) != null ? _a : "", avatar: "" };
    }
    /** 旧版云函数只返回 { code }：没有 openid 就认不出自己的座位，不能进房间 */
    enterFrom(r) {
      if (typeof r.openid !== "string" || r.openid === "") {
        this.d.toast(OUTDATED_ERROR);
        return;
      }
      this.enter(r.code, r.openid);
    }
    enter(code, openid) {
      var _a, _b;
      (_a = this.session) == null ? void 0 : _a.stop();
      (_b = this.ticker) == null ? void 0 : _b.stop();
      this.code = code;
      this.openid = openid;
      this.d.store.setLastRoom(code);
      this.ticker = this.d.makeTicker(() => this.d.api.call({ type: "tick", code }));
      this.session = this.d.openSession(code, openid, () => this.onRoomChange());
      this.session.start();
      this.d.render();
    }
    onRoomChange() {
      var _a;
      const room = this.room;
      (_a = this.ticker) == null ? void 0 : _a.update((room == null ? void 0 : room.status) === "playing" ? room.deadline : null);
      if (room && !room.seats.some((s) => s.openid === this.openid)) {
        this.d.toast("\u4F60\u5DF2\u4E0D\u5728\u8FD9\u4E2A\u623F\u95F4\u91CC");
        this.backHome();
        return;
      }
      if ((room == null ? void 0 : room.status) === "ended") this.d.store.clearLastRoom();
      this.d.render();
    }
    async run(req) {
      var _a;
      if (this.busy) return null;
      this.busy = true;
      this.d.render();
      try {
        const res = await this.d.api.call(req);
        if (res.ok) return res.data;
        if (res.error === STALE_ERROR) {
          void ((_a = this.session) == null ? void 0 : _a.refresh());
          return null;
        }
        this.d.toast(res.error);
        if (LEAVE_ERRORS.includes(res.error)) {
          this.d.store.clearLastRoom();
          if (this.code) this.backHome();
        }
        return null;
      } finally {
        this.busy = false;
        this.d.render();
      }
    }
  };

  // src/net/api.ts
  var NETWORK_ERROR = "\u7F51\u7EDC\u4E0D\u7A33\u5B9A\uFF0C\u6B63\u5728\u91CD\u8BD5";
  var Api = class {
    constructor(cloud) {
      __publicField(this, "cloud", cloud);
    }
    async call(data) {
      try {
        const r = await this.cloud.callFunction({ name: "game", data });
        const res = r.result;
        if (!res || typeof res !== "object" || typeof res.ok !== "boolean") {
          return { ok: false, error: "\u670D\u52A1\u5668\u6CA1\u6709\u54CD\u5E94", network: true };
        }
        return res;
      } catch (e) {
        return { ok: false, error: NETWORK_ERROR, network: true };
      }
    }
  };

  // src/net/session.ts
  var POLL_MS = 3e3;
  var MAX_BACKOFF_MS = 3e4;
  var POLL_AFTER_FAILURES = 3;
  var NOT_FOUND = /does not exist|DOCUMENT_NOT_EXIST|-502004/i;
  function isNotFound(e) {
    var _a;
    const msg = e instanceof Error ? e.message : String((_a = e == null ? void 0 : e.errMsg) != null ? _a : e);
    return NOT_FOUND.test(msg);
  }
  async function rejoinable(db2, code) {
    try {
      const r = await db2.collection("rooms").doc(code).get();
      const room = r.data;
      return !!room && room.status !== "ended";
    } catch (e) {
      return !isNotFound(e);
    }
  }
  var RoomSession = class {
    constructor(db2, code, openid, timers, onChange) {
      __publicField(this, "db", db2);
      __publicField(this, "code", code);
      __publicField(this, "openid", openid);
      __publicField(this, "timers", timers);
      __publicField(this, "onChange", onChange);
      __publicField(this, "room", null);
      __publicField(this, "hand", null);
      __publicField(this, "watchers", []);
      __publicField(this, "gen", 0);
      __publicField(this, "failures", 0);
      __publicField(this, "retryTimer", null);
      __publicField(this, "pollTimer", null);
      __publicField(this, "stopped", false);
      /** 每个集合收到过几次推送；refresh 读取期间有新推送时丢掉读到的（可能更旧的）数据 */
      __publicField(this, "pushes", { rooms: 0, hands: 0 });
    }
    start() {
      void this.refresh();
      this.watch();
    }
    stop() {
      this.stopped = true;
      this.closeWatchers();
      this.stopPolling();
      if (this.retryTimer !== null) {
        this.timers.clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
    }
    async refresh() {
      const before = __spreadValues({}, this.pushes);
      const [room, hand] = await Promise.all([
        this.getDoc("rooms", this.code),
        this.getDoc("hands", `${this.code}_${this.openid}`)
      ]);
      if (this.stopped) return;
      if (room !== void 0 && this.pushes.rooms === before.rooms) this.room = room;
      if (hand !== void 0 && this.pushes.hands === before.hands) this.hand = hand;
      this.onChange();
    }
    /** 找不到文档返回 null；网络等其他错误返回 undefined（保留原数据） */
    async getDoc(coll, id) {
      var _a;
      try {
        const r = await this.db.collection(coll).doc(id).get();
        return (_a = r.data) != null ? _a : null;
      } catch (e) {
        return isNotFound(e) ? null : void 0;
      }
    }
    watch() {
      this.closeWatchers();
      const gen = this.gen;
      const onError = () => {
        if (gen === this.gen) this.fail();
      };
      this.watchers.push(
        this.db.collection("rooms").doc(this.code).watch({
          onChange: (snap) => {
            var _a;
            if (gen !== this.gen) return;
            this.pushes.rooms++;
            this.room = (_a = snap.docs[0]) != null ? _a : null;
            this.ok();
          },
          onError
        }),
        this.db.collection("hands").where({ _openid: "{openid}", roomId: this.code }).watch({
          onChange: (snap) => {
            var _a;
            if (gen !== this.gen) return;
            this.pushes.hands++;
            this.hand = (_a = snap.docs[0]) != null ? _a : null;
            this.ok();
          },
          onError
        })
      );
    }
    closeWatchers() {
      this.gen++;
      for (const w of this.watchers) {
        try {
          w.close();
        } catch (e) {
        }
      }
      this.watchers = [];
    }
    ok() {
      this.failures = 0;
      this.stopPolling();
      this.onChange();
    }
    fail() {
      if (this.stopped) return;
      this.closeWatchers();
      this.failures++;
      if (this.failures >= POLL_AFTER_FAILURES) this.startPolling();
      if (this.retryTimer !== null) return;
      const delay = Math.min(1e3 * 2 ** (this.failures - 1), MAX_BACKOFF_MS);
      this.retryTimer = this.timers.setTimeout(() => {
        this.retryTimer = null;
        if (!this.stopped) this.watch();
      }, delay);
    }
    startPolling() {
      if (this.pollTimer !== null) return;
      const loop = () => {
        this.pollTimer = this.timers.setTimeout(async () => {
          await this.refresh();
          if (this.pollTimer !== null && !this.stopped) loop();
        }, POLL_MS);
      };
      loop();
    }
    stopPolling() {
      if (this.pollTimer !== null) {
        this.timers.clearTimeout(this.pollTimer);
        this.pollTimer = null;
      }
    }
  };

  // src/net/storage.ts
  var NICK = "witchtown.nickname";
  var ROOM = "witchtown.lastRoom";
  var LocalStore = class {
    constructor(s) {
      __publicField(this, "s", s);
    }
    get(key) {
      try {
        const v = this.s.getStorageSync(key);
        return typeof v === "string" && v ? v : null;
      } catch (e) {
        return null;
      }
    }
    set(key, v) {
      try {
        if (v === null) this.s.removeStorageSync(key);
        else this.s.setStorageSync(key, v);
      } catch (e) {
      }
    }
    nickname() {
      return this.get(NICK);
    }
    setNickname(name) {
      this.set(NICK, name);
    }
    lastRoom() {
      return this.get(ROOM);
    }
    setLastRoom(code) {
      this.set(ROOM, code);
    }
    clearLastRoom() {
      this.set(ROOM, null);
    }
  };

  // src/net/ticker.ts
  var TICK_JITTER_MS = 1500;
  var TICK_RETRY_MS = 3e3;
  var Ticker = class {
    constructor(deps) {
      __publicField(this, "deps", deps);
      __publicField(this, "deadline", null);
      __publicField(this, "timer", null);
      __publicField(this, "inflight", false);
    }
    update(deadline) {
      if (deadline === this.deadline) return;
      this.deadline = deadline;
      this.clear();
      if (deadline !== null) {
        this.schedule(Math.max(0, deadline - this.deps.now()) + this.deps.random() * TICK_JITTER_MS);
      }
    }
    stop() {
      this.deadline = null;
      this.clear();
    }
    schedule(ms) {
      this.timer = this.deps.timers.setTimeout(() => {
        this.timer = null;
        void this.fire();
      }, ms);
    }
    async fire() {
      const d = this.deadline;
      if (d === null) return;
      if (this.inflight) {
        this.schedule(TICK_RETRY_MS);
        return;
      }
      this.inflight = true;
      try {
        await this.deps.tick();
      } catch (e) {
      } finally {
        this.inflight = false;
      }
      if (this.deadline === d && this.timer === null) this.schedule(TICK_RETRY_MS);
    }
    clear() {
      if (this.timer !== null) {
        this.deps.timers.clearTimeout(this.timer);
        this.timer = null;
      }
    }
  };

  // src/net/timers.ts
  var realTimers = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id)
  };

  // src/platform.ts
  function createPlatform() {
    const canvas = wx.createCanvas();
    const info = wx.getSystemInfoSync();
    const dpr2 = info.pixelRatio || 2;
    canvas.width = info.windowWidth * dpr2;
    canvas.height = info.windowHeight * dpr2;
    const ctx2 = canvas.getContext("2d");
    ctx2.scale(dpr2, dpr2);
    let top = 64;
    try {
      top = wx.getMenuButtonBoundingClientRect().bottom + 8;
    } catch (e) {
    }
    const bottom = info.safeArea ? Math.min(info.safeArea.bottom, info.windowHeight) : info.windowHeight;
    return { ctx: ctx2, screen: { W: info.windowWidth, H: info.windowHeight, top, bottom }, dpr: dpr2 };
  }
  var wxSurfaces = (w, h) => {
    const canvas = wx.createCanvas();
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext("2d") };
  };
  function bindTouches(app2) {
    wx.onTouchStart((e) => {
      const t = e.touches[0];
      if (t) app2.touchStart(t.clientX, t.clientY);
    });
    wx.onTouchMove((e) => {
      const t = e.touches[0];
      if (t) app2.touchMove(t.clientX, t.clientY);
    });
    wx.onTouchEnd((e) => {
      const t = e.changedTouches[0];
      if (t) app2.touchEnd(t.clientX, t.clientY);
    });
    wx.onTouchCancel(() => app2.touchCancel());
  }

  // src/core/text.ts
  function wrapText(text, maxWidth, measure) {
    const lines = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const ch of para) {
        if (line && measure(line + ch) > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  function ellipsize(text, maxWidth, measure) {
    if (measure(text) <= maxWidth) return text;
    const chars = [...text];
    while (chars.length > 0 && measure(chars.join("") + "\u2026") > maxWidth) chars.pop();
    return chars.join("") + "\u2026";
  }

  // src/model/cards.ts
  var CARD_INFO = {
    accusation: { name: "\u6307\u63A7", color: "red", desc: "\u6307\u63A7\u70B9 +1" },
    evidence: { name: "\u8BC1\u636E", color: "red", desc: "\u6307\u63A7\u70B9 +3" },
    witness: { name: "\u76EE\u51FB", color: "red", desc: "\u6307\u63A7\u70B9 +7" },
    blackCat: { name: "\u9ED1\u732B", color: "blue", desc: "\u4F20\u67D3\u65F6\uFF0C\u6301\u6709\u8005\u5148\u7FFB\u5F00\u81EA\u5DF1\u4E00\u5F20\u8EAB\u4EFD\u5361" },
    matchmaker: { name: "\u60C5\u4FA3", color: "blue", desc: "\u4E24\u540D\u6301\u6709\u8005\u540C\u751F\u5171\u6B7B" },
    asylum: { name: "\u907F\u96BE", color: "blue", desc: "\u591C\u665A\u4E0D\u4F1A\u88AB\u5973\u5DEB\u6740\u6B7B" },
    piety: { name: "\u4FE1\u5F92", color: "blue", desc: "\u5176\u4ED6\u73A9\u5BB6\u4E0D\u80FD\u5BF9\u6301\u6709\u8005\u6253\u51FA\u7EA2\u5361" },
    scapegoat: { name: "\u5AC1\u7978", color: "green", desc: "\u628A\u4E00\u540D\u73A9\u5BB6\u9762\u524D\u7684\u6240\u6709\u5361\u8F6C\u7ED9\u53E6\u4E00\u540D\u73A9\u5BB6" },
    robbery: { name: "\u62A2\u52AB", color: "green", desc: "\u628A\u4E00\u540D\u73A9\u5BB6\u7684\u6240\u6709\u624B\u724C\u4EA4\u7ED9\u53E6\u4E00\u540D\u73A9\u5BB6" },
    arson: { name: "\u7EB5\u706B", color: "green", desc: "\u4E22\u5F03\u4E00\u540D\u73A9\u5BB6\u7684\u6240\u6709\u624B\u724C" },
    curse: { name: "\u8BC5\u5492", color: "green", desc: "\u4E22\u5F03\u4E00\u540D\u73A9\u5BB6\u9762\u524D\u7684\u4E00\u5F20\u84DD\u5361" },
    stocks: { name: "\u62D8\u7559", color: "green", desc: "\u76EE\u6807\u8DF3\u8FC7\u81EA\u5DF1\u7684\u4E0B\u4E00\u56DE\u5408" },
    alibi: { name: "\u8FA9\u62A4", color: "green", desc: "\u4E22\u5F03\u4E00\u540D\u73A9\u5BB6\u9762\u524D\u6700\u591A 3 \u5F20\u6307\u63A7\u6216 1 \u5F20\u8BC1\u636E" },
    night: { name: "\u591C\u665A", color: "black", desc: "\u62BD\u5230\u7ACB\u5373\u7ED3\u7B97\uFF1A\u591C\u665A\u964D\u4E34" },
    conspiracy: { name: "\u4F20\u67D3", color: "black", desc: "\u62BD\u5230\u7ACB\u5373\u7ED3\u7B97\uFF1A\u6BCF\u4EBA\u4ECE\u5DE6\u8FB9\u73A9\u5BB6\u5904\u76F2\u62BD\u4E00\u5F20\u8EAB\u4EFD\u5361" }
  };
  var TRYAL_NAME = { witch: "\u5973\u5DEB", constable: "\u8B66\u957F", villager: "\u6751\u6C11" };
  var TRYAL_SHORT = { witch: "\u5DEB", constable: "\u8B66", villager: "\u6C11" };

  // src/theme/art/cache.ts
  var LARGE_AREA = 256 * 256;
  var LARGE_KEEP = 2;
  var SMALL_KEEP = 400;
  var factory = null;
  var ratio = 1;
  var small = /* @__PURE__ */ new Map();
  var large = [];
  function setSurfaceFactory(f, pixelRatio = 1) {
    factory = f;
    ratio = pixelRatio;
    small.clear();
    large = [];
  }
  function blit(ctx2, key, w, h, paint, dx, dy, dw = w, dh = h) {
    if (w <= 0 || h <= 0 || dw <= 0 || dh <= 0) return;
    if (!factory) {
      ctx2.save();
      ctx2.translate(dx, dy);
      ctx2.scale(dw / w, dh / h);
      paint(ctx2, w, h);
      ctx2.restore();
      return;
    }
    const k = `${key}@${Math.round(w)}x${Math.round(h)}`;
    let s = find(k);
    if (!s) {
      s = factory(Math.ceil(w * ratio), Math.ceil(h * ratio));
      s.ctx.scale(ratio, ratio);
      paint(s.ctx, w, h);
      keep(k, s, w * h);
    }
    ctx2.drawImage(s.canvas, dx, dy, dw, dh);
  }
  function release(s) {
    const c = s.canvas;
    c.width = 0;
    c.height = 0;
  }
  function find(k) {
    const hit = small.get(k);
    if (hit) {
      small.delete(k);
      small.set(k, hit);
      return hit;
    }
    const i = large.findIndex((e2) => e2.key === k);
    if (i < 0) return void 0;
    const [e] = large.splice(i, 1);
    large.push(e);
    return e.s;
  }
  function keep(k, s, area) {
    if (area <= LARGE_AREA) {
      small.set(k, s);
      if (small.size > SMALL_KEEP) {
        const oldest = small.keys().next().value;
        release(small.get(oldest));
        small.delete(oldest);
      }
      return;
    }
    large.push({ key: k, s });
    if (large.length > LARGE_KEEP) release(large.shift().s);
  }

  // ../engine/src/cards.ts
  var isRed = (k) => k === "accusation" || k === "evidence" || k === "witness";
  var isBlack = (k) => k === "night" || k === "conspiracy";

  // ../engine/src/characters.ts
  var USE_LIMITS = { priest: 2, storyteller: 1, official: 1 };

  // ../engine/src/play.ts
  function targetCount(kind) {
    return kind === "scapegoat" || kind === "robbery" ? 2 : 1;
  }

  // src/model/characters.ts
  var CHAR_INFO = {
    doctor: { name: "\u533B\u751F", short: "\u533B\u751F", desc: "\u53EF\u4EE5\u628A\u300C\u8FA9\u62A4\u300D\u5F53\u4F5C\u300C\u76EE\u51FB\u300D\uFF087 \u70B9\uFF09\u6253\u51FA" },
    beggar: { name: "\u4E5E\u4E10", short: "\u4E5E\u4E10", desc: "\u5BF9\u4F60\u6253\u51FA\u7684\u300C\u62A2\u52AB\u300D\u300C\u7EB5\u706B\u300D\u65E0\u6548\uFF0C\u5E76\u7ACB\u523B\u4E22\u5F03" },
    landlord: { name: "\u5730\u4E3B", short: "\u5730\u4E3B", desc: "\u62BD\u724C\u65F6\u5982\u679C\u62BD\u51FA 2 \u5F20\u300C\u6307\u63A7\u300D\uFF0C\u5C55\u793A\u8FD9 2 \u5F20\uFF0C\u518D\u62BD\u4E00\u5F20" },
    judge: { name: "\u6CD5\u5B98", short: "\u6CD5\u5B98", desc: "\u4F60\u6253\u51FA\u7684\u7EA2\u5361\u4F7F\u76EE\u6807\u7D2F\u8BA1\u8FBE\u5230 6 \u70B9\uFF0C\u5373\u53EF\u5BA1\u5224\u8BE5\u73A9\u5BB6" },
    priest: { name: "\u7267\u5E08", short: "\u7267\u5E08", desc: "\u6E38\u620F\u4E2D\u4E24\u6B21\uFF1A\u62BD\u724C\u65F6\u53EF\u4EE5\u6539\u4E3A\u4ECE\u5F03\u724C\u5806\u9009\u6700\u591A 2 \u5F20\u975E\u9ED1\u5361\u52A0\u5165\u624B\u724C" },
    storyteller: { name: "\u8BF4\u4E66\u4EBA", short: "\u8BF4\u4E66", desc: "\u6E38\u620F\u4E2D\u4E00\u6B21\uFF1A\u4F60\u7684\u56DE\u5408\u62BD\u724C\u524D\uFF0C\u53EF\u4EE5\u4EFB\u610F\u8C03\u6574\u724C\u5806\u987A\u5E8F\uFF0C\u9650\u65F6 2 \u5206\u949F" },
    tailor: { name: "\u88C1\u7F1D", short: "\u88C1\u7F1D", desc: "\u6280\u80FD\u4E0E\u53F3\u624B\u8FB9\u7B2C\u4E00\u540D\u6D3B\u7740\u7684\u73A9\u5BB6\u4E00\u81F4" },
    housewife: { name: "\u5BB6\u5EAD\u4E3B\u5987", short: "\u4E3B\u5987", desc: "\u5176\u4ED6\u73A9\u5BB6\u7684\u8EAB\u4EFD\u5361\u56E0\u5BA1\u5224\u6216\u9ED1\u732B\u88AB\u7FFB\u5F00\u65F6\uFF0C\u4F60\u4ECE\u724C\u5806\u62BD\u4E00\u5F20\u724C" },
    farmer: { name: "\u519C\u6C11", short: "\u519C\u6C11", desc: "\u6709\u73A9\u5BB6\u6B7B\u4EA1\u65F6\uFF0C\u4F60\u83B7\u5F97\u4ED6\u7684\u6240\u6709\u624B\u724C\u548C\u9762\u524D\u7684\u84DD\u5361" },
    child: { name: "\u5C0F\u5B69", short: "\u5C0F\u5B69", desc: "\u4F60\u53D1\u8D77\u7684\u5BA1\u5224\u7ED3\u675F\u540E\uFF0C\u4E22\u5F03\u4F60\u81EA\u5DF1\u9762\u524D\u6240\u6709\u300C\u6307\u63A7\u300D\u548C\u300C\u8BC1\u636E\u300D" },
    minister: { name: "\u90E8\u957F", short: "\u90E8\u957F", desc: "\u5BF9\u4F60\u6253\u51FA\u7684\u300C\u8BC1\u636E\u300D\u53EA\u7B97 1 \u70B9" },
    official: { name: "\u5B98\u5458", short: "\u5B98\u5458", desc: "\u6E38\u620F\u4E2D\u4E00\u6B21\uFF1A\u4F60\u81EA\u9996\u65F6\u65E0\u9700\u7FFB\u5F00\u8EAB\u4EFD\u5361" },
    strongman: { name: "\u5927\u529B\u58EB", short: "\u529B\u58EB", desc: "\u5BF9\u4F60\u7684\u5BA1\u5224\u7EBF\u4E3A 8 \u70B9" },
    maid: { name: "\u5973\u4EC6", short: "\u5973\u4EC6", desc: "\u300C\u9ED1\u732B\u300D\u548C\u300C\u60C5\u4FA3\u300D\u5BF9\u4F60\u65E0\u6548" },
    maiden: { name: "\u5C11\u5973", short: "\u5C11\u5973", desc: "\u4F60\u53D1\u8D77\u5BA1\u5224\u65F6\uFF0C\u5BA1\u5224\u524D\u5148\u62BD 2 \u5F20\u724C\uFF0C\u672C\u56DE\u5408\u53EF\u4EE5\u7ACB\u5373\u4F7F\u7528" }
  };
  function charLabel(p) {
    if (!p.character) return "";
    if (p.character === "tailor") return p.ability ? `\u88C1\u7F1D\u2192${CHAR_INFO[p.ability].short}` : "\u88C1\u7F1D";
    return CHAR_INFO[p.character].short;
  }

  // src/theme/palette.ts
  var C = {
    skyTop: "#3a2a5c",
    skyMid: "#1a1326",
    skyBottom: "#0d0a14",
    gold: "#e8c774",
    goldDark: "#b8913e",
    goldLine: "#d6a44a",
    text: "#e9dcb8",
    textDim: "#bfb2d6",
    textMuted: "#8a7fa3",
    danger: "#c0394d",
    moon: "#f1e3b3",
    overlay: "rgba(8,5,14,0.72)",
    tryalHidden: "#2e2446",
    witch: "#b3263a",
    constable: "#c9a24a",
    villager: "#6b6384",
    star: "#ffffff",
    badgeText: "#fff",
    cardText: "#f3d9a0",
    badgeRing: "rgba(232,199,116,0.7)",
    chipRevealedLine: "rgba(255,255,255,0.4)",
    buttonDangerFill: "rgba(192,57,77,0.25)",
    buttonFill: "rgba(60,10,24,0.45)",
    glowStrong: "rgba(232,199,116,0.9)",
    lineDark: "#3b2d57",
    // 酒红金线：大面板、普通面板、主按钮的上下渐变色
    panelBigTop: "#3a0d1c",
    panelBigBottom: "#1e0a14",
    panelTop: "rgba(92,14,32,0.6)",
    panelBottom: "rgba(34,6,16,0.78)",
    buttonTop: "#8a1c34",
    buttonBottom: "#4a0a18",
    /** 危险按钮的文字（比 danger 亮，压得住深色底） */
    dangerText: "#e5677a",
    /** 出局格子、不可用按钮的灰线 */
    greyLine: "#6b6378",
    /** 按下效果：盖在被按住的元素上 */
    pressShade: "rgba(0,0,0,0.22)",
    transparent: "rgba(0,0,0,0)"
  };
  var nightShade = (alpha2) => `rgba(4,2,10,${alpha2})`;
  var goldGlow = (alpha2) => `rgba(232,199,116,${alpha2})`;
  var CARD_GRADIENT = {
    red: ["#7a1428", "#4a0a18"],
    blue: ["#233d6e", "#142546"],
    green: ["#265a45", "#143528"],
    black: ["#2b2b2b", "#0e0e0e"]
  };
  var BADGE_COLORS = [
    "#8e3b5a",
    "#3b6e8e",
    "#5a8e3b",
    "#8e6a3b",
    "#6a3b8e",
    "#3b8e7a",
    "#8e3b3b",
    "#3b4a8e",
    "#7a8e3b",
    "#8e3b82",
    "#3b8e4a",
    "#8e5a3b"
  ];
  var badgeColor = (seat) => BADGE_COLORS[(seat % 12 + 12) % 12];
  var font = (size, bold = false) => `${bold ? "bold " : ""}${size}px sans-serif`;
  var INK = {
    ink: "#0d0a14",
    inkSoft: "#120c1c",
    townFar: "#251a3a",
    townNear: "#0f0a18",
    ground: "#0b0811",
    parchment: "#e3d3a8",
    parchmentDark: "#cdb98a",
    sepia: "#5a4020",
    sepiaDark: "#3a2614",
    brown: "#2b1d12",
    wood: "#3a2614",
    straw: "#b8913e",
    steel: "#cfc6dc",
    iron: "#9b93ad",
    wax: "#8e1a2c",
    wine: "#7a1428",
    wineDark: "#5a1020",
    leaf: "#3f6b4f",
    flameCore: "#fff1c4",
    lilac: "#bfb2d6",
    lilacText: "#d8cce8",
    portraitTop: "#5a4585",
    portraitBottom: "#241a38",
    backTop: "#2a1d44",
    backBottom: "#120c1e",
    poison: "#5d8a4a",
    poisonLight: "#a8d08d",
    dawnTop: "#4a3a6c",
    dawnMid: "#c97b4a",
    dawnLow: "#f0c27a",
    sun: "#ffd98a",
    bloodTop: "#2a0710",
    bloodMid: "#5a0f1c",
    bloodMoon: "#c0283a",
    white: "#ffffff",
    black: "#000000"
  };
  var FRAME_GRADIENT = {
    witch: ["#6e1424", "#2a0710"],
    constable: ["#6b5320", "#2e220a"],
    villager: ["#4a4560", "#221f30"],
    character: ["#3a2a5c", "#1a1326"],
    back: ["#2a1d44", "#120c1e"]
  };
  function alpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  var titleFont = (size) => `bold ${size}px serif`;

  // src/theme/art/shapes.ts
  function rr(ctx2, x, y, w, h, r) {
    const q = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx2.beginPath();
    ctx2.moveTo(x + q, y);
    ctx2.arcTo(x + w, y, x + w, y + h, q);
    ctx2.arcTo(x + w, y + h, x, y + h, q);
    ctx2.arcTo(x, y + h, x, y, q);
    ctx2.arcTo(x, y, x + w, y, q);
    ctx2.closePath();
  }
  function ellipse(ctx2, x, y, rx, ry, rot = 0) {
    ctx2.save();
    ctx2.translate(x, y);
    ctx2.rotate(rot);
    ctx2.scale(Math.max(rx, 0.01), Math.max(ry, 0.01));
    ctx2.beginPath();
    ctx2.arc(0, 0, 1, 0, Math.PI * 2);
    ctx2.restore();
  }
  function fillEllipse(ctx2, x, y, rx, ry, rot, color) {
    ellipse(ctx2, x, y, rx, ry, rot);
    ctx2.fillStyle = color;
    ctx2.fill();
  }
  function circle(ctx2, x, y, r, color) {
    ctx2.beginPath();
    ctx2.arc(x, y, Math.max(r, 0.01), 0, Math.PI * 2);
    ctx2.fillStyle = color;
    ctx2.fill();
  }
  function hatch(ctx2, x, y, w, h, angle, gap, color, lw) {
    if (gap <= 0.5) return;
    ctx2.save();
    ctx2.strokeStyle = color;
    ctx2.lineWidth = lw;
    ctx2.beginPath();
    const d = Math.hypot(w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    for (let o = -d; o <= d; o += gap) {
      ctx2.moveTo(cx - ca * d - sa * o, cy - sa * d + ca * o);
      ctx2.lineTo(cx + ca * d - sa * o, cy + sa * d + ca * o);
    }
    ctx2.stroke();
    ctx2.restore();
  }
  function glow(ctx2, x, y, r, color) {
    if (r <= 0) return;
    const g = ctx2.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, alpha(INK.black, 0));
    ctx2.fillStyle = g;
    ctx2.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function star4(ctx2, x, y, r, color) {
    ctx2.fillStyle = color;
    ctx2.beginPath();
    ctx2.moveTo(x, y - r);
    ctx2.quadraticCurveTo(x, y, x + r, y);
    ctx2.quadraticCurveTo(x, y, x, y + r);
    ctx2.quadraticCurveTo(x, y, x - r, y);
    ctx2.quadraticCurveTo(x, y, x, y - r);
    ctx2.fill();
  }
  function crescent(ctx2, x, y, r, dx, dy, color) {
    const r2 = r * 0.88;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    const base = Math.atan2(dy, dx);
    const a = (r * r - r2 * r2 + d * d) / (2 * d);
    const t = Math.acos(Math.max(-1, Math.min(1, a / r)));
    const cx = x + dx;
    const cy = y + dy;
    const p1x = x + r * Math.cos(base + t);
    const p1y = y + r * Math.sin(base + t);
    const p2x = x + r * Math.cos(base - t);
    const p2y = y + r * Math.sin(base - t);
    ctx2.beginPath();
    ctx2.arc(x, y, r, base + t, base - t + Math.PI * 2);
    ctx2.arc(cx, cy, r2, Math.atan2(p2y - cy, p2x - cx), Math.atan2(p1y - cy, p1x - cx), true);
    ctx2.closePath();
    ctx2.fillStyle = color;
    ctx2.fill();
  }
  function polyline(ctx2, pts, lw, color) {
    ctx2.strokeStyle = color;
    ctx2.lineWidth = lw;
    ctx2.lineCap = "round";
    ctx2.lineJoin = "round";
    ctx2.beginPath();
    pts.forEach(([px, py], i) => i ? ctx2.lineTo(px, py) : ctx2.moveTo(px, py));
    ctx2.stroke();
  }
  function polygon(ctx2, pts, color) {
    ctx2.fillStyle = color;
    ctx2.beginPath();
    pts.forEach(([px, py], i) => i ? ctx2.lineTo(px, py) : ctx2.moveTo(px, py));
    ctx2.closePath();
    ctx2.fill();
  }
  function seeded(seed) {
    let s = seed | 0;
    return () => {
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // src/theme/art/icons.ts
  var blackCat = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy - s * 0.05, s * 0.45, alpha(C.moon, 0.25));
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(cx, cy - s * 0.05, s * 0.3, 0, Math.PI * 2);
    ctx2.fillStyle = C.moon;
    ctx2.fill();
    ctx2.clip();
    hatch(ctx2, cx - s * 0.3, cy - s * 0.35, s * 0.25, s * 0.6, -0.9, s * 0.03, alpha(INK.sepia, 0.35), s * 8e-3);
    ctx2.restore();
    fillEllipse(ctx2, cx, cy + s * 0.14, s * 0.15, s * 0.19, 0, INK.ink);
    circle(ctx2, cx + s * 0.01, cy - s * 0.1, s * 0.095, INK.ink);
    polygon(ctx2, [[cx - s * 0.085, cy - s * 0.13], [cx - s * 0.07, cy - s * 0.25], [cx - s * 0.01, cy - s * 0.18]], INK.ink);
    polygon(ctx2, [[cx + s * 0.1, cy - s * 0.13], [cx + s * 0.09, cy - s * 0.25], [cx + s * 0.03, cy - s * 0.18]], INK.ink);
    ctx2.strokeStyle = INK.ink;
    ctx2.lineWidth = s * 0.045;
    ctx2.lineCap = "round";
    ctx2.beginPath();
    ctx2.moveTo(cx + s * 0.12, cy + s * 0.3);
    ctx2.bezierCurveTo(cx + s * 0.32, cy + s * 0.3, cx + s * 0.3, cy + s * 0.05, cx + s * 0.2, cy - s * 0.02);
    ctx2.stroke();
    fillEllipse(ctx2, cx - s * 0.03, cy - s * 0.1, s * 0.02, s * 0.011, -0.2, C.gold);
    fillEllipse(ctx2, cx + s * 0.05, cy - s * 0.1, s * 0.02, s * 0.011, 0.2, C.gold);
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(cx - s * 0.4, cy + s * 0.32, s * 0.8, s * 0.2);
  };
  var night = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.gold, 0.18));
    crescent(ctx2, cx - s * 0.03, cy - s * 0.02, s * 0.26, s * 0.12, -s * 0.07, C.moon);
    const r = seeded(7);
    for (let i = 0; i < 9; i++) star4(ctx2, cx + (r() - 0.5) * s * 0.8, cy + (r() - 0.5) * s * 0.8, s * (0.015 + r() * 0.025), alpha(INK.white, 0.85));
    for (let i = 0; i < 3; i++) fillEllipse(ctx2, cx + (i - 1) * s * 0.2, cy + s * 0.3 + i * s * 0.03, s * 0.28, s * 0.04, 0, alpha(INK.lilac, 0.18));
  };
  var accusation = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.42, alpha(C.gold, 0.12));
    ctx2.save();
    ctx2.translate(cx, cy);
    ctx2.rotate(-0.7);
    ctx2.fillStyle = INK.parchment;
    ctx2.beginPath();
    ctx2.moveTo(0, s * 0.3);
    ctx2.bezierCurveTo(-s * 0.13, s * 0.1, -s * 0.12, -s * 0.2, s * 0.02, -s * 0.36);
    ctx2.bezierCurveTo(s * 0.08, -s * 0.15, s * 0.06, s * 0.1, 0, s * 0.3);
    ctx2.fill();
    ctx2.save();
    ctx2.clip();
    hatch(ctx2, -s * 0.15, -s * 0.4, s * 0.3, s * 0.7, 0.9, s * 0.028, alpha(INK.sepia, 0.45), s * 7e-3);
    ctx2.restore();
    polyline(ctx2, [[0, s * 0.42], [-s * 5e-3, s * 0.1], [s * 0.02, -s * 0.34]], s * 0.012, INK.sepia);
    polygon(ctx2, [[-s * 0.015, s * 0.38], [s * 0.015, s * 0.38], [0, s * 0.46]], INK.ink);
    ctx2.restore();
    for (const [dx, dy, r] of [[-0.24, 0.3, 0.03], [-0.17, 0.34, 0.018], [-0.29, 0.25, 0.014]]) circle(ctx2, cx + dx * s, cy + dy * s, r * s, INK.ink);
  };
  var evidence = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.gold, 0.15));
    const w = s * 0.42;
    const h = s * 0.56;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx2.fillStyle = INK.parchment;
    ctx2.fillRect(x, y, w, h);
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(x, y, w, h);
    ctx2.clip();
    hatch(ctx2, x, y, w, h, 0.8, s * 0.035, alpha(INK.sepia, 0.18), s * 6e-3);
    ctx2.restore();
    ctx2.fillStyle = INK.parchmentDark;
    rr(ctx2, x - s * 0.03, y - s * 0.04, w + s * 0.06, s * 0.07, s * 0.035);
    ctx2.fill();
    rr(ctx2, x - s * 0.03, y + h - s * 0.03, w + s * 0.06, s * 0.07, s * 0.035);
    ctx2.fill();
    ctx2.strokeStyle = alpha(INK.sepiaDark, 0.7);
    ctx2.lineWidth = s * 0.012;
    ctx2.beginPath();
    for (let i = 0; i < 6; i++) {
      const ly = y + s * 0.09 + i * s * 0.065;
      const len = w * (i === 5 ? 0.45 : 0.75);
      ctx2.moveTo(x + w * 0.12, ly);
      for (let t = 0; t <= len; t += s * 0.03) ctx2.lineTo(x + w * 0.12 + t, ly + Math.sin(t * 40 / s + i) * s * 6e-3);
    }
    ctx2.stroke();
    circle(ctx2, x + w * 0.78, y + h * 0.82, s * 0.07, INK.wax);
    star4(ctx2, x + w * 0.78, y + h * 0.82, s * 0.04, alpha(C.cardText, 0.8));
  };
  var witness = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.5, alpha(C.moon, 0.35));
    ctx2.strokeStyle = alpha(C.gold, 0.75);
    ctx2.lineWidth = s * 0.014;
    ctx2.lineCap = "round";
    ctx2.beginPath();
    for (let i = 0; i < 16; i++) {
      const t = i * Math.PI / 8;
      const r1 = s * 0.3;
      const r2 = s * (i % 2 ? 0.36 : 0.42);
      ctx2.moveTo(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1 * 0.8);
      ctx2.lineTo(cx + Math.cos(t) * r2, cy + Math.sin(t) * r2 * 0.8);
    }
    ctx2.stroke();
    const eye = () => {
      ctx2.beginPath();
      ctx2.moveTo(cx - s * 0.3, cy);
      ctx2.quadraticCurveTo(cx, cy - s * 0.26, cx + s * 0.3, cy);
      ctx2.quadraticCurveTo(cx, cy + s * 0.26, cx - s * 0.3, cy);
      ctx2.closePath();
    };
    eye();
    ctx2.fillStyle = C.moon;
    ctx2.fill();
    ctx2.save();
    eye();
    ctx2.clip();
    hatch(ctx2, cx - s * 0.3, cy - s * 0.15, s * 0.6, s * 0.09, 0, s * 0.022, alpha(INK.sepia, 0.4), s * 6e-3);
    const g = ctx2.createRadialGradient(cx, cy, s * 0.02, cx, cy, s * 0.12);
    g.addColorStop(0, C.gold);
    g.addColorStop(1, INK.wine);
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
    ctx2.fill();
    circle(ctx2, cx, cy, s * 0.055, INK.ink);
    circle(ctx2, cx + s * 0.035, cy - s * 0.035, s * 0.02, INK.white);
    ctx2.restore();
    eye();
    ctx2.strokeStyle = INK.ink;
    ctx2.lineWidth = s * 0.022;
    ctx2.stroke();
  };
  var arson = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy - s * 0.15, s * 0.5, alpha(C.goldLine, 0.35));
    ctx2.save();
    ctx2.translate(cx, cy);
    ctx2.rotate(0.18);
    ctx2.fillStyle = INK.wood;
    ctx2.beginPath();
    ctx2.moveTo(-s * 0.045, -s * 0.02);
    ctx2.lineTo(s * 0.045, -s * 0.02);
    ctx2.lineTo(s * 0.03, s * 0.42);
    ctx2.lineTo(-s * 0.03, s * 0.42);
    ctx2.closePath();
    ctx2.fill();
    ctx2.save();
    ctx2.clip();
    hatch(ctx2, -s * 0.05, -s * 0.02, s * 0.1, s * 0.44, 1.4, s * 0.03, alpha(INK.black, 0.4), s * 8e-3);
    ctx2.restore();
    ctx2.fillStyle = C.goldDark;
    ctx2.fillRect(-s * 0.06, -s * 0.02, s * 0.12, s * 0.04);
    ctx2.fillRect(-s * 0.055, s * 0.06, s * 0.11, s * 0.025);
    const flame = (h, w, col) => {
      ctx2.fillStyle = col;
      ctx2.beginPath();
      ctx2.moveTo(0, -s * 0.02);
      ctx2.bezierCurveTo(-w, -s * 0.05, -w * 0.6, -h * 0.6, 0, -h);
      ctx2.bezierCurveTo(w * 0.6, -h * 0.6, w, -s * 0.05, 0, -s * 0.02);
      ctx2.fill();
    };
    flame(s * 0.42, s * 0.17, C.danger);
    flame(s * 0.34, s * 0.12, C.goldLine);
    flame(s * 0.22, s * 0.07, INK.flameCore);
    ctx2.restore();
  };
  var matchmaker = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.danger, 0.25));
    ctx2.lineWidth = s * 0.05;
    ctx2.strokeStyle = C.goldDark;
    ctx2.beginPath();
    ctx2.arc(cx - s * 0.1, cy + s * 0.04, s * 0.17, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.strokeStyle = C.gold;
    ctx2.beginPath();
    ctx2.arc(cx + s * 0.1, cy - s * 0.02, s * 0.17, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.strokeStyle = C.goldDark;
    ctx2.beginPath();
    ctx2.arc(cx - s * 0.1, cy + s * 0.04, s * 0.17, -0.6, 0.2);
    ctx2.stroke();
    star4(ctx2, cx + s * 0.1, cy - s * 0.21, s * 0.06, INK.white);
    circle(ctx2, cx + s * 0.1, cy - s * 0.2, s * 0.03, C.danger);
  };
  var asylum = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.gold, 0.2));
    const arch = (w, top, bottom) => {
      ctx2.beginPath();
      ctx2.moveTo(cx - w, bottom);
      ctx2.lineTo(cx - w, cy - s * 0.02);
      ctx2.quadraticCurveTo(cx - w, top + (cy - top) * 0.25, cx, top);
      ctx2.quadraticCurveTo(cx + w, top + (cy - top) * 0.25, cx + w, cy - s * 0.02);
      ctx2.lineTo(cx + w, bottom);
      ctx2.closePath();
    };
    arch(s * 0.26, cy - s * 0.4, cy + s * 0.3);
    ctx2.fillStyle = INK.ink;
    ctx2.fill();
    ctx2.save();
    ctx2.clip();
    hatch(ctx2, cx - s * 0.3, cy - s * 0.4, s * 0.6, s * 0.7, 0, s * 0.06, alpha(INK.lilac, 0.18), s * 0.01);
    ctx2.restore();
    arch(s * 0.16, cy - s * 0.26, cy + s * 0.3);
    const g = ctx2.createLinearGradient(0, cy - s * 0.26, 0, cy + s * 0.3);
    g.addColorStop(0, INK.flameCore);
    g.addColorStop(1, C.goldDark);
    ctx2.fillStyle = g;
    ctx2.fill();
    polyline(ctx2, [[cx, cy - s * 0.26], [cx, cy + s * 0.3]], s * 0.015, INK.sepiaDark);
    circle(ctx2, cx - s * 0.04, cy + s * 0.08, s * 0.015, INK.sepiaDark);
    ctx2.fillStyle = INK.inkSoft;
    ctx2.fillRect(cx - s * 0.34, cy + s * 0.3, s * 0.68, s * 0.06);
    polyline(ctx2, [[cx, cy - s * 0.4], [cx, cy - s * 0.48]], s * 0.02, C.gold);
    polyline(ctx2, [[cx - s * 0.035, cy - s * 0.45], [cx + s * 0.035, cy - s * 0.45]], s * 0.02, C.gold);
  };
  var piety = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy - s * 0.1, s * 0.45, alpha(C.moon, 0.3));
    ctx2.strokeStyle = alpha(C.gold, 0.8);
    ctx2.lineWidth = s * 0.02;
    ctx2.beginPath();
    ctx2.arc(cx, cy - s * 0.18, s * 0.26, Math.PI * 1.15, Math.PI * 1.85);
    ctx2.stroke();
    for (const sg of [-1, 1]) {
      const ox = cx + sg * s * 0.012;
      const hand = () => {
        ctx2.beginPath();
        ctx2.moveTo(ox, cy + s * 0.32);
        ctx2.quadraticCurveTo(ox + sg * s * 0.2, cy + s * 0.22, ox + sg * s * 0.12, cy - s * 0.08);
        ctx2.quadraticCurveTo(ox + sg * s * 0.06, cy - s * 0.3, ox, cy - s * 0.36);
        ctx2.closePath();
      };
      hand();
      ctx2.fillStyle = INK.parchment;
      ctx2.fill();
      ctx2.save();
      ctx2.clip();
      hatch(ctx2, cx - s * 0.25, cy - s * 0.4, s * 0.5, s * 0.75, sg * 0.5, s * 0.08, alpha(INK.sepia, 0.25), s * 7e-3);
      ctx2.restore();
      hand();
      ctx2.strokeStyle = INK.sepiaDark;
      ctx2.lineWidth = s * 0.014;
      ctx2.stroke();
      for (let i = 1; i <= 3; i++) polyline(ctx2, [[ox + sg * s * 0.02, cy - s * (0.3 - i * 0.07)], [ox + sg * s * 0.1, cy - s * (0.24 - i * 0.07)]], s * 8e-3, alpha(INK.sepiaDark, 0.6));
    }
    ctx2.fillStyle = INK.wineDark;
    ctx2.fillRect(cx - s * 0.12, cy + s * 0.24, s * 0.24, s * 0.06);
  };
  var scapegoat = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.danger, 0.22));
    ctx2.strokeStyle = INK.sepiaDark;
    ctx2.lineWidth = s * 0.06;
    ctx2.lineCap = "round";
    for (const sg of [-1, 1]) {
      ctx2.beginPath();
      ctx2.moveTo(cx + sg * s * 0.06, cy - s * 0.14);
      ctx2.bezierCurveTo(cx + sg * s * 0.15, cy - s * 0.38, cx + sg * s * 0.36, cy - s * 0.32, cx + sg * s * 0.3, cy - s * 0.12);
      ctx2.stroke();
    }
    ctx2.strokeStyle = alpha(C.cardText, 0.5);
    ctx2.lineWidth = s * 0.01;
    for (const sg of [-1, 1]) {
      ctx2.beginPath();
      ctx2.moveTo(cx + sg * s * 0.08, cy - s * 0.18);
      ctx2.bezierCurveTo(cx + sg * s * 0.16, cy - s * 0.34, cx + sg * s * 0.32, cy - s * 0.3, cx + sg * s * 0.29, cy - s * 0.15);
      ctx2.stroke();
    }
    for (const sg of [-1, 1]) fillEllipse(ctx2, cx + sg * s * 0.17, cy - s * 0.06, s * 0.09, s * 0.035, sg * 0.4, INK.ink);
    polygon(ctx2, [[cx - s * 0.11, cy - s * 0.14], [cx + s * 0.11, cy - s * 0.14], [cx + s * 0.06, cy + s * 0.22], [cx, cy + s * 0.27], [cx - s * 0.06, cy + s * 0.22]], INK.ink);
    polygon(ctx2, [[cx - s * 0.04, cy + s * 0.24], [cx + s * 0.04, cy + s * 0.24], [cx, cy + s * 0.4]], INK.ink);
    fillEllipse(ctx2, cx - s * 0.05, cy - s * 0.04, s * 0.025, s * 0.01, 0, C.gold);
    fillEllipse(ctx2, cx + s * 0.05, cy - s * 0.04, s * 0.025, s * 0.01, 0, C.gold);
    polyline(ctx2, [[cx - s * 0.02, cy + s * 0.18], [cx + s * 0.02, cy + s * 0.18]], s * 0.01, alpha(C.cardText, 0.6));
  };
  var robbery = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.gold, 0.2));
    fillEllipse(ctx2, cx - s * 0.06, cy + s * 0.1, s * 0.2, s * 0.19, 0, INK.straw);
    ctx2.save();
    ellipse_(ctx2, cx - s * 0.06, cy + s * 0.1, s * 0.2, s * 0.19);
    ctx2.clip();
    hatch(ctx2, cx - s * 0.26, cy - s * 0.1, s * 0.4, s * 0.4, 0.7, s * 0.035, alpha(INK.sepiaDark, 0.5), s * 8e-3);
    ctx2.restore();
    polygon(ctx2, [[cx - s * 0.13, cy - s * 0.1], [cx + s * 0.01, cy - s * 0.1], [cx + s * 0.07, cy - s * 0.24], [cx - s * 0.06, cy - s * 0.15], [cx - s * 0.19, cy - s * 0.24]], INK.straw);
    ctx2.fillStyle = C.goldDark;
    ctx2.fillRect(cx - s * 0.14, cy - s * 0.11, s * 0.16, s * 0.035);
    ctx2.fillStyle = INK.sepiaDark;
    ctx2.font = titleFont(Math.max(1, Math.round(s * 0.16)));
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText("$", cx - s * 0.06, cy + s * 0.11);
    polyline(ctx2, [[cx + s * 0.48, cy + s * 0.12], [cx + s * 0.2, cy + s * 0.04]], s * 0.1, INK.ink);
    for (let i = 0; i < 3; i++) {
      polyline(ctx2, [[cx + s * 0.2, cy + s * (0 + i * 0.04)], [cx + s * 0.12, cy + s * (-0.02 + i * 0.05)], [cx + s * 0.1, cy + s * (0.03 + i * 0.05)]], s * 0.03, INK.ink);
    }
  };
  function ellipse_(ctx2, x, y, rx, ry) {
    ctx2.beginPath();
    ctx2.save();
    ctx2.translate(x, y);
    ctx2.scale(rx, ry);
    ctx2.arc(0, 0, 1, 0, Math.PI * 2);
    ctx2.restore();
  }
  var curse = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.danger, 0.25));
    ctx2.fillStyle = INK.straw;
    rr(ctx2, cx - s * 0.11, cy - s * 0.04, s * 0.22, s * 0.3, s * 0.05);
    ctx2.fill();
    ctx2.fillRect(cx - s * 0.26, cy, s * 0.52, s * 0.07);
    ctx2.fillRect(cx - s * 0.1, cy + s * 0.22, s * 0.07, s * 0.14);
    ctx2.fillRect(cx + s * 0.03, cy + s * 0.22, s * 0.07, s * 0.14);
    circle(ctx2, cx, cy - s * 0.15, s * 0.12, INK.straw);
    ctx2.save();
    rr(ctx2, cx - s * 0.26, cy - s * 0.27, s * 0.52, s * 0.63, s * 0.05);
    ctx2.clip();
    hatch(ctx2, cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.7, 1.2, s * 0.035, alpha(INK.sepiaDark, 0.35), s * 7e-3);
    ctx2.restore();
    for (const ex of [cx - s * 0.045, cx + s * 0.045]) {
      const ey = cy - s * 0.17;
      polyline(ctx2, [[ex - s * 0.025, ey - s * 0.025], [ex + s * 0.025, ey + s * 0.025]], s * 0.014, INK.ink);
      polyline(ctx2, [[ex + s * 0.025, ey - s * 0.025], [ex - s * 0.025, ey + s * 0.025]], s * 0.014, INK.ink);
    }
    polyline(ctx2, [[cx - s * 0.05, cy - s * 0.08], [cx + s * 0.05, cy - s * 0.08]], s * 0.012, INK.ink);
    for (const [x1, y1, x2, y2] of [[0.28, -0.3, 0.02, -0.12], [-0.3, 0.12, -0.04, 0.1], [0.3, 0.2, 0.05, 0.12]]) {
      polyline(ctx2, [[cx + x1 * s, cy + y1 * s], [cx + x2 * s, cy + y2 * s]], s * 0.012, INK.steel);
      circle(ctx2, cx + x1 * s, cy + y1 * s, s * 0.03, C.danger);
    }
  };
  var stocks = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.gold, 0.15));
    ctx2.fillStyle = INK.wood;
    ctx2.fillRect(cx - s * 0.04, cy, s * 0.08, s * 0.42);
    const bx = cx - s * 0.38;
    const by = cy - s * 0.2;
    const bw = s * 0.76;
    const bh = s * 0.24;
    ctx2.fillStyle = INK.straw;
    ctx2.fillRect(bx, by, bw, bh);
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(bx, by, bw, bh);
    ctx2.clip();
    hatch(ctx2, bx, by, bw, bh, 0.05, s * 0.03, alpha(INK.sepiaDark, 0.5), s * 8e-3);
    ctx2.restore();
    polyline(ctx2, [[bx, by + bh / 2], [bx + bw, by + bh / 2]], s * 0.012, INK.sepiaDark);
    circle(ctx2, cx, by + bh / 2, s * 0.075, INK.ink);
    circle(ctx2, cx - s * 0.25, by + bh / 2, s * 0.045, INK.ink);
    circle(ctx2, cx + s * 0.25, by + bh / 2, s * 0.045, INK.ink);
    ctx2.fillStyle = C.goldDark;
    for (const x of [bx + s * 0.02, bx + bw - s * 0.06]) ctx2.fillRect(x, by + bh / 2 - s * 0.03, s * 0.04, s * 0.06);
    ctx2.strokeStyle = INK.sepiaDark;
    ctx2.lineWidth = s * 0.012;
    ctx2.strokeRect(bx, by, bw, bh);
  };
  var alibi = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.moon, 0.2));
    ctx2.save();
    ctx2.translate(cx + s * 0.08, cy - s * 0.02);
    ctx2.rotate(0.15);
    ctx2.fillStyle = INK.parchment;
    ctx2.fillRect(-s * 0.18, -s * 0.26, s * 0.36, s * 0.48);
    ctx2.strokeStyle = alpha(INK.sepiaDark, 0.6);
    ctx2.lineWidth = s * 0.012;
    ctx2.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx2.moveTo(-s * 0.12, -s * 0.18 + i * s * 0.07);
      ctx2.lineTo(s * 0.12, -s * 0.18 + i * s * 0.07);
    }
    ctx2.stroke();
    circle(ctx2, s * 0.08, s * 0.14, s * 0.06, INK.wax);
    ctx2.restore();
    ctx2.save();
    ctx2.translate(cx - s * 0.12, cy + s * 0.08);
    ctx2.rotate(-0.15);
    ctx2.fillStyle = INK.lilac;
    ctx2.strokeStyle = INK.ink;
    ctx2.lineWidth = s * 0.016;
    const palm = () => rr(ctx2, -s * 0.11, -s * 0.06, s * 0.22, s * 0.24, s * 0.06);
    palm();
    ctx2.fill();
    ctx2.stroke();
    for (let i = 0; i < 4; i++) {
      rr(ctx2, -s * 0.105 + i * s * 0.055, -s * (0.26 - Math.abs(i - 1.5) * 0.03), s * 0.045, s * 0.22, s * 0.022);
      ctx2.fill();
      ctx2.stroke();
    }
    ctx2.save();
    ctx2.translate(-s * 0.11, s * 0.04);
    ctx2.rotate(-0.8);
    rr(ctx2, -s * 0.025, -s * 0.13, s * 0.05, s * 0.14, s * 0.025);
    ctx2.fill();
    ctx2.stroke();
    ctx2.restore();
    palm();
    ctx2.fill();
    ctx2.restore();
  };
  var conspiracy = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy + s * 0.1, s * 0.45, alpha(INK.poison, 0.35));
    for (let i = 0; i < 3; i++) fillEllipse(ctx2, cx + (i - 1) * s * 0.18, cy + s * (0.3 - i % 2 * 0.05), s * 0.2, s * 0.05, 0, alpha(INK.lilac, 0.2));
    ctx2.save();
    ctx2.translate(cx - s * 0.06, cy - s * 0.08);
    ctx2.rotate(0.6);
    ctx2.beginPath();
    ctx2.arc(0, s * 0.06, s * 0.16, 0, Math.PI * 2);
    ctx2.fillStyle = INK.ink;
    ctx2.fill();
    ctx2.save();
    ctx2.clip();
    ctx2.fillStyle = INK.poison;
    ctx2.fillRect(-s * 0.2, s * 0.08, s * 0.4, s * 0.2);
    ctx2.restore();
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = s * 0.014;
    ctx2.stroke();
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(-s * 0.04, -s * 0.2, s * 0.08, s * 0.12);
    ctx2.fillStyle = INK.sepiaDark;
    ctx2.fillRect(-s * 0.05, -s * 0.26, s * 0.1, s * 0.06);
    ctx2.restore();
    const dx = cx + s * 0.16;
    const dy = cy + s * 0.04;
    ctx2.fillStyle = INK.poisonLight;
    ctx2.beginPath();
    ctx2.moveTo(dx, dy - s * 0.08);
    ctx2.quadraticCurveTo(dx + s * 0.05, dy, dx, dy + s * 0.04);
    ctx2.quadraticCurveTo(dx - s * 0.05, dy, dx, dy - s * 0.08);
    ctx2.fill();
    circle(ctx2, dx + s * 0.05, dy + s * 0.14, s * 0.02, INK.poisonLight);
  };
  var CARD_ICONS = {
    accusation,
    evidence,
    witness,
    blackCat,
    matchmaker,
    asylum,
    piety,
    scapegoat,
    robbery,
    arson,
    curse,
    stocks,
    alibi,
    night,
    conspiracy
  };
  var witch = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.witch, 0.35));
    crescent(ctx2, cx + s * 0.2, cy - s * 0.22, s * 0.1, s * 0.05, -s * 0.03, C.moon);
    ctx2.fillStyle = INK.ink;
    ctx2.strokeStyle = C.goldLine;
    ctx2.lineWidth = s * 0.01;
    ctx2.beginPath();
    ctx2.moveTo(cx - s * 0.17, cy + s * 0.14);
    ctx2.quadraticCurveTo(cx - s * 0.05, cy - s * 0.1, cx + s * 0.02, cy - s * 0.32);
    ctx2.quadraticCurveTo(cx + s * 0.06, cy - s * 0.2, cx + s * 0.2, cy - s * 0.26);
    ctx2.quadraticCurveTo(cx + s * 0.07, cy - s * 0.12, cx + s * 0.17, cy + s * 0.14);
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();
    ellipse_(ctx2, cx, cy + s * 0.16, s * 0.36, s * 0.07);
    ctx2.fill();
    ctx2.stroke();
    polygon(ctx2, [[cx - s * 0.165, cy + s * 0.08], [cx + s * 0.165, cy + s * 0.08], [cx + s * 0.17, cy + s * 0.14], [cx - s * 0.17, cy + s * 0.14]], C.witch);
    ctx2.strokeStyle = C.gold;
    ctx2.lineWidth = s * 0.014;
    ctx2.strokeRect(cx - s * 0.035, cy + s * 0.075, s * 0.07, s * 0.07);
  };
  var constable = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy + s * 0.05, s * 0.45, alpha(C.gold, 0.35));
    ctx2.strokeStyle = INK.ink;
    ctx2.lineWidth = s * 0.025;
    ctx2.beginPath();
    ctx2.arc(cx, cy - s * 0.3, s * 0.05, Math.PI, 0);
    ctx2.stroke();
    polygon(ctx2, [[cx - s * 0.05, cy - s * 0.3], [cx + s * 0.05, cy - s * 0.3], [cx + s * 0.17, cy - s * 0.18], [cx - s * 0.17, cy - s * 0.18]], INK.ink);
    ctx2.fillStyle = alpha(C.gold, 0.55);
    ctx2.fillRect(cx - s * 0.13, cy - s * 0.18, s * 0.26, s * 0.32);
    glow(ctx2, cx, cy - s * 0.02, s * 0.15, alpha(INK.flameCore, 0.9));
    ctx2.fillStyle = INK.flameCore;
    ctx2.beginPath();
    ctx2.moveTo(cx, cy - s * 0.1);
    ctx2.quadraticCurveTo(cx + s * 0.04, cy, cx, cy + s * 0.04);
    ctx2.quadraticCurveTo(cx - s * 0.04, cy, cx, cy - s * 0.1);
    ctx2.fill();
    ctx2.strokeStyle = INK.ink;
    ctx2.lineWidth = s * 0.022;
    ctx2.strokeRect(cx - s * 0.13, cy - s * 0.18, s * 0.26, s * 0.32);
    ctx2.beginPath();
    ctx2.moveTo(cx - s * 0.045, cy - s * 0.18);
    ctx2.lineTo(cx - s * 0.045, cy + s * 0.14);
    ctx2.moveTo(cx + s * 0.045, cy - s * 0.18);
    ctx2.lineTo(cx + s * 0.045, cy + s * 0.14);
    ctx2.stroke();
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(cx - s * 0.17, cy + s * 0.14, s * 0.34, s * 0.06);
    star4(ctx2, cx, cy + s * 0.32, s * 0.07, C.gold);
  };
  var villager = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(INK.lilac, 0.2));
    for (let i = 0; i < 3; i++) circle(ctx2, cx + s * 0.13 + i * s * 0.03, cy - s * 0.3 - i * s * 0.06, s * (0.03 + i * 0.012), alpha(INK.lilac, 0.25));
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(cx + s * 0.1, cy - s * 0.27, s * 0.06, s * 0.14);
    const roof = [[cx - s * 0.27, cy - s * 0.02], [cx, cy - s * 0.24], [cx + s * 0.27, cy - s * 0.02]];
    polygon(ctx2, roof, INK.ink);
    ctx2.fillRect(cx - s * 0.21, cy - s * 0.03, s * 0.42, s * 0.3);
    ctx2.save();
    ctx2.beginPath();
    roof.forEach(([x, y], i) => i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y));
    ctx2.closePath();
    ctx2.clip();
    hatch(ctx2, cx - s * 0.3, cy - s * 0.25, s * 0.6, s * 0.25, 0, s * 0.035, alpha(INK.lilac, 0.25), s * 7e-3);
    ctx2.restore();
    glow(ctx2, cx - s * 0.1, cy + s * 0.08, s * 0.12, alpha(C.gold, 0.5));
    ctx2.fillStyle = C.gold;
    ctx2.fillRect(cx - s * 0.14, cy + s * 0.04, s * 0.08, s * 0.08);
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(cx - s * 0.102, cy + s * 0.04, s * 6e-3, s * 0.08);
    ctx2.fillRect(cx - s * 0.14, cy + s * 0.077, s * 0.08, s * 6e-3);
    ctx2.fillStyle = INK.brown;
    ctx2.fillRect(cx + s * 0.05, cy + s * 0.1, s * 0.09, s * 0.17);
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(cx - s * 0.4, cy + s * 0.27, s * 0.8, s * 0.2);
  };
  var TRYAL_ICONS = { witch, constable, villager };
  var judge = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy, s * 0.45, alpha(C.gold, 0.25));
    ctx2.fillStyle = INK.ink;
    rr(ctx2, cx - s * 0.24, cy + s * 0.2, s * 0.48, s * 0.08, s * 0.02);
    ctx2.fill();
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = s * 0.01;
    ctx2.stroke();
    ctx2.save();
    ctx2.translate(cx + s * 0.02, cy - s * 0.02);
    ctx2.rotate(-0.6);
    ctx2.fillStyle = INK.wood;
    rr(ctx2, -s * 0.025, -s * 0.02, s * 0.05, s * 0.38, s * 0.02);
    ctx2.fill();
    ctx2.fillStyle = INK.ink;
    rr(ctx2, -s * 0.16, -s * 0.12, s * 0.32, s * 0.13, s * 0.03);
    ctx2.fill();
    ctx2.fillStyle = C.goldDark;
    ctx2.fillRect(-s * 0.12, -s * 0.12, s * 0.025, s * 0.13);
    ctx2.fillRect(s * 0.095, -s * 0.12, s * 0.025, s * 0.13);
    ctx2.restore();
  };
  var doctor = (ctx2, cx, cy, s) => {
    fillEllipse(ctx2, cx - s * 0.04, cy - s * 0.2, s * 0.26, s * 0.05, 0, INK.ink);
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(cx - s * 0.16, cy - s * 0.36, s * 0.24, s * 0.17);
    circle(ctx2, cx - s * 0.05, cy - s * 0.02, s * 0.16, INK.ink);
    ctx2.beginPath();
    ctx2.moveTo(cx + s * 0.06, cy - s * 0.1);
    ctx2.quadraticCurveTo(cx + s * 0.3, cy - s * 0.02, cx + s * 0.36, cy + s * 0.22);
    ctx2.quadraticCurveTo(cx + s * 0.2, cy + s * 0.1, cx + s * 0.03, cy + s * 0.08);
    ctx2.fill();
    ctx2.fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.3, s * 0.3);
    circle(ctx2, cx - s * 0.02, cy - s * 0.05, s * 0.045, C.gold);
    circle(ctx2, cx - s * 0.02, cy - s * 0.05, s * 0.02, INK.ink);
    ellipse_(ctx2, cx - s * 0.04, cy - s * 0.2, s * 0.26, s * 0.05);
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = s * 0.01;
    ctx2.stroke();
  };
  var beggar = (ctx2, cx, cy, s) => {
    ctx2.fillStyle = INK.ink;
    ctx2.beginPath();
    ctx2.save();
    ctx2.translate(cx, cy + s * 0.08);
    ctx2.scale(s * 0.28, s * 0.2);
    ctx2.arc(0, 0, 1, 0, Math.PI);
    ctx2.restore();
    ctx2.fill();
    ellipse_(ctx2, cx, cy + s * 0.08, s * 0.28, s * 0.06);
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = s * 0.02;
    ctx2.stroke();
    for (const [dx, dy, r] of [[-0.06, -0.08, 0.06], [0.1, -0.2, 0.05], [0.02, -0.32, 0.04]]) fillEllipse(ctx2, cx + dx * s, cy + dy * s, r * s, r * s * 0.75, 0.4, C.gold);
    polyline(ctx2, [[cx + s * 0.1, cy + s * 0.14], [cx + s * 0.14, cy + s * 0.2], [cx + s * 0.11, cy + s * 0.26]], s * 0.012, alpha(C.gold, 0.5));
  };
  var landlord = (ctx2, cx, cy, s) => {
    ctx2.save();
    ctx2.translate(cx, cy);
    ctx2.rotate(-0.75);
    ctx2.strokeStyle = C.gold;
    ctx2.lineWidth = s * 0.05;
    ctx2.beginPath();
    ctx2.arc(0, -s * 0.22, s * 0.1, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.fillStyle = C.gold;
    ctx2.fillRect(-s * 0.025, -s * 0.12, s * 0.05, s * 0.44);
    ctx2.fillRect(s * 0.02, s * 0.2, s * 0.1, s * 0.04);
    ctx2.fillRect(s * 0.02, s * 0.27, s * 0.07, s * 0.04);
    circle(ctx2, 0, -s * 0.22, s * 0.035, INK.ink);
    ctx2.restore();
  };
  var priest = (ctx2, cx, cy, s) => {
    glow(ctx2, cx, cy - s * 0.1, s * 0.3, alpha(INK.flameCore, 0.5));
    ctx2.fillStyle = C.gold;
    ctx2.fillRect(cx - s * 0.03, cy - s * 0.36, s * 0.06, s * 0.36);
    ctx2.fillRect(cx - s * 0.12, cy - s * 0.26, s * 0.24, s * 0.055);
    ctx2.fillStyle = INK.ink;
    ctx2.beginPath();
    ctx2.moveTo(cx - s * 0.3, cy + s * 0.06);
    ctx2.quadraticCurveTo(cx - s * 0.15, cy, cx, cy + s * 0.07);
    ctx2.quadraticCurveTo(cx + s * 0.15, cy, cx + s * 0.3, cy + s * 0.06);
    ctx2.lineTo(cx + s * 0.3, cy + s * 0.26);
    ctx2.quadraticCurveTo(cx + s * 0.15, cy + s * 0.2, cx, cy + s * 0.27);
    ctx2.quadraticCurveTo(cx - s * 0.15, cy + s * 0.2, cx - s * 0.3, cy + s * 0.26);
    ctx2.closePath();
    ctx2.fill();
    polyline(ctx2, [[cx, cy + s * 0.07], [cx, cy + s * 0.27]], s * 0.012, C.goldDark);
    for (let i = 0; i < 3; i++) {
      polyline(ctx2, [[cx - s * 0.25, cy + s * (0.1 + i * 0.045)], [cx - s * 0.05, cy + s * (0.12 + i * 0.045)]], s * 8e-3, alpha(C.gold, 0.45));
      polyline(ctx2, [[cx + s * 0.05, cy + s * (0.12 + i * 0.045)], [cx + s * 0.25, cy + s * (0.1 + i * 0.045)]], s * 8e-3, alpha(C.gold, 0.45));
    }
  };
  var storyteller = (ctx2, cx, cy, s) => {
    for (let i = 0; i < 5; i++) {
      ctx2.save();
      ctx2.translate(cx, cy + s * 0.28);
      ctx2.rotate((i - 2) * 0.28);
      const w = s * 0.2;
      const h = s * 0.3;
      rr(ctx2, -w / 2, -h - s * 0.12, w, h, s * 0.025);
      ctx2.fillStyle = i === 2 ? INK.wine : FRAME_GRADIENT.back[0];
      ctx2.fill();
      ctx2.strokeStyle = C.goldLine;
      ctx2.lineWidth = s * 0.01;
      ctx2.stroke();
      if (i === 2) star4(ctx2, 0, -h / 2 - s * 0.12, s * 0.05, C.gold);
      else crescent(ctx2, 0, -h / 2 - s * 0.12, s * 0.04, s * 0.02, -s * 0.01, alpha(C.gold, 0.7));
      ctx2.restore();
    }
  };
  var tailor = (ctx2, cx, cy, s) => {
    ctx2.save();
    ctx2.translate(cx, cy);
    for (const sg of [-1, 1]) {
      ctx2.save();
      ctx2.rotate(sg * 0.35);
      polygon(ctx2, [[-s * 0.02, 0], [s * 0.02, 0], [s * 5e-3, -s * 0.36]], INK.steel);
      ctx2.strokeStyle = C.gold;
      ctx2.lineWidth = s * 0.035;
      ctx2.beginPath();
      ctx2.arc(0, s * 0.17, s * 0.08, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.fillStyle = C.gold;
      ctx2.fillRect(-s * 0.015, 0, s * 0.03, s * 0.1);
      ctx2.restore();
    }
    circle(ctx2, 0, 0, s * 0.025, INK.ink);
    ctx2.restore();
    polyline(ctx2, [[cx - s * 0.32, cy - s * 0.3], [cx - s * 0.2, cy - s * 0.12], [cx - s * 0.3, cy + s * 0.05], [cx - s * 0.22, cy + s * 0.3]], s * 0.012, C.danger);
  };
  var housewife = (ctx2, cx, cy, s) => {
    ctx2.strokeStyle = alpha(INK.lilac, 0.45);
    ctx2.lineWidth = s * 0.018;
    ctx2.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      ctx2.beginPath();
      ctx2.moveTo(cx - s * 0.02 + i * s * 0.08, cy - s * 0.2);
      ctx2.bezierCurveTo(cx - s * 0.08 + i * s * 0.08, cy - s * 0.27, cx + s * 0.04 + i * s * 0.08, cy - s * 0.32, cx - s * 0.02 + i * s * 0.08, cy - s * 0.4);
      ctx2.stroke();
    }
    fillEllipse(ctx2, cx, cy + s * 0.06, s * 0.22, s * 0.2, 0, INK.ink);
    ctx2.fillStyle = INK.ink;
    ctx2.beginPath();
    ctx2.moveTo(cx + s * 0.16, cy);
    ctx2.quadraticCurveTo(cx + s * 0.32, cy - s * 0.02, cx + s * 0.36, cy - s * 0.14);
    ctx2.lineTo(cx + s * 0.3, cy - s * 0.12);
    ctx2.quadraticCurveTo(cx + s * 0.26, cy + s * 0.04, cx + s * 0.16, cy + s * 0.1);
    ctx2.fill();
    ctx2.strokeStyle = INK.ink;
    ctx2.lineWidth = s * 0.035;
    ctx2.beginPath();
    ctx2.arc(cx, cy - s * 0.1, s * 0.15, Math.PI * 1.1, Math.PI * 1.9);
    ctx2.stroke();
    fillEllipse(ctx2, cx, cy - s * 0.13, s * 0.1, s * 0.025, 0, C.goldDark);
    ctx2.fillStyle = C.goldDark;
    ctx2.fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.4, s * 0.02);
  };
  var farmer = (ctx2, cx, cy, s) => {
    for (const [ang, len] of [[-0.35, 0.55], [0, 0.62], [0.35, 0.55]]) {
      ctx2.save();
      ctx2.translate(cx, cy + s * 0.32);
      ctx2.rotate(ang);
      polyline(ctx2, [[0, 0], [0, -s * len]], s * 0.02, C.goldDark);
      for (let k = 0; k < 5; k++) {
        const y = -s * len + s * (0.04 + k * 0.05);
        for (const sg of [-1, 1]) fillEllipse(ctx2, sg * s * 0.03, y, s * 0.022, s * 0.045, sg * 0.5, C.gold);
      }
      ctx2.restore();
    }
    ctx2.fillStyle = C.danger;
    ctx2.fillRect(cx - s * 0.07, cy + s * 0.14, s * 0.14, s * 0.04);
  };
  var child = (ctx2, cx, cy, s) => {
    ctx2.strokeStyle = alpha(C.gold, 0.5);
    ctx2.lineWidth = s * 0.012;
    for (const r of [0.3, 0.36]) {
      ctx2.beginPath();
      ctx2.save();
      ctx2.translate(cx, cy + s * 0.26);
      ctx2.scale(s * r, s * r * 0.2);
      ctx2.arc(0, 0, 1, Math.PI * 0.1, Math.PI * 0.9);
      ctx2.restore();
      ctx2.stroke();
    }
    ctx2.save();
    ctx2.beginPath();
    ctx2.moveTo(cx - s * 0.24, cy - s * 0.08);
    ctx2.quadraticCurveTo(cx, cy - s * 0.2, cx + s * 0.24, cy - s * 0.08);
    ctx2.lineTo(cx, cy + s * 0.3);
    ctx2.closePath();
    ctx2.fillStyle = INK.wine;
    ctx2.fill();
    ctx2.clip();
    for (let i = 0; i < 4; i++) {
      ctx2.fillStyle = i % 2 ? C.gold : INK.ink;
      ctx2.fillRect(cx - s * 0.3, cy - s * 0.04 + i * s * 0.07, s * 0.6, s * 0.03);
    }
    ctx2.restore();
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(cx - s * 0.02, cy - s * 0.3, s * 0.04, s * 0.16);
    circle(ctx2, cx, cy - s * 0.31, s * 0.035, INK.ink);
  };
  var minister = (ctx2, cx, cy, s) => {
    ctx2.fillStyle = alpha(C.danger, 0.85);
    ctx2.fillRect(cx - s * 0.3, cy + s * 0.2, s * 0.26, s * 0.14);
    ctx2.strokeStyle = alpha(C.cardText, 0.6);
    ctx2.lineWidth = s * 0.01;
    ctx2.strokeRect(cx - s * 0.28, cy + s * 0.22, s * 0.22, s * 0.1);
    ctx2.save();
    ctx2.translate(cx + s * 0.08, cy);
    ctx2.rotate(0.2);
    circle(ctx2, 0, -s * 0.28, s * 0.08, INK.ink);
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(-s * 0.035, -s * 0.24, s * 0.07, s * 0.22);
    rr(ctx2, -s * 0.16, -s * 0.04, s * 0.32, s * 0.14, s * 0.02);
    ctx2.fill();
    ctx2.fillStyle = C.goldDark;
    ctx2.fillRect(-s * 0.16, s * 0.08, s * 0.32, s * 0.04);
    ctx2.restore();
  };
  var official = (ctx2, cx, cy, s) => {
    ctx2.fillStyle = INK.ink;
    ctx2.beginPath();
    ctx2.moveTo(cx - s * 0.36, cy + s * 0.02);
    ctx2.quadraticCurveTo(cx - s * 0.2, cy - s * 0.28, cx, cy - s * 0.2);
    ctx2.quadraticCurveTo(cx + s * 0.2, cy - s * 0.28, cx + s * 0.36, cy + s * 0.02);
    ctx2.quadraticCurveTo(cx + s * 0.15, cy - s * 0.02, cx, cy + s * 0.14);
    ctx2.quadraticCurveTo(cx - s * 0.15, cy - s * 0.02, cx - s * 0.36, cy + s * 0.02);
    ctx2.closePath();
    ctx2.fill();
    ctx2.strokeStyle = C.gold;
    ctx2.lineWidth = s * 0.018;
    ctx2.stroke();
    circle(ctx2, cx + s * 0.14, cy - s * 0.1, s * 0.05, C.danger);
    star4(ctx2, cx + s * 0.14, cy - s * 0.1, s * 0.035, C.gold);
  };
  var strongman = (ctx2, cx, cy, s) => {
    ctx2.fillStyle = INK.iron;
    ctx2.fillRect(cx - s * 0.36, cy - s * 0.02, s * 0.72, s * 0.04);
    ctx2.fillStyle = INK.ink;
    for (const sg of [-1, 1]) {
      rr(ctx2, cx + sg * s * 0.25 - s * 0.045, cy - s * 0.2, s * 0.09, s * 0.4, s * 0.02);
      ctx2.fill();
      rr(ctx2, cx + sg * s * 0.16 - s * 0.035, cy - s * 0.14, s * 0.07, s * 0.28, s * 0.02);
      ctx2.fill();
    }
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = s * 0.01;
    for (const sg of [-1, 1]) {
      rr(ctx2, cx + sg * s * 0.25 - s * 0.045, cy - s * 0.2, s * 0.09, s * 0.4, s * 0.02);
      ctx2.stroke();
    }
    ctx2.fillStyle = C.gold;
    ctx2.font = titleFont(Math.max(1, Math.round(s * 0.14)));
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText("8", cx, cy + s * 0.22);
  };
  var maid = (ctx2, cx, cy, s) => {
    ctx2.save();
    ctx2.translate(cx, cy);
    ctx2.rotate(0.45);
    ctx2.fillStyle = INK.wood;
    ctx2.fillRect(-s * 0.018, -s * 0.42, s * 0.036, s * 0.5);
    ctx2.beginPath();
    ctx2.moveTo(-s * 0.06, s * 0.06);
    ctx2.lineTo(s * 0.06, s * 0.06);
    ctx2.lineTo(s * 0.15, s * 0.38);
    ctx2.lineTo(-s * 0.15, s * 0.38);
    ctx2.closePath();
    ctx2.fillStyle = INK.straw;
    ctx2.fill();
    ctx2.save();
    ctx2.clip();
    hatch(ctx2, -s * 0.15, s * 0.06, s * 0.3, s * 0.32, Math.PI / 2, s * 0.025, alpha(INK.sepiaDark, 0.6), s * 8e-3);
    ctx2.restore();
    ctx2.fillStyle = C.danger;
    ctx2.fillRect(-s * 0.07, s * 0.06, s * 0.14, s * 0.04);
    ctx2.restore();
  };
  var maiden = (ctx2, cx, cy, s) => {
    polyline(ctx2, [[cx, cy + s * 0.02], [cx - s * 0.02, cy + s * 0.2], [cx + s * 0.01, cy + s * 0.38]], s * 0.025, INK.leaf);
    for (const sg of [-1, 1]) fillEllipse(ctx2, cx + sg * s * 0.08, cy + s * 0.22, s * 0.07, s * 0.03, sg * -0.5, INK.leaf);
    for (let i = 0; i < 5; i++) {
      const t = i * Math.PI * 2 / 5 - Math.PI / 2;
      circle(ctx2, cx + Math.cos(t) * s * 0.09, cy - s * 0.1 + Math.sin(t) * s * 0.09, s * 0.09, C.danger);
    }
    circle(ctx2, cx, cy - s * 0.1, s * 0.07, INK.wine);
    circle(ctx2, cx, cy - s * 0.1, s * 0.03, C.gold);
  };
  var CHAR_ICONS = {
    doctor,
    beggar,
    landlord,
    judge,
    priest,
    storyteller,
    tailor,
    housewife,
    farmer,
    child,
    minister,
    official,
    strongman,
    maid,
    maiden
  };

  // src/theme/art/frames.ts
  var TINY_W = 40;
  var SMALL_W = 80;
  var RED_POINTS2 = { accusation: 1, evidence: 3, witness: 7 };
  var RED_GLOW = { accusation: 0, evidence: 0.5, witness: 1 };
  function vertical(ctx2, h, [top, bottom]) {
    const g = ctx2.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    return g;
  }
  function framed(ctx2, w, h, colors, title, art, frameGlow = 0) {
    const r = Math.max(3, w * 0.07);
    rr(ctx2, 0.5, 0.5, w - 1, h - 1, r);
    ctx2.fillStyle = vertical(ctx2, h, colors);
    ctx2.fill();
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = Math.max(1, w * 0.012);
    ctx2.stroke();
    const tiny = w < TINY_W;
    const small2 = w < SMALL_W;
    const pad = tiny ? Math.max(2, w * 0.08) : w * (small2 ? 0.07 : 0.065);
    const aw = w - pad * 2;
    const ah = tiny ? h - pad * 2 : h * (small2 ? 0.7 : 0.66);
    ctx2.save();
    rr(ctx2, pad, pad, aw, ah, r * 0.6);
    ctx2.clip();
    ctx2.fillStyle = alpha(INK.black, 0.35);
    ctx2.fillRect(pad, pad, aw, ah);
    if (!small2) hatch(ctx2, pad, pad, aw, ah, -0.7, w * 0.03, alpha(INK.white, 0.04), 1);
    art(ctx2, pad + aw / 2, pad + ah / 2, Math.min(aw, ah * 1.05));
    ctx2.restore();
    rr(ctx2, pad, pad, aw, ah, r * 0.6);
    ctx2.strokeStyle = alpha(C.goldLine, 0.55 + 0.45 * frameGlow);
    ctx2.lineWidth = Math.max(0.75, w * (8e-3 + 0.012 * frameGlow));
    ctx2.stroke();
    if (tiny) return;
    if (!small2) {
      ctx2.fillStyle = C.goldLine;
      for (const [px, py] of [[0.07, 0.035], [0.93, 0.035], [0.07, 0.965], [0.93, 0.965]]) {
        ctx2.save();
        ctx2.translate(w * px, h * py);
        ctx2.rotate(Math.PI / 4);
        ctx2.fillRect(-w * 0.015, -w * 0.015, w * 0.03, w * 0.03);
        ctx2.restore();
      }
    }
    const fs = Math.max(9, Math.round(w * (small2 ? 0.19 : 0.115)));
    ctx2.fillStyle = C.cardText;
    ctx2.font = titleFont(fs);
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(title, w / 2, pad + ah + (h - pad - ah) / 2);
  }
  function pointsBadge(ctx2, w, n) {
    const R = Math.max(5, w * 0.11);
    const p = w * 0.14;
    circle(ctx2, p, p, R, INK.wineDark);
    ctx2.strokeStyle = C.gold;
    ctx2.lineWidth = Math.max(1, R * 0.14);
    ctx2.stroke();
    ctx2.fillStyle = C.cardText;
    ctx2.font = titleFont(Math.round(R * 1.25));
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(String(n), p, p + R * 0.05);
  }
  function cardFace(ctx2, w, h, kind) {
    var _a;
    const info = CARD_INFO[kind];
    framed(ctx2, w, h, CARD_GRADIENT[info.color], info.name, CARD_ICONS[kind], (_a = RED_GLOW[kind]) != null ? _a : 0);
    const pts = RED_POINTS2[kind];
    if (pts !== void 0 && w >= 30) pointsBadge(ctx2, w, pts);
  }
  function cardBack(ctx2, w, h) {
    const r = Math.max(2, w * 0.07);
    rr(ctx2, 0.5, 0.5, w - 1, h - 1, r);
    ctx2.fillStyle = vertical(ctx2, h, FRAME_GRADIENT.back);
    ctx2.fill();
    ctx2.save();
    ctx2.clip();
    hatch(ctx2, 0, 0, w, h, Math.PI / 4, Math.max(3, w * 0.09), alpha(C.gold, 0.12), 1);
    hatch(ctx2, 0, 0, w, h, -Math.PI / 4, Math.max(3, w * 0.09), alpha(C.gold, 0.12), 1);
    ctx2.restore();
    rr(ctx2, 0.5, 0.5, w - 1, h - 1, r);
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = Math.max(1, w * 0.012);
    ctx2.stroke();
    if (w >= 24) {
      rr(ctx2, w * 0.06, w * 0.06, w * 0.88, h - w * 0.12, r * 0.6);
      ctx2.strokeStyle = alpha(C.goldLine, 0.6);
      ctx2.stroke();
    }
    const cx = w / 2;
    const cy = h / 2;
    const R = w * 0.3;
    circle(ctx2, cx, cy, R * 1.1, FRAME_GRADIENT.back[1]);
    ctx2.strokeStyle = C.goldLine;
    ctx2.lineWidth = Math.max(1, w * 0.012);
    ctx2.beginPath();
    ctx2.arc(cx, cy, R, 0, Math.PI * 2);
    ctx2.stroke();
    if (w >= 24) {
      ctx2.beginPath();
      ctx2.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
      ctx2.stroke();
      for (let i = 0; i < 12; i++) {
        const t = i * Math.PI / 6;
        ctx2.beginPath();
        ctx2.moveTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
        ctx2.lineTo(cx + Math.cos(t) * R * 1.25, cy + Math.sin(t) * R * 1.25);
        ctx2.stroke();
      }
    }
    crescent(ctx2, cx - R * 0.1, cy, R * 0.55, R * 0.25, -R * 0.12, C.gold);
    star4(ctx2, cx + R * 0.32, cy - R * 0.25, R * 0.12, C.gold);
  }
  function tryalFace(ctx2, w, h, kind) {
    framed(ctx2, w, h, FRAME_GRADIENT[kind], TRYAL_NAME[kind], TRYAL_ICONS[kind]);
  }
  function portrait(ctx2, size, id, ring) {
    const R = size / 2 - Math.max(1, size * 0.04);
    const c = size / 2;
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(c, c, R, 0, Math.PI * 2);
    const g = ctx2.createRadialGradient(c, c - R * 0.4, R * 0.1, c, c, R);
    g.addColorStop(0, INK.portraitTop);
    g.addColorStop(1, INK.portraitBottom);
    ctx2.fillStyle = g;
    ctx2.fill();
    ctx2.clip();
    CHAR_ICONS[id](ctx2, c, c + R * 0.05, R * 1.75);
    ctx2.restore();
    ctx2.strokeStyle = ring;
    ctx2.lineWidth = Math.max(1.2, size * 0.05);
    ctx2.beginPath();
    ctx2.arc(c, c, R, 0, Math.PI * 2);
    ctx2.stroke();
  }
  function charCard(ctx2, w, h, id) {
    const info = CHAR_INFO[id];
    const k = w / 160;
    rr(ctx2, 1, 1, w - 2, h - 2, 10 * k);
    ctx2.fillStyle = vertical(ctx2, h, FRAME_GRADIENT.character);
    ctx2.fill();
    ctx2.strokeStyle = C.goldDark;
    ctx2.lineWidth = 1.5;
    ctx2.stroke();
    rr(ctx2, 6 * k, 6 * k, w - 12 * k, h - 12 * k, 7 * k);
    ctx2.strokeStyle = alpha(C.goldLine, 0.45);
    ctx2.lineWidth = 1;
    ctx2.stroke();
    const R = w * 0.3;
    const cx = w / 2;
    const cy = h * 0.27;
    glow(ctx2, cx, cy, R * 1.6, alpha(C.gold, 0.18));
    ctx2.save();
    ctx2.translate(cx - R - 2, cy - R - 2);
    portrait(ctx2, R * 2 + 4, id, C.goldLine);
    ctx2.restore();
    const by = h * 0.52;
    const bw = w * 0.78;
    const bh = 24 * k;
    ctx2.fillStyle = INK.wineDark;
    ctx2.beginPath();
    ctx2.moveTo(cx - bw / 2 - 8 * k, by);
    ctx2.lineTo(cx - bw / 2 + 4 * k, by + bh / 2);
    ctx2.lineTo(cx - bw / 2 - 8 * k, by + bh);
    ctx2.lineTo(cx + bw / 2 + 8 * k, by + bh);
    ctx2.lineTo(cx + bw / 2 - 4 * k, by + bh / 2);
    ctx2.lineTo(cx + bw / 2 + 8 * k, by);
    ctx2.closePath();
    ctx2.fill();
    ctx2.fillStyle = INK.wine;
    ctx2.fillRect(cx - bw / 2 + 4 * k, by - 2 * k, bw - 8 * k, bh + 4 * k);
    ctx2.strokeStyle = C.goldLine;
    ctx2.lineWidth = 1;
    ctx2.strokeRect(cx - bw / 2 + 4 * k, by - 2 * k, bw - 8 * k, bh + 4 * k);
    ctx2.fillStyle = C.cardText;
    ctx2.font = titleFont(Math.round(15 * k));
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(info.name, cx, by + bh / 2 + k);
    const size = Math.max(10, Math.round(11 * k));
    ctx2.font = font(size);
    ctx2.fillStyle = INK.lilacText;
    ctx2.textAlign = "left";
    ctx2.textBaseline = "top";
    const lines = wrapText(info.desc, w - 28 * k, (s) => ctx2.measureText(s).width);
    const lh = size + 5 * k;
    const maxLines = Math.max(1, Math.floor((h - (by + bh + 12 * k) - 8 * k) / lh));
    lines.slice(0, maxLines).forEach((line, i) => ctx2.fillText(line, 14 * k, by + bh + 12 * k + i * lh));
    const limit = USE_LIMITS[id];
    if (limit) {
      const t = `\u9650 ${limit} \u6B21`;
      ctx2.font = font(Math.max(9, Math.round(10 * k)), true);
      const tw = ctx2.measureText(t).width + 12 * k;
      const th = 18 * k;
      rr(ctx2, w - tw - 10 * k, 10 * k, tw, th, th / 2);
      ctx2.fillStyle = alpha(C.danger, 0.85);
      ctx2.fill();
      ctx2.strokeStyle = C.gold;
      ctx2.stroke();
      ctx2.fillStyle = INK.white;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(t, w - tw / 2 - 10 * k, 10 * k + th / 2);
    }
  }

  // src/theme/art/scenes.ts
  var tableMoon = (W, H) => ({ x: W - 60, y: H * 0.16, r: 22 });
  function sky(ctx2, W, H, stops) {
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, W, H);
  }
  function stars(ctx2, W, H, count, seed, maxY) {
    const r = seeded(seed);
    ctx2.fillStyle = INK.white;
    for (let i = 0; i < count; i++) {
      ctx2.globalAlpha = 0.3 + r() * 0.7;
      ctx2.beginPath();
      ctx2.arc(r() * W, r() * H * maxY, 0.4 + r() * 1.1, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.globalAlpha = 1;
  }
  function moon(ctx2, x, y, r, face, halo, crater) {
    glow(ctx2, x, y, r * 3.2, halo);
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(x, y, r, 0, Math.PI * 2);
    ctx2.fillStyle = face;
    ctx2.fill();
    ctx2.clip();
    for (const [dx, dy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.09]]) circle(ctx2, x + dx * r, y + dy * r, cr * r, crater);
    hatch(ctx2, x - r, y - r, r * 0.9, r * 2, -1, 3, alpha(INK.sepia, 0.25), 0.8);
    ctx2.restore();
  }
  function hills(ctx2, W, H, y, color) {
    ctx2.fillStyle = color;
    ctx2.beginPath();
    ctx2.moveTo(0, y);
    for (let x = 0; x <= W; x += 10) ctx2.lineTo(x, y - Math.sin(x / 45) * 10 - Math.sin(x / 17) * 4 - (x < 110 ? (110 - x) * 0.35 : 0));
    ctx2.lineTo(W, H);
    ctx2.lineTo(0, H);
    ctx2.closePath();
    ctx2.fill();
  }
  function gallows(ctx2, x, baseY, k, color) {
    ctx2.strokeStyle = color;
    ctx2.lineWidth = 4 * k;
    ctx2.lineCap = "square";
    ctx2.beginPath();
    ctx2.moveTo(x, baseY);
    ctx2.lineTo(x, baseY - 60 * k);
    ctx2.lineTo(x + 38 * k, baseY - 60 * k);
    ctx2.moveTo(x, baseY - 45 * k);
    ctx2.lineTo(x + 15 * k, baseY - 60 * k);
    ctx2.stroke();
    ctx2.lineWidth = 1.4 * k;
    ctx2.beginPath();
    ctx2.moveTo(x + 32 * k, baseY - 60 * k);
    ctx2.lineTo(x + 32 * k, baseY - 39 * k);
    ctx2.stroke();
    ctx2.save();
    ctx2.translate(x + 32 * k, baseY - 34 * k);
    ctx2.scale(3.5 * k, 5 * k);
    ctx2.beginPath();
    ctx2.arc(0, 0, 1, 0, Math.PI * 2);
    ctx2.restore();
    ctx2.stroke();
  }
  function town(ctx2, W, base, color, lit, seed) {
    const r = seeded(seed);
    const windows = [];
    ctx2.fillStyle = color;
    let x = -10;
    let church = false;
    while (x < W) {
      const w = 34 + r() * 30;
      const h = 26 + r() * 30;
      if (!church && x > W * 0.5) {
        church = true;
        const cw = 40;
        const ch = 54;
        ctx2.fillRect(x, base - ch, cw, ch);
        ctx2.beginPath();
        ctx2.moveTo(x - 3, base - ch);
        ctx2.lineTo(x + cw / 2, base - ch - 18);
        ctx2.lineTo(x + cw + 3, base - ch);
        ctx2.fill();
        ctx2.fillRect(x + cw / 2 - 8, base - ch - 40, 16, 30);
        ctx2.beginPath();
        ctx2.moveTo(x + cw / 2 - 10, base - ch - 40);
        ctx2.lineTo(x + cw / 2, base - ch - 82);
        ctx2.lineTo(x + cw / 2 + 10, base - ch - 40);
        ctx2.fill();
        ctx2.fillRect(x + cw / 2 - 0.8, base - ch - 94, 1.6, 14);
        ctx2.fillRect(x + cw / 2 - 5, base - ch - 89, 10, 1.6);
        windows.push([x + cw / 2 - 3, base - ch - 32, 6, 9]);
        x += cw + 4;
        continue;
      }
      ctx2.fillRect(x, base - h, w, h);
      ctx2.beginPath();
      ctx2.moveTo(x - 4, base - h);
      ctx2.lineTo(x + w / 2, base - h - 16 - r() * 10);
      ctx2.lineTo(x + w + 4, base - h);
      ctx2.fill();
      if (r() > 0.4) ctx2.fillRect(x + w * 0.7, base - h - 20, 6, 14);
      if (r() > 0.35) windows.push([x + w * (0.2 + r() * 0.45), base - h + 8 + r() * (h - 18), 5, 7]);
      x += w + 2 + r() * 6;
    }
    if (!lit) return;
    for (const [lx, ly, lw, lh] of windows) {
      glow(ctx2, lx + lw / 2, ly + lh / 2, 14, alpha(lit, 0.35));
      ctx2.fillStyle = lit;
      ctx2.fillRect(lx, ly, lw, lh);
    }
  }
  function fog(ctx2, W, y, color, strength, count, radius) {
    for (let i = 0; i < count; i++) {
      const fx = W * i / Math.max(1, count - 1);
      const g = ctx2.createRadialGradient(fx, y, 0, fx, y, radius);
      g.addColorStop(0, alpha(color, strength));
      g.addColorStop(1, alpha(color, 0));
      ctx2.fillStyle = g;
      ctx2.fillRect(fx - radius, y - radius, radius * 2, radius * 2);
    }
  }
  function homeScene(ctx2, W, H) {
    sky(ctx2, W, H, [[0, C.skyTop], [0.55, C.skyMid], [1, C.skyBottom]]);
    stars(ctx2, W, H, 110, 1692, 0.6);
    star4(ctx2, W * 0.19, H * 0.12, 6, alpha(INK.white, 0.9));
    star4(ctx2, W * 0.84, H * 0.42, 4, alpha(INK.white, 0.7));
    moon(ctx2, W * 0.82, H * 0.2, W * 0.1, C.moon, alpha(C.moon, 0.22), alpha(INK.straw, 0.35));
    hills(ctx2, W, H, H * 0.62, INK.townFar);
    gallows(ctx2, 40, H * 0.56, 1, INK.inkSoft);
    fog(ctx2, W, H * 0.66, INK.lilac, 0.12, 4, 90);
    const base = H * 0.74;
    town(ctx2, W, base, INK.townNear, C.gold, 7);
    ctx2.fillStyle = INK.ground;
    ctx2.fillRect(0, base, W, H - base);
    fog(ctx2, W, base + 4, INK.lilac, 0.16, 5, 110);
  }
  function tableScene(ctx2, W, H) {
    sky(ctx2, W, H, [[0, C.skyTop], [0.55, C.skyMid], [1, C.skyBottom]]);
    stars(ctx2, W, H, 50, 1692, 0.5);
    const m = tableMoon(W, H);
    glow(ctx2, m.x, m.y, m.r * 3, alpha(C.moon, 0.15));
    circle(ctx2, m.x, m.y, m.r, alpha(C.moon, 0.85));
    circle(ctx2, m.x + 9, m.y - 7, m.r * 0.9, C.skyTop);
    ctx2.globalAlpha = 0.55;
    town(ctx2, W, H, INK.townNear, null, 7);
    ctx2.globalAlpha = 1;
  }
  function villageScene(ctx2, W, H) {
    sky(ctx2, W, H, [[0, INK.dawnTop], [0.5, INK.dawnMid], [0.75, INK.dawnLow], [1, INK.dawnLow]]);
    stars(ctx2, W, H, 20, 1693, 0.25);
    const base = H * 0.78;
    glow(ctx2, W * 0.5, base, W * 0.7, alpha(INK.sun, 0.45));
    circle(ctx2, W * 0.5, base, W * 0.16, INK.sun);
    hills(ctx2, W, H, H * 0.7, alpha(INK.townFar, 0.8));
    town(ctx2, W, base, INK.townNear, C.gold, 7);
    ctx2.fillStyle = INK.ground;
    ctx2.fillRect(0, base, W, H - base);
    fog(ctx2, W, base + 10, INK.dawnLow, 0.12, 5, 90);
  }
  function witchScene(ctx2, W, H) {
    sky(ctx2, W, H, [[0, INK.bloodTop], [0.55, INK.bloodMid], [1, INK.ink]]);
    stars(ctx2, W, H, 60, 1694, 0.5);
    moon(ctx2, W * 0.82, H * 0.14, W * 0.1, INK.bloodMoon, alpha(C.danger, 0.45), alpha(INK.wineDark, 0.5));
    hills(ctx2, W, H, H * 0.64, INK.bloodTop);
    gallows(ctx2, W * 0.12, H * 0.6, 1.6, INK.ink);
    const base = H * 0.76;
    town(ctx2, W, base, INK.ink, C.danger, 9);
    ctx2.fillStyle = INK.ink;
    ctx2.fillRect(0, base, W, H - base);
    fog(ctx2, W, base + 4, C.danger, 0.12, 5, 110);
  }
  function paintBackdrop(ctx2, W, H, which) {
    switch (which) {
      case "home":
        homeScene(ctx2, W, H);
        return;
      case "lobby":
        homeScene(ctx2, W, H);
        ctx2.fillStyle = alpha(INK.ink, 0.45);
        ctx2.fillRect(0, 0, W, H);
        return;
      case "table":
        tableScene(ctx2, W, H);
        return;
      case "village":
        villageScene(ctx2, W, H);
        return;
      case "witch":
        witchScene(ctx2, W, H);
        return;
    }
  }

  // src/theme/draw.ts
  function roundRect(ctx2, r, radius) {
    const rr2 = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
    ctx2.beginPath();
    ctx2.moveTo(r.x + rr2, r.y);
    ctx2.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr2);
    ctx2.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr2);
    ctx2.arcTo(r.x, r.y + r.h, r.x, r.y, rr2);
    ctx2.arcTo(r.x, r.y, r.x + r.w, r.y, rr2);
    ctx2.closePath();
  }
  function drawText(ctx2, text, x, y, o = {}) {
    var _a, _b, _c, _d, _e;
    ctx2.font = o.serif ? titleFont((_a = o.size) != null ? _a : 14) : font((_b = o.size) != null ? _b : 14, o.bold);
    ctx2.fillStyle = (_c = o.color) != null ? _c : C.text;
    ctx2.textAlign = (_d = o.align) != null ? _d : "left";
    ctx2.textBaseline = (_e = o.baseline) != null ? _e : "middle";
    const t = o.maxWidth ? ellipsize(text, o.maxWidth, (s) => ctx2.measureText(s).width) : text;
    ctx2.fillText(t, x, y);
  }
  function drawSky(ctx2, W, H, darkness, backdrop = "table") {
    blit(ctx2, `sky:${backdrop}`, W, H, (c, w, h) => paintBackdrop(c, w, h, backdrop), 0, 0);
    if (darkness <= 0) return;
    ctx2.fillStyle = nightShade(0.55 * darkness);
    ctx2.fillRect(0, 0, W, H);
    if (backdrop === "table") {
      const m = tableMoon(W, H);
      glow(ctx2, m.x, m.y, m.r * 4, alpha(C.moon, 0.3 * darkness));
    }
  }
  function diamond(ctx2, x, y, r, color) {
    ctx2.fillStyle = color;
    ctx2.beginPath();
    ctx2.moveTo(x, y - r);
    ctx2.lineTo(x + r, y);
    ctx2.lineTo(x, y + r);
    ctx2.lineTo(x - r, y);
    ctx2.closePath();
    ctx2.fill();
  }
  function drawPanel(ctx2, r, o = {}) {
    var _a, _b, _c;
    const big = o.tier === "big";
    const radius = (_a = o.radius) != null ? _a : 8;
    roundRect(ctx2, r, radius);
    if (o.glow) {
      ctx2.shadowColor = goldGlow(o.glow);
      ctx2.shadowBlur = 12;
    }
    if (o.fill !== void 0) ctx2.fillStyle = o.fill;
    else {
      const g = ctx2.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, big ? C.panelBigTop : C.panelTop);
      g.addColorStop(1, big ? C.panelBigBottom : C.panelBottom);
      ctx2.fillStyle = g;
    }
    ctx2.fill();
    ctx2.shadowBlur = 0;
    if (o.tint !== void 0) {
      ctx2.fillStyle = o.tint;
      ctx2.fill();
    }
    ctx2.lineWidth = (_b = o.lineWidth) != null ? _b : big ? 1.5 : 1;
    ctx2.strokeStyle = (_c = o.stroke) != null ? _c : big ? C.goldLine : C.goldDark;
    ctx2.stroke();
    if (!big) return;
    roundRect(ctx2, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(2, radius - 3));
    ctx2.lineWidth = 1;
    ctx2.strokeStyle = alpha(C.gold, 0.28);
    ctx2.stroke();
    if (r.w >= 120) diamond(ctx2, r.x + r.w / 2, r.y + 0.5, 4, C.gold);
  }
  function drawButton(ctx2, r, label, kind) {
    const radius = 9;
    roundRect(ctx2, r, radius);
    if (kind === "primary") {
      const g = ctx2.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, C.buttonTop);
      g.addColorStop(1, C.buttonBottom);
      ctx2.fillStyle = g;
    } else ctx2.fillStyle = kind === "danger" ? C.buttonDangerFill : C.buttonFill;
    ctx2.fill();
    ctx2.lineWidth = kind === "primary" ? 1.5 : 1.2;
    ctx2.strokeStyle = kind === "disabled" ? C.greyLine : kind === "danger" ? C.danger : C.gold;
    ctx2.stroke();
    if (kind === "primary" || kind === "secondary") {
      roundRect(ctx2, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, radius - 2);
      ctx2.lineWidth = 1;
      ctx2.strokeStyle = alpha(C.gold, kind === "primary" ? 0.35 : 0.25);
      ctx2.stroke();
    }
    const color = kind === "disabled" ? C.textMuted : kind === "danger" ? C.dangerText : C.gold;
    drawText(ctx2, label, r.x + r.w / 2, r.y + r.h / 2, { size: 15, serif: true, color, align: "center", maxWidth: r.w - 8 });
  }
  function drawBadge(ctx2, cx, cy, radius, name, seat, character = null) {
    var _a;
    if (character) {
      const size = radius * 2;
      blit(ctx2, `portrait:${character}:${(seat % 12 + 12) % 12}`, size, size, (c, w) => portrait(c, w, character, badgeColor(seat)), cx - radius, cy - radius);
      return;
    }
    ctx2.beginPath();
    ctx2.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx2.fillStyle = badgeColor(seat);
    ctx2.fill();
    ctx2.lineWidth = 1.5;
    ctx2.strokeStyle = C.badgeRing;
    ctx2.stroke();
    drawText(ctx2, (_a = [...name][0]) != null ? _a : "?", cx, cy + 1, { size: Math.round(radius * 1.05), bold: true, color: C.badgeText, align: "center" });
  }
  var cardRadius = (r) => Math.max(3, r.w * 0.07);
  function drawCardFace(ctx2, r, kind, o = {}) {
    if (o.dim) ctx2.globalAlpha = 0.55;
    if (o.selected) {
      roundRect(ctx2, r, cardRadius(r));
      ctx2.shadowColor = C.glowStrong;
      ctx2.shadowBlur = 14;
      ctx2.fillStyle = C.goldLine;
      ctx2.fill();
      ctx2.shadowBlur = 0;
    }
    blit(ctx2, `card:${kind}`, r.w, r.h, (c, w, h) => cardFace(c, w, h, kind), r.x, r.y);
    if (o.selected) {
      roundRect(ctx2, r, cardRadius(r));
      ctx2.lineWidth = 2;
      ctx2.strokeStyle = C.gold;
      ctx2.stroke();
    }
    ctx2.globalAlpha = 1;
  }
  function drawCardBack(ctx2, r) {
    blit(ctx2, "back", r.w, r.h, cardBack, r.x, r.y);
  }
  function drawCharCard(ctx2, r, id) {
    blit(ctx2, `char:${id}`, r.w, r.h, (c, w, h) => charCard(c, w, h, id), r.x, r.y);
  }
  var SMALL_CHIP = 16;
  function drawTryalChip(ctx2, r, kind, revealed, scaleX = 1) {
    const w = r.w * Math.max(0.05, scaleX);
    const x = r.x + (r.w - w) / 2;
    if (r.w >= SMALL_CHIP) {
      if (revealed && kind) blit(ctx2, `tryal:${kind}`, r.w, r.h, (c, cw, ch) => tryalFace(c, cw, ch, kind), x, r.y, w, r.h);
      else blit(ctx2, "back", r.w, r.h, cardBack, x, r.y, w, r.h);
      return;
    }
    const fill = !revealed || !kind ? C.tryalHidden : kind === "witch" ? C.witch : kind === "constable" ? C.constable : C.villager;
    roundRect(ctx2, { x, y: r.y, w, h: r.h }, 2);
    ctx2.fillStyle = fill;
    ctx2.fill();
    ctx2.lineWidth = 1;
    ctx2.strokeStyle = revealed ? C.chipRevealedLine : C.goldDark;
    ctx2.stroke();
    if (!revealed || !kind) {
      ctx2.beginPath();
      ctx2.arc(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.8, w * 0.15), 0, Math.PI * 2);
      ctx2.fillStyle = C.goldDark;
      ctx2.fill();
      return;
    }
    if (scaleX > 0.6) {
      drawText(ctx2, TRYAL_SHORT[kind], r.x + r.w / 2, r.y + r.h / 2 + 0.5, { size: Math.max(8, r.h - 4), color: C.badgeText, align: "center" });
    }
  }
  function drawIconRef(ctx2, ref, x, y, h) {
    if ("card" in ref) {
      const w = Math.round(h * 0.72);
      drawCardFace(ctx2, { x, y, w, h }, ref.card);
      return w;
    }
    drawBadge(ctx2, x + h / 2, y + h / 2, h / 2, "", 0, ref.char);
    return h;
  }
  function drawPressShade(ctx2, r) {
    roundRect(ctx2, r, 8);
    ctx2.fillStyle = C.pressShade;
    ctx2.fill();
  }

  // src/model/changes.ts
  var ANIM_MS = {
    cardIn: 450,
    cardStagger: 80,
    othersDraw: 400,
    play: 600,
    hit: 250,
    trial: 600,
    death: 500,
    reveal: 500,
    burst: 350,
    night: 900,
    turn: 1800,
    panel: 250,
    scene: 250,
    resultTitle: 400,
    resultRowStart: 250,
    resultRowStagger: 80,
    resultRow: 300,
    endHold: 1500
  };
  var MAX_VERSION_STEP = 1 + 2 * 12;
  var dayTurn = (m) => m.view.phase.kind === "day" ? m.turnSeat : null;
  function diffTables(prev, next) {
    var _a, _b, _c;
    if (!prev || prev.code !== next.code || prev.view.log.length > next.view.log.length) return [];
    if (next.view.version - prev.view.version > MAX_VERSION_STEP) return [];
    const out = [];
    if (prev.priv) {
      const before = new Set(prev.priv.hand.map((c) => c.id));
      for (const c of (_b = (_a = next.priv) == null ? void 0 : _a.hand) != null ? _b : []) if (!before.has(c.id)) out.push({ kind: "cardIn", id: c.id });
    }
    const fresh = next.view.log.slice(prev.view.log.length);
    fresh.forEach((e, k) => {
      if (e.t === "play") out.push({ kind: "play", index: prev.view.log.length + k, from: e.seat, to: e.targets[e.targets.length - 1], card: e.kind });
      if (e.t === "trial") out.push({ kind: "trial", seat: e.target });
    });
    const wasNight = prev.view.phase.kind === "night";
    const isNight = next.view.phase.kind === "night";
    if (wasNight !== isNight) out.push({ kind: "night", on: isNight });
    next.view.players.forEach((p, i) => {
      const q = prev.view.players[i];
      if (!q) return;
      if (q.alive && !p.alive) {
        const used = /* @__PURE__ */ new Set();
        for (const e of fresh) {
          if (e.t !== "reveal" || e.seat !== i || e.cause === "death") continue;
          const j = p.tryals.findIndex((t, k) => !used.has(k) && t.revealed && q.tryals[k] && !q.tryals[k].revealed && t.kind === e.kind);
          if (j < 0) continue;
          used.add(j);
          out.push({ kind: "reveal", seat: i, index: j, witch: e.kind === "witch" });
        }
        out.push({ kind: "death", seat: i });
      }
      if (i !== next.mySeat && p.handCount > q.handCount) out.push({ kind: "draw", seat: i, count: p.handCount - q.handCount });
      if (!p.alive) return;
      p.tryals.forEach((t, j) => {
        if (t.revealed && q.tryals[j] && !q.tryals[j].revealed) out.push({ kind: "reveal", seat: i, index: j, witch: t.kind === "witch" });
      });
    });
    const turn = dayTurn(next);
    if (turn !== null && turn !== dayTurn(prev)) out.push({ kind: "turn", seat: turn });
    if (next.pending && next.pending.kind !== "turn" && ((_c = prev.pending) == null ? void 0 : _c.kind) !== next.pending.kind) out.push({ kind: "panel" });
    return out;
  }

  // src/model/rules.ts
  var plain = (texts) => texts.map((text) => ({ text }));
  var cardsOf = (color) => Object.keys(CARD_INFO).filter((k) => CARD_INFO[k].color === color).map((k) => ({ text: `${CARD_INFO[k].name}\uFF1A${CARD_INFO[k].desc}`, icon: { card: k } }));
  var RULES = [
    {
      title: "\u80DC\u8D1F",
      items: plain(["\u5973\u5DEB\u9635\u8425\u7684\u4EBA\u5168\u90E8\u51FA\u5C40\uFF08\u5305\u62EC\u4F20\u67D3\u65F6\u4EA4\u51FA\u5973\u5DEB\u5361\u7684\u539F\u5973\u5DEB\uFF09\uFF1A\u6751\u6C11\u80DC\u5229\u3002", "\u6D3B\u7740\u7684\u73A9\u5BB6\u5168\u90FD\u662F\u5973\u5DEB\u9635\u8425\uFF1A\u5973\u5DEB\u80DC\u5229\u3002"])
    },
    {
      title: "\u8EAB\u4EFD\u5361",
      items: plain([
        "\u6BCF\u4EBA 5 \u5F20\uFF0C\u53EA\u6709\u81EA\u5DF1\u77E5\u9053\u5185\u5BB9\u30024\u20135 \u4EBA 1 \u5F20\u5973\u5DEB\u5361\uFF0C6 \u4EBA\u4EE5\u4E0A 2 \u5F20\uFF1B\u8B66\u957F 1 \u5F20\uFF0C\u5176\u4F59\u662F\u6751\u6C11\u3002",
        "\u7FFB\u51FA\u5973\u5DEB\u5361\uFF0C\u6216 5 \u5F20\u5168\u90E8\u7FFB\u5F00\uFF0C\u7ACB\u5373\u6B7B\u4EA1\u3002",
        "\u5F00\u5C40\u6301\u6709\u5973\u5DEB\u5361\u7684\u4EBA\u5C5E\u4E8E\u5973\u5DEB\u9635\u8425\uFF1B\u4E4B\u540E\u901A\u8FC7\u4F20\u67D3\u62FF\u5230\u5973\u5DEB\u5361\u7684\u4EBA\u4E5F\u52A0\u5165\u5973\u5DEB\u9635\u8425\uFF0C\u9635\u8425\u4E0D\u4F1A\u518D\u53D8\uFF08\u4EA4\u51FA\u5973\u5DEB\u5361\u7684\u4EBA\u4ECD\u662F\u5973\u5DEB\uFF09\u3002\u5973\u5DEB\u9635\u8425\u7684\u4EBA\u80FD\u770B\u5230\u5F7C\u6B64\u3002"
      ])
    },
    {
      title: "\u56DE\u5408",
      items: plain(["\u8F6E\u5230\u4F60\u65F6\u4E8C\u9009\u4E00\uFF1A\u62BD 2 \u5F20\u724C\uFF0C\u6216\u6253\u51FA\u4EFB\u610F\u5F20\u7EA2 / \u84DD / \u7EFF\u5361\u3002", "\u7EA2\u5361\u4E0D\u80FD\u6253\u7ED9\u81EA\u5DF1\uFF0C\u84DD\u5361\u548C\u7EFF\u5361\u53EF\u4EE5\u3002"])
    },
    {
      title: "\u5BA1\u5224",
      items: plain([
        "\u9762\u524D\u7EA2\u5361\u70B9\u6570\u8FBE\u5230 7 \u70B9\u7ACB\u5373\u53D7\u5BA1\uFF0C\u7531\u53D7\u5BA1\u8005\u81EA\u5DF1\u7FFB\u5F00\u4E00\u5F20\u8EAB\u4EFD\u5361\u3002",
        "\u5BA1\u5224\u7ED3\u675F\u540E\uFF0C\u4E22\u5F03\u53D7\u5BA1\u8005\u9762\u524D\u6240\u6709\u7EA2\u5361\u3002"
      ])
    },
    {
      title: "\u591C\u665A",
      items: plain([
        "\u5973\u5DEB\u9635\u8425\u4E00\u8D77\u9009\u4E00\u540D\u73A9\u5BB6\u51FB\u6740\uFF1B\u8B66\u957F\u4FDD\u62A4\u4E00\u540D\u5176\u4ED6\u73A9\u5BB6\uFF1B\u6240\u6709\u4EBA\u90FD\u53EF\u4EE5\u81EA\u9996\uFF08\u7FFB\u5F00\u4E00\u5F20\u81EA\u5DF1\u7684\u8EAB\u4EFD\u5361\uFF09\uFF0C\u81EA\u9996\u7684\u4EBA\u5F53\u665A\u4E0D\u4F1A\u88AB\u6740\u3002",
        "\u88AB\u9009\u4E2D\u7684\u4EBA\u6CA1\u6709\u88AB\u4FDD\u62A4\u3001\u6CA1\u6709\u907F\u96BE\u3001\u4E5F\u6CA1\u6709\u81EA\u9996\u65F6\u6B7B\u4EA1\u3002",
        "\u591C\u665A\u8FC7\u540E\u5168\u90E8\u91CD\u7F6E\uFF1A\u6240\u6709\u624B\u724C\u548C\u9762\u524D\u7684\u724C\uFF08\u5305\u62EC\u9ED1\u732B\uFF09\u6536\u56DE\u91CD\u6D17\uFF0C\u6BCF\u4E2A\u6D3B\u4EBA\u91CD\u65B0\u53D1 3 \u5F20\uFF1B\u8EAB\u4EFD\u5361\u4E0D\u53D8\u3002\u62BD\u5230\u591C\u665A\u7684\u4EBA\u56DE\u5408\u7ED3\u675F\u3002",
        "\u56DE\u5408\u5916\u6478\u5230\u591C\u665A\uFF08\u4F8B\u5982\u5BA1\u5224\u4E2D\uFF09\u65F6\uFF0C\u5148\u628A\u5BA1\u5224\u8D70\u5B8C\u518D\u8FDB\u5165\u591C\u665A\u3002"
      ])
    },
    {
      title: "\u4F20\u67D3",
      items: plain(["\u9ED1\u732B\u6301\u6709\u8005\u5148\u7FFB\u5F00\u4E00\u5F20\u8EAB\u4EFD\u5361\uFF1B\u7136\u540E\u6BCF\u4E2A\u6D3B\u7740\u7684\u4EBA\u4ECE\u5DE6\u8FB9\u73A9\u5BB6\u7684\u672A\u7FFB\u5F00\u8EAB\u4EFD\u5361\u91CC\u76F2\u62BD\u4E00\u5F20\u3002"])
    },
    { title: "\u7EA2\u5361", items: cardsOf("red") },
    { title: "\u84DD\u5361\uFF08\u7559\u5728\u9762\u524D\u6301\u7EED\u751F\u6548\uFF09", items: cardsOf("blue") },
    { title: "\u7EFF\u5361\uFF08\u4E00\u6B21\u6027\uFF09", items: cardsOf("green") },
    { title: "\u9ED1\u5361\uFF08\u62BD\u5230\u7ACB\u5373\u7ED3\u7B97\uFF09", items: cardsOf("black") },
    {
      title: "\u89D2\u8272\uFF08\u516C\u5F00\uFF09",
      items: [
        { text: "\u5C11\u4E8E 7 \u4EBA\u65F6\u6BCF\u4EBA\u4ECE 2 \u4E2A\u968F\u673A\u89D2\u8272\u4E2D\u9009 1 \u4E2A\uFF1B7 \u4EBA\u53CA\u4EE5\u4E0A\u76F4\u63A5\u968F\u673A\u53D1\u3002\u89D2\u8272\u5BF9\u6240\u6709\u4EBA\u516C\u5F00\u3002" },
        ...Object.keys(CHAR_INFO).map((id) => ({ text: `${CHAR_INFO[id].name}\uFF1A${CHAR_INFO[id].desc}`, icon: { char: id } }))
      ]
    }
  ];

  // src/scenes/widgets.ts
  function button(id, r, label, onTap, style = "primary") {
    return {
      id,
      rect: r,
      onTap: onTap != null ? onTap : void 0,
      draw: (ctx2) => drawButton(ctx2, r, label, onTap ? style : "disabled")
    };
  }
  var BUSY_LABEL = "\u5904\u7406\u4E2D";
  function requestButton(id, r, label, onTap, busy, style = "primary") {
    return busy ? button(id, r, BUSY_LABEL, null, style) : button(id, r, label, onTap, style);
  }
  function textNode(r, text, o = {}) {
    var _a;
    const align = (_a = o.align) != null ? _a : "left";
    const x = align === "center" ? r.x + r.w / 2 : align === "right" ? r.x + r.w : r.x;
    return { rect: r, draw: (ctx2) => drawText(ctx2, text, x, r.y + r.h / 2, __spreadValues({ maxWidth: r.w }, o)) };
  }
  function skyNode(screen2, darkness, backdrop = "table") {
    return { rect: rect(0, 0, screen2.W, screen2.H), draw: (ctx2) => drawSky(ctx2, screen2.W, screen2.H, darkness, backdrop) };
  }
  function overlay(screen2, onTap, alpha2 = 1) {
    return {
      id: "overlay",
      noPress: true,
      rect: rect(0, 0, screen2.W, screen2.H),
      onTap: onTap != null ? onTap : (() => {
      }),
      draw: (ctx2) => {
        ctx2.globalAlpha = alpha2;
        ctx2.fillStyle = C.overlay;
        ctx2.fillRect(0, 0, screen2.W, screen2.H);
      }
    };
  }
  function sheet(screen2, height, title, onClose, slide = 1, subtitle) {
    const h = Math.min(height, screen2.H - screen2.top);
    const y = screen2.H - h * slide;
    const panel = rect(0, y, screen2.W, h + 16);
    const nodes = [
      overlay(screen2, onClose != null ? onClose : void 0, slide),
      {
        id: "sheet",
        noPress: true,
        rect: panel,
        onTap: () => {
        },
        draw: (ctx2) => {
          drawPanel(ctx2, panel, { tier: "big", radius: 16 });
          drawText(ctx2, title, 20, y + 26, { size: 17, serif: true, color: C.gold, maxWidth: screen2.W - 120 });
          if (subtitle) drawText(ctx2, subtitle, 20, y + 50, { size: 12, color: C.textDim, maxWidth: screen2.W - 40 });
        }
      }
    ];
    if (onClose) nodes.push(button("sheet-close", rect(screen2.W - 76, y + 10, 60, 32), "\u5173\u95ED", onClose, "secondary"));
    const bodyTop = y + (subtitle ? 66 : 50);
    return { nodes, body: rect(16, bodyTop, screen2.W - 32, screen2.bottom - bodyTop - 12) };
  }
  function clampScroll(offset, contentH, viewH) {
    const min = Math.min(0, viewH - contentH);
    return Math.max(min, Math.min(0, offset));
  }
  var ScrollBox = class {
    constructor() {
      __publicField(this, "offset", 0);
      __publicField(this, "contentH", 0);
    }
    reset() {
      this.offset = 0;
    }
    node(id, r, lines) {
      return {
        id,
        rect: r,
        clip: true,
        onScroll: (dy) => {
          this.offset = clampScroll(this.offset + dy, this.contentH, r.h);
        },
        draw: (ctx2) => {
          var _a, _b;
          const start = r.y + 4;
          let y = start + this.offset;
          for (const l of lines) {
            const size = (_a = l.size) != null ? _a : 13;
            const iconH = l.icon ? size + 6 : 0;
            const indent = l.icon ? drawIconRef(ctx2, l.icon, r.x + 4, y - 2, iconH) + 6 : 0;
            ctx2.font = l.serif ? titleFont(size) : font(size, l.bold);
            const top = y;
            for (const t of wrapText(l.text, r.w - 8 - indent, (s) => ctx2.measureText(s).width)) {
              drawText(ctx2, t, r.x + 4 + indent, y + size / 2, { size, color: l.color, bold: l.bold, serif: l.serif });
              y += size + 6;
            }
            y = Math.max(y, top + iconH + 2);
            y += (_b = l.gap) != null ? _b : 0;
          }
          this.contentH = y - this.offset - start;
        }
      };
    }
  };

  // src/scenes/home.ts
  var RULE_LINES = RULES.flatMap((s) => [
    { text: s.title, size: 15, serif: true, color: C.gold, gap: 2 },
    ...s.items.map((it, i) => ({ text: it.icon ? it.text : `\xB7 ${it.text}`, icon: it.icon, size: 13, gap: i === s.items.length - 1 ? 10 : 2 }))
  ]);
  var HomeScene = class {
    constructor(ui2) {
      __publicField(this, "ui", ui2);
      __publicField(this, "rules", false);
      __publicField(this, "box", new ScrollBox());
    }
    build(_now) {
      var _a;
      const { W, H, top } = this.ui.screen;
      const ctl2 = this.ui.ctl;
      const busy = ctl2.busy;
      const nodes = [skyNode(this.ui.screen, 0, "home")];
      const titleY = top + H * 0.14;
      nodes.push({
        rect: rect(0, titleY - 30, W, 100),
        draw: (ctx2) => {
          drawText(ctx2, "\u5973\u5DEB\u9547", W / 2, titleY, { size: 46, serif: true, color: C.gold, align: "center" });
          drawText(ctx2, "Salem 1692 \xB7 \u670B\u53CB\u5C40", W / 2, titleY + 44, { size: 14, color: C.textDim, align: "center" });
        }
      });
      const nick = (_a = ctl2.nickname) != null ? _a : "\uFF08\u672A\u8BBE\u7F6E\uFF09";
      nodes.push({
        id: "nickname",
        rect: rect(W - 200, top, 188, 28),
        onTap: () => this.ui.prompt("\u4FEE\u6539\u6635\u79F0", "1\u201312 \u4E2A\u5B57", (name) => ctl2.setNickname(name)),
        draw: (ctx2) => drawText(ctx2, `\u6635\u79F0\uFF1A${nick} \u270E`, W - 12, top + 14, { size: 13, color: C.textDim, align: "right", maxWidth: 188 })
      });
      const bw = Math.min(280, W - 64);
      const bx = (W - bw) / 2;
      const y = H * 0.5;
      nodes.push(
        requestButton("join", rect(bx, y, bw, 54), "\u8F93\u5165\u623F\u53F7\u52A0\u5165", () => this.ui.prompt("\u8F93\u5165\u623F\u95F4\u53F7", "4 \u4F4D\u6570\u5B57", (code) => void ctl2.joinRoom(code)), busy),
        requestButton("create", rect(bx, y + 70, bw, 48), "\u521B\u5EFA\u623F\u95F4", () => void ctl2.createRoom(), busy, "secondary"),
        button("rules", rect(bx, y + 132, bw, 48), "\u89C4\u5219\u901F\u67E5", () => {
          this.rules = true;
          this.box.reset();
        }, "secondary")
      );
      if (this.rules) {
        const { nodes: panel, body } = sheet(this.ui.screen, this.ui.screen.H - top, "\u89C4\u5219\u901F\u67E5", () => this.rules = false);
        nodes.push(...panel, this.box.node("rules-list", body, RULE_LINES));
      }
      return nodes;
    }
  };

  // src/scenes/lobby.ts
  var MAX = 12;
  var MIN = 4;
  var LobbyScene = class {
    constructor(ui2) {
      __publicField(this, "ui", ui2);
    }
    build(_now) {
      const { W, top, bottom } = this.ui.screen;
      const ctl2 = this.ui.ctl;
      const room = ctl2.room;
      if (!room) return [];
      const isHost = room.host === ctl2.openid;
      const busy = ctl2.busy;
      const seats = room.seats;
      const nodes = [skyNode(this.ui.screen, 0, "lobby")];
      nodes.push({
        rect: rect(0, top, W, 90),
        draw: (ctx2) => {
          drawText(ctx2, "\u623F\u95F4\u53F7", W / 2, top + 12, { size: 13, color: C.textDim, align: "center" });
          drawText(ctx2, room.code, W / 2, top + 54, { size: 46, serif: true, color: C.gold, align: "center" });
        }
      });
      const half = (W - 24 - 10) / 2;
      nodes.push(
        button("copy", rect(12, top + 92, half, 38), "\u590D\u5236\u623F\u53F7", () => this.ui.copy(room.code), "secondary"),
        button("invite", rect(12 + half + 10, top + 92, half, 38), "\u9080\u8BF7\u670B\u53CB", () => {
          var _a;
          return this.ui.share(`${(_a = ctl2.nickname) != null ? _a : "\u670B\u53CB"} \u9080\u8BF7\u4F60\u6765\u5973\u5DEB\u9547 \xB7 \u623F\u95F4 ${room.code}`, `room=${room.code}`);
        }, "secondary"),
        textNode(rect(12, top + 136, W - 24, 20), "\u628A\u623F\u53F7\u53D1\u5230\u7FA4\u91CC\uFF0C\u670B\u53CB\u5728\u9996\u9875\u8F93\u5165\u5C31\u80FD\u52A0\u5165", { size: 12, color: C.textDim, align: "center" })
      );
      const startY = bottom - 12 - 48;
      const rowY = startY - 8 - 40;
      const listTop = top + 164;
      const rowH = Math.min(46, (rowY - 8 - listTop) / Math.max(seats.length, 1));
      seats.forEach((s, i) => {
        const r = rect(12, listTop + i * rowH, W - 24, rowH - 4);
        const tags = [
          s.openid === room.host ? "\u623F\u4E3B" : "",
          s.openid.startsWith("bot-") ? "\u673A\u5668\u4EBA" : "",
          s.openid === ctl2.openid ? "\u6211" : ""
        ].filter(Boolean);
        nodes.push({
          rect: r,
          draw: (ctx2) => {
            drawPanel(ctx2, r, { radius: 8 });
            drawBadge(ctx2, r.x + 20, r.y + r.h / 2, Math.min(14, r.h / 2 - 3), s.name, i);
            drawText(ctx2, `${i + 1}. ${s.name}`, r.x + 42, r.y + r.h / 2, { size: 14, maxWidth: r.w - 170 });
            if (tags.length) drawText(ctx2, tags.join(" \xB7 "), r.x + r.w - (isHost ? 84 : 10), r.y + r.h / 2, { size: 11, color: C.gold, align: "right" });
          }
        });
        if (isHost) {
          const bh = r.h - 8;
          if (i > 0) nodes.push(button(`seat-up:${i}`, rect(r.x + r.w - 76, r.y + 4, 34, bh), "\u2191", busy ? null : () => void ctl2.moveSeat(i, -1), "secondary"));
          if (i < seats.length - 1) nodes.push(button(`seat-down:${i}`, rect(r.x + r.w - 38, r.y + 4, 34, bh), "\u2193", busy ? null : () => void ctl2.moveSeat(i, 1), "secondary"));
        }
      });
      const leave = () => this.ui.confirm("\u79BB\u5F00\u623F\u95F4\uFF1F", "\u79BB\u5F00\u540E\u53EF\u4EE5\u7528\u623F\u53F7\u91CD\u65B0\u52A0\u5165", () => void ctl2.leaveRoom());
      if (isHost) {
        nodes.push(
          requestButton("leave", rect(12, rowY, half, 40), "\u79BB\u5F00", leave, busy, "danger"),
          requestButton("add-bot", rect(12 + half + 10, rowY, half, 40), "\u52A0\u673A\u5668\u4EBA", seats.length >= MAX ? null : () => void ctl2.addBot(), busy, "secondary"),
          requestButton("start", rect(12, startY, W - 24, 48), `\u5F00\u59CB\u6E38\u620F\uFF08${seats.length}/${MAX}\uFF09`, seats.length < MIN ? null : () => void ctl2.startGame(), busy)
        );
      } else {
        nodes.push(
          requestButton("leave", rect(12, rowY, W - 24, 40), "\u79BB\u5F00", leave, busy, "danger"),
          textNode(rect(12, startY, W - 24, 48), `\u7B49\u5F85\u623F\u4E3B\u5F00\u59CB\u2026\uFF08${seats.length}/${MAX}\uFF09`, { size: 14, color: C.textDim, align: "center" })
        );
      }
      return nodes;
    }
  };

  // src/scenes/result.ts
  var ResultScene = class {
    constructor(ui2) {
      __publicField(this, "ui", ui2);
      __publicField(this, "shownFor", null);
    }
    build(now) {
      var _a;
      const { W, top, bottom } = this.ui.screen;
      const ctl2 = this.ui.ctl;
      const view = (_a = ctl2.room) == null ? void 0 : _a.view;
      if (!view || view.phase.kind !== "ended") return [];
      const A = this.ui.animator;
      const n = view.players.length;
      const total = ANIM_MS.resultRowStart + n * ANIM_MS.resultRowStagger + ANIM_MS.resultRow + 100;
      const key = `${ctl2.room.code}:${ctl2.room.gameId}`;
      if (key !== this.shownFor) {
        this.shownFor = key;
        A.start("result", now, total);
      }
      const t = A.running("result", now) ? A.linear("result", now) * total : Infinity;
      const phase = (start, dur) => easeOutCubic(Math.min(1, Math.max(0, (t - start) / dur)));
      const village = view.phase.winner === "village";
      const mySeat = ctl2.room.seats.findIndex((s) => s.openid === ctl2.openid);
      const nodes = [skyNode(this.ui.screen, 0, village ? "village" : "witch")];
      nodes.push({
        rect: rect(0, top, W, 90),
        draw: (ctx2) => {
          const pt = phase(0, ANIM_MS.resultTitle);
          const sc = 1 + 0.15 * (1 - pt);
          ctx2.globalAlpha = pt;
          ctx2.translate(W / 2, top + 30);
          ctx2.scale(sc, sc);
          ctx2.translate(-W / 2, -(top + 30));
          drawText(ctx2, village ? "\u6751\u6C11\u80DC\u5229" : "\u5973\u5DEB\u80DC\u5229", W / 2, top + 30, { size: 36, serif: true, color: village ? C.gold : C.moon, align: "center" });
          drawText(ctx2, village ? "\u5973\u5DEB\u9635\u8425\u5168\u90E8\u51FA\u5C40" : "\u6D3B\u7740\u7684\u4EBA\u5168\u90E8\u5C5E\u4E8E\u5973\u5DEB\u9635\u8425", W / 2, top + 68, { size: 13, color: C.textDim, align: "center" });
        }
      });
      const btnY = bottom - 12 - 48;
      const listTop = top + 100;
      const rowH = Math.min(52, (btnY - 10 - listTop) / Math.max(1, view.players.length));
      view.players.forEach((p, i) => {
        const r = rect(12, listTop + i * rowH, W - 24, rowH - 4);
        nodes.push({
          rect: r,
          draw: (ctx2) => {
            const pr = phase(ANIM_MS.resultRowStart + i * ANIM_MS.resultRowStagger, ANIM_MS.resultRow);
            ctx2.globalAlpha = pr;
            ctx2.translate(0, (1 - pr) * 24);
            drawPanel(ctx2, r, { stroke: p.witchFaction ? C.danger : void 0 });
            drawBadge(ctx2, r.x + 18, r.y + r.h / 2, Math.min(13, r.h / 2 - 3), p.name, p.seat, p.character);
            drawText(ctx2, `${p.name}${i === mySeat ? "\uFF08\u4F60\uFF09" : ""}`, r.x + 38, r.y + r.h / 2 - 7, { size: 13, maxWidth: r.w * 0.4 });
            drawText(ctx2, `${p.witchFaction ? "\u5973\u5DEB\u9635\u8425" : "\u6751\u6C11\u9635\u8425"} \xB7 ${p.alive ? "\u5B58\u6D3B" : "\u51FA\u5C40"}`, r.x + 38, r.y + r.h / 2 + 9, { size: 11, color: p.witchFaction ? C.dangerText : C.textDim });
            const cw = 12;
            const x0 = r.x + r.w - 10 - p.tryals.length * (cw + 3);
            p.tryals.forEach((t2, j) => drawTryalChip(ctx2, rect(x0 + j * (cw + 3), r.y + r.h / 2 - 8, cw, 16), t2.kind, true));
          }
        });
      });
      const home = button("result-home", rect(12, btnY, W - 24, 48), "\u56DE\u5230\u9996\u9875", () => ctl2.backHome());
      const pb = phase(ANIM_MS.resultRowStart + n * ANIM_MS.resultRowStagger, ANIM_MS.resultRow);
      nodes.push(__spreadProps(__spreadValues({}, home), {
        draw: (ctx2) => {
          ctx2.globalAlpha = pb;
          home.draw(ctx2);
        }
      }));
      return nodes;
    }
  };

  // src/model/actions.ts
  var ALIBI_CHOICES = [
    { value: "accusation", label: "\u4E22\u5F03\u6700\u591A 3 \u5F20\u6307\u63A7" },
    { value: "evidence", label: "\u4E22\u5F03 1 \u5F20\u8BC1\u636E" }
  ];
  var DOCTOR_CHOICE = { value: "witness", label: "\u5F53\u4F5C\u300C\u76EE\u51FB\u300D\u6253\u51FA\uFF087 \u70B9\uFF09" };
  function playableCardIds(m) {
    var _a;
    if (((_a = m.pending) == null ? void 0 : _a.kind) !== "turn" || !m.priv) return [];
    return m.priv.hand.filter((c) => !isBlack(c.kind)).map((c) => c.id);
  }
  function cardKindOf(m, id) {
    var _a, _b, _c;
    return (_c = (_b = (_a = m.priv) == null ? void 0 : _a.hand.find((c) => c.id === id)) == null ? void 0 : _b.kind) != null ? _c : null;
  }
  function targetOptions(m, kind, chosen) {
    const out = [];
    for (const p of m.view.players) {
      if (!p.alive || chosen.includes(p.seat)) continue;
      if (chosen.length === 0) {
        if (isRed(kind) && (p.seat === m.mySeat || p.blue.some((c) => c.kind === "piety"))) continue;
        if (kind === "matchmaker" && p.blue.some((c) => c.kind === "matchmaker")) continue;
        if (kind === "stocks" && p.green.some((c) => c.kind === "stocks")) continue;
        if (kind === "curse" && p.blue.length === 0) continue;
      }
      out.push(p.seat);
    }
    return out;
  }
  function optionNeed(m, kind, target) {
    var _a;
    const p = m.view.players[target];
    if (!p) return null;
    if (kind === "curse") return { kind: "curse", cards: p.blue };
    if (kind === "alibi") {
      const doctor2 = ((_a = m.me) == null ? void 0 : _a.ability) === "doctor" && target !== m.mySeat && !p.blue.some((c) => c.kind === "piety");
      const kinds = [];
      if (p.red.some((c) => c.kind === "accusation")) kinds.push("accusation");
      if (p.red.some((c) => c.kind === "evidence")) kinds.push("evidence");
      if (doctor2) return { kind: "alibi", doctor: true, kinds };
      return kinds.length === 2 ? { kind: "alibi", doctor: false, kinds } : null;
    }
    return null;
  }
  function nightSteps(p) {
    const steps = [];
    if (p.witch) steps.push("kill");
    if (p.constable) steps.push("protect");
    if (steps.length === 0) steps.push("suspect");
    return steps;
  }
  function nightTargets(m, step) {
    return m.view.players.filter((p) => p.alive && (step === "kill" || p.seat !== m.mySeat)).map((p) => p.seat);
  }
  function dawnTargets(m) {
    return m.view.players.filter((p) => p.alive && p.ability !== "maid").map((p) => p.seat);
  }
  function unrevealedTryals(m) {
    return m.priv ? m.priv.tryals.filter((t) => !t.revealed) : [];
  }

  // src/model/log.ts
  var REVEAL_CAUSE = { trial: "\u5BA1\u5224", cat: "\u9ED1\u732B", confess: "\u81EA\u9996", death: "\u6B7B\u4EA1" };
  var DEATH_CAUSE = {
    night: "\u591C\u91CC\u88AB\u5973\u5DEB\u6740\u6B7B",
    witchRevealed: "\u7FFB\u51FA\u4E86\u5973\u5DEB\u5361",
    allRevealed: "\u8EAB\u4EFD\u5361\u5168\u90E8\u7FFB\u5F00",
    lover: "\u60C5\u4FA3\u6B89\u60C5"
  };
  function abilityLine(e, name) {
    var _a;
    const who = `${name(e.seat)}\uFF08${CHAR_INFO[e.ability].name}\uFF09`;
    const card = e.kind ? CARD_INFO[e.kind].name : "";
    switch (e.ability) {
      case "doctor":
        return `${who} \u628A\u300C\u8FA9\u62A4\u300D\u5F53\u4F5C\u300C\u76EE\u51FB\u300D\u6253\u51FA`;
      case "beggar":
      case "maid":
        return `${who}\uFF1A\u300C${card}\u300D\u5BF9 TA \u65E0\u6548\uFF0C\u76F4\u63A5\u4E22\u5F03`;
      case "landlord":
        return `${who} \u62BD\u5230 2 \u5F20\u300C\u6307\u63A7\u300D\uFF0C\u5C55\u793A\u540E\u518D\u62BD\u4E00\u5F20`;
      case "priest":
        return `${who} \u4ECE\u5F03\u724C\u5806\u62FF\u4E86 ${(_a = e.count) != null ? _a : 0} \u5F20\u724C`;
      case "storyteller":
        return `${who} \u8C03\u6574\u4E86\u724C\u5806\u987A\u5E8F`;
      case "housewife":
        return `${who}\uFF1A\u6709\u4EBA\u7684\u8EAB\u4EFD\u5361\u88AB\u7FFB\u5F00\uFF0C\u62BD\u4E00\u5F20\u724C`;
      case "farmer":
        return `${who} \u83B7\u5F97\u4E86 ${e.from === void 0 ? "\u6B7B\u8005" : name(e.from)} \u7684\u624B\u724C\u548C\u84DD\u5361`;
      case "child":
        return `${who} \u4E22\u5F03\u4E86\u81EA\u5DF1\u9762\u524D\u7684\u300C\u6307\u63A7\u300D\u548C\u300C\u8BC1\u636E\u300D`;
      case "minister":
        return `${who}\uFF1A\u300C\u8BC1\u636E\u300D\u53EA\u7B97 1 \u70B9`;
      case "official":
        return `${who} \u81EA\u9996\uFF0C\u6CA1\u6709\u7FFB\u5F00\u8EAB\u4EFD\u5361`;
      case "maiden":
        return `${who} \u53D1\u8D77\u5BA1\u5224\uFF0C\u5BA1\u5224\u524D\u5148\u62BD 2 \u5F20\u724C`;
      default:
        return `${who} \u53D1\u52A8\u4E86\u6280\u80FD`;
    }
  }
  function describeEvent(e, name) {
    switch (e.t) {
      case "gameStart":
        return `\u6E38\u620F\u5F00\u59CB\uFF0C\u5171 ${e.players} \u4EBA`;
      case "catPlaced":
        return `\u5973\u5DEB\u628A\u9ED1\u732B\u653E\u5728\u4E86 ${name(e.target)} \u9762\u524D`;
      case "turn":
        return `\u8F6E\u5230 ${name(e.seat)}`;
      case "skipped":
        return `${name(e.seat)} \u88AB\u62D8\u7559\uFF0C\u8DF3\u8FC7\u8FD9\u4E00\u56DE\u5408`;
      case "draw":
        return `${name(e.seat)} \u62BD\u4E86 1 \u5F20\u724C`;
      case "blackDrawn":
        return `${name(e.seat)} \u62BD\u5230\u4E86\u300C${CARD_INFO[e.kind].name}\u300D`;
      case "play": {
        const card = CARD_INFO[e.kind].name;
        if (e.targets.length === 2) return `${name(e.seat)} \u6253\u51FA\u300C${card}\u300D\uFF1A${name(e.targets[0])} \u2192 ${name(e.targets[1])}`;
        if (e.targets[0] === e.seat) return `${name(e.seat)} \u7ED9\u81EA\u5DF1\u6253\u51FA\u300C${card}\u300D`;
        return `${name(e.seat)} \u5BF9 ${name(e.targets[0])} \u6253\u51FA\u300C${card}\u300D`;
      }
      case "trial":
        return `${name(e.target)} \u53D7\u5230\u5BA1\u5224\uFF08\u53D1\u8D77\u8005\uFF1A${name(e.initiator)}\uFF09`;
      case "reveal":
        return `${name(e.seat)} \u56E0${REVEAL_CAUSE[e.cause]}\u7FFB\u5F00\u4E86\u300C${TRYAL_NAME[e.kind]}\u300D`;
      case "death":
        return `${name(e.seat)} \u6B7B\u4EA1\uFF1A${DEATH_CAUSE[e.cause]}`;
      case "conspiracyDone":
        return "\u4F20\u67D3\u7ED3\u675F\uFF0C\u6BCF\u4E2A\u4EBA\u90FD\u62FF\u5230\u4E86\u4E00\u5F20\u65B0\u7684\u8EAB\u4EFD\u5361";
      case "nightResult":
        return e.died ? `\u591C\u91CC\uFF0C${name(e.target)} \u906D\u5230\u5973\u5DEB\u88AD\u51FB\u8EAB\u4EA1` : `\u591C\u91CC\uFF0C\u5973\u5DEB\u88AD\u51FB\u4E86 ${name(e.target)}\uFF0C\u4F46 TA \u6D3B\u4E86\u4E0B\u6765`;
      case "reshuffle":
        return "\u5F03\u724C\u5806\u6D17\u56DE\u4E86\u724C\u5806";
      case "nightReset":
        return "\u591C\u665A\u8FC7\u540E\uFF0C\u6240\u6709\u724C\u6536\u56DE\u91CD\u6D17\uFF0C\u6BCF\u4EBA\u91CD\u65B0\u53D1 3 \u5F20";
      case "character":
        return `${name(e.seat)} \u7684\u89D2\u8272\u662F\u300C${CHAR_INFO[e.character].name}\u300D`;
      case "ability":
        return abilityLine(e, name);
      case "gameEnd":
        return e.winner === "village" ? "\u6751\u6C11\u80DC\u5229\uFF01" : "\u5973\u5DEB\u80DC\u5229\uFF01";
    }
  }
  function visibleEvents(view) {
    return view.log.filter((e) => !(e.t === "reveal" && e.cause === "death"));
  }
  function logLines(view) {
    const name = (seat) => {
      var _a, _b;
      return (_b = (_a = view.players[seat]) == null ? void 0 : _a.name) != null ? _b : `\u5EA7\u4F4D ${seat + 1}`;
    };
    return visibleEvents(view).map((e) => describeEvent(e, name));
  }

  // src/model/table.ts
  function currentHand(room, hand) {
    if (!hand || !room.gameId || hand.gameId !== room.gameId || hand.roomId !== room.code) return null;
    return hand;
  }
  function buildTable(room, hand, openid) {
    var _a;
    const view = room.view;
    if (!view) return null;
    const idx = room.seats.findIndex((s) => s.openid === openid);
    const mySeat = idx >= 0 && idx < view.players.length ? idx : null;
    const n = view.players.length;
    const others = mySeat === null ? view.players : Array.from({ length: n - 1 }, (_, k) => view.players[(mySeat + 1 + k) % n]);
    const h = currentHand(room, hand);
    const priv = h && mySeat !== null && h.view.seat === mySeat ? h.view : null;
    const me = mySeat === null ? null : view.players[mySeat];
    return {
      code: room.code,
      view,
      mySeat,
      me,
      priv,
      others,
      turnSeat: view.turn,
      isMyTurn: view.phase.kind === "day" && view.turn === mySeat && !!(me == null ? void 0 : me.alive),
      pending: (_a = priv == null ? void 0 : priv.pending) != null ? _a : null,
      deadline: room.deadline,
      winner: view.phase.kind === "ended" ? view.phase.winner : null
    };
  }
  function isPartner(m, seat) {
    var _a, _b;
    return (_b = (_a = m.priv) == null ? void 0 : _a.witchPartners.includes(seat)) != null ? _b : false;
  }
  function nameOf(m, seat) {
    var _a, _b;
    return seat === m.mySeat ? "\u4F60" : (_b = (_a = m.view.players[seat]) == null ? void 0 : _a.name) != null ? _b : "";
  }
  function phaseTitle(m) {
    const ph = m.view.phase;
    switch (ph.kind) {
      case "characterPick":
        return "\u9009\u62E9\u89D2\u8272";
      case "storytelling":
        return ph.seat === m.mySeat ? "\u8C03\u6574\u724C\u5806" : `${m.view.players[ph.seat].name} \u6B63\u5728\u8C03\u6574\u724C\u5806`;
      case "dawn":
        return "\u7B2C\u4E00\u591C\uFF1A\u5973\u5DEB\u653E\u7F6E\u9ED1\u732B";
      case "day":
        return m.isMyTurn ? "\u4F60\u7684\u56DE\u5408" : `${m.view.players[m.turnSeat].name} \u7684\u56DE\u5408`;
      case "trialReveal":
        return `\u5BA1\u5224\uFF1A${nameOf(m, ph.target)} \u7FFB\u5F00\u8EAB\u4EFD\u5361`;
      case "catReveal":
        return `\u4F20\u67D3\uFF1A${nameOf(m, ph.holder)} \u7FFB\u5F00\u8EAB\u4EFD\u5361`;
      case "conspiracyPick":
        return "\u4F20\u67D3\uFF1A\u5927\u5BB6\u76F2\u62BD\u8EAB\u4EFD\u5361";
      case "night":
        return "\u591C\u665A";
      case "ended":
        return ph.winner === "village" ? "\u6751\u6C11\u80DC\u5229" : "\u5973\u5DEB\u80DC\u5229";
    }
  }
  function formatCountdown(deadline, now) {
    if (deadline === null) return "";
    const s = Math.max(0, Math.ceil((deadline - now) / 1e3));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // src/scenes/choicePanels.ts
  function choiceKey(m) {
    if (!m.pending) return "";
    if (m.pending.kind === "characterPick") return `characterPick:${m.view.phase.kind}`;
    return `${m.pending.kind}:${m.view.phase.kind}:${m.view.log.length}`;
  }
  var SEAT_NORMAL = { h: 36, gap: 6 };
  var SEAT_COMPACT = { h: 28, gap: 4 };
  var SEAT_COLS = 4;
  var seatGridHeight = (count, size) => Math.ceil(count / SEAT_COLS) * (size.h + size.gap);
  function seatGrid(m, area, prefix, seats, selected, marks, onPick, size = SEAT_NORMAL) {
    const cols = SEAT_COLS;
    const { h, gap } = size;
    const w = (area.w - gap * (cols - 1)) / cols;
    const nodes = seats.map((seat, i) => {
      var _a;
      const r = rect(area.x + i % cols * (w + gap), area.y + Math.floor(i / cols) * (h + gap), w, h);
      const p = m.view.players[seat];
      const partner = isPartner(m, seat);
      const mark = [...partner ? ["\u540C\u4F34"] : [], ...(_a = marks[seat]) != null ? _a : []].join("\u3001");
      return {
        id: `${prefix}:${seat}`,
        rect: r,
        onTap: onPick ? () => onPick(seat) : void 0,
        draw: (ctx2) => {
          drawPanel(ctx2, r, { tint: selected === seat ? goldGlow(0.25) : void 0, stroke: selected === seat ? C.gold : partner ? C.danger : void 0, lineWidth: selected === seat ? 2 : 1, glow: selected === seat ? 0.6 : 0 });
          drawBadge(ctx2, r.x + 13, r.y + h / 2, 9, p.name, seat, p.character);
          drawText(ctx2, nameOf(m, seat), r.x + 26, r.y + (mark ? h / 3 : h / 2), { size: 12, maxWidth: r.w - 30 });
          if (mark) drawText(ctx2, mark, r.x + 26, r.y + h * 0.72, { size: 9, color: partner ? C.dangerText : C.gold, maxWidth: r.w - 30 });
        }
      };
    });
    return { nodes, height: seatGridHeight(seats.length, size) };
  }
  function votesToMarks(m, votes) {
    var _a;
    const marks = {};
    for (const [voter, target] of Object.entries(votes != null ? votes : {})) ((_a = marks[target]) != null ? _a : marks[target] = []).push(nameOf(m, Number(voter)));
    return marks;
  }
  var CHIP_GAP = 8;
  var chipWidth = (areaW, n, maxW) => Math.min(maxW, (areaW - CHIP_GAP * (n - 1)) / Math.max(1, n));
  var tryalRowHeight = (areaW, n, labels, maxW) => Math.round(chipWidth(areaW, n, maxW) * 1.3) + (labels ? 20 : 4);
  function tryalRow(area, items, prefix, selected, onPick, maxW = 52) {
    const n = items.length;
    const gap = CHIP_GAP;
    const w = chipWidth(area.w, n, maxW);
    const h = Math.round(w * 1.3);
    const x0 = area.x + (area.w - (n * w + (n - 1) * gap)) / 2;
    const nodes = items.map((it, i) => {
      const r = rect(x0 + i * (w + gap), area.y, w, h);
      const sel = selected === it.id || selected === i;
      return {
        id: `${prefix}:${it.id}`,
        rect: r,
        onTap: () => onPick(it.id, i),
        draw: (ctx2) => {
          drawTryalChip(ctx2, r, it.kind, it.kind !== null);
          if (sel) drawPanel(ctx2, rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6), { fill: C.transparent, stroke: C.gold, lineWidth: 2, radius: 4 });
          if (it.kind) drawText(ctx2, TRYAL_NAME[it.kind], r.x + w / 2, r.y + h + 11, { size: 11, align: "center" });
        }
      };
    });
    return { nodes, height: tryalRowHeight(area.w, n, items.some((x) => x.kind), maxW) };
  }
  function choicePanel(ui2, m, st, now, slide = 1) {
    var _a;
    const p = m.pending;
    if (!p || p.kind === "turn") return [];
    const key = choiceKey(m);
    if (st.key !== key) {
      st.key = key;
      st.picked = null;
      st.suspect = null;
    }
    const cd = formatCountdown(m.deadline, now);
    const busy = ui2.ctl.busy;
    const act = ui2.ctl.act.bind(ui2.ctl);
    if (p.kind === "storytelling") return [];
    if (p.kind === "characterPick") return characterPanel(ui2, m, p, st, cd, slide);
    if (p.kind === "revealTryal") {
      const title = p.reason === "trial" ? "\u4F60\u53D7\u5230\u5BA1\u5224\uFF1A\u7FFB\u5F00\u4E00\u5F20\u8EAB\u4EFD\u5361" : "\u4F20\u67D3\uFF1A\u4F60\u6301\u6709\u9ED1\u732B\uFF0C\u7FFB\u5F00\u4E00\u5F20\u8EAB\u4EFD\u5361";
      const { nodes, body } = sheet(ui2.screen, 320, title, null, slide, `\u5269\u4F59 ${cd} \xB7 \u8D85\u65F6\u5C06\u968F\u673A\u7FFB\u5F00`);
      const tryals = unrevealedTryals(m);
      const row = tryalRow(body, tryals.map((t) => ({ id: t.id, kind: t.kind })), "tryal", st.picked, (id) => st.picked = id);
      nodes.push(...row.nodes);
      const picked = tryals.find((t) => t.id === st.picked);
      let y = body.y + row.height + 8;
      if ((picked == null ? void 0 : picked.kind) === "witch") {
        nodes.push(textNode(rect(body.x, y, body.w, 20), "\u7FFB\u5F00\u5973\u5DEB\u5361\u4F1A\u7ACB\u5373\u6B7B\u4EA1", { size: 13, color: C.dangerText, align: "center" }));
      }
      y += 28;
      nodes.push(requestButton("confirm-reveal", rect(body.x, y, body.w, 44), "\u786E\u8BA4\u7FFB\u5F00", picked ? () => void act({ type: "revealTryal", tryalId: picked.id }) : null, busy));
      return nodes;
    }
    if (p.kind === "conspiracyPick") {
      const from = m.view.players[p.from];
      const { nodes, body } = sheet(ui2.screen, 300, `\u4F20\u67D3\uFF1A\u4ECE ${from.name} \u7684\u8EAB\u4EFD\u5361\u91CC\u76F2\u62BD\u4E00\u5F20`, null, slide, `\u5269\u4F59 ${cd} \xB7 \u8D85\u65F6\u5C06\u968F\u673A\u62BD\u53D6`);
      const items = Array.from({ length: p.count }, (_, i) => ({ id: String(i), kind: null }));
      const row = tryalRow(body, items, "pick", st.picked, (_id, i) => st.picked = i);
      nodes.push(...row.nodes);
      const idx = typeof st.picked === "number" ? st.picked : null;
      nodes.push(requestButton("confirm-pick", rect(body.x, body.y + row.height + 16, body.w, 44), "\u62FF\u8FD9\u5F20", idx !== null ? () => void act({ type: "conspiracyPick", index: idx }) : null, busy));
      return nodes;
    }
    if (p.kind === "dawnVote") {
      const { nodes, body } = sheet(ui2.screen, 360, "\u7B2C\u4E00\u591C\uFF1A\u548C\u540C\u4F34\u4E00\u8D77\u9009\u62E9\u9ED1\u732B\u7684\u4E3B\u4EBA", null, slide, `\u540C\u4F34\u9009\u62E9\u4E00\u81F4\u540E\u751F\u6548 \xB7 \u5269\u4F59 ${cd}`);
      const mine = m.mySeat !== null ? (_a = p.votes[m.mySeat]) != null ? _a : null : null;
      const grid = seatGrid(m, body, "vote", dawnTargets(m), mine, votesToMarks(m, p.votes), busy ? null : (seat) => void act({ type: "witchVote", target: seat }));
      nodes.push(...grid.nodes);
      return nodes;
    }
    return nightPanel(ui2, m, p, st, cd, slide);
  }
  var STEP_TITLE = {
    kill: "\u9009\u62E9\u51FB\u6740\u76EE\u6807\uFF08\u540C\u4F34\u987B\u4E00\u81F4\uFF09",
    protect: "\u9009\u62E9\u4FDD\u62A4\u4E00\u540D\u73A9\u5BB6\uFF08\u4E0D\u80FD\u662F\u81EA\u5DF1\uFF09",
    suspect: "\u9009\u62E9\u4F60\u6000\u7591\u7684\u4EBA"
  };
  var NIGHT_LEVELS = [
    { seat: SEAT_NORMAL, chip: 52 },
    { seat: SEAT_COMPACT, chip: 52 },
    { seat: SEAT_COMPACT, chip: 40 },
    { seat: SEAT_COMPACT, chip: 30 }
  ];
  var NIGHT_BUTTON_H = 42;
  function nightPanel(ui2, m, p, st, cd, slide) {
    var _a, _b, _c, _d, _e;
    const busy = ui2.ctl.busy;
    const act = ui2.ctl.act.bind(ui2.ctl);
    const sheetH = ui2.screen.H - ui2.screen.top;
    const { nodes, body } = sheet(ui2.screen, sheetH, "\u591C\u665A", null, slide, `\u5269\u4F59 ${cd} \xB7 \u8D85\u65F6\u5C06\u81EA\u52A8\u5904\u7406`);
    const bodyH = body.h + sheetH * (1 - slide);
    const steps = nightSteps(p).map((step) => ({ step, seats: nightTargets(m, step) }));
    const tryals = p.confessed ? [] : unrevealedTryals(m);
    const silentLeft = !p.confessed && ((_a = m.me) == null ? void 0 : _a.ability) === "official" ? (_b = m.me.usesLeft) != null ? _b : 0 : 0;
    const btnY = body.y + bodyH - NIGHT_BUTTON_H;
    const silentY = btnY - NIGHT_BUTTON_H - 8;
    const avail = p.confessed ? bodyH - 24 : (silentLeft > 0 ? silentY : btnY) - body.y;
    const need = (lv2) => steps.reduce((sum, x) => sum + 24 + seatGridHeight(x.seats.length, lv2.seat) + 8, 0) + (p.confessed ? 0 : 26 + tryalRowHeight(body.w, tryals.length, tryals.length > 0, lv2.chip) + 6);
    const lv = (_c = NIGHT_LEVELS.find((l) => need(l) <= avail)) != null ? _c : NIGHT_LEVELS[NIGHT_LEVELS.length - 1];
    let y = body.y;
    for (const { step, seats } of steps) {
      nodes.push(textNode(rect(body.x, y, body.w, 20), STEP_TITLE[step], { size: 13, color: C.gold }));
      y += 24;
      const area = rect(body.x, y, body.w, 0);
      const grid = step === "kill" ? seatGrid(m, area, "kill", seats, m.mySeat !== null ? (_e = (_d = p.votes) == null ? void 0 : _d[m.mySeat]) != null ? _e : null : null, votesToMarks(m, p.votes), busy ? null : (seat) => void act({ type: "witchVote", target: seat }), lv.seat) : step === "protect" ? seatGrid(m, area, "protect", seats, p.protect, {}, busy ? null : (seat) => void act({ type: "protect", target: seat }), lv.seat) : seatGrid(m, area, "suspect", seats, st.suspect, {}, (seat) => st.suspect = seat, lv.seat);
      nodes.push(...grid.nodes);
      y += grid.height + 8;
    }
    if (p.confessed) {
      nodes.push(textNode(rect(body.x, y, body.w, 24), "\u81EA\u9996\uFF1A\u5DF2\u51B3\u5B9A\u3002\u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6\u2026", { size: 13, color: C.textDim }));
      return nodes;
    }
    nodes.push(textNode(rect(body.x, y, body.w, 20), "\u662F\u5426\u81EA\u9996\uFF1F\u81EA\u9996\u8981\u7FFB\u5F00\u4E00\u5F20\u8EAB\u4EFD\u5361\uFF0C\u5F53\u665A\u4E0D\u4F1A\u88AB\u6740", { size: 13, color: C.gold }));
    y += 26;
    const row = tryalRow(rect(body.x, y, body.w, 0), tryals.map((t) => ({ id: t.id, kind: t.kind })), "confess", st.picked, (id) => st.picked = id, lv.chip);
    nodes.push(...row.nodes);
    const half = (body.w - 10) / 2;
    const picked = typeof st.picked === "string" ? st.picked : null;
    nodes.push(
      requestButton("no-confess", rect(body.x, btnY, half, NIGHT_BUTTON_H), "\u4E0D\u81EA\u9996", () => void act({ type: "confess", tryalId: null }), busy, "secondary"),
      requestButton("confirm-confess", rect(body.x + half + 10, btnY, half, NIGHT_BUTTON_H), "\u81EA\u9996", picked ? () => void act({ type: "confess", tryalId: picked }) : null, busy, "danger")
    );
    if (silentLeft > 0) {
      nodes.push(
        requestButton(
          "silent-confess",
          rect(body.x, silentY, body.w, NIGHT_BUTTON_H),
          `\u4E0D\u7FFB\u724C\u81EA\u9996\uFF08\u5269 ${silentLeft} \u6B21\uFF09`,
          () => void act({ type: "confess", tryalId: null, silent: true }),
          busy,
          "secondary"
        )
      );
    }
    return nodes;
  }
  function characterPanel(ui2, _m, p, st, cd, slide) {
    const { nodes, body } = sheet(ui2.screen, 480, "\u9009\u62E9\u4F60\u7684\u89D2\u8272", null, slide, `\u89D2\u8272\u5BF9\u6240\u6709\u4EBA\u516C\u5F00 \xB7 \u5269\u4F59 ${cd} \xB7 \u8D85\u65F6\u968F\u673A\u9009\u62E9`);
    const settledH = body.h + Math.min(480, ui2.screen.H - ui2.screen.top) * (1 - slide);
    const gap = 10;
    const slot = (body.w - gap) / 2;
    const cw = Math.min(slot, (settledH - 70) / 1.5);
    const ch = cw * 1.5;
    p.offers.forEach((c, i) => {
      const r = rect(body.x + i * (slot + gap) + (slot - cw) / 2, body.y + 6, cw, ch);
      nodes.push({
        id: `character:${c}`,
        rect: r,
        onTap: () => st.picked = i,
        draw: (ctx2) => {
          const sel = st.picked === i;
          const y = r.y - (sel ? 6 : 0);
          if (sel) drawPanel(ctx2, rect(r.x - 3, y - 3, r.w + 6, r.h + 6), { fill: C.transparent, stroke: C.gold, lineWidth: 2, radius: 12, glow: 0.9 });
          drawCharCard(ctx2, rect(r.x, y, r.w, r.h), c);
        }
      });
    });
    const idx = typeof st.picked === "number" ? st.picked : null;
    nodes.push(
      requestButton("confirm-character", rect(body.x, body.y + 6 + ch + 14, body.w, 44), "\u9009\u8FD9\u4E2A\u89D2\u8272", idx !== null ? () => void ui2.ctl.act({ type: "pickCharacter", index: idx }) : null, ui2.ctl.busy)
    );
    return nodes;
  }

  // src/scenes/abilityPanels.ts
  function priestPanel(ui2, m, picked, close) {
    const { nodes, body } = sheet(ui2.screen, 420, "\u7267\u5E08\uFF1A\u4ECE\u5F03\u724C\u5806\u62FF\u724C", close, 1, "\u9009 1\u20132 \u5F20\u975E\u9ED1\u5361\uFF0C\u62FF\u5B8C\u56DE\u5408\u7ED3\u675F");
    const pool = m.view.discard.filter((c) => !isBlack(c.kind));
    const kinds = [...new Set(pool.map((c) => c.kind))];
    const cols = 5;
    const gap = 8;
    const w = (body.w - gap * (cols - 1)) / cols;
    const h = 78;
    kinds.forEach((kind, i) => {
      const r = rect(body.x + i % cols * (w + gap), body.y + Math.floor(i / cols) * (h + gap), w, h);
      const ids = pool.filter((c) => c.kind === kind).map((c) => c.id);
      const mine = picked.filter((id) => ids.includes(id)).length;
      nodes.push({
        id: `priest:${kind}`,
        rect: r,
        onTap: () => {
          const free = ids.find((id) => !picked.includes(id));
          if (free && picked.length < 2) {
            picked.push(free);
            return;
          }
          for (const id of ids) {
            const k = picked.indexOf(id);
            if (k >= 0) picked.splice(k, 1);
          }
        },
        draw: (ctx2) => {
          drawPanel(ctx2, r, { tint: mine ? goldGlow(0.2) : void 0, stroke: mine ? C.gold : void 0, glow: mine ? 0.6 : 0, lineWidth: mine ? 2 : 1 });
          drawCardFace(ctx2, rect(r.x + (r.w - 40) / 2, r.y + 4, 40, 56), kind);
          drawText(ctx2, mine ? `\u5DF2\u9009 ${mine} / ${ids.length}` : `${ids.length} \u5F20`, r.x + r.w / 2, r.y + 69, {
            size: 11,
            align: "center",
            color: mine ? C.gold : C.textDim
          });
        }
      });
    });
    const y = body.y + Math.ceil(kinds.length / cols) * (h + gap) + 8;
    nodes.push(
      requestButton(
        "confirm-priest",
        rect(body.x, y, body.w, 44),
        picked.length ? `\u62FF\u8FD9 ${picked.length} \u5F20` : "\u9009\u62E9\u8981\u62FF\u7684\u724C",
        picked.length ? () => void ui2.ctl.act({ type: "priestDraw", cardIds: [...picked] }) : null,
        ui2.ctl.busy
      )
    );
    return nodes;
  }

  // src/scenes/infoPanels.ts
  function countNames(names) {
    var _a;
    const counts = /* @__PURE__ */ new Map();
    for (const n of names) counts.set(n, ((_a = counts.get(n)) != null ? _a : 0) + 1);
    return [...counts].map(([n, k]) => k > 1 ? `${n}\xD7${k}` : n).join("\u3001");
  }
  function characterLines(p) {
    if (!p.character) return [];
    const c = CHAR_INFO[p.character];
    const lines = [`\u89D2\u8272\uFF1A${c.name}\u2014\u2014${c.desc}`];
    if (p.character === "tailor") {
      lines.push(p.ability ? `\u5F53\u524D\u6280\u80FD\uFF1A${CHAR_INFO[p.ability].name}\u2014\u2014${CHAR_INFO[p.ability].desc}` : "\u5F53\u524D\u6280\u80FD\uFF1A\u65E0\uFF08\u53F3\u624B\u8FB9\u7684\u4EBA\u6CA1\u6709\u89D2\u8272\uFF09");
    }
    if (p.usesLeft !== null) lines.push(`\u6280\u80FD\u5269\u4F59\u6B21\u6570\uFF1A${p.usesLeft}`);
    return lines;
  }
  function detailPanel(ui2, m, seat, close) {
    const p = m.view.players[seat];
    const { nodes, body } = sheet(ui2.screen, 560, `${p.name}${seat === m.mySeat ? "\uFF08\u4F60\uFF09" : ""}${p.alive ? "" : "\uFF08\u5DF2\u51FA\u5C40\uFF09"}`, close);
    const revealed = p.tryals.filter((t) => t.revealed && t.kind).map((t) => TRYAL_NAME[t.kind]);
    const reds = countNames(p.red.map((c) => CARD_INFO[c.kind].name));
    const lines = [
      ...characterLines(p),
      `\u6307\u63A7\uFF1A${p.redTotal} / ${p.threshold}${reds ? `\uFF08${reds}\uFF09` : ""}`,
      `\u84DD\u5361\uFF1A${p.blue.length ? countNames(p.blue.map((c) => CARD_INFO[c.kind].name)) : "\u65E0"}`,
      ...p.green.length ? [`\u9762\u524D\uFF1A${countNames(p.green.map((c) => CARD_INFO[c.kind].name))}`] : [],
      `\u624B\u724C\uFF1A${p.handCount} \u5F20`,
      `\u8EAB\u4EFD\u5361\uFF1A${p.tryals.length - revealed.length} \u5F20\u672A\u7FFB\u5F00${revealed.length ? `\uFF1B\u5DF2\u7FFB\u5F00 ${revealed.join("\u3001")}` : ""}`
    ];
    const card = p.character ? rect(body.x + (body.w - 96) / 2, body.y + 4, 96, 144) : null;
    nodes.push({
      id: "detail-body",
      rect: body,
      draw: (ctx2) => {
        if (card && p.character) drawCharCard(ctx2, card, p.character);
        ctx2.font = font(14);
        let y = body.y + 12 + (card ? card.h + 10 : 0);
        for (const line of lines) {
          for (const t of wrapText(line, body.w, (s) => ctx2.measureText(s).width)) {
            drawText(ctx2, t, body.x, y, { size: 14 });
            y += 22;
          }
          y += 6;
        }
      }
    });
    return nodes;
  }
  function myTryalsPanel(ui2, m, close) {
    const { nodes, body } = sheet(ui2.screen, 320, "\u6211\u7684\u8EAB\u4EFD\u5361", close, 1, "\u53EA\u6709\u4F60\u81EA\u5DF1\u80FD\u770B\u5230");
    const priv = m.priv;
    if (!priv) return nodes;
    const n = priv.tryals.length;
    const w = Math.min(56, (body.w - 8 * (n - 1)) / Math.max(1, n));
    const h = Math.round(w * 1.35);
    const x0 = body.x + (body.w - (n * w + (n - 1) * 8)) / 2;
    const partners = priv.witchPartners.map((s) => nameOf(m, s)).join("\u3001");
    const lines = [
      priv.witchFaction ? `\u4F60\u5C5E\u4E8E\u5973\u5DEB\u9635\u8425\u3002\u540C\u4F34\uFF1A${partners || "\u6CA1\u6709"}` : "\u4F60\u5C5E\u4E8E\u6751\u6C11\u9635\u8425\u3002",
      ...priv.isConstable ? ["\u4F60\u6301\u6709\u8B66\u957F\u5361\uFF1A\u591C\u665A\u53EF\u4EE5\u4FDD\u62A4\u4E00\u540D\u5176\u4ED6\u73A9\u5BB6\u3002"] : []
    ];
    nodes.push({
      id: "my-tryals",
      rect: body,
      draw: (ctx2) => {
        priv.tryals.forEach((t, i) => {
          const r = rect(x0 + i * (w + 8), body.y + 6, w, h);
          drawTryalChip(ctx2, r, t.kind, true);
          drawText(ctx2, `${TRYAL_NAME[t.kind]}${t.revealed ? "\xB7\u5DF2\u7FFB\u5F00" : ""}`, r.x + w / 2, r.y + h + 12, { size: 11, align: "center", color: t.revealed ? C.textMuted : C.text });
        });
        lines.forEach((t, i) => drawText(ctx2, t, body.x, body.y + h + 44 + i * 24, { size: 13, color: C.gold, maxWidth: body.w }));
      }
    });
    return nodes;
  }
  function logPanel(ui2, m, box, close) {
    const { nodes, body } = sheet(ui2.screen, ui2.screen.H * 0.8, "\u4E8B\u4EF6\u8BB0\u5F55", close, 1, "\u6700\u65B0\u7684\u5728\u6700\u4E0A\u9762");
    const lines = logLines(m.view).reverse().map((text, i) => ({ text, size: 13, color: i === 0 ? C.text : C.textDim, gap: 2 }));
    nodes.push(box.node("log-list", body, lines));
    return nodes;
  }
  var COLOR_GROUPS = [
    ["\u7EA2\u5361", "red"],
    ["\u84DD\u5361", "blue"],
    ["\u7EFF\u5361", "green"],
    ["\u9ED1\u5361", "black"]
  ];
  function discardPanel(ui2, m, box, close) {
    const discard = m.view.discard;
    const { nodes, body } = sheet(ui2.screen, ui2.screen.H * 0.6, `\u5F03\u724C\u5806\uFF08${discard.length} \u5F20\uFF09`, close, 1, "\u6240\u6709\u4EBA\u90FD\u53EF\u4EE5\u67E5\u770B");
    const lines = COLOR_GROUPS.flatMap(([title, color]) => {
      const kinds = [...new Set(discard.filter((c) => CARD_INFO[c.kind].color === color).map((c) => c.kind))];
      if (!kinds.length) return [];
      return [
        { text: title, size: 14, bold: true, color: C.gold, gap: 2 },
        ...kinds.map((k) => ({ text: `${CARD_INFO[k].name} \xD7${discard.filter((c) => c.kind === k).length}`, icon: { card: k }, size: 14, gap: 2 })),
        { text: "", size: 4, gap: 4 }
      ];
    });
    nodes.push(box.node("discard-list", body, lines.length ? lines : [{ text: "\u5F03\u724C\u5806\u662F\u7A7A\u7684", color: C.textMuted }]));
    return nodes;
  }

  // src/scenes/storyBoard.ts
  var ROW_H = 52;
  var HANDLE_W = 48;
  var EDGE = 70;
  var MAX_SPEED = 14;
  var StoryBoard = class {
    constructor() {
      __publicField(this, "key", "");
      __publicField(this, "order", []);
      __publicField(this, "scroll", 0);
      __publicField(this, "drag", null);
      __publicField(this, "list", null);
    }
    build(ui2, m, deck, now) {
      const key = deck.map((c) => c.id).join(",");
      if (key !== this.key) {
        this.key = key;
        this.order = deck.map((c) => c.id);
        this.scroll = 0;
        this.drag = null;
      }
      const byId = new Map(deck.map((c) => [c.id, c]));
      const S = ui2.screen;
      const { nodes, body } = sheet(
        S,
        S.H - S.top,
        "\u8BF4\u4E66\u4EBA\uFF1A\u8C03\u6574\u724C\u5806",
        null,
        1,
        `\u4E0A\u9762\u662F\u724C\u5806\u9876 \xB7 \u6309\u4F4F\u53F3\u4FA7 \u2261 \u62D6\u52A8 \xB7 \u5269\u4F59 ${formatCountdown(m.deadline, now)}`
      );
      const btnH = 44;
      const list = rect(body.x, body.y, body.w, body.h - btnH - 12);
      this.list = list;
      const contentH = this.order.length * ROW_H;
      this.scroll = clampScroll(this.scroll, contentH, list.h);
      nodes.push({
        id: "story-list",
        rect: list,
        clip: true,
        onScroll: (dy) => {
          if (!this.drag) this.scroll = clampScroll(this.scroll + dy, contentH, list.h);
        },
        draw: (ctx2) => {
          this.order.forEach((id, i) => {
            var _a;
            const y = list.y + this.scroll + i * ROW_H;
            if (y + ROW_H < list.y || y > list.y + list.h) return;
            const r = rect(list.x, y, list.w, ROW_H - 6);
            if (((_a = this.drag) == null ? void 0 : _a.id) === id) drawPanel(ctx2, r, { fill: C.transparent, stroke: C.goldDark });
            else drawRow(ctx2, r, byId.get(id), i, false);
          });
        }
      });
      this.order.forEach((id, i) => {
        const y = list.y + this.scroll + i * ROW_H;
        const top = Math.max(y, list.y);
        const bottom = Math.min(y + ROW_H - 6, list.y + list.h);
        if (bottom <= top) return;
        nodes.push({
          id: `handle:${id}`,
          rect: rect(list.x + list.w - HANDLE_W, top, HANDLE_W, bottom - top),
          onPress: (_x, py) => this.press(id, py)
        });
      });
      const d = this.drag;
      if (d) {
        const gy = Math.max(list.y - 20, Math.min(list.y + list.h - ROW_H + 26, d.y - d.grab));
        const r = rect(list.x, gy, list.w, ROW_H - 6);
        const card = byId.get(d.id);
        const index = this.order.indexOf(d.id);
        nodes.push({ id: "story-ghost", rect: r, draw: (ctx2) => drawRow(ctx2, r, card, index, true) });
      }
      const half = (body.w - 10) / 2;
      const by = list.y + list.h + 12;
      nodes.push(
        button("story-reset", rect(body.x, by, half, btnH), "\u8FD8\u539F", () => {
          this.order = deck.map((c) => c.id);
        }, "secondary"),
        requestButton(
          "story-confirm",
          rect(body.x + half + 10, by, half, btnH),
          "\u786E\u8BA4\u987A\u5E8F",
          () => void ui2.ctl.act({ type: "storyReorder", order: [...this.order] }),
          ui2.ctl.busy
        )
      );
      return nodes;
    }
    press(id, y) {
      const list = this.list;
      const i = this.order.indexOf(id);
      this.drag = { id, y, grab: y - (list.y + this.scroll + i * ROW_H) };
      return {
        move: (_x, ny) => {
          if (!this.drag) return;
          this.drag.y = ny;
          this.follow();
        },
        frame: () => this.autoScroll(),
        end: () => {
          this.drag = null;
        }
      };
    }
    /** 手指靠近列表上下边缘时滚动，越靠边越快 */
    autoScroll() {
      const d = this.drag;
      const list = this.list;
      if (!d || !list) return;
      const contentH = this.order.length * ROW_H;
      if (d.y < list.y + EDGE) this.scroll += Math.ceil((list.y + EDGE - d.y) / EDGE * MAX_SPEED);
      else if (d.y > list.y + list.h - EDGE) this.scroll -= Math.ceil((d.y - (list.y + list.h - EDGE)) / EDGE * MAX_SPEED);
      else return;
      this.scroll = clampScroll(this.scroll, contentH, list.h);
      this.follow();
    }
    /** 把被拖的牌移到手指所在的位置 */
    follow() {
      const d = this.drag;
      const list = this.list;
      const top = d.y - d.grab;
      const target = Math.max(0, Math.min(this.order.length - 1, Math.round((top - list.y - this.scroll) / ROW_H)));
      const cur = this.order.indexOf(d.id);
      if (target !== cur) {
        this.order.splice(cur, 1);
        this.order.splice(target, 0, d.id);
      }
    }
  };
  function drawRow(ctx2, r, card, index, lifted) {
    const info = CARD_INFO[card.kind];
    drawPanel(ctx2, r, { fill: lifted ? C.panelBigBottom : void 0, stroke: lifted ? C.gold : void 0, lineWidth: lifted ? 2 : 1, glow: lifted ? 0.6 : 0 });
    drawText(ctx2, String(index + 1), r.x + 26, r.y + r.h / 2, { size: 12, color: C.textMuted, align: "right" });
    const chip = rect(r.x + 34, r.y + 5, 28, r.h - 10);
    drawCardFace(ctx2, chip, card.kind);
    const black = info.color === "black";
    drawText(ctx2, info.name, r.x + 72, r.y + r.h / 2 - 8, { size: 15, bold: black, color: black ? C.gold : C.text });
    drawText(ctx2, info.desc, r.x + 72, r.y + r.h / 2 + 10, { size: 11, color: C.textMuted, maxWidth: r.w - 72 - HANDLE_W - 8 });
    drawText(ctx2, "\u2261", r.x + r.w - HANDLE_W / 2, r.y + r.h / 2, { size: 20, color: C.textDim, align: "center" });
  }

  // src/scenes/tableLayout.ts
  var PAD = 12;
  var COLS = 4;
  var GAP = 6;
  function tableLayout(screen2, others) {
    const W = screen2.W;
    const small2 = screen2.bottom - screen2.top < 560;
    const top = rect(PAD, screen2.top, W - 2 * PAD, 32);
    const btnH = small2 ? 40 : 44;
    const buttons = rect(PAD, screen2.bottom - 10 - btnH, W - 2 * PAD, btnH);
    const handH = small2 ? 76 : 96;
    const hand = rect(PAD, buttons.y - 6 - handH, W - 2 * PAD, handH);
    const info = rect(PAD, hand.y - 20, W - 2 * PAD, 18);
    const meH = small2 ? 34 : 40;
    const me = rect(PAD, info.y - 4 - meH, W - 2 * PAD, meH);
    const logH = small2 ? 40 : 58;
    const log = rect(PAD, me.y - 6 - logH, W - 2 * PAD, logH);
    const gridTop = top.y + top.h + 6;
    const rows = Math.max(1, Math.ceil(others / COLS));
    const avail = log.y - 6 - gridTop;
    const cellH = Math.max(48, Math.min(88, (avail - GAP * (rows - 1)) / rows));
    const cellW = (W - 2 * PAD - GAP * (COLS - 1)) / COLS;
    const grid = Array.from(
      { length: others },
      (_, i) => rect(PAD + i % COLS * (cellW + GAP), gridTop + Math.floor(i / COLS) * (cellH + GAP), cellW, cellH)
    );
    return { top, grid, cellH, log, me, info, hand, buttons };
  }

  // src/scenes/tableParts.ts
  function tryalRow2(ctx2, p, cx, y, h, flip) {
    const n = p.tryals.length;
    const cw = Math.round(h * 0.75);
    const gap = 3;
    const x0 = cx - (n * cw + (n - 1) * gap) / 2;
    p.tryals.forEach((t, i) => {
      const r = { x: x0 + i * (cw + gap), y, w: cw, h };
      if (flip && flip.index === i && flip.p < 1) {
        if (flip.p < 0.5) drawTryalChip(ctx2, r, null, false, 1 - flip.p * 2);
        else drawTryalChip(ctx2, r, t.kind, true, flip.p * 2 - 1);
      } else {
        drawTryalChip(ctx2, r, t.kind, t.revealed);
      }
    });
  }
  function redBar(ctx2, p, x, y, w) {
    const bar = { x, y, w, h: 4 };
    roundRect(ctx2, bar, 2);
    ctx2.fillStyle = C.lineDark;
    ctx2.fill();
    const ratio2 = Math.min(1, p.redTotal / Math.max(1, p.threshold));
    if (ratio2 > 0) {
      roundRect(ctx2, __spreadProps(__spreadValues({}, bar), { w: w * ratio2 }), 2);
      ctx2.fillStyle = C.danger;
      ctx2.fill();
    }
  }
  function frontCards(ctx2, p, right, cy, maxW) {
    const cards = [...p.blue, ...p.green];
    const n = Math.min(cards.length, Math.floor((maxW + 2) / 12));
    for (let i = 0; i < n; i++) drawCardFace(ctx2, { x: right - 10 - i * 12, y: cy - 7, w: 10, h: 14 }, cards[i].kind);
  }
  function cellName(p) {
    const label = charLabel(p);
    return label ? `${label}\xB7${p.name}` : p.name;
  }
  function drawStamp(ctx2, x, y, p) {
    const s = 1 + 0.6 * (1 - p);
    ctx2.save();
    ctx2.globalAlpha *= p;
    ctx2.translate(x, y);
    ctx2.rotate(-0.12);
    ctx2.scale(s, s);
    drawText(ctx2, "\u51FA\u5C40", 0, 0, { size: 13, bold: true, color: C.badgeText, align: "center" });
    ctx2.restore();
  }
  function drawFlash(ctx2, r, color) {
    if (!color) return;
    roundRect(ctx2, r, 8);
    ctx2.fillStyle = color;
    ctx2.fill();
  }
  function drawCell(ctx2, r0, p, o) {
    var _a;
    const r = o.shake ? __spreadProps(__spreadValues({}, r0), { x: r0.x + o.shake }) : r0;
    ctx2.globalAlpha = o.alpha;
    drawPanel(ctx2, r, {
      tint: o.targetable ? goldGlow(0.14) : void 0,
      stroke: o.turn || o.targetable || o.order ? C.gold : o.partner ? C.danger : !p.alive ? C.greyLine : void 0,
      glow: o.turn ? o.glow : 0,
      lineWidth: o.turn || o.order ? 2 : 1
    });
    drawFlash(ctx2, r, o.flash);
    const cx = r.x + r.w / 2;
    const tag = o.partner && !o.order;
    if (r.h >= 70) {
      drawBadge(ctx2, cx, r.y + 17, 12, p.name, p.seat, p.character);
      drawText(ctx2, cellName(p), cx, r.y + 38, { size: 11, align: "center", maxWidth: r.w - 6 });
      redBar(ctx2, p, r.x + 6, r.y + 47, r.w - 12);
      tryalRow2(ctx2, p, cx, r.y + 55, 11, o.flip);
      if (r.h >= 80) {
        drawText(ctx2, `\u624B${p.handCount}`, r.x + 6, r.y + r.h - 9, { size: 10, color: C.textDim });
        frontCards(ctx2, p, r.x + r.w - 6, r.y + r.h - 9, r.w - 34);
      }
    } else {
      drawBadge(ctx2, r.x + 13, r.y + 13, 9, p.name, p.seat, p.character);
      drawText(ctx2, cellName(p), r.x + 26, r.y + 13, { size: 11, maxWidth: r.w - (tag ? 52 : 30) });
      redBar(ctx2, p, r.x + 5, r.y + 27, r.w - 10);
      tryalRow2(ctx2, p, cx, r.y + 34, 10, o.flip);
    }
    if (!p.alive) drawStamp(ctx2, cx, r.y + r.h / 2, (_a = o.stamp) != null ? _a : 1);
    if (o.order) drawText(ctx2, o.order === 1 ? "\u2460" : "\u2461", r.x + r.w - 9, r.y + 10, { size: 12, bold: true, color: C.gold, align: "center" });
    else if (tag) drawText(ctx2, "\u540C\u4F34", r.x + r.w - 5, r.y + 10, { size: 9, bold: true, color: C.dangerText, align: "right" });
    ctx2.globalAlpha = 1;
  }
  function drawMeBar(ctx2, r0, m, o) {
    const r = o.shake ? __spreadProps(__spreadValues({}, r0), { x: r0.x + o.shake }) : r0;
    drawPanel(ctx2, r, {
      tier: "strip",
      tint: o.targetable ? goldGlow(0.14) : void 0,
      stroke: o.targetable || o.order || m.isMyTurn ? C.gold : m.me && !m.me.alive ? C.greyLine : void 0,
      glow: m.isMyTurn ? o.glow : 0,
      lineWidth: o.order || m.isMyTurn ? 2 : 1
    });
    drawFlash(ctx2, r, o.flash);
    const me = m.me;
    const cy = r.y + r.h / 2;
    if (!me) {
      drawText(ctx2, "\u4F60\u5728\u89C2\u6218", r.x + 12, cy, { size: 13, color: C.textDim });
      return;
    }
    drawBadge(ctx2, r.x + 20, cy, Math.min(13, r.h / 2 - 3), me.name, me.seat, me.character);
    const status = me.alive ? `\u6307\u63A7 ${me.redTotal}/${me.threshold} \xB7 \u624B\u724C ${me.handCount}` : "\u4F60\u5DF2\u51FA\u5C40";
    const label = charLabel(me);
    drawText(ctx2, `\u4F60\uFF08${label ? `${label}\xB7` : ""}${me.name}\uFF09  ${status}`, r.x + 40, cy, { size: 12, maxWidth: r.w - 130 });
    drawText(ctx2, "\u6211\u7684\u8EAB\u4EFD\u5361 \u203A", r.x + r.w - 10, cy, { size: 12, color: C.gold, align: "right" });
    if (o.order) drawText(ctx2, o.order === 1 ? "\u2460" : "\u2461", r.x + r.w - 96, cy, { size: 12, bold: true, color: C.gold, align: "center" });
  }

  // src/scenes/table.ts
  var TWO_TARGET_HINT = ["\u5148\u9009\u88AB\u62FF\u8D70\u7684\u4EBA", "\u518D\u9009\u63A5\u6536\u7684\u4EBA"];
  var LEAVE_W = 46;
  var TableScene = class {
    constructor(ui2) {
      __publicField(this, "ui", ui2);
      __publicField(this, "sel", null);
      __publicField(this, "targets", []);
      __publicField(this, "option");
      __publicField(this, "askOption", false);
      __publicField(this, "peek", null);
      __publicField(this, "detail", null);
      __publicField(this, "mine", false);
      __publicField(this, "logOpen", false);
      __publicField(this, "logBox", new ScrollBox());
      __publicField(this, "discardOpen", false);
      __publicField(this, "discardBox", new ScrollBox());
      __publicField(this, "priestOpen", false);
      __publicField(this, "priestPick", []);
      __publicField(this, "layout", null);
      __publicField(this, "choice", { key: "", picked: null, suspect: null });
      __publicField(this, "board", new StoryBoard());
      __publicField(this, "prev", null);
    }
    build(now) {
      var _a;
      const ctl2 = this.ui.ctl;
      const room = ctl2.room;
      if (!room || !ctl2.openid) return [];
      const m = buildTable(room, ctl2.hand, ctl2.openid);
      if (!m) return [];
      this.sync(m);
      const L = tableLayout(this.ui.screen, m.others.length);
      this.layout = L;
      const a = this.anim(m, now);
      const choice = ((_a = m.pending) == null ? void 0 : _a.kind) === "storytelling" ? this.board.build(this.ui, m, m.pending.deck, now) : choicePanel(this.ui, m, this.choice, now, a.panelSlide);
      const nodes = [skyNode(this.ui.screen, a.darkness)];
      nodes.push(this.topBar(m, L.top, now));
      const sheetOpen = this.askOption || this.priestOpen || this.detail !== null || this.mine || this.logOpen;
      if (!choice.length && !sheetOpen) nodes.push(this.discardNode(L.top));
      if (!choice.length) nodes.push(this.leaveButton(L.top));
      m.others.forEach((p, i) => nodes.push(this.cell(m, p.seat, L.grid[i], a)));
      nodes.push(this.logNode(m, L.log), this.meNode(m, L.me, a), this.infoNode(m, L.info));
      nodes.push(...this.handNodes(m, L.hand, a), ...this.buttonNodes(m, L.buttons));
      nodes.push(...a.overlay);
      nodes.push(...this.panels(m, choice));
      return nodes;
    }
    /** 比较上一帧的画面数据，启动对应动效，再算出这一帧的动效参数 */
    anim(m, now) {
      var _a, _b;
      const A = this.ui.animator;
      let mine = 0;
      const changes = diffTables(this.prev, m);
      const revealEnd = /* @__PURE__ */ new Map();
      const playTo = /* @__PURE__ */ new Set();
      for (const c of changes) {
        if (c.kind === "reveal") revealEnd.set(c.seat, Math.max((_a = revealEnd.get(c.seat)) != null ? _a : 0, ANIM_MS.reveal + (c.witch ? ANIM_MS.burst : 0)));
        if (c.kind === "play") playTo.add(c.to);
      }
      for (const c of changes) {
        switch (c.kind) {
          case "cardIn":
            A.start(`in:${c.id}`, now + mine++ * ANIM_MS.cardStagger, ANIM_MS.cardIn);
            break;
          case "draw":
            for (let k = 0; k < c.count; k++) A.start(`draw:${c.seat}:${now}:${k}`, now + k * ANIM_MS.cardStagger, ANIM_MS.othersDraw, { seat: c.seat });
            break;
          case "play":
            A.start(`fly:${c.index}`, now, ANIM_MS.play, c);
            A.start(`hit:${c.to}`, now + ANIM_MS.play, ANIM_MS.hit, { red: CARD_INFO[c.card].color === "red" });
            break;
          case "trial":
            A.start(`trial:${c.seat}`, now + (playTo.has(c.seat) ? ANIM_MS.play : 0), ANIM_MS.trial);
            break;
          case "night":
            A.start("sky", now, ANIM_MS.night, { from: c.on ? 0 : 1, to: c.on ? 1 : 0 });
            break;
          case "death":
            A.start(`dead:${c.seat}`, now + ((_b = revealEnd.get(c.seat)) != null ? _b : 0), ANIM_MS.death);
            break;
          case "reveal":
            A.start(`flip:${c.seat}`, now, ANIM_MS.reveal, { index: c.index });
            if (c.witch) A.start(`burst:${c.seat}`, now + ANIM_MS.reveal, ANIM_MS.burst);
            break;
          case "turn":
            A.start("turn", now, ANIM_MS.turn);
            break;
          case "panel":
            A.start("panel", now, ANIM_MS.panel);
            break;
        }
      }
      this.prev = m;
      const live = (key) => A.started(key, now) && A.running(key, now);
      const staticDark = m.view.phase.kind === "night" ? 1 : 0;
      const sky2 = A.data("sky");
      const darkness = sky2 && A.running("sky", now) ? sky2.from + (sky2.to - sky2.from) * A.progress("sky", now) : staticDark;
      const glow2 = A.running("turn", now) ? 0.6 + 0.4 * Math.abs(Math.sin(A.linear("turn", now) * Math.PI * 3)) : 0.6;
      const deck = this.deckPoint();
      const shakeOf = (seat) => {
        const k = `trial:${seat}`;
        if (!live(k)) return 0;
        const p = A.linear(k, now);
        return Math.sin(p * Math.PI * 6) * 3 * (1 - p);
      };
      const flashOf = (seat) => {
        const t = `trial:${seat}`;
        if (live(t)) return alpha(C.danger, 0.4 * Math.abs(Math.sin(A.linear(t, now) * Math.PI * 2)));
        const b = `burst:${seat}`;
        if (live(b)) return alpha(C.danger, 0.45 * (1 - A.progress(b, now)));
        const h = `hit:${seat}`;
        if (live(h)) return alpha(A.data(h).red ? C.danger : C.gold, 0.4 * (1 - A.progress(h, now)));
        return null;
      };
      const overlay2 = [];
      for (const key of A.keys()) {
        if (key.startsWith("fly:") && live(key)) {
          const c = A.data(key);
          const from = this.seatRect(m, c.from);
          const to = this.seatRect(m, c.to);
          if (!from || !to) continue;
          const p = A.progress(key, now);
          const x = from.x + from.w / 2 + (to.x + to.w / 2 - from.x - from.w / 2) * p;
          const y = from.y + from.h / 2 + (to.y + to.h / 2 - from.y - from.h / 2) * p - Math.sin(Math.PI * p) * 40;
          const s = 1 + 0.3 * Math.sin(Math.PI * p);
          overlay2.push({
            rect: rect(x - 14 * s, y - 20 * s, 28 * s, 40 * s),
            draw: (ctx2) => {
              ctx2.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
              ctx2.translate(x, y);
              ctx2.scale(s, s);
              drawCardFace(ctx2, rect(-14, -20, 28, 40), c.card);
            }
          });
        }
        if (key.startsWith("draw:") && live(key)) {
          const { seat } = A.data(key);
          const to = this.seatRect(m, seat);
          if (!to) continue;
          const p = A.progress(key, now);
          const x = deck.x + (to.x + to.w / 2 - deck.x) * p;
          const y = deck.y + (to.y + to.h / 2 - deck.y) * p - Math.sin(Math.PI * p) * 24;
          overlay2.push({
            rect: rect(x - 9, y - 13, 18, 26),
            draw: (ctx2) => {
              ctx2.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
              drawCardBack(ctx2, rect(x - 9, y - 13, 18, 26));
            }
          });
        }
      }
      const meSeat = m.mySeat;
      return {
        darkness,
        glow: glow2,
        cell: (seat) => {
          var _a2, _b2;
          const alive = (_b2 = (_a2 = m.view.players[seat]) == null ? void 0 : _a2.alive) != null ? _b2 : true;
          const dying = A.running(`dead:${seat}`, now);
          const alphaV = dying ? 1 - 0.6 * A.progress(`dead:${seat}`, now) : alive ? 1 : 0.4;
          const f = A.data(`flip:${seat}`);
          const flip = f && A.running(`flip:${seat}`, now) ? { index: f.index, p: A.progress(`flip:${seat}`, now) } : null;
          return { alpha: alphaV, flip, shake: shakeOf(seat), flash: flashOf(seat), stamp: dying ? A.progress(`dead:${seat}`, now) : 1 };
        },
        me: meSeat === null ? { shake: 0, flash: null } : { shake: shakeOf(meSeat), flash: flashOf(meSeat) },
        cardIn: (id) => A.started(`in:${id}`, now) ? A.progress(`in:${id}`, now) : null,
        deck,
        overlay: overlay2,
        panelSlide: A.progress("panel", now)
      };
    }
    /** 叠在最上层的面板；需要做选择时优先显示选择面板 */
    panels(m, choice) {
      if (choice.length) return choice;
      if (this.askOption) return this.optionSheet(m);
      if (this.priestOpen) return priestPanel(this.ui, m, this.priestPick, () => this.priestOpen = false);
      if (this.detail !== null) return detailPanel(this.ui, m, this.detail, () => this.detail = null);
      if (this.mine) return myTryalsPanel(this.ui, m, () => this.mine = false);
      if (this.logOpen) return logPanel(this.ui, m, this.logBox, () => this.logOpen = false);
      if (this.discardOpen) return discardPanel(this.ui, m, this.discardBox, () => this.discardOpen = false);
      return [];
    }
    /** 某个座位在画面上的位置（我自己是信息栏）；给出牌飞行动画用 */
    seatRect(m, seat) {
      const L = this.layout;
      if (!L) return null;
      if (seat === m.mySeat) return L.me;
      const i = m.others.findIndex((p) => p.seat === seat);
      return i >= 0 ? L.grid[i] : null;
    }
    /** 牌堆数字在画面上的位置（抽牌飞行的起点） */
    deckPoint() {
      var _a;
      const r = (_a = this.layout) == null ? void 0 : _a.top;
      if (!r) return { x: this.ui.screen.W - 80, y: 40 };
      return { x: r.x + r.w - LEAVE_W - 28, y: r.y + r.h / 2 - 7 };
    }
    sync(m) {
      var _a, _b;
      if (this.sel && !playableCardIds(m).includes(this.sel)) this.clearSel();
      if (this.peek && !((_a = m.priv) == null ? void 0 : _a.hand.some((c) => c.id === this.peek))) this.peek = null;
      if (this.priestOpen && !(((_b = m.pending) == null ? void 0 : _b.kind) === "turn" && m.pending.mode === "choose")) this.priestOpen = false;
    }
    clearSel() {
      this.sel = null;
      this.targets = [];
      this.option = void 0;
      this.askOption = false;
    }
    selKind(m) {
      return this.sel ? cardKindOf(m, this.sel) : null;
    }
    topBar(m, r, now) {
      return {
        rect: r,
        draw: (ctx2) => {
          const cy = r.y + r.h / 2;
          drawText(ctx2, phaseTitle(m), r.x, cy, { size: 15, serif: true, color: C.gold, maxWidth: r.w * 0.46 });
          const cd = formatCountdown(m.deadline, now);
          if (cd) drawText(ctx2, cd, r.x + r.w * 0.6, cy, { size: 15, bold: true, color: m.pending ? C.gold : C.text, align: "center" });
          const x = r.x + r.w - LEAVE_W - 8;
          drawText(ctx2, `\u724C\u5806 ${m.view.deckCount}`, x, cy - 7, { size: 10, color: C.textDim, align: "right" });
          drawText(ctx2, `\u5F03\u724C ${m.view.discardCount}`, x, cy + 7, { size: 10, color: C.textDim, align: "right" });
        }
      };
    }
    /** 顶栏右侧「牌堆 / 弃牌」数字的点击区域：打开弃牌堆 */
    discardNode(r) {
      const right = r.x + r.w - LEAVE_W - 8;
      return {
        id: "discard",
        rect: rect(right - 56, r.y, 56, r.h),
        onTap: () => {
          this.discardOpen = true;
          this.discardBox.reset();
        }
      };
    }
    leaveButton(r) {
      const ui2 = this.ui;
      const code = ui2.ctl.code;
      const leave = () => ui2.confirm("\u79BB\u5F00\u724C\u5C40\uFF1F", `\u53EF\u4EE5\u7528\u623F\u53F7 ${code} \u56DE\u6765`, () => void ui2.ctl.leaveRoom());
      const node = button("leave-game", rect(r.x + r.w - LEAVE_W, r.y + 4, LEAVE_W, r.h - 8), "\u79BB\u5F00", leave, "secondary");
      return __spreadProps(__spreadValues({}, node), { rect: rect(r.x + r.w - LEAVE_W - 4, r.y, LEAVE_W + 8, r.h + 4) });
    }
    cell(m, seat, r, a) {
      const p = m.view.players[seat];
      const kind = this.selKind(m);
      const targetable = !!kind && targetOptions(m, kind, this.targets).includes(seat);
      const turn = m.view.phase.kind === "day" && m.turnSeat === seat;
      const opts = __spreadValues({ turn, glow: a.glow, targetable, order: this.targets.indexOf(seat) + 1, partner: isPartner(m, seat) }, a.cell(seat));
      return { id: `seat:${seat}`, rect: r, onTap: () => this.tapSeat(m, seat), draw: (ctx2) => drawCell(ctx2, r, p, opts) };
    }
    tapSeat(m, seat) {
      const kind = this.selKind(m);
      if (!kind) {
        this.detail = seat;
        return;
      }
      if (this.targets.includes(seat)) {
        this.targets = this.targets.filter((t) => t !== seat);
        this.option = void 0;
        return;
      }
      const need = targetCount(kind);
      if (this.targets.length >= need || !targetOptions(m, kind, this.targets).includes(seat)) return;
      this.targets = [...this.targets, seat];
      if (this.targets.length === need) this.resolveOption(m, kind);
    }
    resolveOption(m, kind) {
      const need = optionNeed(m, kind, this.targets[0]);
      if (!need) return;
      if (need.kind === "curse" && need.cards.length === 1) {
        this.option = need.cards[0].id;
        return;
      }
      this.askOption = true;
    }
    ready(m) {
      const kind = this.selKind(m);
      if (!kind || this.targets.length !== targetCount(kind)) return false;
      return !optionNeed(m, kind, this.targets[0]) || this.option !== void 0;
    }
    confirmPlay() {
      if (!this.sel) return;
      const action = __spreadValues({
        type: "play",
        cardId: this.sel,
        targets: this.targets
      }, this.option !== void 0 ? { option: this.option } : {});
      this.clearSel();
      void this.ui.ctl.act(action);
    }
    logNode(m, r) {
      const count = r.h >= 54 ? 3 : 2;
      const lines = logLines(m.view).slice(-count);
      return {
        id: "log",
        rect: r,
        onTap: () => {
          this.logOpen = true;
          this.logBox.reset();
        },
        draw: (ctx2) => {
          drawPanel(ctx2, r, { tier: "big" });
          const lh = (r.h - 8) / count;
          lines.forEach(
            (t, i) => drawText(ctx2, t, r.x + 8, r.y + 4 + lh * (i + 0.5), { size: 11, color: i === lines.length - 1 ? C.text : C.textDim, maxWidth: r.w - 16 })
          );
        }
      };
    }
    meNode(m, r, a) {
      const kind = this.selKind(m);
      const me = m.mySeat;
      const targetable = me !== null && !!kind && targetOptions(m, kind, this.targets).includes(me);
      const order = me === null ? 0 : this.targets.indexOf(me) + 1;
      return {
        id: "me",
        rect: r,
        onTap: () => {
          if (kind && me !== null) this.tapSeat(m, me);
          else if (!kind && m.priv) this.mine = true;
        },
        draw: (ctx2) => drawMeBar(ctx2, r, m, { targetable, order, glow: a.glow, shake: a.me.shake, flash: a.me.flash })
      };
    }
    infoText(m) {
      var _a;
      const kind = this.selKind(m);
      if (kind) {
        const { name, desc } = CARD_INFO[kind];
        const need = targetCount(kind);
        if (this.targets.length < need) return `\u300C${name}\u300D${need === 2 ? TWO_TARGET_HINT[this.targets.length] : "\u9009\u62E9\u76EE\u6807"}\uFF5C${desc}`;
        return `\u300C${name}\u300D${this.ready(m) ? "\u70B9\u300C\u786E\u8BA4\u51FA\u724C\u300D" : "\u8BF7\u9009\u62E9\u9009\u9879"}\uFF5C${desc}`;
      }
      if (this.peek) {
        const k = cardKindOf(m, this.peek);
        if (k) return `${CARD_INFO[k].name}\uFF1A${CARD_INFO[k].desc}`;
      }
      if (m.me && !m.me.alive) return "\u4F60\u5DF2\u51FA\u5C40\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u89C2\u770B";
      if (m.view.phase.kind === "characterPick") {
        const done = m.view.players.filter((p) => p.character).length;
        return `\u7B49\u5F85\u5176\u4ED6\u4EBA\u9009\u62E9\u89D2\u8272\uFF08${done}/${m.view.players.length}\uFF09`;
      }
      if (((_a = m.pending) == null ? void 0 : _a.kind) === "turn") return m.pending.mode === "choose" ? "\u4F60\u7684\u56DE\u5408\uFF1A\u62BD 2 \u5F20\uFF0C\u6216\u70B9\u4E00\u5F20\u624B\u724C\u6253\u51FA" : "\u53EF\u4EE5\u7EE7\u7EED\u51FA\u724C\uFF0C\u6216\u7ED3\u675F\u56DE\u5408";
      if (m.view.phase.kind === "day") return `\u7B49\u5F85 ${m.view.players[m.turnSeat].name} \u884C\u52A8\u2026`;
      return phaseTitle(m);
    }
    infoNode(m, r) {
      const text = this.infoText(m);
      return {
        rect: r,
        draw: (ctx2) => {
          drawPanel(ctx2, r, { tier: "strip" });
          drawText(ctx2, text, r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: C.gold, align: "center", maxWidth: r.w });
        }
      };
    }
    handNodes(m, r, a) {
      var _a, _b;
      const hand = (_b = (_a = m.priv) == null ? void 0 : _a.hand) != null ? _b : [];
      if (!hand.length) {
        return [{ rect: r, draw: (ctx2) => drawText(ctx2, m.priv ? "\u6CA1\u6709\u624B\u724C" : "", r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: C.textMuted, align: "center" }) }];
      }
      const playable = playableCardIds(m);
      const ch = r.h - 12;
      const cw = Math.round(ch * 0.69);
      const n = hand.length;
      const step = n > 1 ? Math.min(cw + 6, (r.w - cw) / (n - 1)) : 0;
      const x0 = r.x + (r.w - (cw + step * (n - 1))) / 2;
      return hand.map((c, i) => {
        var _a2;
        const lifted = c.id === this.sel;
        const p = a.cardIn(c.id);
        const cr = rect(x0 + step * i, r.y + (lifted ? 0 : 12), cw, ch);
        const opts = { selected: lifted, dim: ((_a2 = m.pending) == null ? void 0 : _a2.kind) === "turn" && !playable.includes(c.id) };
        return {
          id: `card:${c.id}`,
          rect: cr,
          onTap: () => this.tapCard(c.id, playable),
          draw: (ctx2) => {
            if (p === null) return;
            if (p >= 1) {
              drawCardFace(ctx2, cr, c.kind, opts);
              return;
            }
            const x = a.deck.x + (cr.x + cw / 2 - a.deck.x) * p;
            const y = a.deck.y + (cr.y + ch / 2 - a.deck.y) * p - Math.sin(Math.PI * p) * 30;
            const s = 0.4 + 0.6 * p;
            const q = Math.min(1, Math.max(0, (p - 0.6) / 0.4));
            const sx = Math.abs(1 - 2 * q);
            ctx2.save();
            ctx2.translate(x, y);
            ctx2.scale(s * Math.max(sx, 0.02), s);
            const local = rect(-cw / 2, -ch / 2, cw, ch);
            if (q < 0.5) drawCardBack(ctx2, local);
            else drawCardFace(ctx2, local, c.kind, opts);
            ctx2.restore();
          }
        };
      });
    }
    tapCard(id, playable) {
      if (playable.includes(id)) {
        if (this.sel === id) this.clearSel();
        else {
          this.clearSel();
          this.sel = id;
          this.peek = null;
        }
        return;
      }
      this.peek = this.peek === id ? null : id;
    }
    buttonNodes(m, r) {
      var _a;
      const ctl2 = this.ui.ctl;
      const busy = ctl2.busy;
      const half = (r.w - 10) / 2;
      if (this.sel) {
        return [
          button("cancel", rect(r.x, r.y, half, r.h), "\u53D6\u6D88", () => this.clearSel(), "secondary"),
          requestButton("confirm-play", rect(r.x + half + 10, r.y, half, r.h), "\u786E\u8BA4\u51FA\u724C", this.ready(m) ? () => this.confirmPlay() : null, busy)
        ];
      }
      if (((_a = m.pending) == null ? void 0 : _a.kind) !== "turn") return [];
      if (m.pending.mode === "choose") {
        const skill = this.skillButton(m, rect(r.x + half + 10, r.y, half, r.h));
        if (!skill) return [requestButton("draw", r, "\u62BD 2 \u5F20", () => void ctl2.act({ type: "draw" }), busy)];
        return [requestButton("draw", rect(r.x, r.y, half, r.h), "\u62BD 2 \u5F20", () => void ctl2.act({ type: "draw" }), busy), skill];
      }
      return [requestButton("end-turn", r, "\u7ED3\u675F\u56DE\u5408", () => void ctl2.act({ type: "endTurn" }), busy, "secondary")];
    }
    /** 回合开始时的技能按钮：牧师从弃牌堆拿牌、说书人调整牌堆；没有可用技能时返回 null */
    skillButton(m, r) {
      var _a;
      const me = m.me;
      const left = (_a = me == null ? void 0 : me.usesLeft) != null ? _a : 0;
      if (!me || left <= 0) return null;
      const busy = this.ui.ctl.busy;
      if (me.ability === "priest") {
        const ok = m.view.discard.some((c) => !isBlack(c.kind));
        const open = () => {
          this.priestOpen = true;
          this.priestPick.length = 0;
        };
        return button("priest", r, `\u4ECE\u5F03\u724C\u5806\u62FF\uFF08\u5269 ${left}\uFF09`, ok && !busy ? open : null, "secondary");
      }
      if (me.ability === "storyteller") {
        return requestButton("story-start", r, `\u8C03\u6574\u724C\u5806\uFF08\u5269 ${left}\uFF09`, () => void this.ui.ctl.act({ type: "storyStart" }), busy, "secondary");
      }
      return null;
    }
    optionSheet(m) {
      const kind = this.selKind(m);
      const target = this.targets[0];
      const need = kind && target !== void 0 ? optionNeed(m, kind, target) : null;
      if (!need) {
        this.askOption = false;
        return [];
      }
      const close = () => {
        this.askOption = false;
        this.targets = this.targets.slice(0, -1);
      };
      const title = need.kind === "curse" ? "\u8BC5\u5492\uFF1A\u4E22\u5F03\u54EA\u5F20\u84DD\u5361\uFF1F" : need.doctor ? "\u8FA9\u62A4\uFF1A\u600E\u4E48\u6253\u51FA\uFF1F" : "\u8FA9\u62A4\uFF1A\u4E22\u5F03\u54EA\u79CD\u7EA2\u5361\uFF1F";
      const { nodes, body } = sheet(this.ui.screen, need.kind === "alibi" && need.doctor ? 340 : 280, title, close);
      const choices = need.kind === "curse" ? need.cards.map((c) => ({ value: c.id, label: CARD_INFO[c.kind].name })) : [...need.doctor ? [DOCTOR_CHOICE] : [], ...ALIBI_CHOICES.filter((c) => need.kinds.includes(c.value))].map((c) => ({ value: c.value, label: c.label }));
      choices.forEach(
        (c, i) => nodes.push(
          button(`option:${c.value}`, rect(body.x, body.y + i * 52, body.w, 44), c.label, () => {
            this.option = c.value;
            this.askOption = false;
          }, "secondary")
        )
      );
      return nodes;
    }
  };

  // src/scenes/root.ts
  var RootScene = class {
    constructor(ui2) {
      __publicField(this, "ui", ui2);
      __publicField(this, "home");
      __publicField(this, "lobby");
      __publicField(this, "result");
      __publicField(this, "table", null);
      __publicField(this, "tableKey", "");
      __publicField(this, "shown", "");
      __publicField(this, "holdKey", "");
      this.home = new HomeScene(ui2);
      this.lobby = new LobbyScene(ui2);
      this.result = new ResultScene(ui2);
    }
    pick(now) {
      const ctl2 = this.ui.ctl;
      if (!ctl2.code) {
        this.table = null;
        this.tableKey = "";
        this.holdKey = "";
        return ["home", this.home.build(now)];
      }
      const room = ctl2.room;
      if (!room) return ["message", this.message(`\u6B63\u5728\u8FDB\u5165\u623F\u95F4 ${ctl2.code}\u2026`, "loading-home")];
      if (!room.view) return room.status === "lobby" ? ["lobby", this.lobby.build(now)] : ["message", this.message("\u623F\u95F4\u5DF2\u5173\u95ED", "closed-home")];
      if (room.view.phase.kind === "ended") {
        const key = `${room.code}:${room.gameId}`;
        const A = this.ui.animator;
        if (this.shown === "table" && this.table && this.holdKey !== key) {
          this.holdKey = key;
          A.start("endHold", now, ANIM_MS.endHold);
        }
        if (this.holdKey === key && this.table && A.running("endHold", now)) return ["table", this.table.build(now)];
        return ["result", this.ended(now)];
      }
      return ["table", this.playing(now)];
    }
    build(now) {
      const [kind, nodes] = this.pick(now);
      const A = this.ui.animator;
      if (kind !== this.shown) {
        this.shown = kind;
        A.start("scene", now, ANIM_MS.scene);
      }
      if (!A.running("scene", now)) return nodes;
      const { W, H } = this.ui.screen;
      const a = 1 - A.progress("scene", now);
      return [
        ...nodes,
        {
          id: "scene-fade",
          rect: rect(0, 0, W, H),
          draw: (ctx2) => {
            ctx2.globalAlpha = a;
            ctx2.fillStyle = C.skyBottom;
            ctx2.fillRect(0, 0, W, H);
          }
        }
      ];
    }
    playing(now) {
      const room = this.ui.ctl.room;
      const key = `${room.code}:${room.gameId}`;
      if (!this.table || key !== this.tableKey) {
        this.table = new TableScene(this.ui);
        this.tableKey = key;
      }
      return this.table.build(now);
    }
    ended(now) {
      return this.result.build(now);
    }
    message(text, id) {
      const { W, H } = this.ui.screen;
      return [
        skyNode(this.ui.screen, 0),
        textNode(rect(0, H * 0.42, W, 30), text, { size: 16, color: C.text, align: "center" }),
        button(id, rect((W - 200) / 2, H * 0.42 + 50, 200, 44), "\u8FD4\u56DE\u9996\u9875", () => this.ui.ctl.backHome(), "secondary")
      ];
    }
  };

  // src/main.ts
  wx.cloud.init({ traceUser: true });
  var { ctx, screen, dpr } = createPlatform();
  setSurfaceFactory(wxSurfaces, dpr);
  var app = new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now(), drawPressShade);
  bindTouches(app);
  var store = new LocalStore(wx);
  var db = wx.cloud.database();
  var ctl = new Controller({
    api: new Api(wx.cloud),
    store,
    openSession: (code, openid, onChange) => new RoomSession(db, code, openid, realTimers, onChange),
    makeTicker: (tick) => new Ticker({ now: () => Date.now(), random: Math.random, timers: realTimers, tick }),
    toast: (msg) => wx.showToast({ title: msg, icon: "none", duration: 2e3 }),
    render: () => app.render()
  });
  var ui = {
    screen,
    animator: app.animator,
    ctl,
    render: () => app.render(),
    prompt: (title, placeholder, cb, cancellable = true) => wx.showModal({
      title,
      editable: true,
      placeholderText: placeholder,
      showCancel: cancellable,
      success: (r) => {
        var _a;
        if (r.confirm) cb(((_a = r.content) != null ? _a : "").trim());
      }
    }),
    confirm: (title, content, cb) => wx.showModal({
      title,
      content,
      success: (r) => {
        if (r.confirm) cb();
      }
    }),
    copy: (text) => wx.setClipboardData({ data: text }),
    share: (title, query) => wx.shareAppMessage({ title, query })
  };
  app.setScene(new RootScene(ui));
  wx.showShareMenu({ menus: ["shareAppMessage"] });
  wx.onShareAppMessage(
    () => ctl.code ? { title: `\u5973\u5DEB\u9547 \xB7 \u623F\u95F4 ${ctl.code}`, query: `room=${ctl.code}` } : { title: "\u4E00\u8D77\u6765\u73A9\u5973\u5DEB\u9547" }
  );
  setInterval(() => {
    var _a;
    if (((_a = ctl.room) == null ? void 0 : _a.status) === "playing") app.render();
  }, 1e3);
  function roomFrom(o) {
    var _a;
    const r = (_a = o.query) == null ? void 0 : _a.room;
    return r && /^\d{4}$/.test(r) ? r : null;
  }
  function ensureNickname(then) {
    if (ctl.nickname) {
      then();
      return;
    }
    askNickname("\u7ED9\u81EA\u5DF1\u8D77\u4E2A\u6635\u79F0", then);
  }
  function askNickname(title, then) {
    ui.prompt(title, "1\u201312 \u4E2A\u5B57\uFF0C\u670B\u53CB\u4F1A\u770B\u5230", (name) => ctl.setNickname(name) ? then() : askNickname("\u6635\u79F0\u9700\u8981 1\u201312 \u4E2A\u5B57", then), false);
  }
  ensureNickname(() => {
    const fromShare = roomFrom(wx.getLaunchOptionsSync());
    if (fromShare) {
      void ctl.joinRoom(fromShare);
      return;
    }
    const last = store.lastRoom();
    if (!last) return;
    const stale = () => ctl.code !== null || store.lastRoom() !== last;
    void rejoinable(db, last).then((ok) => {
      if (stale()) return;
      if (!ok) {
        store.clearLastRoom();
        return;
      }
      wx.showModal({
        title: "\u56DE\u5230\u623F\u95F4\uFF1F",
        content: `\u4E0A\u6B21\u4F60\u5728\u623F\u95F4 ${last}\uFF0C\u8981\u56DE\u53BB\u5417\uFF1F`,
        success: (r) => {
          if (stale()) return;
          if (r.confirm) void ctl.joinRoom(last);
          else store.clearLastRoom();
        }
      });
    });
  });
  wx.onShow((o) => {
    ctl.onShow();
    const code = roomFrom(o);
    if (code && code !== ctl.code && ctl.nickname) void ctl.joinRoom(code);
  });
})();
