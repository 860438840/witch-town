import type { CardKind, CharacterId } from '../../../engine/src/index';
import type { IconRef } from '../theme/draw';
import { CHAR_INFO } from './characters';
import { CARD_INFO, type CardColor } from './cards';

export interface RuleItem {
  text: string;
  icon?: IconRef;
}

const plain = (texts: string[]): RuleItem[] => texts.map((text) => ({ text }));

const cardsOf = (color: CardColor): RuleItem[] =>
  (Object.keys(CARD_INFO) as CardKind[])
    .filter((k) => CARD_INFO[k].color === color)
    .map((k) => ({ text: `${CARD_INFO[k].name}：${CARD_INFO[k].desc}`, icon: { card: k } }));

export const RULES: { title: string; items: RuleItem[] }[] = [
  {
    title: '胜负',
    items: plain(['女巫阵营的人全部出局（包括传染时交出女巫卡的原女巫）：村民胜利。', '活着的玩家全都是女巫阵营：女巫胜利。']),
  },
  {
    title: '身份卡',
    items: plain([
      '每人 5 张，只有自己知道内容。4–5 人 1 张女巫卡，6 人以上 2 张；警长 1 张，其余是村民。',
      '翻出女巫卡，或 5 张全部翻开，立即死亡。',
      '开局持有女巫卡的人属于女巫阵营；之后通过传染拿到女巫卡的人也加入女巫阵营，阵营不会再变（交出女巫卡的人仍是女巫）。女巫阵营的人能看到彼此。',
    ]),
  },
  {
    title: '回合',
    items: plain(['轮到你时二选一：抽 2 张牌，或打出任意张红 / 蓝 / 绿卡。', '所有牌都不能对自己使用（第一夜放黑猫除外）。']),
  },
  {
    title: '审判',
    items: plain([
      '面前红卡点数达到 7 点立即受审，由受审者自己翻开一张身份卡。',
      '审判结束后，丢弃受审者面前所有红卡。',
    ]),
  },
  {
    title: '夜晚',
    items: plain([
      '女巫阵营一起选一名玩家击杀；警长保护一名其他玩家；所有人都可以自首（翻开一张自己的身份卡），自首的人当晚不会被杀。',
      '被选中的人没有被保护、没有避难、也没有自首时死亡。',
      '夜晚过后全部重置：所有手牌和面前的牌（包括黑猫）收回重洗，每个活人重新发 3 张；身份卡不变。抽到夜晚的人回合结束。',
      '回合外摸到夜晚（例如审判中）时，先把审判走完再进入夜晚。',
    ]),
  },
  {
    title: '传染',
    items: plain(['黑猫持有者先翻开一张身份卡；然后每个活着的人从左边玩家的未翻开身份卡里盲抽一张。']),
  },
  { title: '红卡', items: cardsOf('red') },
  { title: '蓝卡（留在面前持续生效）', items: cardsOf('blue') },
  { title: '绿卡（一次性）', items: cardsOf('green') },
  { title: '黑卡（抽到立即结算）', items: cardsOf('black') },
  {
    title: '角色（公开）',
    items: [
      { text: '少于 7 人时每人从 2 个随机角色中选 1 个；7 人及以上直接随机发。角色对所有人公开。' },
      ...(Object.keys(CHAR_INFO) as CharacterId[]).map((id) => ({ text: `${CHAR_INFO[id].name}：${CHAR_INFO[id].desc}`, icon: { char: id } })),
    ],
  },
];
