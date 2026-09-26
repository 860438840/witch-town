import type { GameState, PrivateView, PublicView } from '../../engine/src/index';

export const ROOMS = 'rooms';
export const GAMES = 'games';
export const HANDS = 'hands';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;

/** 机器人的 openid 前缀；机器人只靠超时自动行动 */
export const BOT_PREFIX = 'bot-';
export const isBot = (openid: string): boolean => openid.startsWith(BOT_PREFIX);

export const handId = (code: string, openid: string): string => `${code}_${openid}`;

export interface Profile {
  name: string;
  avatar: string;
}

export interface Seat {
  openid: string;
  name: string;
  avatar: string;
}

export type RoomStatus = 'lobby' | 'playing' | 'ended';

/** rooms 集合：房间成员可读 */
export interface RoomDoc {
  code: string;
  host: string;
  status: RoomStatus;
  seats: Seat[];
  view: PublicView | null;
  /** 当前等待阶段的截止时间（毫秒时间戳），大厅和结束后为 null */
  deadline: number | null;
  updatedAt: number;
}

/** games 集合：只有云函数可读写 */
export interface GameDoc {
  state: GameState;
  deadlineKey: string;
  deadline: number;
}

/** hands 集合：只有本人可读 */
export interface HandDoc {
  _openid: string;
  roomId: string;
  view: PrivateView;
}
