# 计划 C：15 个角色 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给女巫镇加上 15 个有技能的角色：开局发角色 / 选角色，全部技能由服务器执行，需要选择的技能在小游戏界面上可以操作。

**Architecture:** 引擎新增「某座位此刻生效的技能」查询（裁缝在这里统一处理），各条规则在原位置直接判断；新增一个「流程栈」，让回合外摸到的黑卡立即结算后回到被打断的流程。云函数只加参数校验和计时；小游戏客户端加角色显示、选角色面板、技能按钮和说书人拖拽面板（界面框架新增「按住拖动」）。

**Tech Stack:** TypeScript 7、Vitest 5、esbuild 0.28；微信小游戏 Canvas；微信云开发云函数。

**Spec:** `docs/superpowers/specs/2026-10-01-plan-c-characters-design.md`（上级：`docs/superpowers/specs/2026-09-26-witch-town-design.md` 2.9、2.10）

## Global Constraints

- 引擎 `engine/` 是纯 TypeScript，不使用任何微信 API；规则错误一律 `throw new RuleError('中文原因')`。
- 三个包共用引擎类型：**每个任务结束时 `engine`、`server`、`client` 三处的测试和类型检查都必须通过**（改引擎类型时，同一任务里修好 server / client 的编译）。
  - 引擎：`cd engine && npx vitest run && npx tsc --noEmit`
  - 服务器：`cd server && npx vitest run && npm run typecheck`
  - 客户端：`cd client && npx vitest run && npm run typecheck`
- 服务器参数校验失败统一报 `操作参数无效`。
- 客户端颜色一律取自 `client/src/theme/palette.ts`，不写颜色字面量。
- 时限：选角色 `PICK_MS = 30_000`；说书人调整牌堆 `STORY_MS = 120_000`；其余沿用（回合 90 秒、其他选择 45 秒、机器人回合 3 秒）。
- 限次：牧师 2 次、说书人 1 次、官员 1 次；次数记在使用者本人身上（裁缝单独计次）。
- 少于 7 人选角色（每人 2 个候选），7 人及以上直接随机发；角色互不重复。
- 角色在 `createGame` 的**最后**才发（之后才消耗随机数），保证同一种子下身份卡和牌堆与以前完全相同。
- 大多数旧测试不关心角色：引擎测试的 `newGame`、客户端测试的 `newState`、服务器测试的 `started` 都会去掉随机角色、从第一夜开始。
- 打包产物 `cloudfunctions/game/index.js` 和 `minigame/game.js` 只在最后一个任务重新生成并提交。
- 每个提交的说明以 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 结尾。

## Review Focus

1. **回合外摸到黑卡**（家庭主妇、少女）：黑卡立即结算，结算完回到被打断的流程；摸到夜晚时，流程走完后当前回合结束。→ Task 4 的「C4」测试。
2. **裁缝的技能随右手边玩家变化**：右边的人死亡后顺延到下一位。→ Task 1 测试。
3. **牌堆顺序泄露**：只有调整中的说书人在自己的私密视图里能看到牌堆；公开视图和其他人的手牌文档里都没有。→ Task 5、Task 6 测试。
4. **医生的辩护进弃牌堆时还原**：总卡数守恒，弃牌堆里不会多出一张目击。→ Task 3 测试 + Task 5 的随机对局模拟。
5. **说书人调整完回到回合时重新计 90 秒**，不会沿用调整前已经快到期的截止时间。→ Task 6 测试。

## 文件地图

| 文件 | 作用 | 任务 |
|---|---|---|
| `engine/src/types.ts` | 角色、流程栈、新阶段、新操作、新事件的类型 | 1、2、4、5 |
| `engine/src/characters.ts`（新） | 角色列表、生效技能查询、限次、发角色、选角色 | 1 |
| `engine/src/flow.ts`（新） | 流程栈：继续被打断的流程、回合外摸牌 | 2、4 |
| `engine/src/abilities.ts`（新） | 牧师、说书人的主动技能 | 5 |
| `engine/src/turn.ts` `conspiracy.ts` `night.ts` `trial.ts` `play.ts` `death.ts` `apply.ts` `auto.ts` `view.ts` `setup.ts` `state.ts` `index.ts` | 接入角色规则 | 1–5 |
| `engine/test/helpers.ts` | 去掉角色、设置角色、平静夜晚等辅助函数 | 1–5 |
| `server/src/validate.ts` `deadlines.ts` | 新操作校验、新阶段时限 | 1、6 |
| `server/test/helpers.ts` | 直接改写局面、跳过选角色 | 1 |
| `client/src/model/characters.ts`（新） | 角色中文名、简称、技能说明 | 1、7 |
| `client/src/model/log.ts` `table.ts` `actions.ts` `rules.ts` | 日志、阶段标题、操作、规则页 | 1、5、7 |
| `client/src/core/node.ts` `app.ts` | 按住拖动 | 8 |
| `client/src/scenes/tableParts.ts` `infoPanels.ts` `table.ts` `choicePanels.ts` | 角色显示、技能按钮、面板 | 7、9、10 |
| `client/src/scenes/storyBoard.ts`（新） | 说书人拖拽面板 | 10 |

---

### Task 1: 角色数据、发角色与选角色

**Files:**
- Modify: `engine/src/types.ts`、`engine/src/setup.ts`、`engine/src/apply.ts`、`engine/src/auto.ts`、`engine/src/view.ts`、`engine/src/index.ts`
- Create: `engine/src/characters.ts`、`engine/test/characters.test.ts`
- Modify: `engine/test/helpers.ts`、`engine/test/view.test.ts`
- Create: `client/src/model/characters.ts`
- Modify: `client/src/model/log.ts`、`client/src/model/table.ts`、`client/src/scenes/choicePanels.ts`、`client/test/fixtures.ts`、`client/test/model.test.ts`
- Modify: `server/src/deadlines.ts`、`server/test/helpers.ts`、`server/test/game.test.ts`、`server/test/deadlines.test.ts`

**Interfaces:**
- Produces（引擎类型）：`CharacterId`、`LimitedAbility`；`Player.character: CharacterId | null`、`Player.uses`；`RedCard.source?`；阶段 `{ kind: 'characterPick' }`；事件 `{ t: 'character' }`、`{ t: 'ability' }`；`GameState.characterOffers`；操作 `{ type: 'pickCharacter'; seat; index }`；待选项 `{ kind: 'characterPick'; offers }`。
- Produces（`engine/src/characters.ts`）：`CHARACTERS`、`USE_LIMITS`、`PICK_BELOW = 7`、`abilityOf(s, seat)`、`hasAbility(s, seat, id)`、`isLimited(c)`、`usesLeft(s, seat, a)`、`useAbility(s, seat, a)`、`canUse(s, seat, a)`、`limitedLeft(s, seat)`、`dealCharacters(s, rng)`、`pickCharacter(s, seat, index)`。
- Produces（公开视图）：`PublicPlayer.character`、`PublicPlayer.ability`、`PublicPlayer.usesLeft`；`PublicView.discard: Card[]`。
- Produces（测试辅助）：引擎 `withoutCharacters(s)`、`setCharacter(s, seat, c)`；服务器 `mutateGame(store, code, fn, deadline?)`、`skipCharacters(store, code)`。
- Produces（客户端）：`CHAR_INFO: Record<CharacterId, { name; short; desc }>`。

- [ ] **Step 1: 写引擎的失败测试**

新建 `engine/test/characters.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { abilityOf, CHARACTERS, limitedLeft, usesLeft } from '../src/characters';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import type { Action, GameState } from '../src/types';
import { projectPrivate, projectPublic } from '../src/view';
import { fixedGame, setCharacter } from './helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` }));
const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

describe('发角色', () => {
  it('7 人及以上：每人直接获得互不相同的角色，进入第一夜', () => {
    for (const n of [7, 12]) {
      const s = createGame(players(n), seededRng(4));
      const chars = s.players.map((p) => p.character);
      expect(chars.every((c) => c !== null && CHARACTERS.includes(c))).toBe(true);
      expect(new Set(chars).size).toBe(n);
      expect(s.phase).toEqual({ kind: 'dawn' });
      expect(s.log.filter((e) => e.t === 'character')).toHaveLength(n);
    }
  });

  it('不到 7 人：每人 2 个候选，所有候选互不重复，进入选角色阶段', () => {
    const s = createGame(players(6), seededRng(4));
    expect(s.phase).toEqual({ kind: 'characterPick' });
    const all = Object.values(s.characterOffers).flat();
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect(s.players.every((p) => p.character === null)).toBe(true);
  });

  it('选角色：选定后写进日志；全部选完进入第一夜；不能重复选，序号只能是 0 或 1', () => {
    let s = createGame(players(4), seededRng(4));
    const offers = s.characterOffers;
    s = act(s, { type: 'pickCharacter', seat: 0, index: 1 });
    expect(s.players[0].character).toBe(offers[0][1]);
    expect(s.log.at(-1)).toEqual({ t: 'character', seat: 0, character: offers[0][1] });
    expect(() => act(s, { type: 'pickCharacter', seat: 0, index: 0 })).toThrow(RuleError);
    expect(() => act(s, { type: 'pickCharacter', seat: 1, index: 2 })).toThrow(RuleError);
    for (const seat of [1, 2, 3]) s = act(s, { type: 'pickCharacter', seat, index: 0 });
    expect(s.phase).toEqual({ kind: 'dawn' });
    expect(s.characterOffers).toEqual({});
  });

  it('选角色超时：没选的人随机选一个', () => {
    let s = createGame(players(5), seededRng(4));
    s = act(s, { type: 'pickCharacter', seat: 2, index: 0 });
    const rng = seededRng(1);
    for (const a of autoActions(s, rng)) s = apply(s, a, rng);
    expect(s.players.every((p) => p.character !== null)).toBe(true);
    expect(s.phase).toEqual({ kind: 'dawn' });
  });

  it('候选只出现在本人的私密视图里', () => {
    const s = createGame(players(5), seededRng(4));
    const pub = JSON.stringify(projectPublic(s));
    for (const c of Object.values(s.characterOffers).flat()) expect(pub).not.toContain(`"${c}"`);
    for (const p of s.players) {
      const priv = projectPrivate(s, p.seat);
      expect(priv.pending).toEqual({ kind: 'characterPick', offers: s.characterOffers[p.seat] });
      const json = JSON.stringify(priv);
      for (const q of s.players) {
        if (q.seat === p.seat) continue;
        for (const c of s.characterOffers[q.seat]) expect(json).not.toContain(`"${c}"`);
      }
    }
  });
});

describe('裁缝', () => {
  it('技能等于右手边第一个活着的玩家；那人死亡后顺延', () => {
    const s = fixedGame();
    setCharacter(s, 2, 'tailor');
    setCharacter(s, 1, 'judge');
    setCharacter(s, 0, 'maid');
    expect(abilityOf(s, 2)).toBe('judge');
    s.players[1].alive = false;
    expect(abilityOf(s, 2)).toBe('maid');
    const view = projectPublic(s).players[2];
    expect(view.character).toBe('tailor');
    expect(view.ability).toBe('maid');
  });

  it('右手边的人没有角色时，裁缝没有技能', () => {
    const s = fixedGame();
    setCharacter(s, 2, 'tailor');
    expect(abilityOf(s, 2)).toBeNull();
  });
});

describe('限次技能', () => {
  it('剩余次数按本人计算；裁缝复制时单独计次；不限次的技能显示 null', () => {
    const s = fixedGame();
    setCharacter(s, 1, 'priest');
    setCharacter(s, 2, 'tailor');
    s.players[1].uses.priest = 2;
    expect(usesLeft(s, 1, 'priest')).toBe(0);
    expect(limitedLeft(s, 2)).toBe(2);
    const view = projectPublic(s);
    expect(view.players[1].usesLeft).toBe(0);
    expect(view.players[2].usesLeft).toBe(2);
    expect(view.players[3].usesLeft).toBeNull();
  });
});
```

在 `engine/test/view.test.ts` 的 `describe('projectPublic', ...)` 里加一条：

```ts
  it('弃牌堆内容公开（牧师技能和查看弃牌堆用）', () => {
    const s = fixedGame();
    const c = s.players[2].hand.pop()!;
    s.discard.push(c);
    expect(projectPublic(s).discard).toEqual([c]);
  });
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd engine && npx vitest run test/characters.test.ts test/view.test.ts`
Expected: FAIL（`../src/characters` 不存在；`setCharacter` 未导出；`discard` 为 undefined）

- [ ] **Step 3: 修改 `engine/src/types.ts`**

把 `RedCard` 改为（并在它后面加两个类型）：

```ts
/** 放在玩家面前的红卡，points 在打出时确定 */
export interface RedCard {
  id: string;
  kind: RedKind;
  points: number;
  /** 这张牌原来是什么卡（医生当作目击打出的辩护为 'alibi'）；没有这个字段时就是 kind 本身 */
  source?: CardKind;
}

export type CharacterId =
  | 'doctor'
  | 'beggar'
  | 'landlord'
  | 'judge'
  | 'priest'
  | 'storyteller'
  | 'tailor'
  | 'housewife'
  | 'farmer'
  | 'child'
  | 'minister'
  | 'official'
  | 'strongman'
  | 'maid'
  | 'maiden';

/** 整局限次的技能 */
export type LimitedAbility = 'priest' | 'storyteller' | 'official';
```

`Player` 里把 `character: string | null;` 换成：

```ts
  character: CharacterId | null;
  /** 限次技能已经用了几次（记在使用者本人身上，所以裁缝复制时单独计次） */
  uses: Partial<Record<LimitedAbility, number>>;
```

`Phase` 的第一项前面加一项：

```ts
  | { kind: 'characterPick' }
```

`GameEvent` 的最后一项（`gameEnd`）之前加两项：

```ts
  | { t: 'character'; seat: number; character: CharacterId }
  /** 技能生效。kind：被挡下的卡（乞丐、女仆）；from：死者（农民）；count：拿了几张（牧师） */
  | { t: 'ability'; seat: number; ability: CharacterId; kind?: CardKind; from?: number; count?: number }
```

`GameState` 里 `conspiracyPicks` 之后加：

```ts
  /** 选角色阶段每人的 2 个候选；选完后清空 */
  characterOffers: Record<number, CharacterId[]>;
```

`Action` 里加一项：

```ts
  | { type: 'pickCharacter'; seat: number; index: number }
```

- [ ] **Step 4: 新建 `engine/src/characters.ts`**

```ts
import { RuleError } from './errors';
import { shuffle, type Rng } from './rng';
import { getPlayer, rightOf, setPhase } from './state';
import type { CharacterId, GameState, LimitedAbility } from './types';

export const CHARACTERS: CharacterId[] = [
  'doctor',
  'beggar',
  'landlord',
  'judge',
  'priest',
  'storyteller',
  'tailor',
  'housewife',
  'farmer',
  'child',
  'minister',
  'official',
  'strongman',
  'maid',
  'maiden',
];

export const USE_LIMITS: Record<LimitedAbility, number> = { priest: 2, storyteller: 1, official: 1 };

/** 少于这个人数时每人从 2 个候选里选角色；达到时直接随机发 */
export const PICK_BELOW = 7;

/** 某座位此刻生效的技能：本人的角色；裁缝则是右手边第一个活着的玩家的角色 */
export function abilityOf(s: GameState, seat: number): CharacterId | null {
  const p = s.players[seat];
  if (!p) return null;
  if (p.character !== 'tailor') return p.character;
  const r = rightOf(s, seat);
  if (r === null) return null;
  const c = s.players[r].character;
  return c === 'tailor' ? null : c;
}

export function hasAbility(s: GameState, seat: number, id: CharacterId): boolean {
  return abilityOf(s, seat) === id;
}

export function isLimited(c: CharacterId | null): c is LimitedAbility {
  return c === 'priest' || c === 'storyteller' || c === 'official';
}

export function usesLeft(s: GameState, seat: number, a: LimitedAbility): number {
  return USE_LIMITS[a] - (getPlayer(s, seat).uses[a] ?? 0);
}

export function useAbility(s: GameState, seat: number, a: LimitedAbility): void {
  const p = getPlayer(s, seat);
  p.uses[a] = (p.uses[a] ?? 0) + 1;
}

/** 拥有这个限次技能，并且还有次数 */
export function canUse(s: GameState, seat: number, a: LimitedAbility): boolean {
  return hasAbility(s, seat, a) && usesLeft(s, seat, a) > 0;
}

/** 此刻生效的技能如果限次，还剩几次；不限次时为 null */
export function limitedLeft(s: GameState, seat: number): number | null {
  const a = abilityOf(s, seat);
  return isLimited(a) ? usesLeft(s, seat, a) : null;
}

/** 开局发角色：7 人及以上直接随机发；少于 7 人给每人 2 个候选，进入选角色阶段 */
export function dealCharacters(s: GameState, rng: Rng): void {
  const ids = shuffle(CHARACTERS, rng);
  if (s.players.length >= PICK_BELOW) {
    s.players.forEach((p, i) => {
      p.character = ids[i];
      s.log.push({ t: 'character', seat: p.seat, character: ids[i] });
    });
    return;
  }
  s.players.forEach((p, i) => {
    s.characterOffers[p.seat] = [ids[2 * i], ids[2 * i + 1]];
  });
  s.phase = { kind: 'characterPick' };
}

export function pickCharacter(s: GameState, seat: number, index: number): void {
  if (s.phase.kind !== 'characterPick') throw new RuleError('现在不能选角色');
  const p = getPlayer(s, seat);
  const offers = s.characterOffers[seat];
  if (!offers || p.character !== null) throw new RuleError('你已经选过角色了');
  if (index !== 0 && index !== 1) throw new RuleError('选择无效');
  p.character = offers[index];
  s.log.push({ t: 'character', seat, character: offers[index] });
  if (s.players.every((q) => q.character !== null)) {
    s.characterOffers = {};
    setPhase(s, { kind: 'dawn' });
  }
}
```

- [ ] **Step 5: 修改 `engine/src/setup.ts`**

顶部加导入 `import { dealCharacters } from './characters';`，类型导入改为 `import type { Card, GameState, Player } from './types';`。

`players` 的每个对象里，`character: null,` 之后加 `uses: {},`。

把末尾的 `return { ... };` 改为：

```ts
  const state: GameState = {
    players,
    deck,
    discard: [],
    setAside: [{ id: 'blackCat-1', kind: 'blackCat' }],
    turn: 0,
    drawsLeft: 0,
    phase: { kind: 'dawn' },
    dawnVotes: {},
    night: null,
    conspiracyPicks: {},
    characterOffers: {},
    log: [{ t: 'gameStart', players: players.length }],
    version: 0,
  };
  // 角色最后才发：之前的随机数顺序不变，同一种子下身份卡和牌堆与没有角色时相同
  dealCharacters(state, rng);
  return state;
```

- [ ] **Step 6: 修改 `engine/src/apply.ts`**

导入 `import { pickCharacter } from './characters';`，在 `switch` 的 `conspiracyPick` 分支后加：

```ts
    case 'pickCharacter':
      pickCharacter(s, action.seat, action.index);
      break;
```

- [ ] **Step 7: 修改 `engine/src/auto.ts`**

在 `switch (ph.kind)` 里、`case 'day':` 之前加：

```ts
    case 'characterPick':
      return s.players
        .filter((p) => p.character === null && s.characterOffers[p.seat])
        .map((p): Action => ({ type: 'pickCharacter', seat: p.seat, index: rng.next() < 0.5 ? 0 : 1 }));
```

- [ ] **Step 8: 修改 `engine/src/view.ts`**

导入改为：

```ts
import { abilityOf, limitedLeft } from './characters';
import { conspiracyPickers } from './conspiracy';
import { constableSeat, getPlayer, leftOf, redTotal, unrevealed } from './state';
import { trialThreshold } from './trial';
import type { Card, CharacterId, GameEvent, GameState, Phase, RedKind, Tryal, TryalKind } from './types';
```

`PublicPlayer` 里把 `character: string | null;` 换成：

```ts
  character: CharacterId | null;
  /** 此刻生效的技能（裁缝为右手边玩家的角色） */
  ability: CharacterId | null;
  /** 此刻生效的技能如果限次，还剩几次；不限次时为 null */
  usesLeft: number | null;
```

`PublicView` 里 `discardCount: number;` 之后加：

```ts
  /** 弃牌堆内容（实体游戏里可以查看） */
  discard: Card[];
```

`projectPublic` 里 `character: p.character,` 之后加：

```ts
      ability: abilityOf(s, p.seat),
      usesLeft: limitedLeft(s, p.seat),
```

`discardCount: s.discard.length,` 之后加 `discard: s.discard,`。

`PendingChoice` 加一项：

```ts
  | { kind: 'characterPick'; offers: CharacterId[] }
```

`pendingFor` 的 `switch` 里加：

```ts
    case 'characterPick': {
      const offers = s.characterOffers[seat];
      return offers && p.character === null ? { kind: 'characterPick', offers } : null;
    }
```

- [ ] **Step 9: 修改 `engine/src/index.ts`**

加一行：

```ts
export { abilityOf, CHARACTERS, PICK_BELOW, USE_LIMITS } from './characters';
```

- [ ] **Step 10: 修改 `engine/test/helpers.ts`**

类型导入改为 `import type { Card, CardKind, CharacterId, GameState, TryalKind } from '../src/types';`。把 `newGame` 换成下面三个函数：

```ts
/** 去掉随机角色，直接从第一夜开始（大多数规则测试不希望角色干扰） */
export function withoutCharacters(s: GameState): GameState {
  for (const p of s.players) p.character = null;
  s.characterOffers = {};
  s.log = s.log.filter((e) => e.t !== 'character');
  if (s.phase.kind === 'characterPick') s.phase = { kind: 'dawn' };
  return s;
}

export function newGame(n = 5, seed = 1): GameState {
  return withoutCharacters(
    createGame(
      Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
      seededRng(seed),
    ),
  );
}

export function setCharacter(s: GameState, seat: number, c: CharacterId): void {
  s.players[seat].character = c;
}
```

- [ ] **Step 11: 运行引擎测试**

Run: `cd engine && npx vitest run && npx tsc --noEmit`
Expected: 全部 PASS，类型检查无输出。

- [ ] **Step 12: 客户端：角色文字、日志、阶段标题**

新建 `client/src/model/characters.ts`：

```ts
import type { CharacterId } from '../../../engine/src/index';

/** name：全名；short：格子里用的两字简称；desc：技能说明 */
export const CHAR_INFO: Record<CharacterId, { name: string; short: string; desc: string }> = {
  doctor: { name: '医生', short: '医生', desc: '可以把「辩护」当作「目击」（7 点）打出' },
  beggar: { name: '乞丐', short: '乞丐', desc: '对你打出的「抢劫」「纵火」无效，并立刻丢弃' },
  landlord: { name: '地主', short: '地主', desc: '抽牌时如果抽出 2 张「指控」，展示这 2 张，再抽一张' },
  judge: { name: '法官', short: '法官', desc: '你打出的红卡使目标累计达到 6 点，即可审判该玩家' },
  priest: { name: '牧师', short: '牧师', desc: '游戏中两次：抽牌时可以改为从弃牌堆选最多 2 张非黑卡加入手牌' },
  storyteller: { name: '说书人', short: '说书', desc: '游戏中一次：你的回合抽牌前，可以任意调整牌堆顺序，限时 2 分钟' },
  tailor: { name: '裁缝', short: '裁缝', desc: '技能与右手边第一名活着的玩家一致' },
  housewife: { name: '家庭主妇', short: '主妇', desc: '其他玩家的身份卡因审判或黑猫被翻开时，你从牌堆抽一张牌' },
  farmer: { name: '农民', short: '农民', desc: '有玩家死亡时，你获得他的所有手牌和面前的蓝卡' },
  child: { name: '小孩', short: '小孩', desc: '你发起的审判结束后，丢弃你自己面前所有「指控」和「证据」' },
  minister: { name: '部长', short: '部长', desc: '对你打出的「证据」只算 1 点' },
  official: { name: '官员', short: '官员', desc: '游戏中一次：你自首时无需翻开身份卡' },
  strongman: { name: '大力士', short: '力士', desc: '对你的审判线为 8 点' },
  maid: { name: '女仆', short: '女仆', desc: '「黑猫」和「情侣」对你无效' },
  maiden: { name: '少女', short: '少女', desc: '你发起审判时，审判前先抽 2 张牌，本回合可以立即使用' },
};
```

`client/src/model/log.ts`：导入 `import { CHAR_INFO } from './characters';`，在 `describeEvent` 之前加：

```ts
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
```

并在 `describeEvent` 的 `switch` 里、`case 'gameEnd':` 之前加：

```ts
    case 'character':
      return `${name(e.seat)} 的角色是「${CHAR_INFO[e.character].name}」`;
    case 'ability':
      return abilityLine(e, name);
```

`client/src/model/table.ts` 的 `phaseTitle` 的 `switch` 里加：

```ts
    case 'characterPick':
      return '选择角色';
```

`client/src/scenes/choicePanels.ts` 的 `choicePanel` 里，在 `if (p.kind === 'revealTryal') {` 之前加一行（Task 9 会换成真正的选角色面板）：

```ts
  if (p.kind === 'characterPick') return [];
```

`client/test/fixtures.ts` 的 `newState` 改为：

```ts
export function newState(n = 5, seed = 1): GameState {
  const s = createGame(
    Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
    seededRng(seed),
  );
  // 大多数界面测试不关心角色：去掉随机角色，直接从第一夜开始
  for (const p of s.players) p.character = null;
  s.characterOffers = {};
  s.log = s.log.filter((e) => e.t !== 'character');
  if (s.phase.kind === 'characterPick') s.phase = { kind: 'dawn' };
  return s;
}
```

`client/test/model.test.ts` 的 `describe('日志', ...)` 里加：

```ts
  it('角色和技能事件', () => {
    const name = (seat: number) => `P${seat}`;
    expect(describeEvent({ t: 'character', seat: 2, character: 'judge' }, name)).toBe('P2 的角色是「法官」');
    expect(describeEvent({ t: 'ability', seat: 3, ability: 'maid', kind: 'matchmaker' }, name)).toBe('P3（女仆）：「情侣」对 TA 无效，直接丢弃');
    expect(describeEvent({ t: 'ability', seat: 1, ability: 'farmer', from: 4 }, name)).toBe('P1（农民） 获得了 P4 的手牌和蓝卡');
    expect(describeEvent({ t: 'ability', seat: 0, ability: 'priest', count: 2 }, name)).toBe('P0（牧师） 从弃牌堆拿了 2 张牌');
  });
```

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 13: 服务器：选角色时限与测试辅助**

`server/src/deadlines.ts` 加常量 `export const PICK_MS = 30_000;`，`phaseDuration` 改为：

```ts
export function phaseDuration(s: GameState): number {
  if (s.phase.kind === 'characterPick') return PICK_MS;
  if (s.phase.kind !== 'day') return CHOICE_MS;
  return isBot(s.players[s.turn].openid) ? BOT_TURN_MS : TURN_MS;
}
```

`server/test/helpers.ts`：顶部导入合并为

```ts
import { projectPrivate, projectPublic, seededRng, type GameState } from '../../engine/src/index';
import { CHOICE_MS } from '../src/deadlines';
import { createRoom, joinRoom } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import type { Tx } from '../src/store';
import { GAMES, handId, HANDS, isBot, ROOMS, type GameDoc, type HandDoc, type RoomDoc } from '../src/types';
```

文件末尾追加：

```ts
/** 直接改写局面，并同步 rooms 视图和每人的 hands（测试专用）。deadline 不传时保持原截止时间。 */
export async function mutateGame(
  store: MemoryStore,
  code: string,
  fn: (s: GameState) => void,
  deadline?: { key: string; at: number },
): Promise<void> {
  await run(store, async (tx) => {
    const g = (await tx.get<GameDoc>(GAMES, code)) as GameDoc;
    fn(g.state);
    if (deadline) {
      g.deadlineKey = deadline.key;
      g.deadline = deadline.at;
    }
    await tx.set(GAMES, code, g);
    const room = (await tx.get<RoomDoc>(ROOMS, code)) as RoomDoc;
    await tx.set(ROOMS, code, { ...room, view: projectPublic(g.state), deadline: g.deadline });
    for (const p of g.state.players) {
      if (isBot(p.openid)) continue;
      const hand = (await tx.get<HandDoc>(HANDS, handId(code, p.openid))) as HandDoc;
      await tx.set(HANDS, handId(code, p.openid), { ...hand, view: projectPrivate(g.state, p.seat) });
    }
  });
}

/** 跳过选角色：去掉角色、直接进入第一夜，截止时间设为 NOW + 45 秒（大多数测试不关心角色） */
export function skipCharacters(store: MemoryStore, code: string): Promise<void> {
  return mutateGame(
    store,
    code,
    (s) => {
      for (const p of s.players) p.character = null;
      s.characterOffers = {};
      s.log = s.log.filter((e) => e.t !== 'character');
      s.phase = { kind: 'dawn' };
    },
    { key: 'dawn', at: NOW + CHOICE_MS },
  );
}
```

`server/test/game.test.ts`：
- 从 `../src/deadlines` 的导入加上 `PICK_MS`；从 `./helpers` 的导入加上 `skipCharacters`。
- `started` 改为：

```ts
async function started(n = 5) {
  const { store, code } = await lobbyWith(n);
  await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
  await skipCharacters(store, code);
  return { store, code };
}
```

- 在 `describe('startGame', ...)` 里加：

```ts
  it('不到 7 人时先选角色：限时 30 秒，每人的手牌文档里有自己的 2 个候选', async () => {
    const { store, code } = await lobbyWith(5);
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    const r = room(store, code);
    expect(r.view!.phase).toEqual({ kind: 'characterPick' });
    expect(r.deadline).toBe(NOW + PICK_MS);
    const offers = game(store, code).state.characterOffers;
    const hand = store.read<HandDoc>(HANDS, handId(code, 'u0'))!;
    expect(hand.view.pending).toEqual({ kind: 'characterPick', offers: offers[0] });
  });
```

- `it('轮到机器人时只等 3 秒', ...)` 里，把 `const t = NOW + CHOICE_MS;` 和紧接着的那次 `tick` 换成（先过选角色，再过第一夜）：

```ts
    await run(store, (tx) => tick(tx, code, NOW + PICK_MS, rng()));
    const t = NOW + PICK_MS + CHOICE_MS;
    await run(store, (tx) => tick(tx, code, t, rng()));
```

`server/test/deadlines.test.ts`：
- 导入加上 `PICK_MS`。
- `it('其他阶段', ...)` 里，在 `expect(deadlineKey(s)).toBe('dawn');` 之前加：

```ts
    expect(deadlineKey(s)).toBe('characterPick');
    s.phase = { kind: 'dawn' };
```

- `it('真人回合 90 秒...', ...)` 的第一条断言 `expect(phaseDuration(s)).toBe(CHOICE_MS);` 换成：

```ts
    expect(phaseDuration(s)).toBe(PICK_MS);
    s.phase = { kind: 'dawn' };
    expect(phaseDuration(s)).toBe(CHOICE_MS);
```

  最后一行改为 `expect([TURN_MS, BOT_TURN_MS, CHOICE_MS, PICK_MS]).toEqual([90_000, 3_000, 45_000, 30_000]);`

Run: `cd server && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 14: 提交**

```bash
git add engine server/src server/test client/src client/test
git commit -m "feat(engine): characters — deal or pick at game start, tailor ability lookup, limited uses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 流程栈（重构，不改变现有行为）

回合外摸牌（Task 4 的家庭主妇、少女）可能摸到黑卡，需要「立即结算，结算完回到被打断的流程」。这一步先把现有的传染、审判、夜晚改成走同一个流程栈，行为与现在完全一致；Task 4 再往栈里加回合外摸牌。

**Files:**
- Create: `engine/src/flow.ts`、`engine/test/flow.test.ts`
- Modify: `engine/src/types.ts`、`engine/src/setup.ts`、`engine/src/turn.ts`、`engine/src/conspiracy.ts`、`engine/src/night.ts`、`engine/src/trial.ts`、`engine/src/play.ts`、`engine/src/apply.ts`
- Modify: `engine/test/helpers.ts`、`engine/test/simulate.test.ts`

**Interfaces:**
- Produces（类型）：`Step`（`draw` / `trial` / `finishTrial` / `picks` / `drawing`）；`GameState.steps: Step[]`、`GameState.endTurnAfter: boolean`。
- Produces（`flow.ts`）：`type StepResult = 'done' | 'paused'`；`proceed(s, rng)`；`takeCard(s, seat, card, rng)`；`backToPlaying(s)`。
- Changes：`checkTrial(s, target, initiator, rng)`（多了 `rng`）；`finishTrial(s, target, initiator)`（多了 `initiator`）；`playCard(s, seat, cardId, targets, option, rng)`（多了 `rng`）；`startConspiracy(s, card): StepResult`（去掉 `rng`）；`beginPicks(s): StepResult`（导出）；`continueDrawing` / `resumeDrawing` 返回 `StepResult`。
- Produces（测试辅助）：`quietNight(s)`、`allPick(s, index?)`。
- 不变量：回到白天「选择 / 出牌」时 `steps` 为空且 `endTurnAfter` 为 false。

- [ ] **Step 1: 写失败测试**

`engine/test/helpers.ts` 顶部加导入：

```ts
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
```

末尾追加：

```ts
/** 平静的夜晚（fixedGame 专用）：0 号女巫和 1 号警长都选 4 号，所有人不自首，没有人死亡 */
export function quietNight(s: GameState): GameState {
  const rng = seededRng(7);
  s = apply(s, { type: 'witchVote', seat: 0, target: 4 }, rng);
  s = apply(s, { type: 'protect', seat: 1, target: 4 }, rng);
  for (const p of s.players) {
    if (p.alive && s.phase.kind === 'night') s = apply(s, { type: 'confess', seat: p.seat, tryalId: null }, rng);
  }
  return s;
}

/** 传染：所有需要拿牌的人都拿左边的第 index 张 */
export function allPick(s: GameState, index = 0): GameState {
  const rng = seededRng(7);
  for (const p of s.players) {
    if (!p.alive || s.phase.kind !== 'conspiracyPick') continue;
    try {
      s = apply(s, { type: 'conspiracyPick', seat: p.seat, index }, rng);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
    }
  }
  return s;
}
```

新建 `engine/test/flow.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { proceed } from '../src/flow';
import { seededRng } from '../src/rng';
import { allPick, fixedGame, quietNight, stackDeck } from './helpers';

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民；轮到 2 号

describe('流程栈', () => {
  it('审判收尾后，如果这次打断里出现过夜晚，结束当前回合', () => {
    const s = fixedGame();
    s.players[3].red = [{ id: 'r1', kind: 'accusation', points: 1 }];
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 });
    s.endTurnAfter = true;
    proceed(s, seededRng(1));
    expect(s.players[3].red).toEqual([]);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.endTurnAfter).toBe(false);
  });

  it('审判开始前被审判者已经死亡：取消审判，回到出牌模式', () => {
    const s = fixedGame();
    s.players[3].alive = false;
    s.steps.push({ kind: 'trial', target: 3, initiator: 2 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.log.some((e) => e.t === 'trial')).toBe(false);
  });

  it('遇到需要玩家操作的阶段就停下，剩下的步骤保留', () => {
    const s = fixedGame();
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'trial', target: 4, initiator: 2 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 4, initiator: 2 });
    expect(s.steps).toEqual([{ kind: 'finishTrial', target: 3, initiator: 2 }]);
  });

  it('回合外摸到普通牌：加入手牌，接着走下一步', () => {
    const s = fixedGame();
    stackDeck(s, ['alibi']);
    const before = s.players[4].hand.length;
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'draw', seat: 4 });
    proceed(s, seededRng(1));
    expect(s.players[4].hand).toHaveLength(before + 1);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.steps).toEqual([]);
  });

  it('回合外摸到夜晚：立即进入夜晚；夜晚后回来走完剩下的流程，再结束当前回合', () => {
    let s = fixedGame();
    s.players[3].red = [{ id: 'r1', kind: 'accusation', points: 1 }];
    stackDeck(s, ['night']);
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'draw', seat: 4 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'night' });
    expect(s.players[3].red).toHaveLength(1);
    s = quietNight(s);
    expect(s.players[3].red).toEqual([]);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });

  it('回合外摸到传染（没有黑猫）：立即盲抽，之后回到原流程，回合不结束', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy']);
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'draw', seat: 4 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = allPick(s);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
    expect(s.steps).toEqual([]);
  });
});
```

`engine/test/simulate.test.ts` 的 `checkInvariants` 里，在 `if (s.phase.kind === 'ended') return;` 之前加：

```ts
  if (s.phase.kind === 'day' && s.phase.mode !== 'drawing' && (s.steps.length > 0 || s.endTurnAfter)) {
    throw new Error(`第 ${seed} 局：回到白天时还有没走完的流程`);
  }
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd engine && npx vitest run test/flow.test.ts`
Expected: FAIL（`../src/flow` 不存在）

- [ ] **Step 3: 修改 `engine/src/types.ts`**

在 `GameState` 之前加：

```ts
/** 被打断后要继续的流程（见 flow.ts） */
export type Step =
  /** 回合外摸一张牌（家庭主妇、少女） */
  | { kind: 'draw'; seat: number }
  /** 开始审判（被审判者已死亡则取消） */
  | { kind: 'trial'; target: number; initiator: number }
  /** 审判收尾：丢弃被审判者的红卡，回到出牌模式 */
  | { kind: 'finishTrial'; target: number; initiator: number }
  /** 传染：黑猫翻牌之后开始盲抽 */
  | { kind: 'picks' }
  /** 传染结算完后，当前玩家继续正常抽牌 */
  | { kind: 'drawing' };
```

`GameState` 里 `characterOffers` 之后加：

```ts
  /** 待继续的流程，最后一个先执行；回到白天等待操作时一定为空 */
  steps: Step[];
  /** 这次打断中出现过夜晚：流程全部走完后结束当前回合 */
  endTurnAfter: boolean;
```

- [ ] **Step 4: 修改 `engine/src/setup.ts`**

`state` 对象里 `characterOffers: {},` 之后加：

```ts
    steps: [],
    endTurnAfter: false,
```

- [ ] **Step 5: 新建 `engine/src/flow.ts`**

```ts
import { beginPicks, startConspiracy } from './conspiracy';
import { startNight } from './night';
import type { Rng } from './rng';
import { getPlayer, isEnded, setPhase } from './state';
import { finishTrial } from './trial';
import { drawOne, endTurn, resumeDrawing } from './turn';
import type { Card, GameState, Step } from './types';

/** 一个流程步骤的结果：paused = 进入了需要玩家操作的阶段 */
export type StepResult = 'done' | 'paused';

/**
 * 依次执行被打断后要继续的流程。遇到需要玩家操作的阶段就停下，
 * 等那个操作完成后再调用本函数；全部走完后，如果这次打断中出现过夜晚，结束当前回合。
 */
export function proceed(s: GameState, rng: Rng): void {
  while (!isEnded(s)) {
    const step = s.steps.pop();
    if (!step) break;
    if (runStep(s, step, rng) === 'paused') return;
  }
  if (isEnded(s)) return;
  if (s.endTurnAfter) {
    s.endTurnAfter = false;
    endTurn(s);
  }
}

function runStep(s: GameState, step: Step, rng: Rng): StepResult {
  switch (step.kind) {
    case 'draw': {
      if (!getPlayer(s, step.seat).alive) return 'done';
      const card = drawOne(s, rng);
      return card ? takeCard(s, step.seat, card, rng) : 'done';
    }
    case 'trial':
      if (!getPlayer(s, step.target).alive) {
        backToPlaying(s);
        return 'done';
      }
      s.log.push({ t: 'trial', target: step.target, initiator: step.initiator });
      setPhase(s, { kind: 'trialReveal', target: step.target, initiator: step.initiator });
      return 'paused';
    case 'finishTrial':
      finishTrial(s, step.target, step.initiator);
      return 'done';
    case 'picks':
      return beginPicks(s);
    case 'drawing':
      return resumeDrawing(s, rng);
  }
}

/** 回合外摸到的一张牌：黑卡立即结算，其余加入手牌 */
export function takeCard(s: GameState, seat: number, card: Card, rng: Rng): StepResult {
  if (card.kind === 'night') {
    s.log.push({ t: 'blackDrawn', seat, kind: 'night' });
    s.discard.push(card);
    startNight(s);
    return 'paused';
  }
  if (card.kind === 'conspiracy') {
    s.log.push({ t: 'blackDrawn', seat, kind: 'conspiracy' });
    return startConspiracy(s, card);
  }
  getPlayer(s, seat).hand.push(card);
  s.log.push({ t: 'draw', seat });
  return 'done';
}

/** 回到当前玩家的出牌模式；当前玩家已死亡时，等流程走完后结束回合 */
export function backToPlaying(s: GameState): void {
  setPhase(s, { kind: 'day', mode: 'playing' });
  if (!s.players[s.turn].alive) s.endTurnAfter = true;
}
```

（`takeCard` 里的 `rng` 在本任务暂未使用，保留是为了和调用方一致。）

- [ ] **Step 6: 重写 `engine/src/turn.ts`**

```ts
import { startConspiracy } from './conspiracy';
import { RuleError } from './errors';
import type { StepResult } from './flow';
import { startNight } from './night';
import { shuffle, type Rng } from './rng';
import { isEnded, setPhase } from './state';
import type { Card, GameState } from './types';

/** 从 fromSeat 开始（含）找到下一个可以行动的玩家；被拘留的玩家跳过一次并移除拘留 */
export function startTurn(s: GameState, fromSeat: number): void {
  if (s.phase.kind === 'ended') return;
  const n = s.players.length;
  let seat = ((fromSeat % n) + n) % n;
  for (let i = 0; i < n * 2; i++) {
    const p = s.players[seat];
    if (p.alive) {
      const idx = p.green.findIndex((c) => c.kind === 'stocks');
      if (idx >= 0) {
        s.discard.push(...p.green.splice(idx, 1));
        s.log.push({ t: 'skipped', seat });
      } else {
        s.turn = seat;
        s.drawsLeft = 0;
        setPhase(s, { kind: 'day', mode: 'choose' });
        s.log.push({ t: 'turn', seat });
        return;
      }
    }
    seat = (seat + 1) % n;
  }
  throw new RuleError('没有可以行动的玩家');
}

export function endTurn(s: GameState): void {
  startTurn(s, s.turn + 1);
}

/** 从牌堆顶抽一张；牌堆空了就把弃牌堆洗成新牌堆 */
export function drawOne(s: GameState, rng: Rng): Card | null {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null;
    s.deck = shuffle(s.discard, rng);
    s.discard = [];
    s.log.push({ t: 'reshuffle' });
  }
  return s.deck.shift() ?? null;
}

export function startDrawing(s: GameState, rng: Rng): void {
  s.drawsLeft = 2;
  setPhase(s, { kind: 'day', mode: 'drawing' });
  continueDrawing(s, rng);
}

/** 抽到 2 张非黑卡为止；抽到夜晚进入夜晚（夜晚后回合结束），抽到传染先结算传染再继续抽 */
export function continueDrawing(s: GameState, rng: Rng): StepResult {
  while (s.drawsLeft > 0) {
    const card = drawOne(s, rng);
    if (!card) {
      s.drawsLeft = 0;
      break;
    }
    if (card.kind === 'night') {
      s.log.push({ t: 'blackDrawn', seat: s.turn, kind: 'night' });
      s.discard.push(card);
      s.drawsLeft = 0;
      startNight(s);
      return 'paused';
    }
    if (card.kind === 'conspiracy') {
      s.log.push({ t: 'blackDrawn', seat: s.turn, kind: 'conspiracy' });
      s.steps.push({ kind: 'drawing' });
      if (startConspiracy(s, card) === 'paused') return 'paused';
      s.steps.pop();
      return resumeDrawing(s, rng);
    }
    s.players[s.turn].hand.push(card);
    s.drawsLeft--;
    s.log.push({ t: 'draw', seat: s.turn });
  }
  endTurn(s);
  return 'done';
}

/** 传染结算完后回到抽牌；当前玩家已经死亡、或这次打断中出现过夜晚时不再继续抽 */
export function resumeDrawing(s: GameState, rng: Rng): StepResult {
  if (isEnded(s) || s.endTurnAfter) return 'done';
  setPhase(s, { kind: 'day', mode: 'drawing' });
  if (!s.players[s.turn].alive) {
    s.drawsLeft = 0;
    endTurn(s);
    return 'done';
  }
  return continueDrawing(s, rng);
}
```

- [ ] **Step 7: 重写 `engine/src/conspiracy.ts`**

```ts
import { checkWin, revealTryal } from './death';
import { RuleError } from './errors';
import { proceed, type StepResult } from './flow';
import type { Rng } from './rng';
import { aliveSeats, catHolder, getPlayer, leftOf, setPhase, unrevealed } from './state';
import type { Card, GameState } from './types';

/** 抽到传染：有黑猫时持有者先翻牌（之后再盲抽），没有黑猫时直接盲抽 */
export function startConspiracy(s: GameState, card: Card): StepResult {
  s.discard.push(card);
  const holder = catHolder(s);
  if (holder !== null) {
    s.steps.push({ kind: 'picks' });
    setPhase(s, { kind: 'catReveal', holder });
    return 'paused';
  }
  return beginPicks(s);
}

export function catReveal(s: GameState, seat: number, tryalId: string, rng: Rng): void {
  if (s.phase.kind !== 'catReveal' || s.phase.holder !== seat) throw new RuleError('现在不能翻开身份卡');
  revealTryal(s, seat, tryalId, 'cat');
  proceed(s, rng);
}

/** 需要拿牌的玩家：活着，且左边邻居还有未翻开的身份卡 */
export function conspiracyPickers(s: GameState): number[] {
  return aliveSeats(s).filter((seat) => {
    const left = leftOf(s, seat);
    return left !== null && unrevealed(getPlayer(s, left)).length > 0;
  });
}

/** 开始盲抽；没有人需要抽时直接完成传染 */
export function beginPicks(s: GameState): StepResult {
  s.conspiracyPicks = {};
  setPhase(s, { kind: 'conspiracyPick' });
  if (conspiracyPickers(s).length > 0) return 'paused';
  finishConspiracy(s);
  return 'done';
}

export function conspiracyPick(s: GameState, seat: number, index: number, rng: Rng): void {
  if (s.phase.kind !== 'conspiracyPick') throw new RuleError('现在不能拿身份卡');
  if (!conspiracyPickers(s).includes(seat)) throw new RuleError('你不需要拿身份卡');
  if (seat in s.conspiracyPicks) throw new RuleError('你已经拿过了');
  const left = leftOf(s, seat) as number;
  const count = unrevealed(getPlayer(s, left)).length;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RuleError('选择的位置无效');
  s.conspiracyPicks[seat] = index;
  if (conspiracyPickers(s).every((p) => p in s.conspiracyPicks)) {
    finishConspiracy(s);
    proceed(s, rng);
  }
}

/** 所有人同时拿牌：先按拿牌前的局面算出每一步，再一起移动 */
function finishConspiracy(s: GameState): void {
  const moves = conspiracyPickers(s).map((seat) => {
    const from = leftOf(s, seat) as number;
    const tryal = unrevealed(getPlayer(s, from))[s.conspiracyPicks[seat]];
    return { seat, from, tryalId: tryal.id };
  });
  for (const m of moves) {
    const giver = getPlayer(s, m.from);
    const i = giver.tryals.findIndex((t) => t.id === m.tryalId);
    const [tryal] = giver.tryals.splice(i, 1);
    const receiver = getPlayer(s, m.seat);
    receiver.tryals.push(tryal);
    if (tryal.kind === 'witch') receiver.witchFaction = true;
  }
  s.conspiracyPicks = {};
  s.log.push({ t: 'conspiracyDone' });
  checkWin(s);
}
```

注意：`beginPicks` 在「没有人需要抽」时同步完成传染，此时 `s.conspiracyPicks` 为空，`finishConspiracy` 的 `moves` 也为空。

- [ ] **Step 8: 修改 `engine/src/night.ts`**

导入改为：

```ts
import { killPlayer, revealTryal } from './death';
import { RuleError } from './errors';
import { proceed } from './flow';
import { shuffle, type Rng } from './rng';
import { aliveSeats, constableSeat, getPlayer, isEnded, setPhase, unrevealed, witchSeats } from './state';
import { startTurn } from './turn';
import type { GameState } from './types';
```

`tryResolveNight` 的最后一行 `endTurn(s);` 换成：

```ts
  // 夜晚总是结束当前回合：先走完被夜晚打断的流程（如果有），再结束
  s.endTurnAfter = true;
  proceed(s, rng);
```

- [ ] **Step 9: 重写 `engine/src/trial.ts`**

```ts
import { backToPlaying, proceed } from './flow';
import type { Rng } from './rng';
import { getPlayer, isEnded, redTotal, toCard } from './state';
import type { GameState } from './types';

export const DEFAULT_TRIAL_THRESHOLD = 7;

/** Task 3 会在这里加入大力士（8）和法官（6） */
export function trialThreshold(_s: GameState, _target: number, _initiator: number | null): number {
  return DEFAULT_TRIAL_THRESHOLD;
}

/** 红卡累计达到审判线时开始审判（经过流程栈，Task 4 的少女会在审判前插入摸牌） */
export function checkTrial(s: GameState, target: number, initiator: number, rng: Rng): void {
  const p = getPlayer(s, target);
  if (!p.alive || isEnded(s)) return;
  if (redTotal(p) < trialThreshold(s, target, initiator)) return;
  s.steps.push({ kind: 'trial', target, initiator });
  proceed(s, rng);
}

/** 审判收尾：丢弃被审判者面前的红卡，回到当前玩家的出牌模式 */
export function finishTrial(s: GameState, target: number, _initiator: number): void {
  const p = getPlayer(s, target);
  if (p.alive) {
    s.discard.push(...p.red.map(toCard));
    p.red = [];
  }
  backToPlaying(s);
}
```

- [ ] **Step 10: 修改 `engine/src/play.ts`**

- 导入加 `import type { Rng } from './rng';`。
- 签名改为 `export function playCard(s: GameState, seat: number, cardId: string, targets: number[], option: string | undefined, rng: Rng): void {`
- 两处 `checkTrial(s, target.seat, seat);`、`checkTrial(s, to.seat, seat);` 改为在末尾加上 `, rng`。

- [ ] **Step 11: 修改 `engine/src/apply.ts`**

- 删除 `import { finishTrial } from './trial';`，加 `import { proceed } from './flow';`。
- `case 'play':` 改为 `playCard(s, action.seat, action.cardId, action.targets, action.option, rng);`
- `handleReveal` 的审判分支改为：

```ts
  if (ph.kind === 'trialReveal' && ph.target === seat) {
    revealTryal(s, seat, tryalId, 'trial');
    s.steps.push({ kind: 'finishTrial', target: seat, initiator: ph.initiator });
    proceed(s, rng);
    return;
  }
```

- [ ] **Step 12: 运行全部测试**

Run: `cd engine && npx vitest run && npx tsc --noEmit`
Expected: 全部 PASS（包括原有的全部测试和 1000 局随机模拟）。

Run: `cd server && npx vitest run && npm run typecheck` 和 `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 13: 提交**

```bash
git add engine
git commit -m "refactor(engine): flow stack for interrupted flows (conspiracy, trial, night)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 不需要操作的角色规则（法官、大力士、部长、女仆、乞丐、小孩、农民）与医生

**Files:**
- Modify: `engine/src/play.ts`（整个文件重写）、`engine/src/death.ts`（整个文件重写）、`engine/src/trial.ts`、`engine/src/night.ts`、`engine/src/auto.ts`、`engine/src/state.ts`
- Create: `engine/test/abilities.test.ts`
- Modify: `engine/test/helpers.ts`

**Interfaces:**
- Consumes：`hasAbility`（Task 1）；`checkTrial(s, target, initiator, rng)`、`backToPlaying`（Task 2）。
- Produces：`JUDGE_THRESHOLD = 6`、`STRONGMAN_THRESHOLD = 8`（`trial.ts`）；`MINISTER_EVIDENCE = 1`（`play.ts`）；出牌选项 `option: 'witness'`（医生的辩护）；`toCard` 支持 `source`。
- Produces（测试辅助）：`placeRed(s, seat, kind)`。

- [ ] **Step 1: 测试辅助**

`engine/test/helpers.ts`：导入加上 `import { RED_POINTS } from '../src/cards';`，类型导入加上 `RedKind`。末尾追加：

```ts
/** 在玩家面前放一张红卡（点数按默认值），卡从别处拿来，总卡数不变 */
export function placeRed(s: GameState, seat: number, kind: RedKind): Card {
  const c = takeFromAnywhere(s, kind);
  s.players[seat].red.push({ id: c.id, kind, points: RED_POINTS[kind] });
  return c;
}
```

- [ ] **Step 2: 写失败测试**

新建 `engine/test/abilities.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { killPlayer } from '../src/death';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { countCards, redTotal } from '../src/state';
import type { Action, GameState } from '../src/types';
import { projectPublic } from '../src/view';
import { fixedGame, giveCard, placeBlue, placeRed, setCharacter } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));
const play = (s: GameState, seat: number, cardId: string, targets: number[], option?: string) =>
  act(s, { type: 'play', seat, cardId, targets, option });

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民；轮到 2 号

describe('法官与大力士', () => {
  it('法官打出的红卡让目标达到 6 点即审判；普通玩家到 6 点不审判', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'judge');
    const a = giveCard(s, 2, 'evidence');
    const b = giveCard(s, 2, 'evidence');
    s = play(s, 2, a.id, [3]);
    s = play(s, 2, b.id, [3]);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });

    let t = fixedGame();
    const c = giveCard(t, 2, 'evidence');
    const d = giveCard(t, 2, 'evidence');
    t = play(t, 2, c.id, [3]);
    t = play(t, 2, d.id, [3]);
    expect(t.phase).toEqual({ kind: 'day', mode: 'playing' });
  });

  it('对大力士审判线是 8 点，公开视图显示 8', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'strongman');
    expect(projectPublic(s).players[3].threshold).toBe(8);
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    const a = giveCard(s, 2, 'accusation');
    s = play(s, 2, a.id, [3]);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
  });

  it('法官对大力士仍按 6 点', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'judge');
    setCharacter(s, 3, 'strongman');
    const a = giveCard(s, 2, 'evidence');
    const b = giveCard(s, 2, 'evidence');
    s = play(s, 2, a.id, [3]);
    s = play(s, 2, b.id, [3]);
    expect(s.phase.kind).toBe('trialReveal');
  });
});

describe('部长', () => {
  it('别人打给他的证据只算 1 点并记日志；嫁祸转来的证据按原点数', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'minister');
    const e = giveCard(s, 2, 'evidence');
    s = play(s, 2, e.id, [3]);
    expect(redTotal(s.players[3])).toBe(1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'minister' });
    const e2 = giveCard(s, 2, 'evidence');
    s = play(s, 2, e2.id, [4]);
    const sg = giveCard(s, 2, 'scapegoat');
    s = play(s, 2, sg.id, [4, 3]);
    expect(redTotal(s.players[3])).toBe(4);
  });
});

describe('医生', () => {
  it('辩护当作目击：目标 +7 点并审判；进弃牌堆时还原成辩护', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'doctor');
    const c = giveCard(s, 2, 'alibi');
    s = play(s, 2, c.id, [3], 'witness');
    expect(s.players[3].red).toEqual([{ id: c.id, kind: 'witness', points: 7, source: 'alibi' }]);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'doctor' });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.discard).toContainEqual({ id: c.id, kind: 'alibi' });
    expect(s.discard.some((d) => d.id === c.id && d.kind === 'witness')).toBe(false);
    expect(countCards(s)).toBe(60);
  });

  it('当作目击时按红卡规则：不能打给自己；不受部长削弱；不是医生不能这样打', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'doctor');
    setCharacter(s, 3, 'minister');
    const c = giveCard(s, 2, 'alibi');
    expect(() => play(s, 2, c.id, [2], 'witness')).toThrow(RuleError);
    s = play(s, 2, c.id, [3], 'witness');
    expect(redTotal(s.players[3])).toBe(7);

    const t = fixedGame();
    const d = giveCard(t, 2, 'alibi');
    expect(() => play(t, 2, d.id, [3], 'witness')).toThrow('只有医生可以把辩护当作目击');
  });
});

describe('女仆', () => {
  it('黑猫、情侣打给她无效，直接进弃牌堆', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'maid');
    const m = giveCard(s, 2, 'matchmaker');
    s = play(s, 2, m.id, [3]);
    expect(s.players[3].blue).toEqual([]);
    expect(s.discard).toContainEqual(m);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'maid', kind: 'matchmaker' });
  });

  it('第一夜不能把黑猫放给她；超时自动放置时也不会选她', () => {
    const s = fixedGame();
    setCharacter(s, 3, 'maid');
    s.phase = { kind: 'dawn' };
    expect(() => act(s, { type: 'witchVote', seat: 0, target: 3 })).toThrow(RuleError);
    for (let seed = 1; seed <= 30; seed++) {
      let t: GameState = JSON.parse(JSON.stringify(s));
      const rng = seededRng(seed);
      for (const a of autoActions(t, rng)) t = apply(t, a, rng);
      expect(t.players[3].blue.some((c) => c.kind === 'blackCat')).toBe(false);
    }
  });

  it('嫁祸转给她的黑猫和情侣进弃牌堆，其他卡照常转移', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'maid');
    placeBlue(s, 4, 'matchmaker');
    placeBlue(s, 4, 'asylum');
    const sg = giveCard(s, 2, 'scapegoat');
    s = play(s, 2, sg.id, [4, 3]);
    expect(s.players[3].blue.map((c) => c.kind)).toEqual(['asylum']);
    expect(s.discard.some((c) => c.kind === 'matchmaker')).toBe(true);
    expect(countCards(s)).toBe(60);
  });
});

describe('乞丐', () => {
  it('以他为第一个目标的纵火无效并丢弃；抢劫时他是接收方照常生效', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'beggar');
    const handBefore = s.players[3].hand.length;
    const ar = giveCard(s, 2, 'arson');
    s = play(s, 2, ar.id, [3]);
    expect(s.players[3].hand).toHaveLength(handBefore);
    expect(s.discard).toContainEqual(ar);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'beggar', kind: 'arson' });

    const rb = giveCard(s, 2, 'robbery');
    const fourHand = s.players[4].hand.length;
    s = play(s, 2, rb.id, [4, 3]);
    expect(s.players[3].hand).toHaveLength(handBefore + fourHand);
    expect(s.players[4].hand).toEqual([]);
  });

  it('抢他的手牌无效', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'beggar');
    const handBefore = s.players[3].hand.length;
    const rb = giveCard(s, 2, 'robbery');
    s = play(s, 2, rb.id, [3, 4]);
    expect(s.players[3].hand).toHaveLength(handBefore);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'beggar', kind: 'robbery' });
  });
});

describe('小孩', () => {
  it('他发起的审判结束后，丢弃自己面前的指控和证据，目击保留', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'child');
    placeRed(s, 2, 'accusation');
    placeRed(s, 2, 'witness');
    for (const kind of ['evidence', 'evidence', 'accusation'] as const) {
      const c = giveCard(s, 2, kind);
      s = play(s, 2, c.id, [3]);
    }
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.players[2].red.map((c) => c.kind)).toEqual(['witness']);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'child' });
    expect(countCards(s)).toBe(60);
  });
});

describe('农民', () => {
  it('有人死亡时获得他的手牌和蓝卡（含黑猫），红卡进弃牌堆', () => {
    const s = fixedGame();
    setCharacter(s, 4, 'farmer');
    placeBlue(s, 3, 'blackCat');
    placeBlue(s, 3, 'asylum');
    const red = placeRed(s, 3, 'accusation');
    const hand3 = s.players[3].hand.length;
    const before = s.players[4].hand.length;
    killPlayer(s, 3, 'night');
    expect(s.players[4].hand).toHaveLength(before + hand3 + 2);
    expect(s.players[4].hand.some((c) => c.kind === 'blackCat')).toBe(true);
    expect(s.discard.some((c) => c.id === red.id)).toBe(true);
    expect(s.log).toContainEqual({ t: 'ability', seat: 4, ability: 'farmer', from: 3 });
    expect(countCards(s)).toBe(60);
  });

  it('农民自己在同一事件中（情侣殉情）死亡时不获得', () => {
    const s = fixedGame();
    setCharacter(s, 4, 'farmer');
    placeBlue(s, 3, 'matchmaker');
    placeBlue(s, 4, 'matchmaker');
    killPlayer(s, 3, 'night');
    expect(s.players[4].alive).toBe(false);
    expect(s.log.some((e) => e.t === 'ability' && e.ability === 'farmer')).toBe(false);
    expect(countCards(s)).toBe(60);
  });
});
```

- [ ] **Step 3: 运行，确认失败**

Run: `cd engine && npx vitest run test/abilities.test.ts`
Expected: FAIL（技能尚未实现；`option: 'witness'` 报「辩护选项无效」等）

- [ ] **Step 4: 修改 `engine/src/state.ts` 的 `toCard`**

```ts
/** 把面前的卡还原成普通卡：医生当作目击打出的辩护还原成辩护 */
export function toCard(c: { id: string; kind: CardKind; source?: CardKind }): Card {
  return { id: c.id, kind: c.source ?? c.kind };
}
```

- [ ] **Step 5: 重写 `engine/src/play.ts`**

```ts
import { isBlack, isRed, RED_POINTS } from './cards';
import { hasAbility } from './characters';
import { RuleError } from './errors';
import type { Rng } from './rng';
import { getPlayer, setPhase, toCard } from './state';
import { checkTrial } from './trial';
import type { Card, CardKind, GameState, RedCard, RedKind } from './types';

/** 部长：别人打给他的证据只算 1 点 */
export const MINISTER_EVIDENCE = 1;

export function accusationValue(s: GameState, kind: RedKind, _actor: number, target: number): number {
  if (kind === 'evidence' && hasAbility(s, target, 'minister')) return MINISTER_EVIDENCE;
  return RED_POINTS[kind];
}

/** 这张卡需要选择几名目标：嫁祸和抢劫需要 2 个（一个来源一个去向），其余都是 1 个 */
export function targetCount(kind: CardKind): number {
  return kind === 'scapegoat' || kind === 'robbery' ? 2 : 1;
}

const ALIBI_OPTIONS = ['accusation', 'evidence', 'witness'];

/** 女仆：黑猫和情侣对她无效 */
function maidBlocks(s: GameState, seat: number, kind: CardKind): boolean {
  return (kind === 'blackCat' || kind === 'matchmaker') && hasAbility(s, seat, 'maid');
}

export function playCard(
  s: GameState,
  seat: number,
  cardId: string,
  targets: number[],
  option: string | undefined,
  rng: Rng,
): void {
  if (s.phase.kind !== 'day' || s.phase.mode === 'drawing' || s.turn !== seat) {
    throw new RuleError('现在不能出牌');
  }
  const actor = getPlayer(s, seat);
  const idx = actor.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new RuleError('手牌中没有这张卡');
  const card = actor.hand[idx];
  if (isBlack(card.kind)) throw new RuleError('黑卡不能主动打出');

  const need = targetCount(card.kind);
  if (targets.length !== need) throw new RuleError(`这张卡需要选择 ${need} 名目标`);
  const ts = targets.map((t) => getPlayer(s, t));
  if (ts.some((t) => !t.alive)) throw new RuleError('目标必须是活着的玩家');
  if (need === 2 && targets[0] === targets[1]) throw new RuleError('两个目标不能相同');
  const target = ts[0];

  // 医生可以把辩护当作目击打出，此时按红卡的规则检查目标
  const asWitness = card.kind === 'alibi' && option === 'witness';
  if (asWitness && !hasAbility(s, seat, 'doctor')) throw new RuleError('只有医生可以把辩护当作目击');
  if (isRed(card.kind) || asWitness) {
    if (target.seat === seat) throw new RuleError('不能对自己打出红卡');
    if (target.blue.some((c) => c.kind === 'piety')) throw new RuleError('信徒：不能对该玩家打出红卡');
  }
  if (card.kind === 'matchmaker' && target.blue.some((c) => c.kind === 'matchmaker')) {
    throw new RuleError('该玩家已经有情侣卡');
  }
  if (card.kind === 'stocks' && target.green.some((c) => c.kind === 'stocks')) {
    throw new RuleError('该玩家已被拘留');
  }
  if (card.kind === 'curse' && !target.blue.some((c) => c.id === option)) {
    throw new RuleError('请选择该玩家面前的一张蓝卡');
  }
  if (card.kind === 'alibi' && option !== undefined && !ALIBI_OPTIONS.includes(option)) {
    throw new RuleError('辩护选项无效');
  }

  actor.hand.splice(idx, 1);
  setPhase(s, { kind: 'day', mode: 'playing' });
  s.log.push({ t: 'play', seat, kind: card.kind, targets });

  switch (card.kind) {
    case 'accusation':
    case 'evidence':
    case 'witness':
      addRed(s, seat, target.seat, card, card.kind, rng);
      return;
    case 'matchmaker':
    case 'asylum':
    case 'piety':
    case 'blackCat':
      if (maidBlocks(s, target.seat, card.kind)) {
        blocked(s, target.seat, 'maid', card);
        return;
      }
      target.blue.push(card);
      return;
    case 'stocks':
      target.green.push(card);
      return;
    case 'alibi': {
      if (asWitness) {
        s.log.push({ t: 'ability', seat, ability: 'doctor' });
        addRed(s, seat, target.seat, card, 'witness', rng);
        return;
      }
      const mode = option ?? (target.red.some((c) => c.kind === 'accusation') ? 'accusation' : 'evidence');
      const limit = mode === 'accusation' ? 3 : 1;
      let removed = 0;
      target.red = target.red.filter((c) => {
        if (removed < limit && c.kind === mode) {
          removed++;
          s.discard.push(toCard(c));
          return false;
        }
        return true;
      });
      s.discard.push(card);
      return;
    }
    case 'arson':
      if (hasAbility(s, target.seat, 'beggar')) {
        blocked(s, target.seat, 'beggar', card);
        return;
      }
      s.discard.push(...target.hand, card);
      target.hand = [];
      return;
    case 'robbery': {
      if (hasAbility(s, target.seat, 'beggar')) {
        blocked(s, target.seat, 'beggar', card);
        return;
      }
      const to = ts[1];
      to.hand.push(...target.hand);
      target.hand = [];
      s.discard.push(card);
      return;
    }
    case 'scapegoat': {
      const to = ts[1];
      // 接收者已有情侣或拘留时，转来的同类卡进弃牌堆，避免叠加；女仆收到的黑猫和情侣也进弃牌堆
      const alreadyHas = (cards: Card[], kind: CardKind) => cards.some((c) => c.kind === kind);
      const hasMatchmaker = alreadyHas(to.blue, 'matchmaker');
      const hasStocks = alreadyHas(to.green, 'stocks');
      to.red.push(...target.red);
      for (const c of target.blue) {
        if (c.kind === 'matchmaker' && hasMatchmaker) s.discard.push(c);
        else if (maidBlocks(s, to.seat, c.kind)) blocked(s, to.seat, 'maid', c);
        else to.blue.push(c);
      }
      for (const c of target.green) {
        if (c.kind === 'stocks' && hasStocks) s.discard.push(c);
        else to.green.push(c);
      }
      target.red = [];
      target.blue = [];
      target.green = [];
      s.discard.push(card);
      checkTrial(s, to.seat, seat, rng);
      return;
    }
    case 'curse': {
      const i = target.blue.findIndex((c) => c.id === option);
      s.discard.push(...target.blue.splice(i, 1), card);
      return;
    }
  }
}

/** 把一张红卡放到目标面前并检查审判；kind 是它算作的红卡种类（医生的辩护算作目击） */
function addRed(s: GameState, actor: number, target: number, card: Card, kind: RedKind, rng: Rng): void {
  const points = accusationValue(s, kind, actor, target);
  if (points < RED_POINTS[kind]) s.log.push({ t: 'ability', seat: target, ability: 'minister' });
  const red: RedCard = { id: card.id, kind, points };
  if (card.kind !== kind) red.source = card.kind;
  getPlayer(s, target).red.push(red);
  checkTrial(s, target, actor, rng);
}

/** 技能挡下了一张卡：这张卡进弃牌堆，记日志 */
function blocked(s: GameState, seat: number, ability: 'maid' | 'beggar', card: Card): void {
  s.discard.push(card);
  s.log.push({ t: 'ability', seat, ability, kind: card.kind });
}
```

- [ ] **Step 6: 重写 `engine/src/death.ts`**

```ts
import { hasAbility } from './characters';
import { RuleError } from './errors';
import { getPlayer, toCard, unrevealed, witchSeats } from './state';
import type { DeathCause, GameState, RevealCause, Winner } from './types';

export function revealTryal(s: GameState, seat: number, tryalId: string, cause: RevealCause): void {
  const p = getPlayer(s, seat);
  const t = p.tryals.find((x) => x.id === tryalId);
  if (!t || t.revealed) throw new RuleError('这张身份卡不能翻开');
  t.revealed = true;
  s.log.push({ t: 'reveal', seat, kind: t.kind, cause });
  if (t.kind === 'witch') killPlayer(s, seat, 'witchRevealed');
  else if (unrevealed(p).length === 0) killPlayer(s, seat, 'allRevealed');
  checkWin(s);
}

export function killPlayer(s: GameState, seat: number, cause: DeathCause): void {
  const p = getPlayer(s, seat);
  if (!p.alive) return;
  p.alive = false;
  for (const t of p.tryals) {
    if (!t.revealed) {
      t.revealed = true;
      s.log.push({ t: 'reveal', seat, kind: t.kind, cause: 'death' });
    }
  }
  s.log.push({ t: 'death', seat, cause });
  // 情侣的另一方会在同一事件里殉情
  const partner = p.blue.some((c) => c.kind === 'matchmaker')
    ? s.players.find((q) => q.alive && q.blue.some((c) => c.kind === 'matchmaker'))
    : undefined;
  const heir = farmerHeir(s, seat, partner?.seat ?? null);
  if (heir !== null) {
    getPlayer(s, heir).hand.push(...p.hand, ...p.blue);
    s.discard.push(...p.red.map(toCard), ...p.green);
    s.log.push({ t: 'ability', seat: heir, ability: 'farmer', from: seat });
  } else {
    s.discard.push(...p.hand, ...p.red.map(toCard), ...p.blue, ...p.green);
  }
  p.hand = [];
  p.red = [];
  p.blue = [];
  p.green = [];
  if (partner) killPlayer(s, partner.seat, 'lover');
  checkWin(s);
}

/** 继承死者手牌和蓝卡的人：从死者的下一个座位起顺时针第一个拥有农民技能的活人；同一事件里也要死去的情侣不算 */
function farmerHeir(s: GameState, dead: number, alsoDying: number | null): number | null {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = s.players[(dead + i) % n];
    if (q.alive && q.seat !== alsoDying && hasAbility(s, q.seat, 'farmer')) return q.seat;
  }
  return null;
}

export function checkWin(s: GameState): void {
  if (s.phase.kind === 'ended') return;
  let winner: Winner | null = null;
  // 女巫阵营的人全部出局才算村民胜利：传染时交出女巫卡的原女巫仍属女巫阵营
  if (witchSeats(s).length === 0) winner = 'village';
  else if (s.players.filter((p) => p.alive).every((p) => p.witchFaction)) winner = 'witch';
  if (winner) {
    s.phase = { kind: 'ended', winner };
    s.log.push({ t: 'gameEnd', winner });
  }
}
```

- [ ] **Step 7: 修改 `engine/src/trial.ts`**

导入加 `import { hasAbility } from './characters';`。把 `trialThreshold` 和 `finishTrial` 换成：

```ts
export const JUDGE_THRESHOLD = 6;
export const STRONGMAN_THRESHOLD = 8;

/** 审判线：法官发起时 6；目标是大力士时 8（法官优先）；其余 7。initiator 为 null 时是公开显示用的值 */
export function trialThreshold(s: GameState, target: number, initiator: number | null): number {
  if (initiator !== null && hasAbility(s, initiator, 'judge')) return JUDGE_THRESHOLD;
  if (hasAbility(s, target, 'strongman')) return STRONGMAN_THRESHOLD;
  return DEFAULT_TRIAL_THRESHOLD;
}
```

```ts
/** 审判收尾：丢弃被审判者面前的红卡；发起者是小孩时丢弃他自己面前的指控和证据；回到出牌模式 */
export function finishTrial(s: GameState, target: number, initiator: number): void {
  const p = getPlayer(s, target);
  if (p.alive) {
    s.discard.push(...p.red.map(toCard));
    p.red = [];
  }
  const init = getPlayer(s, initiator);
  if (init.alive && hasAbility(s, initiator, 'child')) {
    const drop = init.red.filter((c) => c.kind !== 'witness');
    if (drop.length > 0) {
      s.discard.push(...drop.map(toCard));
      init.red = init.red.filter((c) => c.kind === 'witness');
      s.log.push({ t: 'ability', seat: initiator, ability: 'child' });
    }
  }
  backToPlaying(s);
}
```

- [ ] **Step 8: 女仆与黑猫：`engine/src/night.ts`、`engine/src/auto.ts`**

`night.ts`：导入 `import { hasAbility } from './characters';`，`witchVote` 里 `if (!getPlayer(s, target).alive) ...` 之后加：

```ts
  if (s.phase.kind === 'dawn' && hasAbility(s, target, 'maid')) throw new RuleError('女仆：黑猫对她无效，不能选她');
```

`auto.ts`：导入 `import { hasAbility } from './characters';`，`case 'dawn':` 改为：

```ts
    case 'dawn': {
      const allowed = aliveSeats(s).filter((seat) => !hasAbility(s, seat, 'maid'));
      const target = majority(s.dawnVotes) ?? pick(allowed, rng);
      return witchSeats(s).map((seat): Action => ({ type: 'witchVote', seat, target }));
    }
```

- [ ] **Step 9: 运行全部测试**

Run: `cd engine && npx vitest run && npx tsc --noEmit`
Expected: 全部 PASS。

Run: `cd server && npx vitest run && npm run typecheck` 和 `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 10: 提交**

```bash
git add engine
git commit -m "feat(engine): judge, strongman, minister, maid, beggar, child, farmer, doctor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 地主、家庭主妇、少女，以及回合外摸到黑卡（裁定 C4）

**Files:**
- Modify: `engine/src/types.ts`、`engine/src/setup.ts`、`engine/src/turn.ts`、`engine/src/flow.ts`、`engine/src/trial.ts`、`engine/src/apply.ts`、`engine/src/conspiracy.ts`
- Create: `engine/test/drawAbilities.test.ts`

**Interfaces:**
- Consumes：`proceed`、`takeCard`、`Step { kind: 'draw' }`（Task 2）；`hasAbility`（Task 1）。
- Produces：`GameState.drawn: CardKind[]`（本次正常抽牌抽到的非黑卡）；`pushHousewifeDraws(s, revealedSeat)`（`flow.ts`）。

- [ ] **Step 1: 写失败测试**

新建 `engine/test/drawAbilities.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { seededRng } from '../src/rng';
import { countCards } from '../src/state';
import type { Action, GameState } from '../src/types';
import { allPick, fixedGame, giveCard, placeBlue, quietNight, setCharacter, stackDeck } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));
const play = (s: GameState, seat: number, cardId: string, targets: number[]) =>
  act(s, { type: 'play', seat, cardId, targets });
const reveal = (s: GameState, seat: number) =>
  act(s, { type: 'revealTryal', seat, tryalId: s.players[seat].tryals.find((t) => !t.revealed)!.id });

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民（第一张都是村民卡）；轮到 2 号

describe('地主', () => {
  it('正常抽牌抽到 2 张指控时展示并再抽 1 张', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'landlord');
    stackDeck(s, ['accusation', 'accusation', 'alibi']);
    const before = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand).toHaveLength(before + 3);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'landlord' });
    expect(s.turn).toBe(3);
  });

  it('再抽的那张又是指控也不继续；不是 2 张指控不触发', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'landlord');
    stackDeck(s, ['accusation', 'accusation', 'accusation', 'alibi']);
    const before = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand).toHaveLength(before + 3);

    let t = fixedGame();
    setCharacter(t, 2, 'landlord');
    stackDeck(t, ['accusation', 'evidence', 'accusation']);
    const n = t.players[2].hand.length;
    t = act(t, { type: 'draw', seat: 2 });
    expect(t.players[2].hand).toHaveLength(n + 2);
    expect(t.log.some((e) => e.t === 'ability')).toBe(false);
  });
});

describe('家庭主妇', () => {
  it('别人的身份卡因审判翻开时摸一张', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    stackDeck(s, ['alibi']);
    const before = s.players[4].hand.length;
    s = reveal(s, 3);
    expect(s.players[4].hand).toHaveLength(before + 1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 4, ability: 'housewife' });
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(countCards(s)).toBe(60);
  });

  it('自己的身份卡被翻开不摸', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [4]);
    const before = s.players[4].hand.length;
    s = reveal(s, 4);
    expect(s.players[4].hand).toHaveLength(before);
  });

  it('黑猫翻牌也算', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    placeBlue(s, 3, 'blackCat');
    stackDeck(s, ['conspiracy', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.phase).toEqual({ kind: 'catReveal', holder: 3 });
    const before = s.players[4].hand.length;
    s = reveal(s, 3);
    expect(s.players[4].hand).toHaveLength(before + 1);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
  });
});

describe('少女', () => {
  it('她引发的审判开始前先摸 2 张，本回合可以继续出牌', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'maiden');
    const w = giveCard(s, 2, 'witness');
    stackDeck(s, ['accusation', 'alibi']);
    const before = s.players[2].hand.length;
    s = play(s, 2, w.id, [3]);
    expect(s.players[2].hand).toHaveLength(before - 1 + 2);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'maiden' });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
  });
});

describe('回合外摸到黑卡：立即结算，结算完回到原流程（C4）', () => {
  it('例 1：家庭主妇在审判翻牌后摸到夜晚 → 夜晚 → 审判收尾 → 当前回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    stackDeck(s, ['night']);
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'night' });
    expect(s.players[3].red).toHaveLength(1);
    s = quietNight(s);
    expect(s.players[3].red).toEqual([]);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });

  it('例 1b：家庭主妇在审判翻牌后摸到传染 → 传染 → 审判收尾 → 当前玩家继续出牌', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    stackDeck(s, ['conspiracy']);
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = allPick(s);
    expect(s.players[3].red).toEqual([]);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
  });

  it('例 2：家庭主妇在黑猫翻牌后摸到夜晚 → 夜晚 → 继续传染盲抽 → 当前回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    placeBlue(s, 3, 'blackCat');
    stackDeck(s, ['conspiracy', 'night']);
    const hand2 = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'night' });
    s = quietNight(s);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = allPick(s);
    expect(s.players[2].hand).toHaveLength(hand2);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });

  it('例 3：少女审判前摸到夜晚，被审判者夜里死亡 → 取消审判，少女回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'maiden');
    const w = giveCard(s, 2, 'witness');
    stackDeck(s, ['alibi', 'night']);
    s = play(s, 2, w.id, [3]);
    expect(s.phase).toEqual({ kind: 'night' });
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    for (const p of s.players) if (p.alive && s.phase.kind === 'night') s = act(s, { type: 'confess', seat: p.seat, tryalId: null });
    expect(s.players[3].alive).toBe(false);
    expect(s.log.some((e) => e.t === 'trial')).toBe(false);
    expect(s.turn).toBe(4);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('例 3b：少女审判前摸到夜晚，被审判者活着 → 夜晚后继续审判，审判后少女回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'maiden');
    const w = giveCard(s, 2, 'witness');
    stackDeck(s, ['alibi', 'night']);
    s = play(s, 2, w.id, [3]);
    s = quietNight(s);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = reveal(s, 3);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd engine && npx vitest run test/drawAbilities.test.ts`
Expected: FAIL

- [ ] **Step 3: `engine/src/types.ts` 与 `engine/src/setup.ts`**

`GameState` 里 `endTurnAfter` 之后加：

```ts
  /** 本次正常抽牌抽到的非黑卡（地主用） */
  drawn: CardKind[];
```

`setup.ts` 的 `state` 里 `endTurnAfter: false,` 之后加 `drawn: [],`。

- [ ] **Step 4: 地主：`engine/src/turn.ts`**

导入加 `import { hasAbility } from './characters';`。

`startDrawing` 里 `s.drawsLeft = 2;` 之后加 `s.drawn = [];`。

`continueDrawing` 里把普通牌的三行：

```ts
    s.players[s.turn].hand.push(card);
    s.drawsLeft--;
    s.log.push({ t: 'draw', seat: s.turn });
```

改为：

```ts
    s.players[s.turn].hand.push(card);
    s.drawn.push(card.kind);
    s.drawsLeft--;
    s.log.push({ t: 'draw', seat: s.turn });
    if (s.drawsLeft === 0 && landlordBonus(s)) s.drawsLeft = 1;
```

文件末尾加：

```ts
/** 地主：正常抽牌的 2 张都是指控时，展示并再抽 1 张（再抽的那张不再触发） */
function landlordBonus(s: GameState): boolean {
  if (s.drawn.length !== 2 || !s.drawn.every((k) => k === 'accusation')) return false;
  if (!hasAbility(s, s.turn, 'landlord')) return false;
  s.log.push({ t: 'ability', seat: s.turn, ability: 'landlord' });
  return true;
}
```

- [ ] **Step 5: 家庭主妇：`engine/src/flow.ts`、`apply.ts`、`conspiracy.ts`**

`flow.ts` 导入加 `import { hasAbility } from './characters';`，末尾加：

```ts
/** 有人的身份卡因审判或黑猫翻开后：每个拥有家庭主妇技能的其他活人各摸一张（按座位顺序） */
export function pushHousewifeDraws(s: GameState, revealed: number): void {
  const seats = s.players
    .filter((p) => p.alive && p.seat !== revealed && hasAbility(s, p.seat, 'housewife'))
    .map((p) => p.seat);
  for (const seat of seats) s.log.push({ t: 'ability', seat, ability: 'housewife' });
  for (const seat of [...seats].reverse()) s.steps.push({ kind: 'draw', seat });
}
```

`apply.ts`：导入改为 `import { proceed, pushHousewifeDraws } from './flow';`，`handleReveal` 审判分支在 `s.steps.push({ kind: 'finishTrial', ... });` 之后加一行：

```ts
    pushHousewifeDraws(s, seat);
```

`conspiracy.ts`：导入改为 `import { proceed, pushHousewifeDraws, type StepResult } from './flow';`，`catReveal` 里 `revealTryal(s, seat, tryalId, 'cat');` 之后加：

```ts
  pushHousewifeDraws(s, seat);
```

- [ ] **Step 6: 少女：`engine/src/trial.ts`**

`checkTrial` 改为：

```ts
/** 红卡累计达到审判线时开始审判；发起者是少女时，审判前她先摸 2 张 */
export function checkTrial(s: GameState, target: number, initiator: number, rng: Rng): void {
  const p = getPlayer(s, target);
  if (!p.alive || isEnded(s)) return;
  if (redTotal(p) < trialThreshold(s, target, initiator)) return;
  s.steps.push({ kind: 'trial', target, initiator });
  if (hasAbility(s, initiator, 'maiden')) {
    s.log.push({ t: 'ability', seat: initiator, ability: 'maiden' });
    s.steps.push({ kind: 'draw', seat: initiator }, { kind: 'draw', seat: initiator });
  }
  proceed(s, rng);
}
```

- [ ] **Step 7: 运行全部测试**

Run: `cd engine && npx vitest run && npx tsc --noEmit`
Expected: 全部 PASS。

Run: `cd server && npx vitest run && npm run typecheck` 和 `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add engine
git commit -m "feat(engine): landlord, housewife, maiden; off-turn black cards resolve at once (C4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 牧师、说书人、官员，以及带角色的随机对局模拟

**Files:**
- Modify: `engine/src/types.ts`、`engine/src/night.ts`、`engine/src/apply.ts`、`engine/src/auto.ts`、`engine/src/view.ts`
- Create: `engine/src/abilities.ts`、`engine/test/active.test.ts`
- Modify: `engine/test/helpers.ts`、`engine/test/simulate.test.ts`
- Modify: `client/src/model/table.ts`、`client/src/scenes/choicePanels.ts`（只为编译通过）

**Interfaces:**
- Consumes：`canUse`、`useAbility`、`hasAbility`（Task 1）；`endTurn`（`turn.ts`）。
- Produces（类型）：阶段 `{ kind: 'storytelling'; seat: number }`；操作 `{ type: 'priestDraw'; seat; cardIds: string[] }`、`{ type: 'storyStart'; seat }`、`{ type: 'storyReorder'; seat; order: string[] }`；`confess` 操作多一个可选的 `silent?: boolean`；`NightState.silent?: number[]`；待选项 `{ kind: 'storytelling'; deck: Card[] }`。
- Produces（`abilities.ts`）：`priestDraw(s, seat, cardIds)`、`storyStart(s, seat)`、`storyReorder(s, seat, order)`。
- Changes：`confess(s, seat, tryalId, silent, rng)`。
- Produces（测试辅助）：`placeDiscard(s, kind)`。

- [ ] **Step 1: 写失败测试**

`engine/test/helpers.ts` 末尾追加：

```ts
/** 把一张指定种类的卡放进弃牌堆（卡从别处拿来，总卡数不变） */
export function placeDiscard(s: GameState, kind: CardKind): Card {
  const c = takeFromAnywhere(s, kind);
  s.discard.push(c);
  return c;
}
```

新建 `engine/test/active.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { RuleError } from '../src/errors';
import { startNight } from '../src/night';
import { seededRng } from '../src/rng';
import { countCards } from '../src/state';
import type { Action, GameState } from '../src/types';
import { projectPrivate, projectPublic } from '../src/view';
import { fixedGame, placeDiscard, setCharacter } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民；轮到 2 号

describe('牧师', () => {
  it('回合开始时从弃牌堆拿 1–2 张非黑卡，然后回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'priest');
    const a = placeDiscard(s, 'alibi');
    const b = placeDiscard(s, 'evidence');
    s = act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id, b.id] });
    expect(s.players[2].hand.map((c) => c.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(s.discard.some((c) => c.id === a.id || c.id === b.id)).toBe(false);
    expect(s.players[2].uses.priest).toBe(1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'priest', count: 2 });
    expect(s.turn).toBe(3);
    expect(countCards(s)).toBe(60);
  });

  it('不能拿黑卡、不能超过 2 张、不能重复；出过牌后、次数用完后、不是牧师都不能用', () => {
    const s = fixedGame();
    setCharacter(s, 2, 'priest');
    const a = placeDiscard(s, 'alibi');
    const b = placeDiscard(s, 'evidence');
    const c = placeDiscard(s, 'accusation');
    const night = placeDiscard(s, 'night');
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [night.id] })).toThrow(RuleError);
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id, b.id, c.id] })).toThrow(RuleError);
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id, a.id] })).toThrow(RuleError);
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [] })).toThrow(RuleError);
    const playing: GameState = JSON.parse(JSON.stringify(s));
    playing.phase = { kind: 'day', mode: 'playing' };
    expect(() => act(playing, { type: 'priestDraw', seat: 2, cardIds: [a.id] })).toThrow(RuleError);
    const used: GameState = JSON.parse(JSON.stringify(s));
    used.players[2].uses.priest = 2;
    expect(() => act(used, { type: 'priestDraw', seat: 2, cardIds: [a.id] })).toThrow(RuleError);
    const plain: GameState = JSON.parse(JSON.stringify(s));
    plain.players[2].character = null;
    expect(() => act(plain, { type: 'priestDraw', seat: 2, cardIds: [a.id] })).toThrow(RuleError);
  });

  it('裁缝复制牧师：次数记在裁缝自己身上', () => {
    let s = fixedGame();
    setCharacter(s, 1, 'priest');
    setCharacter(s, 2, 'tailor');
    s.players[1].uses.priest = 2;
    const a = placeDiscard(s, 'alibi');
    s = act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id] });
    expect(s.players[2].uses.priest).toBe(1);
    expect(s.players[1].uses.priest).toBe(2);
  });
});

describe('说书人', () => {
  it('开始调整后只有他能看到牌堆；提交新顺序后回到他的回合，仍可抽牌；只能用一次', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'storyteller');
    s = act(s, { type: 'storyStart', seat: 2 });
    expect(s.phase).toEqual({ kind: 'storytelling', seat: 2 });
    expect(projectPrivate(s, 2).pending).toEqual({ kind: 'storytelling', deck: s.deck });
    expect(projectPrivate(s, 3).pending).toBeNull();
    const pub = JSON.stringify(projectPublic(s));
    for (const c of s.deck) expect(pub).not.toContain(`"${c.id}"`);
    for (const p of s.players) {
      if (p.seat === 2) continue;
      const priv = JSON.stringify(projectPrivate(s, p.seat));
      for (const c of s.deck) expect(priv).not.toContain(`"${c.id}"`);
    }
    const order = [...s.deck].reverse().map((c) => c.id);
    s = act(s, { type: 'storyReorder', seat: 2, order });
    expect(s.deck.map((c) => c.id)).toEqual(order);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.turn).toBe(2);
    expect(s.players[2].uses.storyteller).toBe(1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'storyteller' });
    expect(() => act(s, { type: 'storyStart', seat: 2 })).toThrow(RuleError);
    expect(() => act(s, { type: 'draw', seat: 2 })).not.toThrow();
  });

  it('新顺序必须正好是当前牌堆的重新排列', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'storyteller');
    s = act(s, { type: 'storyStart', seat: 2 });
    const ids = s.deck.map((c) => c.id);
    expect(() => act(s, { type: 'storyReorder', seat: 2, order: ids.slice(1) })).toThrow(RuleError);
    expect(() => act(s, { type: 'storyReorder', seat: 2, order: [ids[0], ...ids.slice(0, -1)] })).toThrow(RuleError);
    expect(() => act(s, { type: 'storyReorder', seat: 2, order: ['blackCat-1', ...ids.slice(1)] })).toThrow(RuleError);
    expect(() => act(s, { type: 'storyReorder', seat: 3, order: ids })).toThrow(RuleError);
  });

  it('超时：按原顺序回到他的回合', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'storyteller');
    s = act(s, { type: 'storyStart', seat: 2 });
    const ids = s.deck.map((c) => c.id);
    const rng = seededRng(1);
    for (const a of autoActions(s, rng)) s = apply(s, a, rng);
    expect(s.deck.map((c) => c.id)).toEqual(ids);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.turn).toBe(2);
  });
});

describe('官员', () => {
  it('不翻牌自首：当晚免疫击杀，身份卡都不翻开，次数用完', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'official');
    startNight(s);
    s = act(s, { type: 'confess', seat: 3, tryalId: null, silent: true });
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    for (const seat of [0, 1, 2, 4]) s = act(s, { type: 'confess', seat, tryalId: null });
    expect(s.players[3].alive).toBe(true);
    expect(s.players[3].tryals.every((t) => !t.revealed)).toBe(true);
    expect(s.log).toContainEqual({ t: 'nightResult', target: 3, died: false });
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'official' });
    expect(s.players[3].uses.official).toBe(1);
  });

  it('次数用完、不是官员、同时选了身份卡、已经决定过时都不能不翻牌自首', () => {
    const s = fixedGame();
    setCharacter(s, 3, 'official');
    startNight(s);
    const used: GameState = JSON.parse(JSON.stringify(s));
    used.players[3].uses.official = 1;
    expect(() => act(used, { type: 'confess', seat: 3, tryalId: null, silent: true })).toThrow(RuleError);
    expect(() => act(s, { type: 'confess', seat: 2, tryalId: null, silent: true })).toThrow(RuleError);
    const tid = s.players[3].tryals[0].id;
    expect(() => act(s, { type: 'confess', seat: 3, tryalId: tid, silent: true })).toThrow(RuleError);
    const decided = act(s, { type: 'confess', seat: 3, tryalId: null });
    expect(() => act(decided, { type: 'confess', seat: 3, tryalId: null, silent: true })).toThrow(RuleError);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd engine && npx vitest run test/active.test.ts`
Expected: FAIL（操作类型不存在）

- [ ] **Step 3: 修改 `engine/src/types.ts`**

`Phase` 在 `conspiracyPick` 之后加：

```ts
  | { kind: 'storytelling'; seat: number }
```

`NightState` 加：

```ts
  /** 不翻牌自首的官员 */
  silent?: number[];
```

`Action` 里 `confess` 改为 `| { type: 'confess'; seat: number; tryalId: string | null; silent?: boolean }`，并加三项：

```ts
  | { type: 'priestDraw'; seat: number; cardIds: string[] }
  | { type: 'storyStart'; seat: number }
  | { type: 'storyReorder'; seat: number; order: string[] }
```

- [ ] **Step 4: 新建 `engine/src/abilities.ts`**

```ts
import { isBlack } from './cards';
import { canUse, useAbility } from './characters';
import { RuleError } from './errors';
import { getPlayer, setPhase } from './state';
import { endTurn } from './turn';
import type { Card, GameState } from './types';

/** 回合开始、还没抽牌也没出牌 */
function atTurnStart(s: GameState, seat: number): boolean {
  return s.phase.kind === 'day' && s.phase.mode === 'choose' && s.turn === seat;
}

/** 牧师：从弃牌堆拿 1–2 张非黑卡代替抽牌，拿完回合结束 */
export function priestDraw(s: GameState, seat: number, cardIds: string[]): void {
  if (!atTurnStart(s, seat)) throw new RuleError('现在不能使用牧师技能');
  if (!canUse(s, seat, 'priest')) throw new RuleError('你不能使用牧师技能');
  if (cardIds.length < 1 || cardIds.length > 2 || new Set(cardIds).size !== cardIds.length) {
    throw new RuleError('请选择 1–2 张不同的牌');
  }
  const cards = cardIds.map((id) => s.discard.find((c) => c.id === id));
  if (cards.some((c) => !c || isBlack(c.kind))) throw new RuleError('只能拿弃牌堆里的非黑卡');
  s.discard = s.discard.filter((c) => !cardIds.includes(c.id));
  getPlayer(s, seat).hand.push(...(cards as Card[]));
  useAbility(s, seat, 'priest');
  s.log.push({ t: 'ability', seat, ability: 'priest', count: cardIds.length });
  endTurn(s);
}

/** 说书人：进入「调整牌堆」阶段（次数在开始时就用掉） */
export function storyStart(s: GameState, seat: number): void {
  if (!atTurnStart(s, seat)) throw new RuleError('现在不能调整牌堆');
  if (!canUse(s, seat, 'storyteller')) throw new RuleError('你不能调整牌堆');
  useAbility(s, seat, 'storyteller');
  setPhase(s, { kind: 'storytelling', seat });
}

/** 说书人：提交新的牌堆顺序（必须正好是当前牌堆的重新排列），回到他的回合 */
export function storyReorder(s: GameState, seat: number, order: string[]): void {
  if (s.phase.kind !== 'storytelling' || s.phase.seat !== seat) throw new RuleError('现在不能调整牌堆');
  const byId = new Map(s.deck.map((c) => [c.id, c] as const));
  if (order.length !== s.deck.length || new Set(order).size !== order.length || order.some((id) => !byId.has(id))) {
    throw new RuleError('新顺序必须包含牌堆里的每一张牌');
  }
  s.deck = order.map((id) => byId.get(id) as Card);
  s.log.push({ t: 'ability', seat, ability: 'storyteller' });
  setPhase(s, { kind: 'day', mode: 'choose' });
}
```

- [ ] **Step 5: 官员：`engine/src/night.ts`**

导入改为 `import { canUse, hasAbility, useAbility } from './characters';`（`hasAbility` 是 Task 3 加的）。

`startNight` 里 `s.night = { witchVotes: {}, protect: null, confessions: {} };` 改为 `s.night = { witchVotes: {}, protect: null, confessions: {}, silent: [] };`

`confess` 改为：

```ts
export function confess(s: GameState, seat: number, tryalId: string | null, silent: boolean, rng: Rng): void {
  if (s.phase.kind !== 'night' || !s.night) throw new RuleError('现在不能自首');
  if (silent) {
    if (tryalId !== null) throw new RuleError('不翻牌自首时不能选身份卡');
    if (seat in s.night.confessions) throw new RuleError('你已经决定过是否自首了');
    if (!canUse(s, seat, 'official')) throw new RuleError('你不能不翻牌自首');
    useAbility(s, seat, 'official');
    (s.night.silent ??= []).push(seat);
  } else if (tryalId !== null && !unrevealed(getPlayer(s, seat)).some((t) => t.id === tryalId)) {
    throw new RuleError('这张身份卡不能翻开');
  }
  s.night.confessions[seat] = tryalId;
  tryResolveNight(s, rng);
}
```

`tryResolveNight` 里，翻开自首身份卡的 `for` 循环之后、`s.night = null;` 之前加：

```ts
  for (const seat of night.silent ?? []) {
    if (!getPlayer(s, seat).alive) continue;
    confessed.add(seat);
    s.log.push({ t: 'ability', seat, ability: 'official' });
  }
```

- [ ] **Step 6: `engine/src/apply.ts`、`auto.ts`、`view.ts`**

`apply.ts`：导入 `import { priestDraw, storyReorder, storyStart } from './abilities';`；`case 'confess':` 改为 `confess(s, action.seat, action.tryalId, action.silent === true, rng);`；`switch` 里加：

```ts
    case 'priestDraw':
      priestDraw(s, action.seat, action.cardIds);
      break;
    case 'storyStart':
      storyStart(s, action.seat);
      break;
    case 'storyReorder':
      storyReorder(s, action.seat, action.order);
      break;
```

`auto.ts` 的 `switch` 里加：

```ts
    case 'storytelling':
      return [{ type: 'storyReorder', seat: ph.seat, order: s.deck.map((c) => c.id) }];
```

`view.ts`：`PendingChoice` 加 `| { kind: 'storytelling'; deck: Card[] }`；`pendingFor` 的 `switch` 里加：

```ts
    case 'storytelling':
      return ph.seat === seat ? { kind: 'storytelling', deck: s.deck } : null;
```

- [ ] **Step 7: 客户端编译修正**

`client/src/model/table.ts` 的 `phaseTitle` 加：

```ts
    case 'storytelling':
      return ph.seat === m.mySeat ? '调整牌堆' : `${m.view.players[ph.seat].name} 正在调整牌堆`;
```

`client/src/scenes/choicePanels.ts`：把 Task 1 加的那一行改为（说书人面板由 Task 10 在游戏桌里单独处理）：

```ts
  if (p.kind === 'characterPick' || p.kind === 'storytelling') return [];
```

- [ ] **Step 8: 随机对局模拟加入角色和技能**

`engine/test/simulate.test.ts`：
- 导入加上 `import { isBlack } from '../src/cards';`，`rng` 的导入改为 `import { pick, seededRng, shuffle } from '../src/rng';`。
- `nightBotActions` 里把

```ts
    const tid = opts.length > 0 && rng.next() < 0.3 ? pick(opts, rng).id : null;
    s = tryApply(s, { type: 'confess', seat, tryalId: tid }, rng);
```

改为（官员有时不翻牌自首；不是官员时这一步会被拒绝，之后由兜底自首补上）：

```ts
    if (rng.next() < 0.2) {
      s = tryApply(s, { type: 'confess', seat, tryalId: null, silent: true }, rng);
      continue;
    }
    const tid = opts.length > 0 && rng.next() < 0.3 ? pick(opts, rng).id : null;
    s = tryApply(s, { type: 'confess', seat, tryalId: tid }, rng);
```

- 在 `runGame` 之前加：

```ts
/** 回合开始时有一定概率尝试牧师拿牌或说书人调整牌堆（没有这个技能时会被拒绝，局面不变） */
function abilityMoves(s: GameState, rng: ReturnType<typeof seededRng>): GameState {
  const ph = s.phase;
  if (ph.kind !== 'day' || ph.mode !== 'choose' || rng.next() >= 0.2) return s;
  const seat = s.turn;
  const pool = s.discard.filter((c) => !isBlack(c.kind));
  if (pool.length > 0) {
    const ids = shuffle(pool, rng)
      .slice(0, 1 + Math.floor(rng.next() * 2))
      .map((c) => c.id);
    const next = tryApply(s, { type: 'priestDraw', seat, cardIds: ids }, rng);
    if (next !== s) return next;
  }
  const started = tryApply(s, { type: 'storyStart', seat }, rng);
  if (started === s) return s;
  return tryApply(started, { type: 'storyReorder', seat, order: shuffle(started.deck, rng).map((c) => c.id) }, rng);
}
```

- `runGame` 的循环体改为：

```ts
  for (let step = 0; step < MAX_STEPS; step++) {
    if (s.phase.kind === 'ended') return s;
    const moved = abilityMoves(s, rng);
    let acted = moved !== s;
    s = moved;
    const ph = s.phase;
    if (!acted && ph.kind === 'day' && ph.mode !== 'drawing' && rng.next() < 0.5) {
      const p = s.players[s.turn];
      if (p.hand.length > 0) {
        const card = pick(p.hand, rng);
        const alive = aliveSeats(s);
        const count = card.kind === 'scapegoat' || card.kind === 'robbery' ? 2 : 1;
        const targets = Array.from({ length: count }, () => pick(alive, rng));
        const option =
          card.kind === 'curse'
            ? getPlayer(s, targets[0]).blue[0]?.id
            : card.kind === 'alibi' && rng.next() < 0.5
              ? 'witness'
              : undefined;
        const next = tryApply(s, { type: 'play', seat: s.turn, cardId: card.id, targets, option }, rng);
        acted = next !== s;
        s = next;
      }
    }
    if (!acted && ph.kind === 'night') {
      s = nightBotActions(s, rng);
    }
    if (!acted) {
      for (const a of autoActions(s, rng)) s = tryApply(s, a, rng);
    }
    checkInvariants(s, n, seed);
  }
```

（`runGame` 用 `createGame` 创建局面，不去掉角色：4–6 人的局会先经过选角色阶段，由 `autoActions` 随机选。）

- [ ] **Step 9: 运行全部测试**

Run: `cd engine && npx vitest run && npx tsc --noEmit`
Expected: 全部 PASS（1000 局带角色的随机对局全部正常结束，总卡数不变，私密视图不泄露）。

Run: `cd server && npx vitest run && npm run typecheck` 和 `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 10: 提交**

```bash
git add engine client/src
git commit -m "feat(engine): priest, storyteller, official; simulate games with characters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 云函数：新操作校验与说书人计时

**Files:**
- Modify: `server/src/validate.ts`、`server/src/deadlines.ts`
- Modify: `server/test/validate.test.ts`、`server/test/deadlines.test.ts`、`server/test/game.test.ts`

**Interfaces:**
- Consumes：引擎操作 `pickCharacter`、`priestDraw`、`storyStart`、`storyReorder`、`confess.silent`（Task 1、5）；`mutateGame`（Task 1）。
- Produces：`STORY_MS = 120_000`；白天截止时间的 key 变为 `day:${turn}:${回合计数}:${说书人调整次数}`。

- [ ] **Step 1: 写失败测试**

`server/test/validate.test.ts` 的 `describe('parseClientAction', ...)` 里加：

```ts
  it('计划 C 的新操作：只保留白名单字段，格式不对一律拒绝', () => {
    expect(parseClientAction({ type: 'pickCharacter', index: 1, seat: 3 }, n)).toEqual({ type: 'pickCharacter', index: 1 });
    expect(() => parseClientAction({ type: 'pickCharacter', index: 2 }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'pickCharacter', index: '0' }, n)).toThrow('操作参数无效');
    expect(parseClientAction({ type: 'priestDraw', cardIds: ['alibi-1', 'evidence-2'] }, n)).toEqual({
      type: 'priestDraw',
      cardIds: ['alibi-1', 'evidence-2'],
    });
    expect(() => parseClientAction({ type: 'priestDraw', cardIds: [] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'priestDraw', cardIds: ['a', 'b', 'c'] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'priestDraw', cardIds: 'alibi-1' }, n)).toThrow('操作参数无效');
    expect(parseClientAction({ type: 'storyStart', extra: 1 }, n)).toEqual({ type: 'storyStart' });
    expect(parseClientAction({ type: 'storyReorder', order: ['x', 'y'] }, n)).toEqual({ type: 'storyReorder', order: ['x', 'y'] });
    expect(() => parseClientAction({ type: 'storyReorder', order: Array(61).fill('x') }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'storyReorder', order: [1] }, n)).toThrow('操作参数无效');
    expect(parseClientAction({ type: 'confess', tryalId: null, silent: true }, n)).toEqual({ type: 'confess', tryalId: null, silent: true });
    expect(parseClientAction({ type: 'confess', tryalId: null, silent: false }, n)).toEqual({ type: 'confess', tryalId: null });
    expect(() => parseClientAction({ type: 'confess', tryalId: 't1', silent: true }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'confess', tryalId: null, silent: 'yes' }, n)).toThrow('操作参数无效');
  });
```

`server/test/deadlines.test.ts`：
- 导入加上 `STORY_MS`。
- `it('白天按回合区分...')` 里的三个期望值 `'day:2:0'`、`'day:2:0'`、`'day:3:0'` 改为 `'day:2:0:0'`、`'day:2:0:0'`、`'day:3:0:0'`。
- 加两条：

```ts
  it('说书人调整完牌堆回到回合时 key 变化（重新计时）', () => {
    const s = game();
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 2;
    const before = deadlineKey(s);
    s.phase = { kind: 'storytelling', seat: 2 };
    expect(deadlineKey(s)).toBe('storytelling');
    s.log.push({ t: 'ability', seat: 2, ability: 'storyteller' });
    s.phase = { kind: 'day', mode: 'choose' };
    expect(deadlineKey(s)).not.toBe(before);
  });

  it('说书人调整牌堆限时 2 分钟', () => {
    const s = game();
    s.phase = { kind: 'storytelling', seat: 1 };
    expect(phaseDuration(s)).toBe(STORY_MS);
    expect(STORY_MS).toBe(120_000);
  });
```

`server/test/game.test.ts`：导入加上 `STORY_MS`（`../src/deadlines`）和 `mutateGame`（`./helpers`），文件末尾加：

```ts
describe('说书人', () => {
  it('调整牌堆限时 2 分钟；牌堆顺序只写进说书人自己的手牌文档；回到回合后重新计 90 秒', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    await run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, undefined, NOW, rng()));
    await mutateGame(store, code, (s) => {
      s.players[s.turn].character = 'storyteller';
    });
    const s0 = game(store, code).state;
    const teller = s0.players[s0.turn];
    const t1 = NOW + 1000;
    await run(store, (tx) => act(tx, code, teller.openid, { type: 'storyStart' }, undefined, t1, rng()));
    expect(room(store, code).view!.phase).toEqual({ kind: 'storytelling', seat: teller.seat });
    expect(room(store, code).deadline).toBe(t1 + STORY_MS);

    const deckIds = game(store, code).state.deck.map((c) => c.id);
    const mine = JSON.stringify(store.read<HandDoc>(HANDS, handId(code, teller.openid)));
    for (const id of deckIds) expect(mine).toContain(`"${id}"`);
    const pub = JSON.stringify(room(store, code));
    for (const id of deckIds) expect(pub).not.toContain(`"${id}"`);
    for (const p of game(store, code).state.players) {
      if (p.seat === teller.seat) continue;
      const other = JSON.stringify(store.read<HandDoc>(HANDS, handId(code, p.openid)));
      for (const id of deckIds) expect(other).not.toContain(`"${id}"`);
    }

    const t2 = t1 + 100_000;
    const order = [...deckIds].reverse();
    await run(store, (tx) => act(tx, code, teller.openid, { type: 'storyReorder', order }, undefined, t2, rng()));
    expect(room(store, code).view!.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(room(store, code).deadline).toBe(t2 + TURN_MS);
    expect(game(store, code).state.deck.map((c) => c.id)).toEqual(order);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd server && npx vitest run`
Expected: FAIL（新操作被拒绝；`STORY_MS` 不存在；day key 格式不同）

- [ ] **Step 3: 修改 `server/src/validate.ts`**

在 `targets` 函数之后加：

```ts
function idList(v: unknown, min: number, max: number): string[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) fail();
  for (const id of v) if (!isBoundedString(id, 64)) fail();
  return v as string[];
}
```

顶部导入改为 `import { RuleError, TOTAL_GAME_CARDS } from '../../engine/src/index';`。

`switch` 里把 `confess` 分支换成：

```ts
    case 'confess': {
      if (r.silent === true) {
        if (r.tryalId !== null) fail();
        return { type: 'confess', tryalId: null, silent: true };
      }
      if (r.silent !== undefined && r.silent !== false) fail();
      if (r.tryalId === null) return { type: 'confess', tryalId: null };
      if (!isBoundedString(r.tryalId, 64)) fail();
      return { type: 'confess', tryalId: r.tryalId };
    }
```

并在 `default:` 之前加：

```ts
    case 'pickCharacter': {
      const index = r.index === 0 ? 0 : r.index === 1 ? 1 : fail();
      return { type: 'pickCharacter', index };
    }
    case 'priestDraw':
      return { type: 'priestDraw', cardIds: idList(r.cardIds, 1, 2) };
    case 'storyStart':
      return { type: 'storyStart' };
    case 'storyReorder':
      return { type: 'storyReorder', order: idList(r.order, 0, TOTAL_GAME_CARDS) };
```

- [ ] **Step 4: 修改 `server/src/deadlines.ts`**

加常量：

```ts
export const STORY_MS = 120_000;
```

`deadlineKey` 的 `case 'day':` 改为：

```ts
    case 'day': {
      // 只按座位号区分不够：如果只剩 2 人存活（或另一人被拘留），同一座位会连续拿到两个回合，
      // 单纯的 day:${turn} 会复用上一回合已经过期的截止时间。加入 log 里 turn 事件的计数区分。
      const turnCount = s.log.filter((e) => e.t === 'turn').length;
      // 说书人调整完牌堆回到回合时重新计时
      const arranged = s.log.filter((e) => e.t === 'ability' && e.ability === 'storyteller').length;
      return `day:${s.turn}:${turnCount}:${arranged}`;
    }
```

`phaseDuration` 里 `if (s.phase.kind === 'characterPick') return PICK_MS;` 之后加：

```ts
  if (s.phase.kind === 'storytelling') return STORY_MS;
```

- [ ] **Step 5: 运行测试**

Run: `cd server && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add server
git commit -m "feat(server): validate character actions; 2-minute storyteller phase with fresh turn timer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 客户端：显示角色、医生出牌选项、规则页

**Files:**
- Modify: `client/src/model/characters.ts`、`client/src/model/actions.ts`、`client/src/model/rules.ts`
- Modify: `client/src/scenes/tableParts.ts`、`client/src/scenes/infoPanels.ts`、`client/src/scenes/table.ts`
- Modify: `client/test/table.test.ts`、`client/test/model.test.ts`

**Interfaces:**
- Consumes：`PublicPlayer.character / ability / usesLeft`（Task 1）；`CHAR_INFO`（Task 1）。
- Produces：`charLabel(p)`（`model/characters.ts`）；`ClientAction` 新增 `pickCharacter`、`priestDraw`、`storyStart`、`storyReorder`，`confess` 多 `silent?`；`OptionNeed` 的辩护项变为 `{ kind: 'alibi'; doctor: boolean }`；`DOCTOR_CHOICE`；`dawnTargets` 排除女仆。

格子里的文字是「角色·昵称」（例如「法官·小明」、「裁缝→法官·小红」）：角色放在前面，格子太窄时截掉的是昵称而不是角色（徽章上仍有昵称首字和座位颜色）。

- [ ] **Step 1: 写失败测试**

`client/test/table.test.ts` 的 `describe('游戏桌', ...)` 里加：

```ts
  it('格子和我的信息栏显示角色；裁缝显示当前复制的角色', () => {
    const s = newState(5);
    setDay(s, 1);
    s.players[0].character = 'priest';
    s.players[1].character = 'judge';
    s.players[2].character = 'tailor';
    const nodes = scene(s).scene.build(0);
    expect(labelOf(nodes, 'seat:1')).toContain('法官');
    expect(labelOf(nodes, 'seat:2')).toContain('裁缝→法官');
    expect(labelOf(nodes, 'me')).toContain('牧师');
  });

  it('玩家详情显示技能说明；限次技能显示剩余次数', () => {
    const s = newState(5);
    setDay(s, 1);
    s.players[3].character = 'priest';
    const { scene: t } = scene(s);
    tap(t.build(0), 'seat:3');
    const text = drawAll(t.build(0)).join('');
    expect(text).toContain('牧师');
    expect(text).toContain('弃牌堆');
    expect(text).toContain('技能剩余次数：2');
  });

  it('医生出辩护：可以选「当作目击」', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[0].character = 'doctor';
    const id = giveCard(s, 0, 'alibi');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), `card:${id}`);
    tap(t.build(0), 'seat:2');
    tap(t.build(0), 'option:witness');
    tap(t.build(0), 'confirm-play');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: id, targets: [2], option: 'witness' });
  });
```

`client/test/model.test.ts`：确保导入了 `buildTable`（`../src/model/table`）、`dawnTargets`（`../src/model/actions`）、`RULES`（`../src/model/rules`）以及 `handOf, newState, roomOf`（`./fixtures`），加：

```ts
describe('角色相关', () => {
  it('第一夜不能选女仆放黑猫', () => {
    const s = newState(5);
    s.players[2].character = 'maid';
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(dawnTargets(m)).not.toContain(2);
    expect(dawnTargets(m)).toContain(3);
  });

  it('规则页有「角色」一节，列出 15 个角色', () => {
    const sec = RULES.find((r) => r.title.startsWith('角色'))!;
    expect(sec.items.filter((t) => t.includes('：'))).toHaveLength(15);
    expect(sec.items.join('')).toContain('裁缝');
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client && npx vitest run test/table.test.ts test/model.test.ts`
Expected: FAIL

- [ ] **Step 3: `client/src/model/characters.ts` 追加 `charLabel`**

```ts
/** 格子里的角色文字：裁缝带上当前复制的角色；没有角色时为空 */
export function charLabel(p: { character: CharacterId | null; ability: CharacterId | null }): string {
  if (!p.character) return '';
  if (p.character === 'tailor') return p.ability ? `裁缝→${CHAR_INFO[p.ability].short}` : '裁缝';
  return CHAR_INFO[p.character].short;
}
```

- [ ] **Step 4: `client/src/model/actions.ts`**

`ClientAction` 改为：

```ts
export type ClientAction =
  | { type: 'draw' }
  | { type: 'play'; cardId: string; targets: number[]; option?: string }
  | { type: 'endTurn' }
  | { type: 'revealTryal'; tryalId: string }
  | { type: 'witchVote'; target: number }
  | { type: 'protect'; target: number }
  | { type: 'confess'; tryalId: string | null; silent?: boolean }
  | { type: 'conspiracyPick'; index: number }
  | { type: 'pickCharacter'; index: number }
  | { type: 'priestDraw'; cardIds: string[] }
  | { type: 'storyStart' }
  | { type: 'storyReorder'; order: string[] };
```

`OptionNeed` 改为：

```ts
export type OptionNeed = { kind: 'curse'; cards: Card[] } | { kind: 'alibi'; doctor: boolean } | null;
```

在 `ALIBI_CHOICES` 之后加：

```ts
/** 医生：把辩护当作目击打出 */
export const DOCTOR_CHOICE = { value: 'witness', label: '当作「目击」打出（7 点）' } as const;
```

`optionNeed` 里辩护的分支改为：

```ts
  if (kind === 'alibi') {
    // 医生对别人（没有信徒）打辩护时，总要问一下是否当作目击
    const doctor = m.me?.ability === 'doctor' && target !== m.mySeat && !p.blue.some((c) => c.kind === 'piety');
    if (doctor) return { kind: 'alibi', doctor: true };
    const acc = p.red.some((c) => c.kind === 'accusation');
    const evi = p.red.some((c) => c.kind === 'evidence');
    return acc && evi ? { kind: 'alibi', doctor: false } : null;
  }
```

`dawnTargets` 改为：

```ts
/** 第一夜放黑猫的目标：活着、且不是女仆（黑猫对女仆无效） */
export function dawnTargets(m: TableModel): number[] {
  return m.view.players.filter((p) => p.alive && p.ability !== 'maid').map((p) => p.seat);
}
```

- [ ] **Step 5: `client/src/model/rules.ts`**

导入 `import { CHAR_INFO } from './characters';`，在 `RULES` 数组的最后加一节：

```ts
  {
    title: '角色（公开）',
    items: [
      '少于 7 人时每人从 2 个随机角色中选 1 个；7 人及以上直接随机发。角色对所有人公开。',
      ...Object.values(CHAR_INFO).map((c) => `${c.name}：${c.desc}`),
    ],
  },
```

- [ ] **Step 6: `client/src/scenes/tableParts.ts`**

导入 `import { charLabel } from '../model/characters';`，在 `drawCell` 之前加：

```ts
/** 格子里的名字：角色在前，昵称在后（太长时截掉的是昵称） */
function cellName(p: PublicPlayer): string {
  const label = charLabel(p);
  return label ? `${label}·${p.name}` : p.name;
}
```

`drawCell` 里两处画名字的调用改为使用 `cellName(p)`：

```ts
    drawText(ctx, cellName(p), cx, r.y + 38, { size: 11, align: 'center', maxWidth: r.w - 6 });
```

```ts
    drawText(ctx, cellName(p), r.x + 26, r.y + 13, { size: 11, maxWidth: r.w - (tag ? 52 : 30) });
```

`drawMeBar` 里：

```ts
  const label = charLabel(me);
  drawText(ctx, `你（${label ? `${label}·` : ''}${me.name}）  ${status}`, r.x + 40, cy, { size: 12, maxWidth: r.w - 130 });
```

- [ ] **Step 7: `client/src/scenes/infoPanels.ts` 的 `detailPanel`**

导入：

```ts
import type { PublicPlayer } from '../../../engine/src/index';
import { wrapText } from '../core/text';
import { CHAR_INFO } from '../model/characters';
import { C, font } from '../theme/palette';
```

（`C` 已导入的话只加 `font`。）在 `detailPanel` 之前加：

```ts
function characterLines(p: PublicPlayer): string[] {
  if (!p.character) return [];
  const c = CHAR_INFO[p.character];
  const lines = [`角色：${c.name}——${c.desc}`];
  if (p.character === 'tailor') {
    lines.push(p.ability ? `当前技能：${CHAR_INFO[p.ability].name}——${CHAR_INFO[p.ability].desc}` : '当前技能：无（右手边的人没有角色）');
  }
  if (p.usesLeft !== null) lines.push(`技能剩余次数：${p.usesLeft}`);
  return lines;
}
```

`detailPanel` 改为（面板加高到 420，文字按宽度换行）：

```ts
export function detailPanel(ui: Ui, m: TableModel, seat: number, close: () => void): Node[] {
  const p = m.view.players[seat];
  const { nodes, body } = sheet(ui.screen, 420, `${p.name}${seat === m.mySeat ? '（你）' : ''}${p.alive ? '' : '（已出局）'}`, close);
  const revealed = p.tryals.filter((t) => t.revealed && t.kind).map((t) => TRYAL_NAME[t.kind!]);
  const reds = countNames(p.red.map((c) => CARD_INFO[c.kind].name));
  const lines = [
    ...characterLines(p),
    `指控：${p.redTotal} / ${p.threshold}${reds ? `（${reds}）` : ''}`,
    `蓝卡：${p.blue.length ? countNames(p.blue.map((c) => CARD_INFO[c.kind].name)) : '无'}`,
    ...(p.green.length ? [`面前：${countNames(p.green.map((c) => CARD_INFO[c.kind].name))}`] : []),
    `手牌：${p.handCount} 张`,
    `身份卡：${p.tryals.length - revealed.length} 张未翻开${revealed.length ? `；已翻开 ${revealed.join('、')}` : ''}`,
  ];
  nodes.push({
    id: 'detail-body',
    rect: body,
    draw: (ctx) => {
      ctx.font = font(14);
      let y = body.y + 12;
      for (const line of lines) {
        for (const t of wrapText(line, body.w, (s) => ctx.measureText(s).width)) {
          drawText(ctx, t, body.x, y, { size: 14 });
          y += 22;
        }
        y += 6;
      }
    },
  });
  return nodes;
}
```

- [ ] **Step 8: `client/src/scenes/table.ts` 的辩护选项**

导入加上 `DOCTOR_CHOICE`（`../model/actions`）。`optionSheet` 里的 `title` 和 `choices` 改为：

```ts
    const title = need.kind === 'curse' ? '诅咒：丢弃哪张蓝卡？' : need.doctor ? '辩护：怎么打出？' : '辩护：丢弃哪种红卡？';
    const { nodes, body } = sheet(this.ui.screen, need.kind === 'alibi' && need.doctor ? 340 : 280, title, close);
    const choices =
      need.kind === 'curse'
        ? need.cards.map((c) => ({ value: c.id, label: CARD_INFO[c.kind].name }))
        : [...(need.doctor ? [DOCTOR_CHOICE] : []), ...ALIBI_CHOICES].map((c) => ({ value: c.value as string, label: c.label as string }));
```

- [ ] **Step 9: 运行测试**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 10: 提交**

```bash
git add client
git commit -m "feat(client): show characters on the table, skill details, doctor's witness option, rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 界面框架：按住拖动

**Files:**
- Modify: `client/src/core/node.ts`、`client/src/core/app.ts`
- Modify: `client/test/core.test.ts`

**Interfaces:**
- Produces：`interface Drag { move(x, y): void; end(): void; frame?(): void }`；`Node.onPress?: (x, y) => Drag`；`hitTest` 的 key 支持 `'onPress'`。
- 行为：手指按下时如果落在带 `onPress` 的节点上，立即进入拖动：之后的移动、松手都交给这次拖动，不再触发点击和滚动；拖动期间 App 每一帧都会重画并调用 `frame()`（手指不动时也会调用，用于边缘自动滚动）；松手后停止。

- [ ] **Step 1: 写失败测试**

`client/test/core.test.ts` 末尾加：

```ts
describe('App 按住拖动', () => {
  function setup() {
    const frames: (() => void)[] = [];
    const events: string[] = [];
    const app = new App(fakeCtx().ctx, { W: 100, H: 100, top: 0, bottom: 100 }, (cb) => frames.push(cb), () => 0);
    const scene: Scene = {
      build: () => [
        { id: 'row', rect: rect(0, 0, 100, 100), onTap: () => events.push('tap'), onScroll: () => events.push('scroll') },
        {
          id: 'handle',
          rect: rect(80, 0, 20, 20),
          onPress: (_x, y) => {
            events.push(`press ${y}`);
            return {
              move: (_mx, my) => events.push(`move ${my}`),
              end: () => events.push('end'),
              frame: () => events.push('frame'),
            };
          },
        },
      ],
    };
    app.setScene(scene);
    frames.shift()!();
    return { app, frames, events };
  }

  it('按住把手立即开始拖动：移动和松手都交给拖动，不触发点击和滚动', () => {
    const { app, events } = setup();
    app.touchStart(90, 10);
    app.touchMove(90, 50);
    app.touchEnd(90, 50);
    expect(events.filter((e) => e !== 'frame')).toEqual(['press 10', 'move 50', 'end']);
  });

  it('拖动期间每一帧都调用 frame（手指不动也调用），松手后不再调用', () => {
    const { app, frames, events } = setup();
    app.touchStart(90, 10);
    frames.shift()!();
    frames.shift()!();
    const during = events.filter((e) => e === 'frame').length;
    expect(during).toBeGreaterThanOrEqual(2);
    app.touchEnd(90, 10);
    while (frames.length) frames.shift()!();
    const after = events.filter((e) => e === 'frame').length;
    app.render();
    while (frames.length) frames.shift()!();
    expect(events.filter((e) => e === 'frame').length).toBe(after);
    expect(frames).toHaveLength(0);
  });

  it('把手以外的地方照常点击和滚动', () => {
    const { app, events } = setup();
    app.touchStart(10, 50);
    app.touchEnd(10, 50);
    app.touchStart(10, 50);
    app.touchMove(10, 80);
    app.touchEnd(10, 80);
    expect(events).toEqual(['tap', 'scroll']);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client && npx vitest run test/core.test.ts`
Expected: FAIL（类型错误 / `onPress` 不被识别）

- [ ] **Step 3: 修改 `client/src/core/node.ts`**

在 `Node` 之前加：

```ts
/** 一次按住拖动：移动、松手都交给它；frame 在拖动期间每一帧调用（手指不动时也调用） */
export interface Drag {
  move(x: number, y: number): void;
  end(): void;
  frame?(): void;
}
```

`Node` 里 `onScroll` 之后加：

```ts
  /** 按下时立即开始拖动（例如列表的拖动把手），返回这次拖动 */
  onPress?: (x: number, y: number) => Drag;
```

`hitTest` 的签名改为 `key: 'onTap' | 'onScroll' | 'onPress'`。

- [ ] **Step 4: 修改 `client/src/core/app.ts`**

导入改为 `import { drawNodes, hitTest, type Ctx, type Drag, type Node } from './node';`。`App` 加字段 `private drag: Drag | null = null;`。

`draw` 改为：

```ts
  draw(): void {
    if (!this.scene) return;
    const now = this.clock();
    this.drag?.frame?.();
    this.nodes = this.scene.build(now);
    this.ctx.clearRect(0, 0, this.screen.W, this.screen.H);
    drawNodes(this.ctx, this.nodes);
    // 动画进行中或正在拖动时继续逐帧重画
    if (this.animator.active(now) || this.drag) this.render();
  }
```

三个触摸方法改为：

```ts
  touchStart(x: number, y: number): void {
    const press = hitTest(this.nodes, x, y, 'onPress');
    if (press) {
      this.touch = null;
      this.drag = press.onPress!(x, y);
      this.render();
      return;
    }
    this.touch = { x0: x, y0: y, lastY: y, moved: false, scroll: hitTest(this.nodes, x, y, 'onScroll') };
  }

  touchMove(x: number, y: number): void {
    if (this.drag) {
      this.drag.move(x, y);
      this.render();
      return;
    }
    const t = this.touch;
    if (!t) return;
    if (!t.moved && Math.abs(x - t.x0) + Math.abs(y - t.y0) > 8) t.moved = true;
    if (t.moved && t.scroll) {
      t.scroll.onScroll!(y - t.lastY);
      this.render();
    }
    t.lastY = y;
  }

  touchEnd(x: number, y: number): void {
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      d.end();
      this.render();
      return;
    }
    const t = this.touch;
    this.touch = null;
    if (!t || t.moved) return;
    const n = hitTest(this.nodes, x, y, 'onTap');
    if (n) {
      n.onTap!();
      this.render();
    }
  }
```

- [ ] **Step 5: 运行测试**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add client
git commit -m "feat(client): press-and-drag in the UI core, with per-frame callback while dragging

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 客户端面板：选角色、官员自首、查看弃牌堆、牧师、说书人按钮

**Files:**
- Modify: `client/src/scenes/choicePanels.ts`、`client/src/scenes/infoPanels.ts`、`client/src/scenes/table.ts`
- Create: `client/src/scenes/abilityPanels.ts`
- Modify: `client/test/choices.test.ts`、`client/test/table.test.ts`

**Interfaces:**
- Consumes：`ClientAction` 的新操作、`CHAR_INFO`（Task 1、7）；`PublicView.discard`（Task 1）；`PublicPlayer.ability / usesLeft`。
- Produces：节点 id —— `character:<角色>`、`confirm-character`、`silent-confess`、`discard`、`discard-list`、`priest`、`priest:<卡种>`、`confirm-priest`、`story-start`；`priestPanel(ui, m, picked, close)`；`discardPanel(ui, m, box, close)`。

- [ ] **Step 1: 写失败测试**

`client/test/choices.test.ts` 末尾加：

```ts
describe('选角色', () => {
  function picking(screen: Screen = SCREEN) {
    const s = newState(5);
    s.phase = { kind: 'characterPick' };
    s.characterOffers = {
      0: ['judge', 'maid'],
      1: ['priest', 'child'],
      2: ['farmer', 'beggar'],
      3: ['doctor', 'maiden'],
      4: ['official', 'tailor'],
    };
    return { s, ...table(s, 0, screen) };
  }

  it('两个候选显示技能说明；点一个再确认', () => {
    const { ctl, t } = picking();
    const nodes = t.build(0);
    const text = drawAll(nodes).join('');
    expect(text).toContain('法官');
    expect(text).toContain('女仆');
    expect(canTap(nodes, 'confirm-character')).toBe(false);
    tap(nodes, 'character:maid');
    tap(t.build(0), 'confirm-character');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'pickCharacter', index: 1 });
  });

  it('小屏上确认按钮在屏幕内', () => {
    const { t } = picking(SMALL);
    const r = rectOf(t.build(0), 'confirm-character');
    expect(r.y + r.h).toBeLessThanOrEqual(SMALL.bottom);
  });

  it('自己选完后显示等待其他人', () => {
    const { s } = picking();
    s.players[0].character = 'judge';
    const text = drawAll(table(s, 0).t.build(0)).join('');
    expect(text).toContain('等待其他人选择角色（1/5）');
  });
});

describe('官员', () => {
  it('夜晚多一个「不翻牌自首」按钮；小屏 12 人也放得下', () => {
    const s = newState(12);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const me = s.players.find((p) => !p.witchFaction && p.seat !== constable(s))!.seat;
    s.players[me].character = 'official';
    const { ctl, t } = table(s, me, SMALL);
    const nodes = t.build(0);
    const silent = rectOf(nodes, 'silent-confess');
    expect(labelOf(nodes, 'silent-confess')).toContain('剩 1 次');
    expect(bottomOf(nodes, /^(kill|protect|suspect):/)).toBeLessThanOrEqual(silent.y);
    expect(bottomOf(nodes, /^confess:/) + 20).toBeLessThanOrEqual(silent.y);
    expect(silent.y + silent.h).toBeLessThanOrEqual(rectOf(nodes, 'no-confess').y);
    tap(nodes, 'silent-confess');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'confess', tryalId: null, silent: true });
  });

  it('不是官员没有这个按钮', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    expect(has(table(s, plain).t.build(0), 'silent-confess')).toBe(false);
  });
});
```

（`Screen` 类型已在文件顶部导入；如果没有，加 `import type { Screen } from '../src/core/app';`。）

`client/test/table.test.ts` 的 `describe('游戏桌', ...)` 里加：

```ts
  it('点顶栏的弃牌数查看弃牌堆', () => {
    const s = newState(5);
    setDay(s, 1);
    s.discard.push(...s.players[3].hand.splice(0, 2));
    const { scene: t } = scene(s);
    tap(t.build(0), 'discard');
    const nodes = t.build(0);
    expect(has(nodes, 'discard-list')).toBe(true);
    expect(drawAll(nodes).join('')).toContain('弃牌堆（2 张）');
    tap(nodes, 'sheet-close');
    expect(has(t.build(0), 'discard-list')).toBe(false);
  });

  it('牧师：回合开始时可以从弃牌堆拿 1–2 张', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[0].character = 'priest';
    const a = s.players[3].hand.pop()!;
    const b = s.players[4].hand.pop()!;
    s.discard.push(a, b);
    const { ctl, scene: t } = scene(s);
    const nodes = t.build(0);
    expect(labelOf(nodes, 'priest')).toContain('剩 2');
    expect(has(nodes, 'draw')).toBe(true);
    tap(nodes, 'priest');
    tap(t.build(0), `priest:${a.kind}`);
    tap(t.build(0), `priest:${b.kind}`);
    tap(t.build(0), 'confirm-priest');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'priestDraw', cardIds: expect.arrayContaining([a.id, b.id]) });
  });

  it('牧师：弃牌堆里只有黑卡时按钮不可点', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[0].character = 'priest';
    const i = s.deck.findIndex((c) => c.kind === 'night');
    s.discard.push(...s.deck.splice(i, 1));
    expect(canTap(scene(s).scene.build(0), 'priest')).toBe(false);
  });

  it('说书人：回合开始时可以开始调整牌堆', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[0].character = 'storyteller';
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'story-start');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'storyStart' });
  });
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client && npx vitest run test/choices.test.ts test/table.test.ts`
Expected: FAIL

- [ ] **Step 3: 选角色面板与官员按钮：`client/src/scenes/choicePanels.ts`**

导入加上：

```ts
import type { PendingChoice } from '../../../engine/src/index';
import { wrapText } from '../core/text';
import { CHAR_INFO } from '../model/characters';
import { C, font, goldGlow } from '../theme/palette';
```

（`C`、`goldGlow` 原本已导入，合并即可。）把 `if (p.kind === 'characterPick' || p.kind === 'storytelling') return [];` 改为：

```ts
  if (p.kind === 'storytelling') return [];
  if (p.kind === 'characterPick') return characterPanel(ui, m, p, st, cd, slide);
```

在 `choicePanel` 之后加：

```ts
function characterPanel(
  ui: Ui,
  _m: TableModel,
  p: Extract<PendingChoice, { kind: 'characterPick' }>,
  st: ChoiceState,
  cd: string,
  slide: number,
): Node[] {
  const { nodes, body } = sheet(ui.screen, 400, '选择你的角色', null, slide, `角色对所有人公开 · 剩余 ${cd} · 超时随机选择`);
  const gap = 10;
  const w = (body.w - gap) / 2;
  const h = Math.min(200, body.h - 60);
  p.offers.forEach((c, i) => {
    const r = rect(body.x + i * (w + gap), body.y, w, h);
    nodes.push({
      id: `character:${c}`,
      rect: r,
      onTap: () => (st.picked = i),
      draw: (ctx) => {
        const sel = st.picked === i;
        drawPanel(ctx, r, { fill: sel ? goldGlow(0.2) : C.panel, stroke: sel ? C.gold : C.panelLine, lineWidth: sel ? 2 : 1 });
        drawText(ctx, CHAR_INFO[c].name, r.x + r.w / 2, r.y + 28, { size: 20, bold: true, color: C.gold, align: 'center' });
        ctx.font = font(13);
        wrapText(CHAR_INFO[c].desc, r.w - 20, (s) => ctx.measureText(s).width).forEach((line, k) =>
          drawText(ctx, line, r.x + 10, r.y + 62 + k * 20, { size: 13 }),
        );
      },
    });
  });
  const idx = typeof st.picked === 'number' ? st.picked : null;
  nodes.push(
    requestButton(
      'confirm-character',
      rect(body.x, body.y + h + 16, body.w, 44),
      '选这个角色',
      idx !== null ? () => void ui.ctl.act({ type: 'pickCharacter', index: idx }) : null,
      ui.ctl.busy,
    ),
  );
  return nodes;
}
```

`nightPanel` 里，把

```ts
  const tryals = p.confessed ? [] : unrevealedTryals(m);
  const btnY = body.y + bodyH - NIGHT_BUTTON_H;
  const avail = p.confessed ? bodyH - 24 : btnY - body.y;
```

改为：

```ts
  const tryals = p.confessed ? [] : unrevealedTryals(m);
  // 官员还有次数时，两个自首按钮上方多一个「不翻牌自首」
  const silentLeft = !p.confessed && m.me?.ability === 'official' ? (m.me.usesLeft ?? 0) : 0;
  const btnY = body.y + bodyH - NIGHT_BUTTON_H;
  const silentY = btnY - NIGHT_BUTTON_H - 8;
  const avail = p.confessed ? bodyH - 24 : (silentLeft > 0 ? silentY : btnY) - body.y;
```

并在 `nightPanel` 末尾 `return nodes;` 之前（`no-confess`、`confirm-confess` 两个按钮之后）加：

```ts
  if (silentLeft > 0) {
    nodes.push(
      requestButton(
        'silent-confess',
        rect(body.x, silentY, body.w, NIGHT_BUTTON_H),
        `不翻牌自首（剩 ${silentLeft} 次）`,
        () => void act({ type: 'confess', tryalId: null, silent: true }),
        busy,
        'secondary',
      ),
    );
  }
```

- [ ] **Step 4: 弃牌堆面板：`client/src/scenes/infoPanels.ts`**

导入加上 `import type { CardColor } from '../model/cards';`（`CARD_INFO` 已导入）。末尾加：

```ts
const COLOR_GROUPS: [string, CardColor][] = [
  ['红卡', 'red'],
  ['蓝卡', 'blue'],
  ['绿卡', 'green'],
  ['黑卡', 'black'],
];

export function discardPanel(ui: Ui, m: TableModel, box: ScrollBox, close: () => void): Node[] {
  const discard = m.view.discard;
  const { nodes, body } = sheet(ui.screen, ui.screen.H * 0.6, `弃牌堆（${discard.length} 张）`, close, 1, '所有人都可以查看');
  const lines = COLOR_GROUPS.flatMap(([title, color]) => {
    const names = discard.filter((c) => CARD_INFO[c.kind].color === color).map((c) => CARD_INFO[c.kind].name);
    return names.length ? [{ text: `${title}：${countNames(names)}`, size: 14, gap: 8 }] : [];
  });
  nodes.push(box.node('discard-list', body, lines.length ? lines : [{ text: '弃牌堆是空的', color: C.textMuted }]));
  return nodes;
}
```

- [ ] **Step 5: 牧师面板：新建 `client/src/scenes/abilityPanels.ts`**

```ts
import { isBlack } from '../../../engine/src/index';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { CARD_INFO } from '../model/cards';
import type { TableModel } from '../model/table';
import { drawPanel, drawText } from '../theme/draw';
import { C, goldGlow } from '../theme/palette';
import type { Ui } from './ui';
import { requestButton, sheet } from './widgets';

/** 牧师：按卡种列出弃牌堆里的非黑卡，点一下拿一张（最多 2 张），再点已满的卡种取消 */
export function priestPanel(ui: Ui, m: TableModel, picked: string[], close: () => void): Node[] {
  const { nodes, body } = sheet(ui.screen, 420, '牧师：从弃牌堆拿牌', close, 1, '选 1–2 张非黑卡，拿完回合结束');
  const pool = m.view.discard.filter((c) => !isBlack(c.kind));
  const kinds = [...new Set(pool.map((c) => c.kind))];
  const cols = 4;
  const gap = 8;
  const w = (body.w - gap * (cols - 1)) / cols;
  const h = 56;
  kinds.forEach((kind, i) => {
    const r = rect(body.x + (i % cols) * (w + gap), body.y + Math.floor(i / cols) * (h + gap), w, h);
    const ids = pool.filter((c) => c.kind === kind).map((c) => c.id);
    const mine = picked.filter((id) => ids.includes(id)).length;
    nodes.push({
      id: `priest:${kind}`,
      rect: r,
      onTap: () => {
        const free = ids.find((id) => !picked.includes(id));
        if (free && picked.length < 2) {
          picked.push(free);
          return;
        }
        for (const id of ids) {
          const k = picked.indexOf(id);
          if (k >= 0) picked.splice(k, 1);
        }
      },
      draw: (ctx) => {
        drawPanel(ctx, r, { fill: mine ? goldGlow(0.2) : C.panel, stroke: mine ? C.gold : C.panelLine, lineWidth: mine ? 2 : 1 });
        drawText(ctx, CARD_INFO[kind].name, r.x + r.w / 2, r.y + 20, { size: 14, align: 'center' });
        drawText(ctx, mine ? `已选 ${mine} / ${ids.length}` : `${ids.length} 张`, r.x + r.w / 2, r.y + 40, {
          size: 11,
          align: 'center',
          color: mine ? C.gold : C.textDim,
        });
      },
    });
  });
  const y = body.y + Math.ceil(kinds.length / cols) * (h + gap) + 8;
  nodes.push(
    requestButton(
      'confirm-priest',
      rect(body.x, y, body.w, 44),
      picked.length ? `拿这 ${picked.length} 张` : '选择要拿的牌',
      picked.length ? () => void ui.ctl.act({ type: 'priestDraw', cardIds: [...picked] }) : null,
      ui.ctl.busy,
    ),
  );
  return nodes;
}
```

- [ ] **Step 6: 游戏桌接入：`client/src/scenes/table.ts`**

导入加上：

```ts
import { isBlack } from '../../../engine/src/index';
import { priestPanel } from './abilityPanels';
import { detailPanel, discardPanel, logPanel, myTryalsPanel } from './infoPanels';
```

（替换原来 `./infoPanels` 的导入；`isBlack` 与已有的引擎类型导入合并为 `import { isBlack, type CardKind } from '../../../engine/src/index';`。）

`TableScene` 加字段：

```ts
  protected discardOpen = false;
  protected readonly discardBox = new ScrollBox();
  protected priestOpen = false;
  protected readonly priestPick: string[] = [];
```

`build` 里 `nodes.push(this.topBar(m, L.top, now));` 之后加：

```ts
    nodes.push(this.discardNode(L.top));
```

`panels` 改为：

```ts
  protected panels(m: TableModel, choice: Node[]): Node[] {
    if (choice.length) return choice;
    if (this.askOption) return this.optionSheet(m);
    if (this.priestOpen) return priestPanel(this.ui, m, this.priestPick, () => (this.priestOpen = false));
    if (this.detail !== null) return detailPanel(this.ui, m, this.detail, () => (this.detail = null));
    if (this.mine) return myTryalsPanel(this.ui, m, () => (this.mine = false));
    if (this.logOpen) return logPanel(this.ui, m, this.logBox, () => (this.logOpen = false));
    if (this.discardOpen) return discardPanel(this.ui, m, this.discardBox, () => (this.discardOpen = false));
    return [];
  }
```

`sync` 末尾加（不再是自己回合开始时关掉牧师面板）：

```ts
    if (this.priestOpen && !(m.pending?.kind === 'turn' && m.pending.mode === 'choose')) this.priestOpen = false;
```

`topBar` 之后加：

```ts
  /** 顶栏右侧「牌堆 / 弃牌」数字的点击区域：打开弃牌堆 */
  private discardNode(r: Rect): Node {
    const right = r.x + r.w - LEAVE_W - 8;
    return {
      id: 'discard',
      rect: rect(right - 56, r.y, 56, r.h),
      onTap: () => {
        this.discardOpen = true;
        this.discardBox.reset();
      },
    };
  }
```

`infoText` 里，`if (m.me && !m.me.alive) return '你已出局，可以继续观看';` 之后加：

```ts
    if (m.view.phase.kind === 'characterPick') {
      const done = m.view.players.filter((p) => p.character).length;
      return `等待其他人选择角色（${done}/${m.view.players.length}）`;
    }
```

`buttonNodes` 里把

```ts
    if (m.pending.mode === 'choose') return [requestButton('draw', r, '抽 2 张', () => void ctl.act({ type: 'draw' }), busy)];
```

改为：

```ts
    if (m.pending.mode === 'choose') {
      const skill = this.skillButton(m, rect(r.x + half + 10, r.y, half, r.h));
      if (!skill) return [requestButton('draw', r, '抽 2 张', () => void ctl.act({ type: 'draw' }), busy)];
      return [requestButton('draw', rect(r.x, r.y, half, r.h), '抽 2 张', () => void ctl.act({ type: 'draw' }), busy), skill];
    }
```

并在 `buttonNodes` 之后加：

```ts
  /** 回合开始时的技能按钮：牧师从弃牌堆拿牌、说书人调整牌堆；没有可用技能时返回 null */
  private skillButton(m: TableModel, r: Rect): Node | null {
    const me = m.me;
    const left = me?.usesLeft ?? 0;
    if (!me || left <= 0) return null;
    const busy = this.ui.ctl.busy;
    if (me.ability === 'priest') {
      const ok = m.view.discard.some((c) => !isBlack(c.kind));
      const open = () => {
        this.priestOpen = true;
        this.priestPick.length = 0;
      };
      return button('priest', r, `从弃牌堆拿（剩 ${left}）`, ok && !busy ? open : null, 'secondary');
    }
    if (me.ability === 'storyteller') {
      return requestButton('story-start', r, `调整牌堆（剩 ${left}）`, () => void this.ui.ctl.act({ type: 'storyStart' }), busy, 'secondary');
    }
    return null;
  }
```

- [ ] **Step 7: 运行测试**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add client
git commit -m "feat(client): character pick panel, official's silent confession, discard viewer, priest and storyteller buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 说书人拖拽面板

与 2026-10-01 在手机上试过的网页原型一致：从上到下是牌堆顶到牌堆底；按住每行右侧的「≡」立即拖起，其他地方上下滑动是滚动；手指靠近列表上下边缘时自动滚动，越靠边越快；底部「还原」「确认顺序」；标题下方显示倒计时。其他人看到顶栏「P2 正在调整牌堆」。

**Files:**
- Create: `client/src/scenes/storyBoard.ts`、`client/test/story.test.ts`
- Modify: `client/src/scenes/table.ts`

**Interfaces:**
- Consumes：`Drag`、`Node.onPress`（Task 8）；待选项 `{ kind: 'storytelling'; deck }`（Task 5）；`ClientAction` 的 `storyReorder`（Task 7）。
- Produces：`class StoryBoard { build(ui, m, deck, now): Node[] }`、`ROW_H = 52`；节点 id —— `story-list`、`handle:<卡 id>`、`story-ghost`、`story-reset`、`story-confirm`。

- [ ] **Step 1: 写失败测试**

新建 `client/test/story.test.ts`：

```ts
import { describe, expect, it, type Mock } from 'vitest';
import type { GameState } from '../../engine/src/index';
import { findNode } from '../src/core/node';
import { ROW_H } from '../src/scenes/storyBoard';
import { TableScene } from '../src/scenes/table';
import { handOf, newState, roomOf } from './fixtures';
import { drawAll, fakeCtl, fakeUi, has, tap } from './sceneKit';

function view(s: GameState, seat: number) {
  const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, seat), openid: `u${seat}` });
  return { ctl, t: new TableScene(fakeUi(ctl)) };
}

function telling(): GameState {
  const s = newState(5);
  s.players[0].character = 'storyteller';
  s.phase = { kind: 'storytelling', seat: 0 };
  return s;
}

const sentOrder = (ctl: ReturnType<typeof fakeCtl>): string[] => (ctl.act as Mock).mock.calls.at(-1)![0].order;

describe('说书人调整牌堆', () => {
  it('看到整个牌堆；直接确认时发送原顺序', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const nodes = t.build(0);
    expect(has(nodes, 'story-list')).toBe(true);
    expect(has(nodes, `handle:${s.deck[0].id}`)).toBe(true);
    tap(nodes, 'story-confirm');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'storyReorder', order: s.deck.map((c) => c.id) });
  });

  it('按住第 3 张的把手往上拖两行：它变成第 1 张', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const id = s.deck[2].id;
    const h = findNode(t.build(0), `handle:${id}`)!;
    const x = h.rect.x + 5;
    const y0 = h.rect.y + 10;
    const drag = h.onPress!(x, y0);
    drag.move(x, y0 - 2 * ROW_H);
    drag.end();
    tap(t.build(0), 'story-confirm');
    const order = sentOrder(ctl);
    expect(order[0]).toBe(id);
    expect([...order].sort()).toEqual(s.deck.map((c) => c.id).sort());
  });

  it('拖到列表下边缘停住：自动往下滚，牌被带到牌堆底', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const nodes = t.build(0);
    const id = s.deck[0].id;
    const h = findNode(nodes, `handle:${id}`)!;
    const list = findNode(nodes, 'story-list')!.rect;
    const drag = h.onPress!(h.rect.x + 5, h.rect.y + 10);
    drag.move(h.rect.x + 5, list.y + list.h - 5);
    for (let i = 0; i < 400; i++) drag.frame!();
    drag.end();
    tap(t.build(0), 'story-confirm');
    expect(sentOrder(ctl).at(-1)).toBe(id);
  });

  it('拖动时画出跟手的牌，松手后消失', () => {
    const s = telling();
    const { t } = view(s, 0);
    const h = findNode(t.build(0), `handle:${s.deck[1].id}`)!;
    const drag = h.onPress!(h.rect.x + 5, h.rect.y + 10);
    expect(has(t.build(0), 'story-ghost')).toBe(true);
    drag.end();
    expect(has(t.build(0), 'story-ghost')).toBe(false);
  });

  it('还原：回到原来的顺序', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const h = findNode(t.build(0), `handle:${s.deck[2].id}`)!;
    const drag = h.onPress!(h.rect.x + 5, h.rect.y + 10);
    drag.move(h.rect.x + 5, h.rect.y + 10 - 2 * ROW_H);
    drag.end();
    tap(t.build(0), 'story-reset');
    tap(t.build(0), 'story-confirm');
    expect(sentOrder(ctl)).toEqual(s.deck.map((c) => c.id));
  });

  it('其他人看不到面板，顶栏显示谁在调整牌堆', () => {
    const s = telling();
    const nodes = view(s, 1).t.build(0);
    expect(has(nodes, 'story-list')).toBe(false);
    expect(drawAll(nodes).join('')).toContain('P0 正在调整牌堆');
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client && npx vitest run test/story.test.ts`
Expected: FAIL（`../src/scenes/storyBoard` 不存在）

- [ ] **Step 3: 新建 `client/src/scenes/storyBoard.ts`**

```ts
import type { Card } from '../../../engine/src/index';
import { rect, type Rect } from '../core/geom';
import type { Ctx, Drag, Node } from '../core/node';
import { CARD_INFO } from '../model/cards';
import { formatCountdown, type TableModel } from '../model/table';
import { drawPanel, drawText, roundRect } from '../theme/draw';
import { C, CARD_GRADIENT } from '../theme/palette';
import type { Ui } from './ui';
import { button, clampScroll, requestButton, sheet } from './widgets';

/** 每行的高度（含 6px 行距） */
export const ROW_H = 52;
const HANDLE_W = 48;
/** 手指离列表上下边缘这么近时自动滚动 */
const EDGE = 70;
/** 自动滚动每帧最多滚动的像素 */
const MAX_SPEED = 14;

interface DragState {
  id: string;
  /** 手指当前的 y */
  y: number;
  /** 手指到被拖那一行顶部的距离 */
  grab: number;
}

/** 说书人调整牌堆的面板。顺序、滚动位置和拖动状态保存在这里，跨帧保留。 */
export class StoryBoard {
  private key = '';
  private order: string[] = [];
  private scroll = 0;
  private drag: DragState | null = null;
  private list: Rect | null = null;

  build(ui: Ui, m: TableModel, deck: Card[], now: number): Node[] {
    // 服务器发来的牌堆变了（新的一次调整）才重置本地顺序
    const key = deck.map((c) => c.id).join(',');
    if (key !== this.key) {
      this.key = key;
      this.order = deck.map((c) => c.id);
      this.scroll = 0;
      this.drag = null;
    }
    const byId = new Map(deck.map((c) => [c.id, c] as const));
    const S = ui.screen;
    const { nodes, body } = sheet(
      S,
      S.H - S.top,
      '说书人：调整牌堆',
      null,
      1,
      `上面是牌堆顶 · 按住右侧 ≡ 拖动 · 剩余 ${formatCountdown(m.deadline, now)}`,
    );
    const btnH = 44;
    const list = rect(body.x, body.y, body.w, body.h - btnH - 12);
    this.list = list;
    const contentH = this.order.length * ROW_H;
    this.scroll = clampScroll(this.scroll, contentH, list.h);

    nodes.push({
      id: 'story-list',
      rect: list,
      clip: true,
      onScroll: (dy) => {
        if (!this.drag) this.scroll = clampScroll(this.scroll + dy, contentH, list.h);
      },
      draw: (ctx) => {
        this.order.forEach((id, i) => {
          const y = list.y + this.scroll + i * ROW_H;
          if (y + ROW_H < list.y || y > list.y + list.h) return;
          const r = rect(list.x, y, list.w, ROW_H - 6);
          if (this.drag?.id === id) drawPanel(ctx, r, { fill: C.transparent, stroke: C.goldDark });
          else drawRow(ctx, r, byId.get(id) as Card, i, false);
        });
      },
    });

    // 只给看得见的行放拖动把手，把手的点击区域裁到列表范围内
    this.order.forEach((id, i) => {
      const y = list.y + this.scroll + i * ROW_H;
      const top = Math.max(y, list.y);
      const bottom = Math.min(y + ROW_H - 6, list.y + list.h);
      if (bottom <= top) return;
      nodes.push({
        id: `handle:${id}`,
        rect: rect(list.x + list.w - HANDLE_W, top, HANDLE_W, bottom - top),
        onPress: (_x, py) => this.press(id, py),
      });
    });

    const d = this.drag;
    if (d) {
      const gy = Math.max(list.y - 20, Math.min(list.y + list.h - ROW_H + 26, d.y - d.grab));
      const r = rect(list.x, gy, list.w, ROW_H - 6);
      const card = byId.get(d.id) as Card;
      const index = this.order.indexOf(d.id);
      nodes.push({ id: 'story-ghost', rect: r, draw: (ctx) => drawRow(ctx, r, card, index, true) });
    }

    const half = (body.w - 10) / 2;
    const by = list.y + list.h + 12;
    nodes.push(
      button('story-reset', rect(body.x, by, half, btnH), '还原', () => {
        this.order = deck.map((c) => c.id);
      }, 'secondary'),
      requestButton(
        'story-confirm',
        rect(body.x + half + 10, by, half, btnH),
        '确认顺序',
        () => void ui.ctl.act({ type: 'storyReorder', order: [...this.order] }),
        ui.ctl.busy,
      ),
    );
    return nodes;
  }

  private press(id: string, y: number): Drag {
    const list = this.list as Rect;
    const i = this.order.indexOf(id);
    this.drag = { id, y, grab: y - (list.y + this.scroll + i * ROW_H) };
    return {
      move: (_x, ny) => {
        if (!this.drag) return;
        this.drag.y = ny;
        this.follow();
      },
      frame: () => this.autoScroll(),
      end: () => {
        this.drag = null;
      },
    };
  }

  /** 手指靠近列表上下边缘时滚动，越靠边越快 */
  private autoScroll(): void {
    const d = this.drag;
    const list = this.list;
    if (!d || !list) return;
    const contentH = this.order.length * ROW_H;
    if (d.y < list.y + EDGE) this.scroll += Math.ceil(((list.y + EDGE - d.y) / EDGE) * MAX_SPEED);
    else if (d.y > list.y + list.h - EDGE) this.scroll -= Math.ceil(((d.y - (list.y + list.h - EDGE)) / EDGE) * MAX_SPEED);
    else return;
    this.scroll = clampScroll(this.scroll, contentH, list.h);
    this.follow();
  }

  /** 把被拖的牌移到手指所在的位置 */
  private follow(): void {
    const d = this.drag as DragState;
    const list = this.list as Rect;
    const top = d.y - d.grab;
    const target = Math.max(0, Math.min(this.order.length - 1, Math.round((top - list.y - this.scroll) / ROW_H)));
    const cur = this.order.indexOf(d.id);
    if (target !== cur) {
      this.order.splice(cur, 1);
      this.order.splice(target, 0, d.id);
    }
  }
}

/** 一行：序号、卡牌小色块、名字和说明、拖动把手 */
function drawRow(ctx: Ctx, r: Rect, card: Card, index: number, lifted: boolean): void {
  const info = CARD_INFO[card.kind];
  drawPanel(ctx, r, { fill: lifted ? C.panelSolid : C.panel, stroke: lifted ? C.gold : C.panelLine, lineWidth: lifted ? 2 : 1 });
  drawText(ctx, String(index + 1), r.x + 26, r.y + r.h / 2, { size: 12, color: C.textMuted, align: 'right' });
  const chip = rect(r.x + 34, r.y + 5, 28, r.h - 10);
  const [top, bottom] = CARD_GRADIENT[info.color];
  const g = ctx.createLinearGradient(0, chip.y, 0, chip.y + chip.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  roundRect(ctx, chip, 4);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = C.goldLine;
  ctx.stroke();
  drawText(ctx, info.name.slice(0, 1), chip.x + chip.w / 2, chip.y + chip.h / 2, { size: 13, bold: true, color: C.cardText, align: 'center' });
  const black = info.color === 'black';
  drawText(ctx, info.name, r.x + 72, r.y + r.h / 2 - 8, { size: 15, bold: black, color: black ? C.gold : C.text });
  drawText(ctx, info.desc, r.x + 72, r.y + r.h / 2 + 10, { size: 11, color: C.textMuted, maxWidth: r.w - 72 - HANDLE_W - 8 });
  drawText(ctx, '≡', r.x + r.w - HANDLE_W / 2, r.y + r.h / 2, { size: 20, color: C.textDim, align: 'center' });
}
```

- [ ] **Step 4: 游戏桌接入：`client/src/scenes/table.ts`**

导入 `import { StoryBoard } from './storyBoard';`，`TableScene` 加字段：

```ts
  protected readonly board = new StoryBoard();
```

`build` 里把

```ts
    const choice = choicePanel(this.ui, m, this.choice, now, a.panelSlide);
```

改为：

```ts
    const choice =
      m.pending?.kind === 'storytelling'
        ? this.board.build(this.ui, m, m.pending.deck, now)
        : choicePanel(this.ui, m, this.choice, now, a.panelSlide);
```

- [ ] **Step 5: 运行测试**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add client
git commit -m "feat(client): storyteller deck board with handle drag and edge auto-scroll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 重新打包，真机验收

**Files:**
- Modify（生成）：`cloudfunctions/game/index.js`、`minigame/game.js`
- Modify: `docs/superpowers/specs/2026-10-01-plan-c-characters-design.md`（记录真机验收结果）

- [ ] **Step 1: 全部测试和类型检查**

Run:

```bash
cd engine && npx vitest run && npx tsc --noEmit
cd ../server && npx vitest run && npm run typecheck
cd ../client && npx vitest run && npm run typecheck
```

Expected: 全部 PASS。

- [ ] **Step 2: 打包**

Run: `cd server && npm run build`，再 `cd ../client && npm run build`
Expected: 生成 `cloudfunctions/game/index.js` 和 `minigame/game.js`，esbuild 无报错。

- [ ] **Step 3: 提交打包产物**

```bash
git add cloudfunctions/game/index.js minigame/game.js
git commit -m "build: regenerate cloud function and mini-game bundles for characters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 真机验收（需要用户和朋友的手机，实现者跳过这一步并在报告里说明）**

用户在微信开发者工具里：
1. 确认没有正在进行的对局，右键 `cloudfunctions/game` →「上传并部署：云端安装依赖」（环境 cloud1）。
2. 编译后上传体验版（版本号 `0.3.0`），在小游戏后台「选为体验版」。
3. 4–6 人（可加机器人）开一局，检查：
   - 开局弹出选角色面板，两个候选能看清技能说明，确认后显示「等待其他人选择角色」；
   - 格子上显示角色，裁缝显示「裁缝→某角色」，点格子能看到技能说明；
   - 牧师、说书人在回合开始时有技能按钮；说书人拖拽面板手感与原型一致；
   - 官员夜晚有「不翻牌自首」；
   - 事件记录里能看到技能生效的文字。
4. 7 人及以上（可加机器人）开一局，确认直接发角色、不出现选角色面板。

把结果写进设计文档末尾新的一节「真机验收（YYYY-MM-DD）」，提交：

```bash
git add docs/superpowers/specs/2026-10-01-plan-c-characters-design.md
git commit -m "docs: plan C on-device acceptance results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
