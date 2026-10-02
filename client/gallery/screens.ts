import { findNode } from '../src/core/node';
import { HomeScene } from '../src/scenes/home';
import { LobbyScene } from '../src/scenes/lobby';
import { ResultScene } from '../src/scenes/result';
import { newState, lobbyRoom, roomOf } from '../test/fixtures';
import { busy, ctlFor, shot, SIZES, table } from './harness';

for (const size of SIZES) {
  const home = ctlFor({});
  shot('首页', size, (ui) => new HomeScene(ui).build(0), home);
  shot('首页·规则页', size, (ui) => {
    const sc = new HomeScene(ui);
    findNode(sc.build(0), 'rules')?.onTap?.();
    return sc.build(0);
  }, home);

  const lobby = ctlFor({ room: lobbyRoom(6) });
  shot('大厅', size, (ui) => new LobbyScene(ui).build(0), lobby);

  const t = table(busy());
  shot('牌桌', size, (ui) => t.scene(ui).build(0), t.ctl);
  shot('牌桌·点格子详情', size, (ui) => {
    const sc = t.scene(ui);
    findNode(sc.build(0), 'seat:2')?.onTap?.();
    return sc.build(0);
  }, t.ctl);
  shot('牌桌·我的身份卡', size, (ui) => {
    const sc = t.scene(ui);
    findNode(sc.build(0), 'me')?.onTap?.();
    return sc.build(0);
  }, t.ctl);
  shot('牌桌·弃牌堆', size, (ui) => {
    const sc = t.scene(ui);
    findNode(sc.build(0), 'discard')?.onTap?.();
    return sc.build(0);
  }, t.ctl);

  const priest = busy();
  priest.players[0].character = 'priest';
  const tp = table(priest);
  shot('牧师拿牌', size, (ui) => {
    const sc = tp.scene(ui);
    findNode(sc.build(0), 'priest')?.onTap?.();
    return sc.build(0);
  }, tp.ctl);

  const pick = newState(5);
  pick.phase = { kind: 'characterPick' };
  pick.characterOffers = { 0: ['judge', 'maid'], 1: ['priest', 'child'], 2: ['farmer', 'beggar'], 3: ['doctor', 'maiden'], 4: ['official', 'tailor'] };
  const tc = table(pick);
  shot('选角色', size, (ui) => {
    const sc = tc.scene(ui);
    findNode(sc.build(0), 'character:maid')?.onTap?.();
    return sc.build(0);
  }, tc.ctl);

  const tell = newState(5);
  tell.players[0].character = 'storyteller';
  tell.phase = { kind: 'storytelling', seat: 0 };
  const ts = table(tell);
  shot('说书人', size, (ui) => ts.scene(ui).build(0), ts.ctl);

  for (const winner of ['village', 'witch'] as const) {
    const end = newState(6);
    end.players.forEach((p, i) => (p.character = (['judge', 'priest', 'tailor', 'farmer', 'maid', 'strongman'] as const)[i]));
    end.phase = { kind: 'ended', winner };
    const ctl = ctlFor({ room: roomOf(end) });
    shot(winner === 'village' ? '结算·村民胜利' : '结算·女巫胜利', size, (ui) => new ResultScene(ui).build(0), ctl);
  }
}
