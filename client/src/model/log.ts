import type { GameEvent, PublicView } from '../../../engine/src/index';
import { CARD_INFO, TRYAL_NAME } from './cards';
import { CHAR_INFO } from './characters';

const REVEAL_CAUSE = { trial: '审判', cat: '黑猫', confess: '自首', death: '死亡' } as const;
const DEATH_CAUSE = {
  night: '夜里被女巫杀死',
  witchRevealed: '翻出了女巫卡',
  allRevealed: '身份卡全部翻开',
  lover: '情侣殉情',
} as const;

function abilityLine(e: Extract<GameEvent, { t: 'ability' }>, name: (seat: number) => string): string {
  const who = `${name(e.seat)}（${CHAR_INFO[e.ability].name}）`;
  const card = e.kind ? CARD_INFO[e.kind].name : '';
  switch (e.ability) {
    case 'doctor':
      return `${who} 把「辩护」当作「目击」打出`;
    case 'beggar':
    case 'maid':
      return `${who}：「${card}」对 TA 无效，直接丢弃`;
    case 'landlord':
      return `${who} 抽到 2 张「指控」，展示后再抽一张`;
    case 'priest':
      return `${who} 从弃牌堆拿了 ${e.count ?? 0} 张牌`;
    case 'storyteller':
      return `${who} 调整了牌堆顺序`;
    case 'housewife':
      return `${who}：有人的身份卡被翻开，抽一张牌`;
    case 'farmer':
      return `${who} 获得了 ${e.from === undefined ? '死者' : name(e.from)} 的手牌和蓝卡`;
    case 'child':
      return `${who} 丢弃了自己面前的「指控」和「证据」`;
    case 'minister':
      return `${who}：「证据」只算 1 点`;
    case 'official':
      return `${who} 自首，没有翻开身份卡`;
    case 'maiden':
      return `${who} 发起审判，审判前先抽 2 张牌`;
    default:
      return `${who} 发动了技能`;
  }
}

export function describeEvent(e: GameEvent, name: (seat: number) => string): string {
  switch (e.t) {
    case 'gameStart':
      return `游戏开始，共 ${e.players} 人`;
    case 'catPlaced':
      return `女巫把黑猫放在了 ${name(e.target)} 面前`;
    case 'turn':
      return `轮到 ${name(e.seat)}`;
    case 'skipped':
      return `${name(e.seat)} 被拘留，跳过这一回合`;
    case 'draw':
      return `${name(e.seat)} 抽了 1 张牌`;
    case 'blackDrawn':
      return `${name(e.seat)} 抽到了「${CARD_INFO[e.kind].name}」`;
    case 'play': {
      const card = CARD_INFO[e.kind].name;
      if (e.targets.length === 2) return `${name(e.seat)} 打出「${card}」：${name(e.targets[0])} → ${name(e.targets[1])}`;
      if (e.targets[0] === e.seat) return `${name(e.seat)} 给自己打出「${card}」`;
      return `${name(e.seat)} 对 ${name(e.targets[0])} 打出「${card}」`;
    }
    case 'trial':
      return `${name(e.target)} 受到审判（发起者：${name(e.initiator)}）`;
    case 'reveal':
      return `${name(e.seat)} 因${REVEAL_CAUSE[e.cause]}翻开了「${TRYAL_NAME[e.kind]}」`;
    case 'death':
      return `${name(e.seat)} 死亡：${DEATH_CAUSE[e.cause]}`;
    case 'conspiracyDone':
      return '传染结束，每个人都拿到了一张新的身份卡';
    case 'nightResult':
      return e.died ? `夜里，${name(e.target)} 遭到女巫袭击身亡` : `夜里，女巫袭击了 ${name(e.target)}，但 TA 活了下来`;
    case 'reshuffle':
      return '弃牌堆洗回了牌堆';
    case 'character':
      return `${name(e.seat)} 的角色是「${CHAR_INFO[e.character].name}」`;
    case 'ability':
      return abilityLine(e, name);
    case 'gameEnd':
      return e.winner === 'village' ? '村民胜利！' : '女巫胜利！';
  }
}

/** 日志里要显示的事件：死亡时自动翻开的身份卡不单独显示 */
export function visibleEvents(view: PublicView): GameEvent[] {
  return view.log.filter((e) => !(e.t === 'reveal' && e.cause === 'death'));
}

export function logLines(view: PublicView): string[] {
  const name = (seat: number) => view.players[seat]?.name ?? `座位 ${seat + 1}`;
  return visibleEvents(view).map((e) => describeEvent(e, name));
}
