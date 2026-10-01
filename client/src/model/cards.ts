import type { CardKind, TryalKind } from '../../../engine/src/index';

export type CardColor = 'red' | 'blue' | 'green' | 'black';

export const CARD_INFO: Record<CardKind, { name: string; color: CardColor; desc: string }> = {
  accusation: { name: '指控', color: 'red', desc: '指控点 +1' },
  evidence: { name: '证据', color: 'red', desc: '指控点 +3' },
  witness: { name: '目击', color: 'red', desc: '指控点 +7' },
  blackCat: { name: '黑猫', color: 'blue', desc: '传染时，持有者先翻开自己一张身份卡' },
  matchmaker: { name: '情侣', color: 'blue', desc: '两名持有者同生共死' },
  asylum: { name: '避难', color: 'blue', desc: '夜晚不会被女巫杀死' },
  piety: { name: '信徒', color: 'blue', desc: '其他玩家不能对持有者打出红卡' },
  scapegoat: { name: '嫁祸', color: 'green', desc: '把一名玩家面前的所有卡转给另一名玩家' },
  robbery: { name: '抢劫', color: 'green', desc: '把一名玩家的所有手牌交给另一名玩家' },
  arson: { name: '纵火', color: 'green', desc: '丢弃一名玩家的所有手牌' },
  curse: { name: '诅咒', color: 'green', desc: '丢弃一名玩家面前的一张蓝卡' },
  stocks: { name: '拘留', color: 'green', desc: '目标跳过自己的下一回合' },
  alibi: { name: '辩护', color: 'green', desc: '丢弃一名玩家面前最多 3 张指控或 1 张证据' },
  night: { name: '夜晚', color: 'black', desc: '抽到立即结算：夜晚降临' },
  conspiracy: { name: '传染', color: 'black', desc: '抽到立即结算：每人从左边玩家处盲抽一张身份卡' },
};

export const TRYAL_NAME: Record<TryalKind, string> = { witch: '女巫', constable: '警长', villager: '村民' };

/** 格子里身份卡小方块上的单字 */
export const TRYAL_SHORT: Record<TryalKind, string> = { witch: '巫', constable: '警', villager: '民' };
