// 由 client/build.mjs 生成，请勿手改。修改 client/src 后运行 npm run build。
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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

  // src/main.ts
  var { ctx, screen } = createPlatform();
  var app = new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now());
  bindTouches(app);
  app.setScene({
    build: () => [
      {
        rect: rect(0, 0, screen.W, screen.H),
        draw: (c) => {
          c.fillStyle = "#1a1326";
          c.fillRect(0, 0, screen.W, screen.H);
          c.fillStyle = "#e8c774";
          c.font = "bold 28px sans-serif";
          c.textAlign = "center";
          c.fillText("\u5973\u5DEB\u9547 \xB7 \u5EFA\u8BBE\u4E2D", screen.W / 2, screen.H / 2);
        }
      }
    ]
  });
})();
