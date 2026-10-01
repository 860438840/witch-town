import type { App, Screen } from './core/app';
import type { Ctx } from './core/node';

/** 创建全屏画布，按像素比缩放，计算内容区（避开右上角胶囊按钮和底部安全区） */
export function createPlatform(): { ctx: Ctx; screen: Screen } {
  const canvas = wx.createCanvas();
  const info = wx.getSystemInfoSync();
  const dpr = info.pixelRatio || 2;
  canvas.width = info.windowWidth * dpr;
  canvas.height = info.windowHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let top = 64;
  try {
    top = wx.getMenuButtonBoundingClientRect().bottom + 8;
  } catch {
    // 个别环境拿不到胶囊按钮位置，用默认值
  }
  const bottom = info.safeArea ? Math.min(info.safeArea.bottom, info.windowHeight) : info.windowHeight;
  return { ctx, screen: { W: info.windowWidth, H: info.windowHeight, top, bottom } };
}

export function bindTouches(app: App): void {
  wx.onTouchStart((e) => {
    const t = e.touches[0];
    if (t) app.touchStart(t.clientX, t.clientY);
  });
  wx.onTouchMove((e) => {
    const t = e.touches[0];
    if (t) app.touchMove(t.clientX, t.clientY);
  });
  wx.onTouchEnd((e) => {
    const t = e.changedTouches[0];
    if (t) app.touchEnd(t.clientX, t.clientY);
  });
  wx.onTouchCancel(() => app.touchCancel());
}
