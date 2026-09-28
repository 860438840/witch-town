import type { GameEvent, PublicView } from '../../../engine/src/index';
import { CARD_INFO, TRYAL_NAME } from './cards';

const REVEAL_CAUSE = { trial: '审判', cat: '黑猫', confess: '自首', death: '死亡' } as const;
const DEATH_CAUSE = {
  night: '夜里被女巫杀死',
  witchRevealed: '翻出了女巫卡',
  allRevealed: '身份卡全部翻开',
  lover: '情侣殉情',
} as const;

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
