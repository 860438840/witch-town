import { describe, expect, it } from 'vitest';
import {
  cardKindOf,
  dawnTargets,
  nightSteps,
  nightTargets,
  optionNeed,
  playableCardIds,
  targetOptions,
  unrevealedTryals,
  type NightPending,
} from '../src/model/actions';
import { describeEvent, logLines } from '../src/model/log';
import { buildTable, currentHand, formatCountdown, phaseTitle } from '../src/model/table';
import { giveCard, handOf, lobbyRoom, newState, roomOf, setDay } from './fixtures';

const name = (seat: number) => `P${seat}`;

describe('日志', () => {
  it('把事件翻译成中文', () => {
    expect(describeEvent({ t: 'play', seat: 0, kind: 'accusation', targets: [2] }, name)).toBe('P0 对 P2 打出「指控」');
    expect(describeEvent({ t: 'play', seat: 1, kind: 'asylum', targets: [1] }, name)).toBe('P1 给自己打出「避难」');
    expect(describeEvent({ t: 'play', seat: 0, kind: 'scapegoat', targets: [1, 2] }, name)).toBe('P0 打出「嫁祸」：P1 → P2');
    expect(describeEvent({ t: 'death', seat: 3, cause: 'lover' }, name)).toBe('P3 死亡：情侣殉情');
    expect(describeEvent({ t: 'reveal', seat: 1, kind: 'witch', cause: 'trial' }, name)).toBe('P1 因审判翻开了「女巫」');
    expect(describeEvent({ t: 'nightResult', target: 2, died: false }, name)).toBe('夜里，女巫袭击了 P2，但 TA 活了下来');
    expect(describeEvent({ t: 'gameEnd', winner: 'witch' }, name)).toBe('女巫胜利！');
  });
  it('死亡时自动翻开的身份卡不单独显示', () => {
    const s = newState();
    s.log.push({ t: 'reveal', seat: 1, kind: 'villager', cause: 'death' }, { t: 'death', seat: 1, cause: 'night' });
    const lines = logLines(roomOf(s).view!);
    expect(lines).toEqual(['游戏开始，共 5 人', 'P1 死亡：夜里被女巫杀死']);
  });
});

describe('TableModel', () => {
  it('大厅阶段没有画面数据', () => {
    expect(buildTable(lobbyRoom(4), null, 'u0')).toBeNull();
  });

  it('其他玩家从我的下一个座位开始按顺时针排列', () => {
    const s = newState(5);
    const m = buildTable(roomOf(s), handOf(s, 2), 'u2')!;
    expect(m.mySeat).toBe(2);
    expect(m.others.map((p) => p.seat)).toEqual([3, 4, 0, 1]);
    expect(m.priv?.seat).toBe(2);
  });

  it('gameId 不同的手牌（上一局残留）被忽略', () => {
    const s = newState(5);
    const room = roomOf(s, 'new-game');
    const stale = handOf(s, 1, 'old-game');
    expect(currentHand(room, stale)).toBeNull();
    const m = buildTable(room, stale, 'u1')!;
    expect(m.priv).toBeNull();
    expect(m.pending).toBeNull();
  });

  it('轮到我时 isMyTurn 为真，pending 是 turn', () => {
    const s = newState(5);
    setDay(s, 3);
    const m = buildTable(roomOf(s), handOf(s, 3), 'u3')!;
    expect(m.isMyTurn).toBe(true);
    expect(m.pending).toEqual({ kind: 'turn', mode: 'choose' });
    expect(phaseTitle(m)).toBe('你的回合');
    const other = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(other.isMyTurn).toBe(false);
    expect(phaseTitle(other)).toBe('P3 的回合');
  });

  it('阶段标题', () => {
    const s = newState(5);
    expect(phaseTitle(buildTable(roomOf(s), null, 'u0')!)).toBe('第一夜：女巫放置黑猫');
    s.phase = { kind: 'night' };
    expect(phaseTitle(buildTable(roomOf(s), null, 'u0')!)).toBe('夜晚');
    s.phase = { kind: 'ended', winner: 'village' };
    const m = buildTable(roomOf(s), null, 'u0')!;
    expect(phaseTitle(m)).toBe('村民胜利');
    expect(m.winner).toBe('village');
  });

  it('倒计时不显示负数', () => {
    expect(formatCountdown(65_000, 0)).toBe('1:05');
    expect(formatCountdown(1_000, 5_000)).toBe('0:00');
    expect(formatCountdown(null, 0)).toBe('');
  });
});

describe('可做的操作', () => {
  it('只有轮到我时才能出牌，黑卡不能出', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'night', 'night-9');
    const mine = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    const ids = playableCardIds(mine);
    expect(ids).not.toContain('night-9');
    expect(ids.length).toBe(s.players[0].hand.length - 1);
    const notMine = buildTable(roomOf(s), handOf(s, 1), 'u1')!;
    expect(playableCardIds(notMine)).toEqual([]);
  });

  it('红卡不能打给自己、死人和信徒持有者', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[3].alive = false;
    s.players[4].blue.push({ id: 'piety-1', kind: 'piety' });
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(targetOptions(m, 'accusation', [])).toEqual([1, 2]);
    expect(targetOptions(m, 'asylum', [])).toEqual([0, 1, 2, 4]);
  });

  it('情侣、拘留、诅咒的目标限制；第二个目标不能和第一个相同', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[1].blue.push({ id: 'matchmaker-1', kind: 'matchmaker' });
    s.players[2].green.push({ id: 'stocks-1', kind: 'stocks' });
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(targetOptions(m, 'matchmaker', [])).toEqual([0, 2, 3, 4]);
    expect(targetOptions(m, 'stocks', [])).toEqual([0, 1, 3, 4]);
    expect(targetOptions(m, 'curse', [])).toEqual([1]);
    expect(targetOptions(m, 'robbery', [2])).toEqual([0, 1, 3, 4]);
  });

  it('诅咒要选蓝卡，辩护在指控和证据都有时要选', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[1].blue.push({ id: 'asylum-1', kind: 'asylum' }, { id: 'piety-1', kind: 'piety' });
    s.players[2].red.push({ id: 'accusation-1', kind: 'accusation', points: 1 }, { id: 'evidence-1', kind: 'evidence', points: 3 });
    s.players[3].red.push({ id: 'accusation-2', kind: 'accusation', points: 1 });
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    const curse = optionNeed(m, 'curse', 1);
    expect(curse?.kind).toBe('curse');
    expect(curse && curse.kind === 'curse' ? curse.cards.map((c) => c.id) : []).toEqual(['asylum-1', 'piety-1']);
    expect(optionNeed(m, 'alibi', 2)).toEqual({ kind: 'alibi' });
    expect(optionNeed(m, 'alibi', 3)).toBeNull();
    expect(optionNeed(m, 'accusation', 2)).toBeNull();
  });

  it('cardKindOf 查手牌种类', () => {
    const s = newState(5);
    setDay(s, 0);
    const id = giveCard(s, 0, 'witness', 'witness-1');
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(cardKindOf(m, id)).toBe('witness');
    expect(cardKindOf(m, 'nope')).toBeNull();
  });

  it('夜晚步骤与目标', () => {
    const base: NightPending = { kind: 'night', witch: false, votes: null, constable: false, protect: null, confessed: false };
    expect(nightSteps(base)).toEqual(['suspect']);
    expect(nightSteps({ ...base, witch: true, votes: {} })).toEqual(['kill']);
    expect(nightSteps({ ...base, constable: true })).toEqual(['protect']);
    expect(nightSteps({ ...base, witch: true, votes: {}, constable: true })).toEqual(['kill', 'protect']);
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    s.players[4].alive = false;
    const m = buildTable(roomOf(s), handOf(s, 1), 'u1')!;
    expect(nightTargets(m, 'kill')).toEqual([0, 1, 2, 3]);
    expect(nightTargets(m, 'protect')).toEqual([0, 2, 3]);
    expect(dawnTargets(m)).toEqual([0, 1, 2, 3]);
  });

  it('未翻开的身份卡', () => {
    const s = newState(5);
    s.players[0].tryals[0].revealed = true;
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(unrevealedTryals(m)).toHaveLength(4);
  });
});
