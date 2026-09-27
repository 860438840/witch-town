# 计划 B1：女巫镇云端后端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Task 5 is interactive with the human (WeChat DevTools + cloud console) and must be executed by the controller, not a subagent.**

**Goal:** 实现微信云函数 `game` 的全部逻辑（建房、加入、离开、调座位、加机器人、开局、出牌、超时推进），把局面安全地写入 `games` / `rooms` / `hands` 三个集合，并在真实云环境中验证。

**Architecture:** 云函数逻辑写在 `server/`（TypeScript），通过一个很薄的 `Store` 接口访问数据库：测试用内存实现 `MemoryStore`，线上用 `wxStore`（包装 `wx-server-sdk` 的事务）。所有写操作都在一个事务内完成：读 `games` → `engine.apply` → 写回 `games`、`rooms`（公开视图）和每人的 `hands`（私密视图）。`esbuild` 把 `server/src/index.ts` 和 `engine/` 打包成 `cloudfunctions/game/index.js`，`wx-server-sdk` 作为外部依赖由云端安装。

**Tech Stack:** Node 24（本地）、TypeScript、Vitest、esbuild；云端运行时 Node 16、`wx-server-sdk` 3.x。

**Spec:** `docs/superpowers/specs/2026-09-26-witch-town-design.md`（§3 架构、§3.1 集合与权限、§3.2 并发/超时/重连）

## Global Constraints

- AppID：`wx5bbb2a460a75b656`（小游戏账号；原测试号 wx39381174201ab82c 不能用云开发）。项目根目录：`D:/UNSW/女巫镇`。
- 集合与权限（spec §3.1）：`games` 客户端不可读写；`rooms` 房间成员可读、客户端不可写；`hands` 仅本人可读（`doc._openid == auth.openid`）、客户端不可写。
- `hands` 文档 id 为 `<房间号>_<openid>`，必须带 `_openid` 字段。`games`、`rooms` 文档 id 为 4 位房间号（`1000`–`9999`）。
- 每次写操作在一个事务中完成；`games.state.version` 作为版本号，客户端可带 `version`，不一致时返回「状态已变化，请重试」。
- 超时（spec §3.2）：回合 90 秒；审判/传染/夜晚/黎明选择 45 秒。任何在线客户端都可以在倒计时结束后调用 `tick`，服务器确认已超时才执行 `engine.autoActions`。
- 客户端发来的 `action.seat` 一律忽略，由服务器根据 openid 确定座位。
- 玩家人数 4–12；昵称 1–12 个字。
- 所有返回给玩家的错误信息使用简体中文；非规则类异常统一返回「服务器错误，请稍后再试」并在云函数日志里打印。
- 规则引擎（`engine/`）不修改；只通过 `engine/src/index.ts` 导入。

## Review Focus

1. **两名玩家几乎同时操作**：第二个请求带着旧版本号 → 必须被拒绝且数据库不变。测试位于 Task 3。
2. **客户端伪造 `action.seat`**：操作必须按请求者本人的座位执行。测试位于 Task 3。
3. **掉线重连**：游戏进行中，已经在房间里的玩家再次 `joinRoom` 必须成功（不能被「游戏已经开始」拒绝）。测试位于 Task 2。
4. **有人提前或反复调用 `tick`**：截止时间之前必须什么都不做。测试位于 Task 3。
5. **房间号复用覆盖正在进行的游戏**：只有「已结束」或超过 6 小时未更新的房间号才能被新房间复用。测试位于 Task 2。

## 与规格的偏差（controller 已裁定）

- spec §6 把「验证 `db.watch`」列为第 0 步。本计划把它放到 Task 5：本地逻辑（Task 1–4）不依赖推送方式，而验证需要可部署的云函数和一个调试页面，放在最后一次做完。若 Task 5 发现 `watch` 在免费环境不可用，计划 B2 改用轮询，本计划代码不受影响。
- spec §3.1 说 `rooms`「房间成员可读」。微信云数据库的安全规则无法判断「是否为某房间成员」（成员列表在文档内的数组里），因此规则设为「所有登录用户可读」（`read: true`）。`rooms` 只含公开信息，知道房间号的人本来就能加入房间，风险可接受。
- 新增 `addBots`（房主往大厅里加机器人，机器人只靠超时自动行动；轮到机器人的回合只等 3 秒）。用于一个人在开发者工具里测试完整流程，spec 未提及。

---

## 文件结构

```
女巫镇/
├─ project.config.json               （Task 5）
├─ miniprogram/                      （Task 5：临时调试页，B2 替换）
│  ├─ app.json  app.js  sitemap.json
│  └─ pages/debug/debug.{js,json,wxml,wxss}
├─ cloudfunctions/game/
│  ├─ package.json                   依赖 wx-server-sdk
│  └─ index.js                       构建产物（npm run build 生成，提交入库）
└─ server/
   ├─ package.json  tsconfig.json  build.mjs
   ├─ src/
   │  ├─ wx-server-sdk.d.ts          模块声明
   │  ├─ types.ts                    文档类型、集合名、常量
   │  ├─ store.ts                    Store / Tx 接口
   │  ├─ memoryStore.ts              测试用内存数据库
   │  ├─ deadlines.ts                超时截止时间规则
   │  ├─ lobby.ts                    建房、加入、离开、调座位、加机器人
   │  ├─ game.ts                     开局、出牌、tick、写回视图
   │  ├─ handler.ts                  请求分发与错误处理
   │  ├─ wxStore.ts                  wx-server-sdk 事务适配
   │  └─ index.ts                    云函数入口 main
   └─ test/
      ├─ stub/wx-server-sdk/index.js 构建冒烟测试用桩
      ├─ helpers.ts
      ├─ memoryStore.test.ts  deadlines.test.ts
      ├─ lobby.test.ts  game.test.ts
      ├─ handler.test.ts  wxStore.test.ts
```

所有 npm 命令都在 `server/` 目录下执行。

---

### Task 1: server 脚手架、Store 接口、内存数据库和截止时间规则

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`
- Create: `server/src/types.ts`, `server/src/store.ts`, `server/src/memoryStore.ts`, `server/src/deadlines.ts`
- Test: `server/test/memoryStore.test.ts`, `server/test/deadlines.test.ts`

**Interfaces:**
- Consumes: `engine/src/index.ts`（`GameState`、`PublicView`、`PrivateView`、`createGame`、`seededRng`）
- Produces:
  - `types.ts`：`ROOMS`、`GAMES`、`HANDS`、`BOT_PREFIX`、`MIN_PLAYERS`、`MAX_PLAYERS`、`handId(code, openid)`、`isBot(openid)`、`interface Profile`、`interface Seat`、`type RoomStatus`、`interface RoomDoc`、`interface GameDoc`、`interface HandDoc`
  - `store.ts`：`interface Tx { get<T>(collection, id): Promise<T | null>; set(collection, id, data): Promise<void> }`、`interface Store { transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> }`
  - `memoryStore.ts`：`class MemoryStore implements Store`，另有测试用 `read<T>(collection, id): T | null` 和 `write(collection, id, data): void`
  - `deadlines.ts`：`TURN_MS = 90_000`、`BOT_TURN_MS = 3_000`、`CHOICE_MS = 45_000`、`deadlineKey(s): string`、`phaseDuration(s): number`

- [ ] **Step 1: 创建 `package.json`、`tsconfig.json` 并安装依赖**

`server/package.json`：

```json
{
  "name": "witch-town-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "node build.mjs"
  }
}
```

`server/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

Run: `cd server && npm install -D typescript vitest esbuild @types/node`
Expected: 安装成功。

- [ ] **Step 2: 写 `types.ts` 和 `store.ts`**

`server/src/types.ts`：

```ts
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
```

`server/src/store.ts`：

```ts
/** 事务内的数据库操作 */
export interface Tx {
  /** 文档不存在时返回 null；返回的数据不含 _id */
  get<T>(collection: string, id: string): Promise<T | null>;
  /** 整体覆盖写入（不存在则创建） */
  set(collection: string, id: string, data: object): Promise<void>;
}

export interface Store {
  /** fn 抛出异常时，事务内的所有写入都会回滚，并原样抛出该异常 */
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}
```

- [ ] **Step 3: 写失败的测试**

`server/test/memoryStore.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/memoryStore';

describe('MemoryStore', () => {
  it('写入后能读出；数据经过 JSON 序列化（undefined 字段被丢弃）', async () => {
    const store = new MemoryStore();
    await store.transaction((tx) => tx.set('c', 'a', { x: 1, y: undefined }));
    expect(store.read('c', 'a')).toEqual({ x: 1 });
    await store.transaction(async (tx) => {
      expect(await tx.get('c', 'a')).toEqual({ x: 1 });
    });
  });

  it('不存在的文档返回 null', async () => {
    const store = new MemoryStore();
    await store.transaction(async (tx) => {
      expect(await tx.get('c', 'nope')).toBeNull();
    });
  });

  it('事务抛错时回滚所有写入，并原样抛出错误', async () => {
    const store = new MemoryStore();
    store.write('c', 'keep', { v: 1 });
    const err = new Error('boom');
    await expect(
      store.transaction(async (tx) => {
        await tx.set('c', 'keep', { v: 2 });
        await tx.set('c', 'new', { v: 3 });
        throw err;
      }),
    ).rejects.toBe(err);
    expect(store.read('c', 'keep')).toEqual({ v: 1 });
    expect(store.read('c', 'new')).toBeNull();
  });
});
```

`server/test/deadlines.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { createGame, seededRng } from '../../engine/src/index';
import { BOT_TURN_MS, CHOICE_MS, deadlineKey, phaseDuration, TURN_MS } from '../src/deadlines';

function game(openids = ['u0', 'u1', 'u2', 'u3', 'u4']) {
  return createGame(openids.map((openid) => ({ openid, name: openid })), seededRng(1));
}

describe('deadlineKey', () => {
  it('白天按回合区分，同一回合内出牌不改变', () => {
    const s = game();
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 2;
    expect(deadlineKey(s)).toBe('day:2');
    s.phase = { kind: 'day', mode: 'playing' };
    expect(deadlineKey(s)).toBe('day:2');
    s.turn = 3;
    expect(deadlineKey(s)).toBe('day:3');
  });

  it('其他阶段', () => {
    const s = game();
    expect(deadlineKey(s)).toBe('dawn');
    s.phase = { kind: 'trialReveal', target: 3, initiator: 2 };
    expect(deadlineKey(s)).toBe('trial:3');
    s.phase = { kind: 'catReveal', holder: 1 };
    expect(deadlineKey(s)).toBe('cat:1');
    s.phase = { kind: 'night' };
    expect(deadlineKey(s)).toBe('night');
    s.phase = { kind: 'conspiracyPick' };
    expect(deadlineKey(s)).toBe('conspiracyPick');
  });
});

describe('phaseDuration', () => {
  it('真人回合 90 秒，机器人回合 3 秒，其他选择 45 秒', () => {
    const s = game(['u0', 'bot-1', 'u2', 'u3', 'u4']);
    expect(phaseDuration(s)).toBe(CHOICE_MS);
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 0;
    expect(phaseDuration(s)).toBe(TURN_MS);
    s.turn = 1;
    expect(phaseDuration(s)).toBe(BOT_TURN_MS);
    expect([TURN_MS, BOT_TURN_MS, CHOICE_MS]).toEqual([90_000, 3_000, 45_000]);
  });
});
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `npx vitest run`
Expected: FAIL，提示找不到 `../src/memoryStore` 和 `../src/deadlines`。

- [ ] **Step 5: 实现 `memoryStore.ts` 和 `deadlines.ts`**

`server/src/memoryStore.ts`：

```ts
import type { Store, Tx } from './store';

/** 测试用内存数据库。数据以 JSON 字符串保存，保证写入的内容可以序列化；事务失败时回滚。 */
export class MemoryStore implements Store {
  private docs = new Map<string, string>();

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  read<T>(collection: string, id: string): T | null {
    const raw = this.docs.get(this.key(collection, id));
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  write(collection: string, id: string, data: object): void {
    this.docs.set(this.key(collection, id), JSON.stringify(data));
  }

  async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const snapshot = new Map(this.docs);
    const tx: Tx = {
      get: async <T>(collection: string, id: string) => this.read<T>(collection, id),
      set: async (collection: string, id: string, data: object) => this.write(collection, id, data),
    };
    try {
      return await fn(tx);
    } catch (e) {
      this.docs = snapshot;
      throw e;
    }
  }
}
```

`server/src/deadlines.ts`：

```ts
import type { GameState } from '../../engine/src/index';
import { isBot } from './types';

export const TURN_MS = 90_000;
export const BOT_TURN_MS = 3_000;
export const CHOICE_MS = 45_000;

/** 同一个等待阶段的 key 相同；key 变化时才重新计时 */
export function deadlineKey(s: GameState): string {
  const ph = s.phase;
  switch (ph.kind) {
    case 'day':
      return `day:${s.turn}`;
    case 'trialReveal':
      return `trial:${ph.target}`;
    case 'catReveal':
      return `cat:${ph.holder}`;
    default:
      return ph.kind;
  }
}

export function phaseDuration(s: GameState): number {
  if (s.phase.kind !== 'day') return CHOICE_MS;
  return isBot(s.players[s.turn].openid) ? BOT_TURN_MS : TURN_MS;
}
```

- [ ] **Step 6: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/src server/test
git commit -m "feat(server): scaffold cloud backend with store interface, memory store and deadlines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 房间大厅（建房、加入、离开、调座位、加机器人）

**Files:**
- Create: `server/src/lobby.ts`
- Create: `server/test/helpers.ts`
- Test: `server/test/lobby.test.ts`

**Interfaces:**
- Consumes: `Tx`、`Store`（Task 1）；`RoomDoc`、`Seat`、`Profile`、`ROOMS`、`BOT_PREFIX`、`MAX_PLAYERS`（Task 1）；`RuleError`、`Rng`（engine）
- Produces:
  - `STALE_MS = 6 * 3600_000`
  - `checkProfile(p: unknown): Profile`
  - `loadRoom(tx, code): Promise<RoomDoc>`（不存在抛 `RuleError('房间不存在')`）
  - `createRoom(tx, openid, profile, now, rng): Promise<{ code: string }>`
  - `joinRoom(tx, code, openid, profile, now): Promise<{ code: string }>`
  - `leaveRoom(tx, code, openid, now): Promise<Record<string, never>>`
  - `reorderSeats(tx, code, openid, order: string[], now): Promise<Record<string, never>>`
  - `addBots(tx, code, openid, count: number, now): Promise<Record<string, never>>`
  - `test/helpers.ts`：`NOW`、`profile(name)`、`run(store, fn)`、`lobbyWith(n)`

- [ ] **Step 1: 写测试工具 `test/helpers.ts`**

```ts
import { seededRng } from '../../engine/src/index';
import { createRoom, joinRoom } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import type { Tx } from '../src/store';

export const NOW = 1_800_000_000_000;

export const profile = (name: string) => ({ name, avatar: '' });

export function run<R>(store: MemoryStore, fn: (tx: Tx) => Promise<R>): Promise<R> {
  return store.transaction(fn);
}

/** u0 建房，u1…u(n-1) 依次加入 */
export async function lobbyWith(n: number): Promise<{ store: MemoryStore; code: string }> {
  const store = new MemoryStore();
  const { code } = await run(store, (tx) => createRoom(tx, 'u0', profile('P0'), NOW, seededRng(1)));
  for (let i = 1; i < n; i++) {
    await run(store, (tx) => joinRoom(tx, code, `u${i}`, profile(`P${i}`), NOW));
  }
  return { store, code };
}
```

- [ ] **Step 2: 写失败的测试**

`server/test/lobby.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { RuleError, seededRng } from '../../engine/src/index';
import { addBots, createRoom, joinRoom, leaveRoom, reorderSeats, STALE_MS } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import { ROOMS, type RoomDoc } from '../src/types';
import { lobbyWith, NOW, profile, run } from './helpers';

const room = (store: MemoryStore, code: string) => store.read<RoomDoc>(ROOMS, code) as RoomDoc;

describe('createRoom', () => {
  it('生成 4 位房间号，创建者是房主和 1 号座位', async () => {
    const store = new MemoryStore();
    const { code } = await run(store, (tx) => createRoom(tx, 'u0', profile('小明'), NOW, seededRng(1)));
    expect(code).toMatch(/^\d{4}$/);
    const r = room(store, code);
    expect(r.host).toBe('u0');
    expect(r.status).toBe('lobby');
    expect(r.seats).toEqual([{ openid: 'u0', name: '小明', avatar: '' }]);
    expect(r.view).toBeNull();
    expect(r.deadline).toBeNull();
  });

  it('房间号被正在使用的房间占用时换一个', async () => {
    const store = new MemoryStore();
    const a = await run(store, (tx) => createRoom(tx, 'u0', profile('A'), NOW, seededRng(1)));
    const b = await run(store, (tx) => createRoom(tx, 'u1', profile('B'), NOW, seededRng(1)));
    expect(b.code).not.toBe(a.code);
    expect(room(store, a.code).host).toBe('u0');
  });

  it('超过 6 小时未更新的房间号可以复用', async () => {
    const store = new MemoryStore();
    const a = await run(store, (tx) => createRoom(tx, 'u0', profile('A'), NOW, seededRng(1)));
    const later = NOW + STALE_MS + 1;
    const b = await run(store, (tx) => createRoom(tx, 'u1', profile('B'), later, seededRng(1)));
    expect(b.code).toBe(a.code);
    expect(room(store, b.code).host).toBe('u1');
  });

  it('昵称必须是 1–12 个字', async () => {
    const store = new MemoryStore();
    await expect(run(store, (tx) => createRoom(tx, 'u0', profile('  '), NOW, seededRng(1)))).rejects.toThrow(RuleError);
    await expect(
      run(store, (tx) => createRoom(tx, 'u0', profile('一二三四五六七八九十一二三'), NOW, seededRng(1))),
    ).rejects.toThrow(/1–12/);
  });
});

describe('joinRoom', () => {
  it('加入后按顺序排座位；同一个人重复加入只更新昵称', async () => {
    const { store, code } = await lobbyWith(3);
    await run(store, (tx) => joinRoom(tx, code, 'u1', profile('新名字'), NOW));
    const r = room(store, code);
    expect(r.seats.map((s) => s.openid)).toEqual(['u0', 'u1', 'u2']);
    expect(r.seats[1].name).toBe('新名字');
  });

  it('房间不存在、房间已满时报错', async () => {
    const { store, code } = await lobbyWith(12);
    await expect(run(store, (tx) => joinRoom(tx, '9999', 'x', profile('X'), NOW))).rejects.toThrow('房间不存在');
    await expect(run(store, (tx) => joinRoom(tx, code, 'u12', profile('X'), NOW))).rejects.toThrow('房间已满');
  });

  it('游戏开始后新玩家不能加入，但已在房间里的玩家可以重新进入（掉线重连）', async () => {
    const { store, code } = await lobbyWith(4);
    store.write(ROOMS, code, { ...room(store, code), status: 'playing' });
    await expect(run(store, (tx) => joinRoom(tx, code, 'new', profile('X'), NOW))).rejects.toThrow('游戏已经开始');
    await expect(run(store, (tx) => joinRoom(tx, code, 'u2', profile('P2'), NOW))).resolves.toEqual({ code });
  });
});

describe('leaveRoom', () => {
  it('房主离开后下一位成为房主；最后一人离开后房间结束', async () => {
    const { store, code } = await lobbyWith(2);
    await run(store, (tx) => leaveRoom(tx, code, 'u0', NOW));
    expect(room(store, code).host).toBe('u1');
    await run(store, (tx) => leaveRoom(tx, code, 'u1', NOW));
    expect(room(store, code).status).toBe('ended');
  });

  it('游戏开始后不能离开', async () => {
    const { store, code } = await lobbyWith(4);
    store.write(ROOMS, code, { ...room(store, code), status: 'playing' });
    await expect(run(store, (tx) => leaveRoom(tx, code, 'u1', NOW))).rejects.toThrow(RuleError);
  });
});

describe('reorderSeats', () => {
  it('房主可以调整座位顺序', async () => {
    const { store, code } = await lobbyWith(3);
    await run(store, (tx) => reorderSeats(tx, code, 'u0', ['u2', 'u0', 'u1'], NOW));
    expect(room(store, code).seats.map((s) => s.openid)).toEqual(['u2', 'u0', 'u1']);
  });

  it('非房主不能调整；顺序必须恰好包含所有人', async () => {
    const { store, code } = await lobbyWith(3);
    await expect(run(store, (tx) => reorderSeats(tx, code, 'u1', ['u2', 'u0', 'u1'], NOW))).rejects.toThrow('房主');
    await expect(run(store, (tx) => reorderSeats(tx, code, 'u0', ['u2', 'u0'], NOW))).rejects.toThrow(RuleError);
    await expect(run(store, (tx) => reorderSeats(tx, code, 'u0', ['u2', 'u0', 'u0'], NOW))).rejects.toThrow(RuleError);
  });
});

describe('addBots', () => {
  it('房主加机器人，最多加到 12 人', async () => {
    const { store, code } = await lobbyWith(2);
    await run(store, (tx) => addBots(tx, code, 'u0', 2, NOW));
    const r = room(store, code);
    expect(r.seats.map((s) => s.openid)).toEqual(['u0', 'u1', 'bot-1', 'bot-2']);
    expect(r.seats[2].name).toBe('机器人1');
    await run(store, (tx) => addBots(tx, code, 'u0', 20, NOW));
    expect(room(store, code).seats).toHaveLength(12);
  });

  it('非房主不能加机器人', async () => {
    const { store, code } = await lobbyWith(2);
    await expect(run(store, (tx) => addBots(tx, code, 'u1', 1, NOW))).rejects.toThrow('房主');
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run test/lobby.test.ts`
Expected: FAIL，提示找不到 `../src/lobby`。

- [ ] **Step 4: 实现 `lobby.ts`**

```ts
import { RuleError, type Rng } from '../../engine/src/index';
import type { Tx } from './store';
import { BOT_PREFIX, MAX_PLAYERS, ROOMS, type Profile, type RoomDoc } from './types';

/** 超过这么久没有更新的房间，其房间号可以被新房间复用 */
export const STALE_MS = 6 * 3600_000;

export function checkProfile(p: unknown): Profile {
  const raw = (p ?? {}) as { name?: unknown; avatar?: unknown };
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if ([...name].length < 1 || [...name].length > 12) throw new RuleError('昵称需要 1–12 个字');
  return { name, avatar: typeof raw.avatar === 'string' ? raw.avatar : '' };
}

export async function loadRoom(tx: Tx, code: string): Promise<RoomDoc> {
  const room = await tx.get<RoomDoc>(ROOMS, code);
  if (!room) throw new RuleError('房间不存在');
  return room;
}

function requireHost(room: RoomDoc, openid: string): void {
  if (room.host !== openid) throw new RuleError('只有房主可以这样做');
}

function requireLobby(room: RoomDoc): void {
  if (room.status !== 'lobby') throw new RuleError('游戏已经开始');
}

export async function createRoom(tx: Tx, openid: string, profile: unknown, now: number, rng: Rng): Promise<{ code: string }> {
  const me = checkProfile(profile);
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = String(1000 + Math.floor(rng.next() * 9000));
    const existing = await tx.get<RoomDoc>(ROOMS, code);
    if (existing && existing.status !== 'ended' && now - existing.updatedAt <= STALE_MS) continue;
    const room: RoomDoc = {
      code,
      host: openid,
      status: 'lobby',
      seats: [{ openid, ...me }],
      view: null,
      deadline: null,
      updatedAt: now,
    };
    await tx.set(ROOMS, code, room);
    return { code };
  }
  throw new RuleError('暂时没有空闲的房间号，请稍后再试');
}

export async function joinRoom(tx: Tx, code: string, openid: string, profile: unknown, now: number): Promise<{ code: string }> {
  const me = checkProfile(profile);
  const room = await loadRoom(tx, code);
  const seat = room.seats.find((s) => s.openid === openid);
  if (seat) {
    seat.name = me.name;
    seat.avatar = me.avatar;
  } else {
    if (room.status !== 'lobby') throw new RuleError('游戏已经开始，不能加入');
    if (room.seats.length >= MAX_PLAYERS) throw new RuleError('房间已满');
    room.seats.push({ openid, ...me });
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return { code };
}

export async function leaveRoom(tx: Tx, code: string, openid: string, now: number): Promise<Record<string, never>> {
  const room = await loadRoom(tx, code);
  requireLobby(room);
  room.seats = room.seats.filter((s) => s.openid !== openid);
  if (room.seats.length === 0) room.status = 'ended';
  else if (room.host === openid) room.host = room.seats[0].openid;
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}

export async function reorderSeats(tx: Tx, code: string, openid: string, order: string[], now: number): Promise<Record<string, never>> {
  const room = await loadRoom(tx, code);
  requireHost(room, openid);
  requireLobby(room);
  const current = room.seats.map((s) => s.openid);
  const valid =
    Array.isArray(order) &&
    order.length === current.length &&
    new Set(order).size === order.length &&
    order.every((o) => current.includes(o));
  if (!valid) throw new RuleError('座位顺序无效');
  room.seats = order.map((o) => room.seats.find((s) => s.openid === o)!);
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}

export async function addBots(tx: Tx, code: string, openid: string, count: number, now: number): Promise<Record<string, never>> {
  const room = await loadRoom(tx, code);
  requireHost(room, openid);
  requireLobby(room);
  let n = room.seats.filter((s) => s.openid.startsWith(BOT_PREFIX)).length;
  for (let i = 0; i < count && room.seats.length < MAX_PLAYERS; i++) {
    n++;
    room.seats.push({ openid: `${BOT_PREFIX}${n}`, name: `机器人${n}`, avatar: '' });
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}
```

- [ ] **Step 5: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add server/src/lobby.ts server/test/helpers.ts server/test/lobby.test.ts
git commit -m "feat(server): add room lobby (create, join, leave, reorder, bots)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 开局、出牌、超时推进和视图写回

**Files:**
- Create: `server/src/game.ts`
- Test: `server/test/game.test.ts`

**Interfaces:**
- Consumes: `loadRoom`、`addBots`（Task 2）；`deadlineKey`、`phaseDuration`（Task 1）；`GAMES`、`HANDS`、`ROOMS`、`handId`、`MIN_PLAYERS`、`GameDoc`、`HandDoc`、`RoomDoc`（Task 1）；engine 的 `apply`、`autoActions`、`createGame`、`projectPrivate`、`projectPublic`、`RuleError`、`Action`、`GameState`、`Rng`
- Produces:
  - `type ClientAction`：去掉 `seat` 的 `Action`
  - `startGame(tx, code, openid, now, rng): Promise<{ version: number }>`
  - `act(tx, code, openid, action: ClientAction, expectedVersion: number | undefined, now, rng): Promise<{ version: number }>`
  - `tick(tx, code, now, rng): Promise<{ changed: boolean }>`

- [ ] **Step 1: 写失败的测试**

`server/test/game.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { RuleError, seededRng, targetCount, type GameState } from '../../engine/src/index';
import { BOT_TURN_MS, CHOICE_MS, TURN_MS } from '../src/deadlines';
import { act, startGame, tick } from '../src/game';
import { addBots } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import { GAMES, handId, HANDS, ROOMS, type GameDoc, type HandDoc, type RoomDoc } from '../src/types';
import { lobbyWith, NOW, run } from './helpers';

const rng = () => seededRng(5);
const room = (store: MemoryStore, code: string) => store.read<RoomDoc>(ROOMS, code) as RoomDoc;
const game = (store: MemoryStore, code: string) => store.read<GameDoc>(GAMES, code) as GameDoc;

async function started(n = 5) {
  const { store, code } = await lobbyWith(n);
  await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
  return { store, code };
}

function witchOpenid(s: GameState): string {
  return s.players.find((p) => p.witchFaction)!.openid;
}

describe('startGame', () => {
  it('只有房主能开始，且至少 4 人', async () => {
    const small = await lobbyWith(3);
    await expect(run(small.store, (tx) => startGame(tx, small.code, 'u0', NOW, rng()))).rejects.toThrow('至少需要 4 名玩家');
    const ok = await lobbyWith(4);
    await expect(run(ok.store, (tx) => startGame(tx, ok.code, 'u1', NOW, rng()))).rejects.toThrow('房主');
  });

  it('开局后写入 games、rooms 公开视图和每个人的 hands；黎明截止时间为 45 秒', async () => {
    const { store, code } = await started(5);
    const r = room(store, code);
    expect(r.status).toBe('playing');
    expect(r.view!.players).toHaveLength(5);
    expect(r.view!.phase).toEqual({ kind: 'dawn' });
    expect(r.deadline).toBe(NOW + CHOICE_MS);
    const g = game(store, code);
    expect(g.state.players.map((p) => p.openid)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4']);
    expect(g.deadline).toBe(NOW + CHOICE_MS);
    for (const p of g.state.players) {
      const hand = store.read<HandDoc>(HANDS, handId(code, p.openid))!;
      expect(hand._openid).toBe(p.openid);
      expect(hand.roomId).toBe(code);
      expect(hand.view.seat).toBe(p.seat);
      const json = JSON.stringify(hand.view);
      for (const q of g.state.players) {
        if (q.seat === p.seat) continue;
        for (const c of q.hand) expect(json).not.toContain(`"${c.id}"`);
      }
    }
  });

  it('不能重复开始', async () => {
    const { store, code } = await started(4);
    await expect(run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()))).rejects.toThrow('游戏已经开始');
  });
});

describe('act', () => {
  it('女巫在黎明投票放黑猫后进入白天，版本号 +1', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    const res = await run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, 0, NOW + 1000, rng()));
    expect(res).toEqual({ version: 1 });
    expect(room(store, code).view!.phase.kind).toBe('day');
    expect(room(store, code).view!.version).toBe(1);
  });

  it('客户端伪造的 seat 被忽略，按请求者本人的座位执行', async () => {
    const { store, code } = await started(5);
    const s = game(store, code).state;
    const witch = s.players.find((p) => p.witchFaction)!;
    const villager = s.players.find((p) => !p.witchFaction)!;
    await expect(
      run(store, (tx) =>
        act(tx, code, villager.openid, { type: 'witchVote', target: 2, seat: witch.seat } as never, undefined, NOW, rng()),
      ),
    ).rejects.toThrow('只有女巫阵营可以投票');
  });

  it('不在游戏中的人不能操作', async () => {
    const { store, code } = await started(4);
    await expect(run(store, (tx) => act(tx, code, 'stranger', { type: 'draw' }, undefined, NOW, rng()))).rejects.toThrow(
      '你不在这局游戏中',
    );
  });

  it('版本号过期时拒绝，且数据库不变', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    await expect(
      run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, 7, NOW, rng())),
    ).rejects.toThrow('状态已变化，请重试');
    expect(game(store, code).state.version).toBe(0);
  });

  it('规则不允许的操作报错，且数据库不变', async () => {
    const { store, code } = await started(5);
    await expect(run(store, (tx) => act(tx, code, 'u1', { type: 'draw' }, undefined, NOW, rng()))).rejects.toThrow(RuleError);
    expect(room(store, code).view!.version).toBe(0);
  });

  it('同一回合内出牌不重置截止时间；换人后重新计时', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    const t1 = NOW + 1000;
    await run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, undefined, t1, rng()));
    expect(room(store, code).deadline).toBe(t1 + TURN_MS);
    const s = game(store, code).state;
    const me = s.players[s.turn];
    const card = me.hand.find((c) => c.kind !== 'curse')!;
    const others = s.players.filter((p) => p.seat !== me.seat).map((p) => p.seat);
    const targets = others.slice(0, targetCount(card.kind));
    const t2 = t1 + 5000;
    await run(store, (tx) => act(tx, code, me.openid, { type: 'play', cardId: card.id, targets }, undefined, t2, rng()));
    if (room(store, code).view!.phase.kind === 'day') {
      expect(room(store, code).deadline).toBe(t1 + TURN_MS);
    }
  });
});

describe('tick', () => {
  it('截止时间之前调用什么都不做', async () => {
    const { store, code } = await started(5);
    await expect(run(store, (tx) => tick(tx, code, NOW + CHOICE_MS - 1, rng()))).resolves.toEqual({ changed: false });
    expect(game(store, code).state.version).toBe(0);
  });

  it('超时后执行默认操作：黎明自动放黑猫', async () => {
    const { store, code } = await started(5);
    const t = NOW + CHOICE_MS;
    await expect(run(store, (tx) => tick(tx, code, t, rng()))).resolves.toEqual({ changed: true });
    expect(room(store, code).view!.phase.kind).toBe('day');
    expect(room(store, code).deadline).toBeGreaterThan(t);
  });

  it('轮到机器人时只等 3 秒', async () => {
    const { store, code } = await lobbyWith(1);
    await run(store, (tx) => addBots(tx, code, 'u0', 4, NOW));
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    const t = NOW + CHOICE_MS;
    await run(store, (tx) => tick(tx, code, t, rng()));
    const s = game(store, code).state;
    const expected = s.players[s.turn].openid.startsWith('bot-') ? BOT_TURN_MS : TURN_MS;
    expect(room(store, code).deadline).toBe(t + expected);
  });

  it('1 个真人 + 4 个机器人全靠超时也能打完一局，结束后房间状态为 ended', async () => {
    const { store, code } = await lobbyWith(1);
    await run(store, (tx) => addBots(tx, code, 'u0', 4, NOW));
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    let t = NOW;
    for (let i = 0; i < 5000 && room(store, code).status === 'playing'; i++) {
      t += TURN_MS;
      await run(store, (tx) => tick(tx, code, t, seededRng(i)));
    }
    const r = room(store, code);
    expect(r.status).toBe('ended');
    expect(r.deadline).toBeNull();
    expect(r.view!.phase.kind).toBe('ended');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/game.test.ts`
Expected: FAIL，提示找不到 `../src/game`。

- [ ] **Step 3: 实现 `game.ts`**

```ts
import {
  apply,
  autoActions,
  createGame,
  projectPrivate,
  projectPublic,
  RuleError,
  type Action,
  type GameState,
  type Rng,
} from '../../engine/src/index';
import { deadlineKey, phaseDuration } from './deadlines';
import { loadRoom } from './lobby';
import type { Tx } from './store';
import { GAMES, handId, HANDS, MIN_PLAYERS, ROOMS, type GameDoc, type HandDoc, type RoomDoc } from './types';

/** 客户端发来的操作：座位由服务器根据 openid 决定 */
export type ClientAction = { [K in Action['type']]: Omit<Extract<Action, { type: K }>, 'seat'> }[Action['type']];

/** 把新局面写回 games、rooms（公开视图）和每人的 hands（私密视图）。等待阶段没变时沿用原截止时间。 */
async function persist(tx: Tx, room: RoomDoc, state: GameState, prev: GameDoc | null, now: number): Promise<void> {
  const key = deadlineKey(state);
  const deadline = prev && prev.deadlineKey === key ? prev.deadline : now + phaseDuration(state);
  const ended = state.phase.kind === 'ended';
  const gameDoc: GameDoc = { state, deadlineKey: key, deadline };
  const roomDoc: RoomDoc = {
    ...room,
    status: ended ? 'ended' : 'playing',
    view: projectPublic(state),
    deadline: ended ? null : deadline,
    updatedAt: now,
  };
  await tx.set(GAMES, room.code, gameDoc);
  await tx.set(ROOMS, room.code, roomDoc);
  for (const p of state.players) {
    const hand: HandDoc = { _openid: p.openid, roomId: room.code, view: projectPrivate(state, p.seat) };
    await tx.set(HANDS, handId(room.code, p.openid), hand);
  }
}

async function loadGame(tx: Tx, code: string): Promise<GameDoc> {
  const game = await tx.get<GameDoc>(GAMES, code);
  if (!game) throw new RuleError('游戏数据不存在');
  return game;
}

export async function startGame(tx: Tx, code: string, openid: string, now: number, rng: Rng): Promise<{ version: number }> {
  const room = await loadRoom(tx, code);
  if (room.host !== openid) throw new RuleError('只有房主可以开始游戏');
  if (room.status !== 'lobby') throw new RuleError('游戏已经开始');
  if (room.seats.length < MIN_PLAYERS) throw new RuleError(`至少需要 ${MIN_PLAYERS} 名玩家`);
  const state = createGame(
    room.seats.map((s) => ({ openid: s.openid, name: s.name })),
    rng,
  );
  await persist(tx, room, state, null, now);
  return { version: state.version };
}

export async function act(
  tx: Tx,
  code: string,
  openid: string,
  action: ClientAction,
  expectedVersion: number | undefined,
  now: number,
  rng: Rng,
): Promise<{ version: number }> {
  const room = await loadRoom(tx, code);
  if (room.status !== 'playing') throw new RuleError('游戏没有在进行');
  const game = await loadGame(tx, code);
  if (expectedVersion !== undefined && expectedVersion !== game.state.version) {
    throw new RuleError('状态已变化，请重试');
  }
  const seat = game.state.players.findIndex((p) => p.openid === openid);
  if (seat < 0) throw new RuleError('你不在这局游戏中');
  const next = apply(game.state, { ...action, seat } as Action, rng);
  await persist(tx, room, next, game, now);
  return { version: next.version };
}

export async function tick(tx: Tx, code: string, now: number, rng: Rng): Promise<{ changed: boolean }> {
  const room = await loadRoom(tx, code);
  if (room.status !== 'playing') return { changed: false };
  const game = await loadGame(tx, code);
  if (now < game.deadline) return { changed: false };
  let state = game.state;
  for (const a of autoActions(state, rng)) {
    try {
      state = apply(state, a, rng);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
    }
  }
  if (state === game.state) return { changed: false };
  await persist(tx, room, state, game, now);
  return { changed: true };
}
```

- [ ] **Step 4: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add server/src/game.ts server/test/game.test.ts
git commit -m "feat(server): add game start, actions, timeout ticks and view persistence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 请求分发、wx-server-sdk 适配、云函数入口和打包

**Files:**
- Create: `server/src/handler.ts`, `server/src/wxStore.ts`, `server/src/index.ts`, `server/src/wx-server-sdk.d.ts`
- Create: `server/build.mjs`, `server/test/stub/wx-server-sdk/index.js`
- Create: `cloudfunctions/game/package.json`, `cloudfunctions/game/index.js`（构建产物）
- Test: `server/test/handler.test.ts`, `server/test/wxStore.test.ts`

**Interfaces:**
- Consumes: Task 2 的 lobby 函数、Task 3 的 `startGame`/`act`/`tick`/`ClientAction`、`Store`/`Tx`
- Produces:
  - `handler.ts`：`type Request`（见代码）、`type Response = { ok: true; data: unknown } | { ok: false; error: string }`、`handle(store, openid, req, now, rng): Promise<Response>`
  - `wxStore.ts`：`NOT_FOUND: RegExp`、`wxStore(db): Store`
  - `index.ts`：云函数入口 `main(event)`
  - `cloudfunctions/game/index.js`：可部署的 CommonJS 包

- [ ] **Step 1: 写失败的测试**

`server/test/handler.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';
import { seededRng } from '../../engine/src/index';
import { handle } from '../src/handler';
import { MemoryStore } from '../src/memoryStore';
import type { Store } from '../src/store';
import { ROOMS, type RoomDoc } from '../src/types';
import { NOW } from './helpers';

const call = (store: Store, openid: string, req: unknown) => handle(store, openid, req, NOW, seededRng(3));

describe('handle', () => {
  it('没有 openid 时拒绝', async () => {
    expect(await call(new MemoryStore(), '', { type: 'createRoom', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '未登录',
    });
  });

  it('建房并加入', async () => {
    const store = new MemoryStore();
    const created = await call(store, 'u0', { type: 'createRoom', profile: { name: 'A' } });
    expect(created.ok).toBe(true);
    const code = (created as { data: { code: string } }).data.code;
    expect(await call(store, 'u1', { type: 'joinRoom', code, profile: { name: 'B' } })).toEqual({ ok: true, data: { code } });
    expect(store.read<RoomDoc>(ROOMS, code)!.seats).toHaveLength(2);
  });

  it('房间号格式不对、未知请求、规则错误都返回中文错误', async () => {
    const store = new MemoryStore();
    expect(await call(store, 'u0', { type: 'joinRoom', code: 'abc', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '房间号无效',
    });
    expect(await call(store, 'u0', { type: 'hack' })).toEqual({ ok: false, error: '未知请求' });
    expect(await call(store, 'u0', null)).toEqual({ ok: false, error: '未知请求' });
    expect(await call(store, 'u0', { type: 'joinRoom', code: '1234', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '房间不存在',
    });
  });

  it('非规则类异常返回通用错误并打印日志', async () => {
    const broken: Store = {
      transaction: async () => {
        throw new Error('db down');
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await call(broken, 'u0', { type: 'createRoom', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '服务器错误，请稍后再试',
    });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
```

`server/test/wxStore.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { RuleError } from '../../engine/src/index';
import { wxStore } from '../src/wxStore';

type Docs = Record<string, Record<string, unknown>>;

function fakeDb(docs: Docs, wrapErrors = false) {
  return {
    async runTransaction(cb: (t: unknown) => Promise<unknown>) {
      const t = {
        collection: (c: string) => ({
          doc: (id: string) => ({
            async get() {
              const d = docs[`${c}/${id}`];
              if (!d) throw { errCode: -502004, errMsg: `document.get:fail document with _id ${id} does not exist` };
              return { data: { _id: id, ...d } };
            },
            async set({ data }: { data: Record<string, unknown> }) {
              docs[`${c}/${id}`] = data;
            },
          }),
        }),
      };
      try {
        return await cb(t);
      } catch (e) {
        if (wrapErrors) throw new Error('transaction aborted');
        throw e;
      }
    },
  };
}

describe('wxStore', () => {
  it('get 去掉 _id；文档不存在时返回 null；set 写入 data', async () => {
    const docs: Docs = { 'rooms/1234': { code: '1234' } };
    const store = wxStore(fakeDb(docs));
    const result = await store.transaction(async (tx) => {
      const a = await tx.get('rooms', '1234');
      const b = await tx.get('rooms', '9999');
      await tx.set('rooms', '5678', { code: '5678' });
      return { a, b };
    });
    expect(result).toEqual({ a: { code: '1234' }, b: null });
    expect(docs['rooms/5678']).toEqual({ code: '5678' });
  });

  it('其他数据库错误原样抛出', async () => {
    const db = fakeDb({});
    db.runTransaction = async () => {
      throw new Error('network');
    };
    await expect(wxStore(db).transaction(async () => 1)).rejects.toThrow('network');
  });

  it('事务内抛出的 RuleError 即使被 SDK 包装，也原样抛给调用方', async () => {
    const err = new RuleError('房间不存在');
    await expect(
      wxStore(fakeDb({}, true)).transaction(async () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/handler.test.ts test/wxStore.test.ts`
Expected: FAIL，提示找不到 `../src/handler` 和 `../src/wxStore`。

- [ ] **Step 3: 实现 `handler.ts`**

```ts
import { RuleError, type Rng } from '../../engine/src/index';
import { act, startGame, tick, type ClientAction } from './game';
import { addBots, createRoom, joinRoom, leaveRoom, reorderSeats } from './lobby';
import type { Store } from './store';

export type Request =
  | { type: 'createRoom'; profile: unknown }
  | { type: 'joinRoom'; code: string; profile: unknown }
  | { type: 'leaveRoom'; code: string }
  | { type: 'reorderSeats'; code: string; order: string[] }
  | { type: 'addBots'; code: string; count: number }
  | { type: 'startGame'; code: string }
  | { type: 'act'; code: string; action: ClientAction; version?: number }
  | { type: 'tick'; code: string };

export type Response = { ok: true; data: unknown } | { ok: false; error: string };

function checkCode(code: unknown): string {
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) throw new RuleError('房间号无效');
  return code;
}

export async function handle(store: Store, openid: string, input: unknown, now: number, rng: Rng): Promise<Response> {
  if (!openid) return { ok: false, error: '未登录' };
  const req = (input ?? {}) as Request;
  try {
    const data = await store.transaction(async (tx) => {
      switch (req.type) {
        case 'createRoom':
          return createRoom(tx, openid, req.profile, now, rng);
        case 'joinRoom':
          return joinRoom(tx, checkCode(req.code), openid, req.profile, now);
        case 'leaveRoom':
          return leaveRoom(tx, checkCode(req.code), openid, now);
        case 'reorderSeats':
          return reorderSeats(tx, checkCode(req.code), openid, req.order, now);
        case 'addBots':
          return addBots(tx, checkCode(req.code), openid, Number(req.count) || 0, now);
        case 'startGame':
          return startGame(tx, checkCode(req.code), openid, now, rng);
        case 'act':
          return act(tx, checkCode(req.code), openid, req.action, req.version, now, rng);
        case 'tick':
          return tick(tx, checkCode(req.code), now, rng);
        default:
          throw new RuleError('未知请求');
      }
    });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: '服务器错误，请稍后再试' };
  }
}
```

- [ ] **Step 4: 实现 `wxStore.ts` 和 SDK 声明**

`server/src/wx-server-sdk.d.ts`：

```ts
declare module 'wx-server-sdk' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloud: any;
  export default cloud;
}
```

`server/src/wxStore.ts`：

```ts
import type { Store, Tx } from './store';

/** 云数据库「文档不存在」报错的特征。Task 5 在真实环境确认后按实际报错调整。 */
export const NOT_FOUND = /does not exist|not exist|DOCUMENT_NOT_EXIST|-502004/i;

function errorText(e: unknown): string {
  const err = e as { errCode?: unknown; errMsg?: unknown; message?: unknown };
  return [err?.errCode, err?.errMsg, err?.message, String(e)].filter((x) => x !== undefined).join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wxStore(db: any): Store {
  return {
    async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
      let thrown: unknown = undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await db.runTransaction(async (t: any) => {
          const tx: Tx = {
            async get<T>(collection: string, id: string): Promise<T | null> {
              try {
                const res = await t.collection(collection).doc(id).get();
                const { _id, ...rest } = res.data;
                return rest as T;
              } catch (e) {
                if (NOT_FOUND.test(errorText(e))) return null;
                throw e;
              }
            },
            async set(collection: string, id: string, data: object): Promise<void> {
              await t.collection(collection).doc(id).set({ data });
            },
          };
          try {
            return await fn(tx);
          } catch (e) {
            thrown = e;
            throw e;
          }
        });
      } catch (e) {
        // SDK 可能把回调里抛出的错误包装成别的对象，这里恢复成原始错误（例如 RuleError）
        throw thrown ?? e;
      }
    },
  };
}
```

- [ ] **Step 5: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS，输出中没有多余的 `console.error` 日志。

- [ ] **Step 6: 云函数入口、打包脚本、SDK 桩和云函数 package.json**

`server/src/index.ts`：

```ts
import cloud from 'wx-server-sdk';
import { mathRng } from '../../engine/src/index';
import { handle } from './handler';
import { wxStore } from './wxStore';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const store = wxStore(cloud.database());

export async function main(event: unknown) {
  const { OPENID } = cloud.getWXContext();
  return handle(store, OPENID, event, Date.now(), mathRng);
}
```

`server/build.mjs`：

```js
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  outfile: '../cloudfunctions/game/index.js',
  external: ['wx-server-sdk'],
  banner: { js: '// 由 server/build.mjs 生成，请勿手改。修改 server/src 后运行 npm run build。' },
  logLevel: 'info',
});
```

`server/test/stub/wx-server-sdk/index.js`：

```js
// 构建冒烟测试用的 wx-server-sdk 桩
module.exports = {
  DYNAMIC_CURRENT_ENV: 'stub',
  init() {},
  database() {
    return {};
  },
  getWXContext() {
    return { OPENID: '' };
  },
};
```

`cloudfunctions/game/package.json`：

```json
{
  "name": "game",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.1"
  }
}
```

- [ ] **Step 7: 构建并做冒烟测试**

Run: `npm run build`
Expected: esbuild 输出 `../cloudfunctions/game/index.js`，无错误。

Run（Git Bash，在 `server/` 下）：

```bash
NODE_PATH=test/stub node -e "require('../cloudfunctions/game/index.js').main({type:'createRoom',profile:{name:'x'}}).then(r=>{console.log(JSON.stringify(r));process.exit(r.ok===false&&r.error==='未登录'?0:1)})"
```

Expected: 打印 `{"ok":false,"error":"未登录"}`，退出码 0。

- [ ] **Step 8: Commit**

```bash
git add server/src/handler.ts server/src/wxStore.ts server/src/index.ts server/src/wx-server-sdk.d.ts server/build.mjs server/test/handler.test.ts server/test/wxStore.test.ts server/test/stub cloudfunctions/game/package.json cloudfunctions/game/index.js
git commit -m "feat(server): add request handler, wx-server-sdk adapter and cloud function bundle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5（与用户一起进行）: 部署到真实云环境并验证

**由 controller 与用户交互完成，不派子代理。** 目标：确认免费云环境可用、云函数能部署、事务和权限规则按预期工作、`watch` 推送在免费环境可用。

**Files:**
- Create: `project.config.json`
- Create: `miniprogram/app.json`, `miniprogram/app.js`, `miniprogram/sitemap.json`
- Create: `miniprogram/pages/debug/debug.js`, `debug.json`, `debug.wxml`, `debug.wxss`（临时调试页，计划 B2 替换）
- Modify（视验证结果）：`server/src/wxStore.ts` 的 `NOT_FOUND`；spec §3.2 的「实时推送备用方案」一段

- [ ] **Step 1: 写项目配置和调试页**

`project.config.json`：

```json
{
  "appid": "wx39381174201ab82c",
  "projectname": "witch-town",
  "compileType": "miniprogram",
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "es6": true,
    "enhance": true,
    "minified": true
  }
}
```

`miniprogram/app.json`：

```json
{
  "pages": ["pages/debug/debug"],
  "window": { "navigationBarTitleText": "女巫镇 · 调试" },
  "sitemapLocation": "sitemap.json",
  "style": "v2"
}
```

`miniprogram/sitemap.json`：

```json
{ "rules": [{ "action": "disallow", "page": "*" }] }
```

`miniprogram/app.js`（`ENV_ID` 在 Step 2 拿到后填入）：

```js
const ENV_ID = '在这里填云环境 ID';

App({
  onLaunch() {
    wx.cloud.init({ env: ENV_ID, traceUser: true });
  },
});
```

`miniprogram/pages/debug/debug.json`：

```json
{ "usingComponents": {} }
```

`miniprogram/pages/debug/debug.wxml`：

```xml
<view class="box">
  <input class="input" placeholder="房间号" value="{{code}}" bindinput="onCode" />
  <view class="row">
    <button size="mini" bindtap="createRoom">建房</button>
    <button size="mini" bindtap="joinRoom">加入</button>
    <button size="mini" bindtap="addBots">加 4 个机器人</button>
    <button size="mini" bindtap="startGame">开始</button>
  </view>
  <view class="row">
    <button size="mini" bindtap="watch">开始监听</button>
    <button size="mini" bindtap="draw">抽 2 张</button>
    <button size="mini" bindtap="tick">超时推进</button>
    <button size="mini" bindtap="readOthers">读别人的数据</button>
  </view>
  <view class="log">{{log}}</view>
</view>
```

`miniprogram/pages/debug/debug.wxss`：

```css
.box { padding: 16px; }
.input { border: 1px solid #ccc; padding: 6px; margin-bottom: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.log { white-space: pre-wrap; font-size: 11px; font-family: monospace; }
```

`miniprogram/pages/debug/debug.js`：

```js
const db = () => wx.cloud.database();

Page({
  data: { code: '', log: '' },

  print(label, value) {
    const line = `[${new Date().toLocaleTimeString()}] ${label}: ${JSON.stringify(value)}`;
    this.setData({ log: `${line}\n${this.data.log}`.slice(0, 8000) });
  },

  onCode(e) {
    this.setData({ code: e.detail.value });
  },

  async call(data) {
    const t0 = Date.now();
    try {
      const res = await wx.cloud.callFunction({ name: 'game', data });
      this.print(`${data.type} (${Date.now() - t0}ms)`, res.result);
      return res.result;
    } catch (e) {
      this.print(`${data.type} 调用失败`, e.errMsg || String(e));
      return null;
    }
  },

  async createRoom() {
    const r = await this.call({ type: 'createRoom', profile: { name: '测试' } });
    if (r && r.ok) this.setData({ code: r.data.code });
  },
  joinRoom() {
    this.call({ type: 'joinRoom', code: this.data.code, profile: { name: '测试' } });
  },
  addBots() {
    this.call({ type: 'addBots', code: this.data.code, count: 4 });
  },
  startGame() {
    this.call({ type: 'startGame', code: this.data.code });
  },
  draw() {
    this.call({ type: 'act', code: this.data.code, action: { type: 'draw' } });
  },
  tick() {
    this.call({ type: 'tick', code: this.data.code });
  },

  watch() {
    const code = this.data.code;
    if (this.roomWatcher) this.roomWatcher.close();
    if (this.handWatcher) this.handWatcher.close();
    this.roomWatcher = db()
      .collection('rooms')
      .doc(code)
      .watch({
        onChange: (snap) => {
          const doc = snap.docs[0];
          this.print('rooms 推送', doc ? { status: doc.status, version: doc.view && doc.view.version, phase: doc.view && doc.view.phase, deadline: doc.deadline } : null);
        },
        onError: (e) => this.print('rooms 监听失败', e.errMsg || String(e)),
      });
    this.handWatcher = db()
      .collection('hands')
      .where({ _openid: '{openid}', roomId: code })
      .watch({
        onChange: (snap) => {
          const doc = snap.docs[0];
          this.print('hands 推送', doc ? { seat: doc.view.seat, hand: doc.view.hand.map((c) => c.kind), pending: doc.view.pending } : null);
        },
        onError: (e) => this.print('hands 监听失败', e.errMsg || String(e)),
      });
  },

  async readOthers() {
    const code = this.data.code;
    try {
      const g = await db().collection('games').doc(code).get();
      this.print('读 games（应该失败）', g.data);
    } catch (e) {
      this.print('读 games 被拒绝（正确）', e.errMsg || String(e));
    }
    try {
      const h = await db().collection('hands').doc(`${code}_bot-1`).get();
      this.print('读 bot-1 的 hands（应该失败）', h.data);
    } catch (e) {
      this.print('读别人的 hands 被拒绝（正确）', e.errMsg || String(e));
    }
  },

  onUnload() {
    if (this.roomWatcher) this.roomWatcher.close();
    if (this.handWatcher) this.handWatcher.close();
  },
});
```

- [ ] **Step 2: 用户开通云环境（用户操作）**

1. 用微信开发者工具「导入项目」，目录选 `D:/UNSW/女巫镇`，AppID 自动读取 `wx39381174201ab82c`。
2. 点工具栏「云开发」，按提示开通。**选免费环境**（若只看到付费选项，停下来告诉 controller）。
3. 把环境 ID 发给 controller；controller 填入 `miniprogram/app.js` 的 `ENV_ID`。

- [ ] **Step 3: 建集合并设置权限规则（用户操作，controller 提供内容）**

云开发控制台 → 数据库，新建三个集合，并在每个集合的「数据权限 → 自定义安全规则」中填入：

| 集合 | 自定义安全规则 |
|---|---|
| `rooms` | `{ "read": true, "write": false }` |
| `games` | `{ "read": false, "write": false }` |
| `hands` | `{ "read": "doc._openid == auth.openid", "write": false }` |

- [ ] **Step 4: 部署云函数（用户操作）**

controller 先在 `server/` 运行 `npm run build`，确认 `cloudfunctions/game/index.js` 是最新的。然后用户在开发者工具中右键 `cloudfunctions/game` →「上传并部署：云端安装依赖」。

- [ ] **Step 5: 在调试页中逐项验证并记录结果**

在模拟器中按顺序操作，controller 根据日志逐项判断：

| # | 操作 | 期望 |
|---|---|---|
| 1 | 建房 | 返回 `ok: true` 和 4 位房间号；耗时记录下来（冷启动） |
| 2 | 加入（不存在的房间号，如 `0000`） | `房间号无效` 或 `房间不存在` —— 若出现「服务器错误」，查看云函数日志中的报错原文，说明 `NOT_FOUND` 需要调整 |
| 3 | 加 4 个机器人 → 开始监听 → 开始 | 开始成功（证明一个事务里写 1 个 games + 1 个 rooms + 5 个 hands 可行）；rooms 和 hands 都收到推送 |
| 4 | 超时推进（45 秒后） | 黎明结算，rooms 推送 phase 变为 day |
| 5 | 抽 2 张（轮到自己时） | hands 推送的手牌 +2 |
| 6 | 读别人的数据 | 读 games、读 bot-1 的 hands 都被拒绝 |
| 7 | 云开发控制台查看 `hands` 中一条文档 | 有 `_openid` 字段且值正确 |

- [ ] **Step 6: 根据结果调整并记录**

- 第 2 项若 `NOT_FOUND` 没匹配上：把实际报错特征加入 `server/src/wxStore.ts` 的 `NOT_FOUND`，并在 `server/test/wxStore.test.ts` 的 `fakeDb` 中用同样的报错格式补一个测试；重新 `npm run build` 并部署。
- 第 3 项若事务写入数量受限：把 `hands` 的写入移到事务提交之后逐个写（`game.ts` 的 `persist` 拆成事务内和事务外两部分），并在 spec §3.2 记录。
- 若 `watch` 在免费环境不可用：在 spec §3.2「实时推送备用方案」一段写明「已确认不可用，B2 使用轮询」。
- 把验证结论（冷启动耗时、watch 是否可用、NOT_FOUND 报错原文）写入 spec §7「风险」下方的新小节「云环境验证结果（2026-09-xx）」。

- [ ] **Step 7: Commit**

```bash
git add project.config.json miniprogram server cloudfunctions docs/superpowers/specs/2026-09-26-witch-town-design.md
git commit -m "chore: add debug mini-program page and record cloud environment verification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 计划 B1 完成后

- 云函数可以完整跑一局：建房 → 加人/机器人 → 开局 → 出牌 → 超时推进 → 结束。
- 下一步：**计划 B2（小程序页面）**，用本计划的 `Request` 类型作为前后端接口，用 `rooms` / `hands` 的推送（或轮询）驱动界面。
