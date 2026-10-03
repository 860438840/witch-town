import type { PendingChoice, PrivateView, PublicPlayer, PublicView, Winner } from '../../../engine/src/index';
import type { HandDoc, RoomDoc } from '../../../server/src/types';

export interface TableModel {
  code: string;
  view: PublicView;
  /** 我在本局的座位；不在座位中（观战）时为 null */
  mySeat: number | null;
  me: PublicPlayer | null;
  /** 我的私密视图；手牌文档不属于本局时为 null */
  priv: PrivateView | null;
  /** 其他玩家，从我的下一个座位开始按顺时针排列 */
  others: PublicPlayer[];
  turnSeat: number;
  isMyTurn: boolean;
  pending: PendingChoice | null;
  deadline: number | null;
  winner: Winner | null;
}

/** 只认属于当前这一局的手牌文档（房号复用时旧文档的 gameId 不同） */
export function currentHand(room: RoomDoc, hand: HandDoc | null): HandDoc | null {
  if (!hand || !room.gameId || hand.gameId !== room.gameId || hand.roomId !== room.code) return null;
  return hand;
}

export function buildTable(room: RoomDoc, hand: HandDoc | null, openid: string): TableModel | null {
  const view = room.view;
  if (!view) return null;
  const idx = room.seats.findIndex((s) => s.openid === openid);
  const mySeat = idx >= 0 && idx < view.players.length ? idx : null;
  const n = view.players.length;
  const others =
    mySeat === null ? view.players : Array.from({ length: n - 1 }, (_, k) => view.players[(mySeat + 1 + k) % n]);
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
    isMyTurn: view.phase.kind === 'day' && view.turn === mySeat && !!me?.alive,
    pending: view.phase.kind === 'ended' ? null : (priv?.pending ?? null),
    deadline: room.deadline,
    winner: view.phase.kind === 'ended' ? view.phase.winner : null,
  };
}

/** 这个座位是不是我的女巫同伴（只有女巫阵营能看到；包括传染时交出女巫卡的原女巫） */
export function isPartner(m: TableModel, seat: number): boolean {
  return m.priv?.witchPartners.includes(seat) ?? false;
}

export function nameOf(m: TableModel, seat: number): string {
  return seat === m.mySeat ? '你' : (m.view.players[seat]?.name ?? '');
}

export function phaseTitle(m: TableModel): string {
  const ph = m.view.phase;
  switch (ph.kind) {
    case 'characterPick':
      return '选择角色';
    case 'storytelling':
      return ph.seat === m.mySeat ? '调整牌堆' : `${m.view.players[ph.seat].name} 正在调整牌堆`;
    case 'dawn':
      return '第一夜：女巫放置黑猫';
    case 'day':
      return m.isMyTurn ? '你的回合' : `${m.view.players[m.turnSeat].name} 的回合`;
    case 'trialReveal':
      return `审判：${nameOf(m, ph.target)} 翻开身份卡`;
    case 'catReveal':
      return `传染：${nameOf(m, ph.holder)} 翻开身份卡`;
    case 'conspiracyPick':
      return '传染：大家盲抽身份卡';
    case 'night':
      return '夜晚';
    case 'ended':
      return ph.winner === 'village' ? '村民胜利' : '女巫胜利';
  }
}

export function formatCountdown(deadline: number | null, now: number): string {
  if (deadline === null) return '';
  const s = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
