import { App } from './core/app';
import { Controller } from './controller';
import { Api } from './net/api';
import { rejoinable, RoomSession, type DbLike } from './net/session';
import { LocalStore } from './net/storage';
import { Ticker } from './net/ticker';
import { realTimers } from './net/timers';
import { bindTouches, createPlatform } from './platform';
import { RootScene } from './scenes/root';
import type { Ui } from './scenes/ui';

wx.cloud.init({ traceUser: true });

const { ctx, screen } = createPlatform();
const app = new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now());
bindTouches(app);

const store = new LocalStore(wx);
const db = wx.cloud.database() as unknown as DbLike;
const ctl = new Controller({
  api: new Api(wx.cloud),
  store,
  openSession: (code, openid, onChange) => new RoomSession(db, code, openid, realTimers, onChange),
  makeTicker: (tick) => new Ticker({ now: () => Date.now(), random: Math.random, timers: realTimers, tick }),
  toast: (msg) => wx.showToast({ title: msg, icon: 'none', duration: 2000 }),
  render: () => app.render(),
});

const ui: Ui = {
  screen,
  animator: app.animator,
  ctl,
  render: () => app.render(),
  prompt: (title, placeholder, cb, cancellable = true) =>
    wx.showModal({
      title,
      editable: true,
      placeholderText: placeholder,
      showCancel: cancellable,
      success: (r) => {
        if (r.confirm) cb((r.content ?? '').trim());
      },
    }),
  confirm: (title, content, cb) =>
    wx.showModal({
      title,
      content,
      success: (r) => {
        if (r.confirm) cb();
      },
    }),
  copy: (text) => wx.setClipboardData({ data: text }),
  share: (title, query) => wx.shareAppMessage({ title, query }),
};

app.setScene(new RootScene(ui));

// 右上角菜单的「转发」（手机上目前不带房号，见设计文档 §7.1；保留以便日后生效）
wx.showShareMenu({ menus: ['shareAppMessage'] });
wx.onShareAppMessage(() =>
  ctl.code ? { title: `女巫镇 · 房间 ${ctl.code}`, query: `room=${ctl.code}` } : { title: '一起来玩女巫镇' },
);

// 游戏进行中每秒重画一次，刷新倒计时
setInterval(() => {
  if (ctl.room?.status === 'playing') app.render();
}, 1000);

function roomFrom(o: WxLaunchOptions): string | null {
  const r = o.query?.room;
  return r && /^\d{4}$/.test(r) ? r : null;
}

function ensureNickname(then: () => void): void {
  if (ctl.nickname) {
    then();
    return;
  }
  askNickname('给自己起个昵称', then);
}

/** 昵称不合法时换成说明原因的标题再问一次（提示框会被输入框挡住） */
function askNickname(title: string, then: () => void): void {
  ui.prompt(title, '1–12 个字，朋友会看到', (name) => (ctl.setNickname(name) ? then() : askNickname('昵称需要 1–12 个字', then)), false);
}

ensureNickname(() => {
  const fromShare = roomFrom(wx.getLaunchOptionsSync());
  if (fromShare) {
    void ctl.joinRoom(fromShare);
    return;
  }
  const last = store.lastRoom();
  if (!last) return;
  // 查询期间用户可能已经进了别的房间（或上次的房间已变）：那时这个提示已过时，什么都不做
  const stale = (): boolean => ctl.code !== null || store.lastRoom() !== last;
  void rejoinable(db, last).then((ok) => {
    if (stale()) return;
    if (!ok) {
      store.clearLastRoom();
      return;
    }
    wx.showModal({
      title: '回到房间？',
      content: `上次你在房间 ${last}，要回去吗？`,
      success: (r) => {
        if (stale()) return;
        if (r.confirm) void ctl.joinRoom(last);
        else store.clearLastRoom();
      },
    });
  });
});

wx.onShow((o) => {
  ctl.onShow();
  const code = roomFrom(o);
  if (code && code !== ctl.code && ctl.nickname) void ctl.joinRoom(code);
});
