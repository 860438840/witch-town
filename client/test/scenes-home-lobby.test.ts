import { describe, expect, it } from 'vitest';
import { HomeScene } from '../src/scenes/home';
import { LobbyScene } from '../src/scenes/lobby';
import { RootScene } from '../src/scenes/root';
import { lobbyRoom, newState, roomOf } from './fixtures';
import { canTap, drawAll, fakeCtl, fakeUi, has, labelOf, tap } from './sceneKit';

describe('首页', () => {
  it('输入房号加入', () => {
    const ctl = fakeCtl({ code: null });
    const ui = fakeUi(ctl);
    ui.prompt.mockImplementation((_t, _p, cb) => cb('4321'));
    tap(new HomeScene(ui).build(0), 'join');
    expect(ctl.joinRoom).toHaveBeenCalledWith('4321');
  });

  it('创建房间；请求进行中按钮不可点', () => {
    const ctl = fakeCtl({ code: null });
    tap(new HomeScene(fakeUi(ctl)).build(0), 'create');
    expect(ctl.createRoom).toHaveBeenCalled();
    const busy = new HomeScene(fakeUi(fakeCtl({ code: null, busy: true }))).build(0);
    expect(canTap(busy, 'join')).toBe(false);
    expect(canTap(busy, 'create')).toBe(false);
    expect(labelOf(busy, 'join')).toBe('处理中');
    expect(labelOf(busy, 'create')).toBe('处理中');
  });

  it('规则速查可以打开和关闭', () => {
    const scene = new HomeScene(fakeUi(fakeCtl({ code: null })));
    tap(scene.build(0), 'rules');
    const opened = scene.build(0);
    expect(has(opened, 'rules-list')).toBe(true);
    expect(drawAll(opened).join('')).toContain('胜负');
    tap(opened, 'sheet-close');
    expect(has(scene.build(0), 'rules-list')).toBe(false);
  });

  it('显示昵称，点击可修改', () => {
    const ctl = fakeCtl({ code: null });
    const ui = fakeUi(ctl);
    ui.prompt.mockImplementation((_t, _p, cb) => cb('阿花'));
    const nodes = new HomeScene(ui).build(0);
    expect(drawAll(nodes).join('')).toContain('小明');
    tap(nodes, 'nickname');
    expect(ctl.setNickname).toHaveBeenCalledWith('阿花');
  });
});

describe('大厅', () => {
  it('复制房号和邀请', () => {
    const ctl = fakeCtl({ room: lobbyRoom(3) });
    const ui = fakeUi(ctl);
    const nodes = new LobbyScene(ui).build(0);
    expect(drawAll(nodes)).toContain('1234');
    tap(nodes, 'copy');
    expect(ui.copy).toHaveBeenCalledWith('1234');
    tap(nodes, 'invite');
    expect(ui.share).toHaveBeenCalledWith(expect.stringContaining('1234'), 'room=1234');
  });

  it('房主可以调座位、加机器人；不满 4 人不能开始', () => {
    const ctl = fakeCtl({ room: lobbyRoom(3) });
    const nodes = new LobbyScene(fakeUi(ctl)).build(0);
    expect(has(nodes, 'seat-up:0')).toBe(false);
    expect(has(nodes, 'seat-down:2')).toBe(false);
    tap(nodes, 'seat-up:2');
    expect(ctl.moveSeat).toHaveBeenCalledWith(2, -1);
    tap(nodes, 'seat-down:0');
    expect(ctl.moveSeat).toHaveBeenCalledWith(0, 1);
    tap(nodes, 'add-bot');
    expect(ctl.addBot).toHaveBeenCalled();
    expect(canTap(nodes, 'start')).toBe(false);
  });

  it('4 人可以开始；12 人不能再加机器人', () => {
    const ctl = fakeCtl({ room: lobbyRoom(4) });
    tap(new LobbyScene(fakeUi(ctl)).build(0), 'start');
    expect(ctl.startGame).toHaveBeenCalled();
    const full = new LobbyScene(fakeUi(fakeCtl({ room: lobbyRoom(12) }))).build(0);
    expect(canTap(full, 'add-bot')).toBe(false);
    expect(drawAll(full).length).toBeGreaterThan(12);
  });

  it('非房主没有房主按钮，可以离开', () => {
    const ctl = fakeCtl({ room: lobbyRoom(4), openid: 'u1' });
    const nodes = new LobbyScene(fakeUi(ctl)).build(0);
    expect(has(nodes, 'start')).toBe(false);
    expect(has(nodes, 'add-bot')).toBe(false);
    expect(has(nodes, 'seat-up:1')).toBe(false);
    tap(nodes, 'leave');
    expect(ctl.leaveRoom).toHaveBeenCalled();
  });

  it('请求进行中房间按钮显示「处理中」', () => {
    const nodes = new LobbyScene(fakeUi(fakeCtl({ room: lobbyRoom(5), openid: 'u0', busy: true }))).build(0);
    for (const id of ['leave', 'add-bot', 'start']) {
      expect(canTap(nodes, id)).toBe(false);
      expect(labelOf(nodes, id)).toBe('处理中');
    }
  });
});

describe('路由', () => {
  it('按状态选择画面', () => {
    expect(has(new RootScene(fakeUi(fakeCtl({ code: null }))).build(0), 'create')).toBe(true);
    expect(has(new RootScene(fakeUi(fakeCtl({ room: null }))).build(0), 'loading-home')).toBe(true);
    expect(has(new RootScene(fakeUi(fakeCtl({ room: lobbyRoom(2) }))).build(0), 'invite')).toBe(true);
    const closed = { ...lobbyRoom(2), status: 'ended' as const };
    expect(has(new RootScene(fakeUi(fakeCtl({ room: closed }))).build(0), 'closed-home')).toBe(true);
    expect(new RootScene(fakeUi(fakeCtl({ room: roomOf(newState(5)) }))).build(0).length).toBeGreaterThan(0);
  });
});
