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
  function drawNodes(ctx2, nodes) {
    var _a;
    for (const n of nodes) {
      ctx2.save();
      if (n.clip) {
        ctx2.beginPath();
        ctx2.rect(n.rect.x, n.rect.y, n.rect.w, n.rect.h);
        ctx2.clip();
      }
      (_a = n.draw) == null ? void 0 : _a.call(n, ctx2);
      if (n.children) drawNodes(ctx2, n.children);
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
    data(key) {
      var _a;
      return (_a = this.items.get(key)) == null ? void 0 : _a.data;
    }
    running(key, now) {
      const it = this.items.get(key);
      return !!it && now < it.start + it.dur;
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
    constructor(ctx2, screen2, raf, clock) {
      __publicField(this, "ctx", ctx2);
      __publicField(this, "screen", screen2);
      __publicField(this, "raf", raf);
      __publicField(this, "clock", clock);
      __publicField(this, "animator", new Animator());
      __publicField(this, "scene", null);
      __publicField(this, "nodes", []);
      __publicField(this, "scheduled", false);
      __publicField(this, "touch", null);
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
      if (!this.scene) return;
      const now = this.clock();
      this.nodes = this.scene.build(now);
      this.ctx.clearRect(0, 0, this.screen.W, this.screen.H);
      drawNodes(this.ctx, this.nodes);
      if (this.animator.active(now)) this.render();
    }
    get current() {
      return this.nodes;
    }
    touchStart(x, y) {
      this.touch = { x0: x, y0: y, lastY: y, moved: false, scroll: hitTest(this.nodes, x, y, "onScroll") };
    }
    touchMove(x, y) {
      const t = this.touch;
      if (!t) return;
      if (!t.moved && Math.abs(x - t.x0) + Math.abs(y - t.y0) > 8) t.moved = true;
      if (t.moved && t.scroll) {
        t.scroll.onScroll(y - t.lastY);
        this.render();
      }
      t.lastY = y;
    }
    touchEnd(x, y) {
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
      if (r) this.enter(r.code, r.openid);
    }
    async joinRoom(code) {
      if (!/^\d{4}$/.test(code)) {
        this.d.toast("\u8BF7\u8F93\u5165 4 \u4F4D\u623F\u95F4\u53F7");
        return;
      }
      const r = await this.run({ type: "joinRoom", code, profile: this.profile() });
      if (r) this.enter(r.code, r.openid);
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
        if (LEAVE_ERRORS.includes(res.error) && this.code) this.backHome();
        return null;
      } finally {
        this.busy = false;
        this.d.render();
      }
    }
  };

  // src/net/api.ts
  var NETWORK_ERROR = "\u7F51\u7EDC\u4E0D\u7A33\u5B9A\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5";
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
      const [room, hand] = await Promise.all([
        this.getDoc("rooms", this.code),
        this.getDoc("hands", `${this.code}_${this.openid}`)
      ]);
      if (this.stopped) return;
      if (room !== void 0) this.room = room;
      if (hand !== void 0) this.hand = hand;
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
            this.room = (_a = snap.docs[0]) != null ? _a : null;
            this.ok();
          },
          onError
        }),
        this.db.collection("hands").where({ _openid: "{openid}", roomId: this.code }).watch({
          onChange: (snap) => {
            var _a;
            if (gen !== this.gen) return;
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
    const dpr = info.pixelRatio || 2;
    canvas.width = info.windowWidth * dpr;
    canvas.height = info.windowHeight * dpr;
    const ctx2 = canvas.getContext("2d");
    ctx2.scale(dpr, dpr);
    let top = 64;
    try {
      top = wx.getMenuButtonBoundingClientRect().bottom + 8;
    } catch (e) {
    }
    const bottom = info.safeArea ? Math.min(info.safeArea.bottom, info.windowHeight) : info.windowHeight;
    return { ctx: ctx2, screen: { W: info.windowWidth, H: info.windowHeight, top, bottom } };
  }
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
    panel: "rgba(255,255,255,0.05)",
    panelSolid: "#221833",
    panelLine: "#4a3a6c",
    logBg: "rgba(0,0,0,0.35)",
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
    buttonFill: "rgba(0,0,0,0.25)",
    glowStrong: "rgba(232,199,116,0.9)",
    lineDark: "#3b2d57"
  };
  var nightShade = (alpha) => `rgba(4,2,10,${alpha})`;
  var goldGlow = (alpha) => `rgba(232,199,116,${alpha})`;
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

  // src/model/rules.ts
  var cardsOf = (color) => Object.values(CARD_INFO).filter((c) => c.color === color).map((c) => `${c.name}\uFF1A${c.desc}`);
  var RULES = [
    {
      title: "\u80DC\u8D1F",
      items: ["\u6240\u6709\u5973\u5DEB\u5361\u90FD\u88AB\u7FFB\u5F00\uFF1A\u6751\u6C11\u80DC\u5229\u3002", "\u6D3B\u7740\u7684\u73A9\u5BB6\u5168\u90FD\u662F\u5973\u5DEB\u9635\u8425\uFF1A\u5973\u5DEB\u80DC\u5229\u3002"]
    },
    {
      title: "\u8EAB\u4EFD\u5361",
      items: [
        "\u6BCF\u4EBA 5 \u5F20\uFF0C\u53EA\u6709\u81EA\u5DF1\u77E5\u9053\u5185\u5BB9\u30024\u20135 \u4EBA 1 \u5F20\u5973\u5DEB\u5361\uFF0C6 \u4EBA\u4EE5\u4E0A 2 \u5F20\uFF1B\u8B66\u957F 1 \u5F20\uFF0C\u5176\u4F59\u662F\u6751\u6C11\u3002",
        "\u7FFB\u51FA\u5973\u5DEB\u5361\uFF0C\u6216 5 \u5F20\u5168\u90E8\u7FFB\u5F00\uFF0C\u7ACB\u5373\u6B7B\u4EA1\u3002",
        "\u5F00\u5C40\u6301\u6709\u5973\u5DEB\u5361\u7684\u4EBA\u5C5E\u4E8E\u5973\u5DEB\u9635\u8425\uFF1B\u4E4B\u540E\u901A\u8FC7\u4F20\u67D3\u62FF\u5230\u5973\u5DEB\u5361\u7684\u4EBA\u4E5F\u52A0\u5165\u5973\u5DEB\u9635\u8425\uFF0C\u9635\u8425\u4E0D\u4F1A\u518D\u53D8\u3002"
      ]
    },
    {
      title: "\u56DE\u5408",
      items: ["\u8F6E\u5230\u4F60\u65F6\u4E8C\u9009\u4E00\uFF1A\u62BD 2 \u5F20\u724C\uFF0C\u6216\u6253\u51FA\u4EFB\u610F\u5F20\u7EA2 / \u84DD / \u7EFF\u5361\u3002", "\u7EA2\u5361\u4E0D\u80FD\u6253\u7ED9\u81EA\u5DF1\uFF0C\u84DD\u5361\u548C\u7EFF\u5361\u53EF\u4EE5\u3002"]
    },
    {
      title: "\u5BA1\u5224",
      items: [
        "\u9762\u524D\u7EA2\u5361\u70B9\u6570\u8FBE\u5230 7 \u70B9\u7ACB\u5373\u53D7\u5BA1\uFF0C\u7531\u53D7\u5BA1\u8005\u81EA\u5DF1\u7FFB\u5F00\u4E00\u5F20\u8EAB\u4EFD\u5361\u3002",
        "\u5BA1\u5224\u7ED3\u675F\u540E\uFF0C\u4E22\u5F03\u53D7\u5BA1\u8005\u9762\u524D\u6240\u6709\u7EA2\u5361\u3002"
      ]
    },
    {
      title: "\u591C\u665A",
      items: [
        "\u5973\u5DEB\u9635\u8425\u4E00\u8D77\u9009\u4E00\u540D\u73A9\u5BB6\u51FB\u6740\uFF1B\u8B66\u957F\u4FDD\u62A4\u4E00\u540D\u5176\u4ED6\u73A9\u5BB6\uFF1B\u6240\u6709\u4EBA\u90FD\u53EF\u4EE5\u81EA\u9996\uFF08\u7FFB\u5F00\u4E00\u5F20\u81EA\u5DF1\u7684\u8EAB\u4EFD\u5361\uFF09\uFF0C\u81EA\u9996\u7684\u4EBA\u5F53\u665A\u4E0D\u4F1A\u88AB\u6740\u3002",
        "\u88AB\u9009\u4E2D\u7684\u4EBA\u6CA1\u6709\u88AB\u4FDD\u62A4\u3001\u6CA1\u6709\u907F\u96BE\u3001\u4E5F\u6CA1\u6709\u81EA\u9996\u65F6\u6B7B\u4EA1\u3002"
      ]
    },
    {
      title: "\u4F20\u67D3",
      items: ["\u9ED1\u732B\u6301\u6709\u8005\u5148\u7FFB\u5F00\u4E00\u5F20\u8EAB\u4EFD\u5361\uFF1B\u7136\u540E\u6BCF\u4E2A\u6D3B\u7740\u7684\u4EBA\u4ECE\u5DE6\u8FB9\u73A9\u5BB6\u7684\u672A\u7FFB\u5F00\u8EAB\u4EFD\u5361\u91CC\u76F2\u62BD\u4E00\u5F20\u3002"]
    },
    { title: "\u7EA2\u5361", items: cardsOf("red") },
    { title: "\u84DD\u5361\uFF08\u7559\u5728\u9762\u524D\u6301\u7EED\u751F\u6548\uFF09", items: cardsOf("blue") },
    { title: "\u7EFF\u5361\uFF08\u4E00\u6B21\u6027\uFF09", items: cardsOf("green") },
    { title: "\u9ED1\u5361\uFF08\u62BD\u5230\u7ACB\u5373\u7ED3\u7B97\uFF09", items: cardsOf("black") }
  ];

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

  // src/theme/draw.ts
  function roundRect(ctx2, r, radius) {
    const rr = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
    ctx2.beginPath();
    ctx2.moveTo(r.x + rr, r.y);
    ctx2.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr);
    ctx2.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr);
    ctx2.arcTo(r.x, r.y + r.h, r.x, r.y, rr);
    ctx2.arcTo(r.x, r.y, r.x + r.w, r.y, rr);
    ctx2.closePath();
  }
  function drawText(ctx2, text, x, y, o = {}) {
    var _a, _b, _c, _d;
    ctx2.font = font((_a = o.size) != null ? _a : 14, o.bold);
    ctx2.fillStyle = (_b = o.color) != null ? _b : C.text;
    ctx2.textAlign = (_c = o.align) != null ? _c : "left";
    ctx2.textBaseline = (_d = o.baseline) != null ? _d : "middle";
    const t = o.maxWidth ? ellipsize(text, o.maxWidth, (s) => ctx2.measureText(s).width) : text;
    ctx2.fillText(t, x, y);
  }
  function drawSky(ctx2, W, H, darkness) {
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.skyTop);
    g.addColorStop(0.55, C.skyMid);
    g.addColorStop(1, C.skyBottom);
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, W, H);
    ctx2.fillStyle = C.star;
    for (let i = 0; i < 40; i++) {
      ctx2.globalAlpha = 0.25 + i % 5 * 0.1;
      ctx2.fillRect((i * 97 + 13) % W, (i * 57 + 7) % (H * 0.5), 1.5, 1.5);
    }
    ctx2.globalAlpha = 0.85;
    ctx2.fillStyle = C.moon;
    ctx2.beginPath();
    ctx2.arc(W - 60, H * 0.16, 22, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = 1;
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(W - 51, H * 0.16 - 7, 20, 0, Math.PI * 2);
    ctx2.fill();
    if (darkness > 0) {
      ctx2.fillStyle = nightShade(0.55 * darkness);
      ctx2.fillRect(0, 0, W, H);
    }
  }
  function drawPanel(ctx2, r, o = {}) {
    var _a, _b, _c, _d;
    roundRect(ctx2, r, (_a = o.radius) != null ? _a : 8);
    if (o.glow) {
      ctx2.shadowColor = goldGlow(o.glow);
      ctx2.shadowBlur = 12;
    }
    ctx2.fillStyle = (_b = o.fill) != null ? _b : C.panel;
    ctx2.fill();
    ctx2.shadowBlur = 0;
    ctx2.lineWidth = (_c = o.lineWidth) != null ? _c : 1;
    ctx2.strokeStyle = (_d = o.stroke) != null ? _d : C.panelLine;
    ctx2.stroke();
  }
  function drawButton(ctx2, r, label, style) {
    if (style === "primary") {
      const g = ctx2.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, C.gold);
      g.addColorStop(1, C.goldDark);
      roundRect(ctx2, r, 10);
      ctx2.fillStyle = g;
      ctx2.fill();
    } else {
      drawPanel(ctx2, r, {
        radius: 10,
        fill: style === "danger" ? C.buttonDangerFill : C.buttonFill,
        stroke: style === "disabled" ? C.panelLine : style === "danger" ? C.danger : C.gold
      });
    }
    const color = style === "primary" ? C.skyMid : style === "disabled" ? C.textMuted : style === "danger" ? C.danger : C.gold;
    drawText(ctx2, label, r.x + r.w / 2, r.y + r.h / 2, { size: 15, bold: true, color, align: "center", maxWidth: r.w - 8 });
  }
  function drawBadge(ctx2, cx, cy, radius, name, seat) {
    var _a;
    ctx2.beginPath();
    ctx2.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx2.fillStyle = badgeColor(seat);
    ctx2.fill();
    ctx2.lineWidth = 1.5;
    ctx2.strokeStyle = C.badgeRing;
    ctx2.stroke();
    drawText(ctx2, (_a = [...name][0]) != null ? _a : "?", cx, cy + 1, { size: Math.round(radius * 1.05), bold: true, color: C.badgeText, align: "center" });
  }
  function drawCardFace(ctx2, r, kind, o = {}) {
    const info = CARD_INFO[kind];
    const [a, b] = CARD_GRADIENT[info.color];
    const g = ctx2.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    if (o.dim) ctx2.globalAlpha = 0.55;
    roundRect(ctx2, r, 7);
    if (o.selected) {
      ctx2.shadowColor = C.glowStrong;
      ctx2.shadowBlur = 14;
    }
    ctx2.fillStyle = g;
    ctx2.fill();
    ctx2.shadowBlur = 0;
    ctx2.lineWidth = o.selected ? 2 : 1;
    ctx2.strokeStyle = C.goldLine;
    ctx2.stroke();
    drawText(ctx2, info.name, r.x + r.w / 2, r.y + 16, { size: 14, bold: true, color: C.cardText, align: "center" });
    ctx2.font = font(9);
    const lines = wrapText(info.desc, r.w - 8, (s) => ctx2.measureText(s).width).slice(0, 4);
    lines.forEach((line, i) => drawText(ctx2, line, r.x + r.w / 2, r.y + 34 + i * 12, { size: 9, color: C.cardText, align: "center" }));
    ctx2.globalAlpha = 1;
  }
  function drawTryalChip(ctx2, r, kind, revealed, scaleX = 1) {
    const w = r.w * Math.max(0.05, scaleX);
    const x = r.x + (r.w - w) / 2;
    const fill = !revealed || !kind ? C.tryalHidden : kind === "witch" ? C.witch : kind === "constable" ? C.constable : C.villager;
    roundRect(ctx2, { x, y: r.y, w, h: r.h }, 2);
    ctx2.fillStyle = fill;
    ctx2.fill();
    ctx2.lineWidth = 1;
    ctx2.strokeStyle = revealed ? C.chipRevealedLine : C.goldDark;
    ctx2.stroke();
    if (revealed && kind && scaleX > 0.6) {
      drawText(ctx2, TRYAL_SHORT[kind], r.x + r.w / 2, r.y + r.h / 2 + 0.5, { size: Math.max(8, r.h - 4), color: C.badgeText, align: "center" });
    }
  }

  // src/scenes/widgets.ts
  function button(id, r, label, onTap, style = "primary") {
    return {
      id,
      rect: r,
      onTap: onTap != null ? onTap : void 0,
      draw: (ctx2) => drawButton(ctx2, r, label, onTap ? style : "disabled")
    };
  }
  function textNode(r, text, o = {}) {
    var _a;
    const align = (_a = o.align) != null ? _a : "left";
    const x = align === "center" ? r.x + r.w / 2 : align === "right" ? r.x + r.w : r.x;
    return { rect: r, draw: (ctx2) => drawText(ctx2, text, x, r.y + r.h / 2, __spreadValues({ maxWidth: r.w }, o)) };
  }
  function skyNode(screen2, darkness) {
    return { rect: rect(0, 0, screen2.W, screen2.H), draw: (ctx2) => drawSky(ctx2, screen2.W, screen2.H, darkness) };
  }
  function overlay(screen2, onTap) {
    return {
      id: "overlay",
      rect: rect(0, 0, screen2.W, screen2.H),
      onTap: onTap != null ? onTap : (() => {
      }),
      draw: (ctx2) => {
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
      overlay(screen2, onClose != null ? onClose : void 0),
      {
        id: "sheet",
        rect: panel,
        onTap: () => {
        },
        draw: (ctx2) => {
          drawPanel(ctx2, panel, { fill: C.panelSolid, stroke: C.goldLine, radius: 16 });
          drawText(ctx2, title, 20, y + 26, { size: 17, bold: true, color: C.gold, maxWidth: screen2.W - 120 });
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
            ctx2.font = font(size, l.bold);
            for (const t of wrapText(l.text, r.w - 8, (s) => ctx2.measureText(s).width)) {
              drawText(ctx2, t, r.x + 4, y + size / 2, { size, color: l.color, bold: l.bold });
              y += size + 6;
            }
            y += (_b = l.gap) != null ? _b : 0;
          }
          this.contentH = y - this.offset - start;
        }
      };
    }
  };

  // src/scenes/home.ts
  var RULE_LINES = RULES.flatMap((s) => [
    { text: s.title, size: 15, bold: true, color: C.gold, gap: 2 },
    ...s.items.map((t, i) => ({ text: `\xB7 ${t}`, size: 13, gap: i === s.items.length - 1 ? 10 : 0 }))
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
      const nodes = [skyNode(this.ui.screen, 0)];
      const titleY = top + H * 0.14;
      nodes.push({
        rect: rect(0, titleY - 30, W, 100),
        draw: (ctx2) => {
          drawText(ctx2, "\u5973\u5DEB\u9547", W / 2, titleY, { size: 46, bold: true, color: C.gold, align: "center" });
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
        button("join", rect(bx, y, bw, 54), "\u8F93\u5165\u623F\u53F7\u52A0\u5165", busy ? null : () => this.ui.prompt("\u8F93\u5165\u623F\u95F4\u53F7", "4 \u4F4D\u6570\u5B57", (code) => void ctl2.joinRoom(code))),
        button("create", rect(bx, y + 70, bw, 48), "\u521B\u5EFA\u623F\u95F4", busy ? null : () => void ctl2.createRoom(), "secondary"),
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
      const nodes = [skyNode(this.ui.screen, 0)];
      nodes.push({
        rect: rect(0, top, W, 90),
        draw: (ctx2) => {
          drawText(ctx2, "\u623F\u95F4\u53F7", W / 2, top + 12, { size: 13, color: C.textDim, align: "center" });
          drawText(ctx2, room.code, W / 2, top + 54, { size: 46, bold: true, color: C.gold, align: "center" });
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
          button("leave", rect(12, rowY, half, 40), "\u79BB\u5F00", busy ? null : leave, "danger"),
          button("add-bot", rect(12 + half + 10, rowY, half, 40), "\u52A0\u673A\u5668\u4EBA", busy || seats.length >= MAX ? null : () => void ctl2.addBot(), "secondary"),
          button("start", rect(12, startY, W - 24, 48), `\u5F00\u59CB\u6E38\u620F\uFF08${seats.length}/${MAX}\uFF09`, busy || seats.length < MIN ? null : () => void ctl2.startGame())
        );
      } else {
        nodes.push(
          button("leave", rect(12, rowY, W - 24, 40), "\u79BB\u5F00", busy ? null : leave, "danger"),
          textNode(rect(12, startY, W - 24, 48), `\u7B49\u5F85\u623F\u4E3B\u5F00\u59CB\u2026\uFF08${seats.length}/${MAX}\uFF09`, { size: 14, color: C.textDim, align: "center" })
        );
      }
      return nodes;
    }
  };

  // ../engine/src/cards.ts
  var isRed = (k) => k === "accusation" || k === "evidence" || k === "witness";
  var isBlack = (k) => k === "night" || k === "conspiracy";

  // ../engine/src/play.ts
  function targetCount(kind) {
    return kind === "scapegoat" || kind === "robbery" ? 2 : 1;
  }

  // src/model/actions.ts
  var ALIBI_CHOICES = [
    { value: "accusation", label: "\u4E22\u5F03\u6700\u591A 3 \u5F20\u6307\u63A7" },
    { value: "evidence", label: "\u4E22\u5F03 1 \u5F20\u8BC1\u636E" }
  ];
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
    const p = m.view.players[target];
    if (!p) return null;
    if (kind === "curse") return { kind: "curse", cards: p.blue };
    if (kind === "alibi") {
      const acc = p.red.some((c) => c.kind === "accusation");
      const evi = p.red.some((c) => c.kind === "evidence");
      return acc && evi ? { kind: "alibi" } : null;
    }
    return null;
  }

  // src/model/log.ts
  var REVEAL_CAUSE = { trial: "\u5BA1\u5224", cat: "\u9ED1\u732B", confess: "\u81EA\u9996", death: "\u6B7B\u4EA1" };
  var DEATH_CAUSE = {
    night: "\u591C\u91CC\u88AB\u5973\u5DEB\u6740\u6B7B",
    witchRevealed: "\u7FFB\u51FA\u4E86\u5973\u5DEB\u5361",
    allRevealed: "\u8EAB\u4EFD\u5361\u5168\u90E8\u7FFB\u5F00",
    lover: "\u60C5\u4FA3\u6B89\u60C5"
  };
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
  function nameOf(m, seat) {
    var _a, _b;
    return seat === m.mySeat ? "\u4F60" : (_b = (_a = m.view.players[seat]) == null ? void 0 : _a.name) != null ? _b : "";
  }
  function phaseTitle(m) {
    const ph = m.view.phase;
    switch (ph.kind) {
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

  // src/scenes/infoPanels.ts
  function countNames(names) {
    var _a;
    const counts = /* @__PURE__ */ new Map();
    for (const n of names) counts.set(n, ((_a = counts.get(n)) != null ? _a : 0) + 1);
    return [...counts].map(([n, k]) => k > 1 ? `${n}\xD7${k}` : n).join("\u3001");
  }
  function detailPanel(ui2, m, seat, close) {
    const p = m.view.players[seat];
    const { nodes, body } = sheet(ui2.screen, 330, `${p.name}${seat === m.mySeat ? "\uFF08\u4F60\uFF09" : ""}${p.alive ? "" : "\uFF08\u5DF2\u51FA\u5C40\uFF09"}`, close);
    const revealed = p.tryals.filter((t) => t.revealed && t.kind).map((t) => TRYAL_NAME[t.kind]);
    const reds = countNames(p.red.map((c) => CARD_INFO[c.kind].name));
    const lines = [
      ...p.character ? [`\u89D2\u8272\uFF1A${p.character}`] : [],
      `\u6307\u63A7\uFF1A${p.redTotal} / ${p.threshold}${reds ? `\uFF08${reds}\uFF09` : ""}`,
      `\u84DD\u5361\uFF1A${p.blue.length ? countNames(p.blue.map((c) => CARD_INFO[c.kind].name)) : "\u65E0"}`,
      ...p.green.length ? [`\u9762\u524D\uFF1A${countNames(p.green.map((c) => CARD_INFO[c.kind].name))}`] : [],
      `\u624B\u724C\uFF1A${p.handCount} \u5F20`,
      `\u8EAB\u4EFD\u5361\uFF1A${p.tryals.length - revealed.length} \u5F20\u672A\u7FFB\u5F00${revealed.length ? `\uFF1B\u5DF2\u7FFB\u5F00 ${revealed.join("\u3001")}` : ""}`
    ];
    nodes.push({
      id: "detail-body",
      rect: body,
      draw: (ctx2) => lines.forEach((t, i) => drawText(ctx2, t, body.x, body.y + 12 + i * 28, { size: 14, maxWidth: body.w }))
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

  // src/scenes/tableLayout.ts
  var PAD = 12;
  var COLS = 4;
  var GAP = 6;
  function tableLayout(screen2, others) {
    const W = screen2.W;
    const small = screen2.bottom - screen2.top < 560;
    const top = rect(PAD, screen2.top, W - 2 * PAD, 32);
    const btnH = small ? 40 : 44;
    const buttons = rect(PAD, screen2.bottom - 10 - btnH, W - 2 * PAD, btnH);
    const handH = small ? 76 : 96;
    const hand = rect(PAD, buttons.y - 6 - handH, W - 2 * PAD, handH);
    const info = rect(PAD, hand.y - 20, W - 2 * PAD, 18);
    const meH = small ? 34 : 40;
    const me = rect(PAD, info.y - 4 - meH, W - 2 * PAD, meH);
    const logH = small ? 40 : 58;
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
  function tryalRow(ctx2, p, cx, y, h, flip) {
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
    const ratio = Math.min(1, p.redTotal / Math.max(1, p.threshold));
    if (ratio > 0) {
      roundRect(ctx2, __spreadProps(__spreadValues({}, bar), { w: w * ratio }), 2);
      ctx2.fillStyle = C.danger;
      ctx2.fill();
    }
  }
  function frontMarks(p) {
    return [...p.blue, ...p.green].map((c) => CARD_INFO[c.kind].name[0]).join("");
  }
  function drawCell(ctx2, r, p, o) {
    ctx2.globalAlpha = o.alpha;
    drawPanel(ctx2, r, {
      fill: o.targetable ? goldGlow(0.14) : C.panel,
      stroke: o.turn || o.targetable || o.order ? C.gold : C.panelLine,
      glow: o.turn ? o.glow : 0,
      lineWidth: o.order ? 2 : 1
    });
    const cx = r.x + r.w / 2;
    if (r.h >= 70) {
      drawBadge(ctx2, cx, r.y + 17, 12, p.name, p.seat);
      drawText(ctx2, p.name, cx, r.y + 38, { size: 11, align: "center", maxWidth: r.w - 6 });
      redBar(ctx2, p, r.x + 6, r.y + 47, r.w - 12);
      tryalRow(ctx2, p, cx, r.y + 55, 11, o.flip);
      if (r.h >= 80) {
        drawText(ctx2, `\u624B${p.handCount}`, r.x + 6, r.y + r.h - 9, { size: 10, color: C.textDim });
        drawText(ctx2, frontMarks(p), r.x + r.w - 6, r.y + r.h - 9, { size: 10, color: C.gold, align: "right", maxWidth: r.w - 34 });
      }
    } else {
      drawBadge(ctx2, r.x + 13, r.y + 13, 9, p.name, p.seat);
      drawText(ctx2, p.name, r.x + 26, r.y + 13, { size: 11, maxWidth: r.w - 30 });
      redBar(ctx2, p, r.x + 5, r.y + 27, r.w - 10);
      tryalRow(ctx2, p, cx, r.y + 34, 10, o.flip);
    }
    if (!p.alive) drawText(ctx2, "\u51FA\u5C40", cx, r.y + r.h / 2, { size: 13, bold: true, color: C.badgeText, align: "center" });
    if (o.order) drawText(ctx2, o.order === 1 ? "\u2460" : "\u2461", r.x + r.w - 9, r.y + 10, { size: 12, bold: true, color: C.gold, align: "center" });
    ctx2.globalAlpha = 1;
  }
  function drawMeBar(ctx2, r, m, o) {
    drawPanel(ctx2, r, {
      fill: o.targetable ? goldGlow(0.14) : C.panel,
      stroke: o.targetable || o.order || m.isMyTurn ? C.gold : C.panelLine,
      glow: m.isMyTurn ? o.glow : 0,
      lineWidth: o.order ? 2 : 1
    });
    const me = m.me;
    const cy = r.y + r.h / 2;
    if (!me) {
      drawText(ctx2, "\u4F60\u5728\u89C2\u6218", r.x + 12, cy, { size: 13, color: C.textDim });
      return;
    }
    drawBadge(ctx2, r.x + 20, cy, Math.min(13, r.h / 2 - 3), me.name, me.seat);
    const status = me.alive ? `\u6307\u63A7 ${me.redTotal}/${me.threshold} \xB7 \u624B\u724C ${me.handCount}` : "\u4F60\u5DF2\u51FA\u5C40";
    drawText(ctx2, `\u4F60\uFF08${me.name}\uFF09  ${status}`, r.x + 40, cy, { size: 12, maxWidth: r.w - 130 });
    drawText(ctx2, "\u6211\u7684\u8EAB\u4EFD\u5361 \u203A", r.x + r.w - 10, cy, { size: 12, color: C.gold, align: "right" });
    if (o.order) drawText(ctx2, o.order === 1 ? "\u2460" : "\u2461", r.x + r.w - 96, cy, { size: 12, bold: true, color: C.gold, align: "center" });
  }

  // src/scenes/table.ts
  var TWO_TARGET_HINT = ["\u5148\u9009\u88AB\u62FF\u8D70\u7684\u4EBA", "\u518D\u9009\u63A5\u6536\u7684\u4EBA"];
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
      __publicField(this, "layout", null);
    }
    build(now) {
      const ctl2 = this.ui.ctl;
      const room = ctl2.room;
      if (!room || !ctl2.openid) return [];
      const m = buildTable(room, ctl2.hand, ctl2.openid);
      if (!m) return [];
      this.sync(m);
      const L = tableLayout(this.ui.screen, m.others.length);
      this.layout = L;
      const a = this.anim(m, now);
      const nodes = [skyNode(this.ui.screen, a.darkness)];
      nodes.push(this.topBar(m, L.top, now));
      m.others.forEach((p, i) => nodes.push(this.cell(m, p.seat, L.grid[i], a)));
      nodes.push(this.logNode(m, L.log), this.meNode(m, L.me, a), this.infoNode(m, L.info));
      nodes.push(...this.handNodes(m, L.hand, a), ...this.buttonNodes(m, L.buttons));
      nodes.push(...a.overlay);
      nodes.push(...this.panels(m, now, a));
      return nodes;
    }
    /** 动效钩子（Task 9 覆盖为真正的动画） */
    anim(m, _now) {
      return {
        darkness: m.view.phase.kind === "night" ? 1 : 0,
        glow: 0.6,
        cell: (seat) => {
          var _a;
          return { alpha: ((_a = m.view.players[seat]) == null ? void 0 : _a.alive) ? 1 : 0.4, flip: null };
        },
        cardIn: () => 1,
        overlay: [],
        panelSlide: 1
      };
    }
    /** 叠在最上层的面板；Task 8 在这里加入选择面板 */
    panels(m, _now, _a) {
      if (this.askOption) return this.optionSheet(m);
      if (this.detail !== null) return detailPanel(this.ui, m, this.detail, () => this.detail = null);
      if (this.mine) return myTryalsPanel(this.ui, m, () => this.mine = false);
      if (this.logOpen) return logPanel(this.ui, m, this.logBox, () => this.logOpen = false);
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
    sync(m) {
      var _a;
      if (this.sel && !playableCardIds(m).includes(this.sel)) this.clearSel();
      if (this.peek && !((_a = m.priv) == null ? void 0 : _a.hand.some((c) => c.id === this.peek))) this.peek = null;
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
          drawText(ctx2, phaseTitle(m), r.x, cy, { size: 15, bold: true, color: C.gold, maxWidth: r.w * 0.46 });
          const cd = formatCountdown(m.deadline, now);
          if (cd) drawText(ctx2, cd, r.x + r.w * 0.6, cy, { size: 15, bold: true, color: m.pending ? C.gold : C.text, align: "center" });
          drawText(ctx2, `\u724C\u5806 ${m.view.deckCount} \xB7 \u5F03 ${m.view.discardCount}`, r.x + r.w, cy, { size: 11, color: C.textDim, align: "right" });
        }
      };
    }
    cell(m, seat, r, a) {
      const p = m.view.players[seat];
      const kind = this.selKind(m);
      const targetable = !!kind && targetOptions(m, kind, this.targets).includes(seat);
      const turn = m.view.phase.kind === "day" && m.turnSeat === seat;
      const opts = __spreadValues({ turn, glow: a.glow, targetable, order: this.targets.indexOf(seat) + 1 }, a.cell(seat));
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
          drawPanel(ctx2, r, { fill: C.logBg, stroke: C.lineDark });
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
        draw: (ctx2) => drawMeBar(ctx2, r, m, { targetable, order, glow: a.glow })
      };
    }
    infoText(m) {
      var _a;
      const kind = this.selKind(m);
      if (kind) {
        const name = CARD_INFO[kind].name;
        const need = targetCount(kind);
        if (this.targets.length < need) return need === 2 ? `\u300C${name}\u300D\uFF1A${TWO_TARGET_HINT[this.targets.length]}` : `\u300C${name}\u300D\uFF1A\u9009\u62E9\u76EE\u6807`;
        return this.ready(m) ? `\u300C${name}\u300D\uFF1A\u70B9\u300C\u786E\u8BA4\u51FA\u724C\u300D` : `\u300C${name}\u300D\uFF1A\u8BF7\u9009\u62E9\u9009\u9879`;
      }
      if (this.peek) {
        const k = cardKindOf(m, this.peek);
        if (k) return `${CARD_INFO[k].name}\uFF1A${CARD_INFO[k].desc}`;
      }
      if (m.me && !m.me.alive) return "\u4F60\u5DF2\u51FA\u5C40\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u89C2\u770B";
      if (((_a = m.pending) == null ? void 0 : _a.kind) === "turn") return m.pending.mode === "choose" ? "\u4F60\u7684\u56DE\u5408\uFF1A\u62BD 2 \u5F20\uFF0C\u6216\u70B9\u4E00\u5F20\u624B\u724C\u6253\u51FA" : "\u53EF\u4EE5\u7EE7\u7EED\u51FA\u724C\uFF0C\u6216\u7ED3\u675F\u56DE\u5408";
      if (m.view.phase.kind === "day") return `\u7B49\u5F85 ${m.view.players[m.turnSeat].name} \u884C\u52A8\u2026`;
      return phaseTitle(m);
    }
    infoNode(m, r) {
      const text = this.infoText(m);
      return { rect: r, draw: (ctx2) => drawText(ctx2, text, r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: C.gold, align: "center", maxWidth: r.w }) };
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
        const lifted = c.id === this.sel;
        const p = a.cardIn(c.id);
        const cr = rect(x0 + step * i, r.y + (lifted ? 0 : 12) + (1 - p) * 40, cw, ch);
        return {
          id: `card:${c.id}`,
          rect: cr,
          onTap: () => this.tapCard(c.id, playable),
          draw: (ctx2) => {
            var _a2;
            ctx2.globalAlpha = p;
            drawCardFace(ctx2, cr, c.kind, { selected: lifted, dim: ((_a2 = m.pending) == null ? void 0 : _a2.kind) === "turn" && !playable.includes(c.id) });
            ctx2.globalAlpha = 1;
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
          button("confirm-play", rect(r.x + half + 10, r.y, half, r.h), "\u786E\u8BA4\u51FA\u724C", this.ready(m) && !busy ? () => this.confirmPlay() : null)
        ];
      }
      if (((_a = m.pending) == null ? void 0 : _a.kind) !== "turn") return [];
      if (m.pending.mode === "choose") return [button("draw", r, "\u62BD 2 \u5F20", busy ? null : () => void ctl2.act({ type: "draw" }))];
      return [button("end-turn", r, "\u7ED3\u675F\u56DE\u5408", busy ? null : () => void ctl2.act({ type: "endTurn" }), "secondary")];
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
      const title = need.kind === "curse" ? "\u8BC5\u5492\uFF1A\u4E22\u5F03\u54EA\u5F20\u84DD\u5361\uFF1F" : "\u8FA9\u62A4\uFF1A\u4E22\u5F03\u54EA\u79CD\u7EA2\u5361\uFF1F";
      const { nodes, body } = sheet(this.ui.screen, 280, title, close);
      const choices = need.kind === "curse" ? need.cards.map((c) => ({ value: c.id, label: CARD_INFO[c.kind].name })) : ALIBI_CHOICES.map((c) => ({ value: c.value, label: c.label }));
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
      __publicField(this, "table", null);
      __publicField(this, "tableKey", "");
      this.home = new HomeScene(ui2);
      this.lobby = new LobbyScene(ui2);
    }
    build(now) {
      const ctl2 = this.ui.ctl;
      if (!ctl2.code) return this.home.build(now);
      const room = ctl2.room;
      if (!room) return this.message(`\u6B63\u5728\u8FDB\u5165\u623F\u95F4 ${ctl2.code}\u2026`, "loading-home");
      if (!room.view) return room.status === "lobby" ? this.lobby.build(now) : this.message("\u623F\u95F4\u5DF2\u5173\u95ED", "closed-home");
      if (room.view.phase.kind === "ended") return this.ended(now);
      return this.playing(now);
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
    /** Task 8 替换为结算页 */
    ended(_now) {
      return this.message("\u6E38\u620F\u7ED3\u675F", "closed-home");
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
  var { ctx, screen } = createPlatform();
  var app = new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now());
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
    ui.prompt("\u7ED9\u81EA\u5DF1\u8D77\u4E2A\u6635\u79F0", "1\u201312 \u4E2A\u5B57\uFF0C\u670B\u53CB\u4F1A\u770B\u5230", (name) => ctl.setNickname(name) ? then() : ensureNickname(then), false);
  }
  ensureNickname(() => {
    const fromShare = roomFrom(wx.getLaunchOptionsSync());
    if (fromShare) {
      void ctl.joinRoom(fromShare);
      return;
    }
    const last = store.lastRoom();
    if (last) {
      wx.showModal({
        title: "\u56DE\u5230\u623F\u95F4\uFF1F",
        content: `\u4E0A\u6B21\u4F60\u5728\u623F\u95F4 ${last}\uFF0C\u8981\u56DE\u53BB\u5417\uFF1F`,
        success: (r) => {
          if (r.confirm) void ctl.joinRoom(last);
          else store.clearLastRoom();
        }
      });
    }
  });
  wx.onShow((o) => {
    ctl.onShow();
    const code = roomFrom(o);
    if (code && code !== ctl.code && ctl.nickname) void ctl.joinRoom(code);
  });
})();
