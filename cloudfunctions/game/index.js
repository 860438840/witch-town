// 由 server/build.mjs 生成，请勿手改。修改 server/src 后运行 npm run build。
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  main: () => main
});
module.exports = __toCommonJS(index_exports);
var import_wx_server_sdk = __toESM(require("wx-server-sdk"), 1);

// ../engine/src/errors.ts
var RuleError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RuleError";
  }
};

// ../engine/src/rng.ts
function seededRng(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  };
}
var mathRng = { next: () => Math.random() };
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr, rng) {
  return arr[Math.floor(rng.next() * arr.length)];
}

// ../engine/src/cards.ts
var DECK_COMPOSITION = {
  accusation: 35,
  evidence: 6,
  witness: 1,
  matchmaker: 2,
  asylum: 1,
  piety: 1,
  scapegoat: 2,
  robbery: 1,
  arson: 1,
  curse: 1,
  stocks: 3,
  alibi: 3
};
var TOTAL_GAME_CARDS = 60;
var TRYALS_PER_PLAYER = 5;
var RED_POINTS = { accusation: 1, evidence: 3, witness: 7 };
var isRed = (k) => k === "accusation" || k === "evidence" || k === "witness";
var isBlack = (k) => k === "night" || k === "conspiracy";
function buildBaseDeck() {
  const deck = [];
  for (const [kind, count] of Object.entries(DECK_COMPOSITION)) {
    for (let i = 1; i <= count; i++) deck.push({ id: `${kind}-${i}`, kind });
  }
  return deck;
}
function tryalComposition(n) {
  if (!Number.isInteger(n) || n < 4 || n > 12) throw new RuleError("\u73A9\u5BB6\u4EBA\u6570\u5FC5\u987B\u5728 4\u201312 \u4E4B\u95F4");
  const witches = n <= 5 ? 1 : 2;
  const total = n * TRYALS_PER_PLAYER;
  return [
    ...Array(witches).fill("witch"),
    "constable",
    ...Array(total - witches - 1).fill("villager")
  ];
}

// ../engine/src/state.ts
function getPlayer(s, seat) {
  const p = s.players[seat];
  if (!p) throw new RuleError(`\u5EA7\u4F4D ${seat} \u4E0D\u5B58\u5728`);
  return p;
}
function aliveSeats(s) {
  return s.players.filter((p) => p.alive).map((p) => p.seat);
}
function leftOf(s, seat) {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = (seat + i) % n;
    if (s.players[q].alive) return q;
  }
  return null;
}
function rightOf(s, seat) {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = (seat - i + n) % n;
    if (s.players[q].alive) return q;
  }
  return null;
}
function unrevealed(p) {
  return p.tryals.filter((t) => !t.revealed);
}
function constableSeat(s) {
  const p = s.players.find((q) => q.alive && q.tryals.some((t) => t.kind === "constable" && !t.revealed));
  return p ? p.seat : null;
}
function catHolder(s) {
  const p = s.players.find((q) => q.alive && q.blue.some((c) => c.kind === "blackCat"));
  return p ? p.seat : null;
}
function witchSeats(s) {
  return s.players.filter((p) => p.alive && p.witchFaction).map((p) => p.seat);
}
function redTotal(p) {
  return p.red.reduce((sum, c) => sum + c.points, 0);
}
function setPhase(s, phase) {
  if (s.phase.kind === "ended") return;
  s.phase = phase;
}
function isEnded(s) {
  return s.phase.kind === "ended";
}
function toCard(c) {
  return { id: c.id, kind: c.source ?? c.kind };
}

// ../engine/src/characters.ts
var CHARACTERS = [
  "doctor",
  "beggar",
  "landlord",
  "judge",
  "priest",
  "storyteller",
  "tailor",
  "housewife",
  "farmer",
  "child",
  "minister",
  "official",
  "strongman",
  "maid",
  "maiden"
];
var USE_LIMITS = { priest: 2, storyteller: 1, official: 1 };
var PICK_BELOW = 7;
function abilityOf(s, seat) {
  const p = s.players[seat];
  if (!p) return null;
  if (p.character !== "tailor") return p.character;
  const r = rightOf(s, seat);
  if (r === null) return null;
  const c = s.players[r].character;
  return c === "tailor" ? null : c;
}
function hasAbility(s, seat, id) {
  return abilityOf(s, seat) === id;
}
function isLimited(c) {
  return c === "priest" || c === "storyteller" || c === "official";
}
function usesLeft(s, seat, a) {
  return USE_LIMITS[a] - (getPlayer(s, seat).uses[a] ?? 0);
}
function useAbility(s, seat, a) {
  const p = getPlayer(s, seat);
  p.uses[a] = (p.uses[a] ?? 0) + 1;
}
function canUse(s, seat, a) {
  return hasAbility(s, seat, a) && usesLeft(s, seat, a) > 0;
}
function limitedLeft(s, seat) {
  const a = abilityOf(s, seat);
  return isLimited(a) ? usesLeft(s, seat, a) : null;
}
function dealCharacters(s, rng) {
  const ids = shuffle(CHARACTERS, rng);
  if (s.players.length >= PICK_BELOW) {
    s.players.forEach((p, i) => {
      p.character = ids[i];
      s.log.push({ t: "character", seat: p.seat, character: ids[i] });
    });
    return;
  }
  s.players.forEach((p, i) => {
    s.characterOffers[p.seat] = [ids[2 * i], ids[2 * i + 1]];
  });
  s.phase = { kind: "characterPick" };
}
function pickCharacter(s, seat, index) {
  if (s.phase.kind !== "characterPick") throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u9009\u89D2\u8272");
  const p = getPlayer(s, seat);
  const offers = s.characterOffers[seat];
  if (!offers || p.character !== null) throw new RuleError("\u4F60\u5DF2\u7ECF\u9009\u8FC7\u89D2\u8272\u4E86");
  if (index !== 0 && index !== 1) throw new RuleError("\u9009\u62E9\u65E0\u6548");
  p.character = offers[index];
  s.log.push({ t: "character", seat, character: offers[index] });
  if (s.players.every((q) => q.character !== null)) {
    s.characterOffers = {};
    setPhase(s, { kind: "dawn" });
  }
}

// ../engine/src/setup.ts
function createGame(newPlayers, rng) {
  if (newPlayers.length < 4) {
    throw new RuleError(`\u4EBA\u6570\u4E0D\u8DB3 4 \u4EBA`);
  }
  const kinds = shuffle(tryalComposition(newPlayers.length), rng);
  const total = newPlayers.length * TRYALS_PER_PLAYER;
  const idNumbers = shuffle(
    Array.from({ length: total }, (_, i) => i + 1),
    rng
  );
  const players = newPlayers.map((np, seat) => {
    const tryals = kinds.slice(seat * TRYALS_PER_PLAYER, (seat + 1) * TRYALS_PER_PLAYER).map((kind, i) => ({ id: `t${idNumbers[seat * TRYALS_PER_PLAYER + i]}`, kind, revealed: false }));
    return {
      seat,
      openid: np.openid,
      name: np.name,
      character: null,
      uses: {},
      alive: true,
      witchFaction: tryals.some((t) => t.kind === "witch"),
      hand: [],
      tryals,
      red: [],
      blue: [],
      green: []
    };
  });
  let deck = shuffle(buildBaseDeck(), rng);
  for (let round = 0; round < 3; round++) {
    for (const p of players) p.hand.push(deck.shift());
  }
  deck = shuffle([...deck, { id: "night-1", kind: "night" }, { id: "conspiracy-1", kind: "conspiracy" }], rng);
  const state = {
    players,
    deck,
    discard: [],
    setAside: [{ id: "blackCat-1", kind: "blackCat" }],
    turn: 0,
    drawsLeft: 0,
    phase: { kind: "dawn" },
    dawnVotes: {},
    night: null,
    conspiracyPicks: {},
    characterOffers: {},
    steps: [],
    endTurnAfter: false,
    drawn: [],
    log: [{ t: "gameStart", players: players.length }],
    version: 0
  };
  dealCharacters(state, rng);
  return state;
}

// ../engine/src/death.ts
function revealTryal(s, seat, tryalId, cause) {
  const p = getPlayer(s, seat);
  const t = p.tryals.find((x) => x.id === tryalId);
  if (!t || t.revealed) throw new RuleError("\u8FD9\u5F20\u8EAB\u4EFD\u5361\u4E0D\u80FD\u7FFB\u5F00");
  t.revealed = true;
  s.log.push({ t: "reveal", seat, kind: t.kind, cause });
  if (t.kind === "witch") killPlayer(s, seat, "witchRevealed");
  else if (unrevealed(p).length === 0) killPlayer(s, seat, "allRevealed");
  checkWin(s);
}
function killPlayer(s, seat, cause) {
  const p = getPlayer(s, seat);
  if (!p.alive) return;
  p.alive = false;
  for (const t of p.tryals) {
    if (!t.revealed) {
      t.revealed = true;
      s.log.push({ t: "reveal", seat, kind: t.kind, cause: "death" });
    }
  }
  s.log.push({ t: "death", seat, cause });
  const partner = p.blue.some((c) => c.kind === "matchmaker") ? s.players.find((q) => q.alive && q.blue.some((c) => c.kind === "matchmaker")) : void 0;
  const heir = farmerHeir(s, seat, (partner == null ? void 0 : partner.seat) ?? null);
  if (heir !== null) {
    getPlayer(s, heir).hand.push(...p.hand, ...p.blue);
    s.discard.push(...p.red.map(toCard), ...p.green);
    s.log.push({ t: "ability", seat: heir, ability: "farmer", from: seat });
  } else {
    s.discard.push(...p.hand, ...p.red.map(toCard), ...p.blue, ...p.green);
  }
  p.hand = [];
  p.red = [];
  p.blue = [];
  p.green = [];
  if (partner) killPlayer(s, partner.seat, "lover");
  checkWin(s);
}
function farmerHeir(s, dead, alsoDying) {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = s.players[(dead + i) % n];
    if (q.alive && q.seat !== alsoDying && hasAbility(s, q.seat, "farmer")) return q.seat;
  }
  return null;
}
function checkWin(s) {
  if (s.phase.kind === "ended") return;
  let winner = null;
  if (witchSeats(s).length === 0) winner = "village";
  else if (s.players.filter((p) => p.alive).every((p) => p.witchFaction)) winner = "witch";
  if (winner) {
    s.phase = { kind: "ended", winner };
    s.log.push({ t: "gameEnd", winner });
  }
}

// ../engine/src/night.ts
function agreedTarget(s, votes) {
  const witches = witchSeats(s);
  if (witches.length === 0) return null;
  const first = votes[witches[0]];
  if (first === void 0) return null;
  return witches.every((w) => votes[w] === first) ? first : null;
}
function witchVote(s, seat, target, rng) {
  if (!getPlayer(s, seat).witchFaction) throw new RuleError("\u53EA\u6709\u5973\u5DEB\u9635\u8425\u53EF\u4EE5\u6295\u7968");
  if (!getPlayer(s, target).alive) throw new RuleError("\u76EE\u6807\u5FC5\u987B\u662F\u6D3B\u7740\u7684\u73A9\u5BB6");
  if (s.phase.kind === "dawn" && hasAbility(s, target, "maid")) throw new RuleError("\u5973\u4EC6\uFF1A\u9ED1\u732B\u5BF9\u5979\u65E0\u6548\uFF0C\u4E0D\u80FD\u9009\u5979");
  if (s.phase.kind === "dawn") {
    s.dawnVotes[seat] = target;
    tryResolveDawn(s);
    return;
  }
  if (s.phase.kind === "night" && s.night) {
    s.night.witchVotes[seat] = target;
    tryResolveNight(s, rng);
    return;
  }
  throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u6295\u7968");
}
function tryResolveDawn(s) {
  const target = agreedTarget(s, s.dawnVotes);
  if (target === null) return;
  const cat = s.setAside.find((c) => c.kind === "blackCat");
  if (!cat) throw new RuleError("\u627E\u4E0D\u5230\u9ED1\u732B\u5361");
  s.setAside = s.setAside.filter((c) => c !== cat);
  getPlayer(s, target).blue.push(cat);
  s.dawnVotes = {};
  s.log.push({ t: "catPlaced", target });
  startTurn(s, target);
}
function startNight(s) {
  setPhase(s, { kind: "night" });
  s.night = { witchVotes: {}, protect: null, confessions: {}, silent: [] };
}
function protect(s, seat, target, rng) {
  if (s.phase.kind !== "night" || !s.night) throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u4FDD\u62A4");
  if (constableSeat(s) !== seat) throw new RuleError("\u53EA\u6709\u8B66\u957F\u53EF\u4EE5\u4FDD\u62A4");
  if (target === seat) throw new RuleError("\u8B66\u957F\u4E0D\u80FD\u4FDD\u62A4\u81EA\u5DF1");
  if (!getPlayer(s, target).alive) throw new RuleError("\u76EE\u6807\u5FC5\u987B\u662F\u6D3B\u7740\u7684\u73A9\u5BB6");
  s.night.protect = target;
  tryResolveNight(s, rng);
}
function confess(s, seat, tryalId, silent, rng) {
  if (s.phase.kind !== "night" || !s.night) throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u81EA\u9996");
  if (silent) {
    if (tryalId !== null) throw new RuleError("\u4E0D\u7FFB\u724C\u81EA\u9996\u65F6\u4E0D\u80FD\u9009\u8EAB\u4EFD\u5361");
    if (seat in s.night.confessions) throw new RuleError("\u4F60\u5DF2\u7ECF\u51B3\u5B9A\u8FC7\u662F\u5426\u81EA\u9996\u4E86");
    if (!canUse(s, seat, "official")) throw new RuleError("\u4F60\u4E0D\u80FD\u4E0D\u7FFB\u724C\u81EA\u9996");
    useAbility(s, seat, "official");
    (s.night.silent ??= []).push(seat);
  } else if (tryalId !== null && !unrevealed(getPlayer(s, seat)).some((t) => t.id === tryalId)) {
    throw new RuleError("\u8FD9\u5F20\u8EAB\u4EFD\u5361\u4E0D\u80FD\u7FFB\u5F00");
  }
  s.night.confessions[seat] = tryalId;
  tryResolveNight(s, rng);
}
function tryResolveNight(s, rng) {
  const night = s.night;
  if (!night) return;
  const target = agreedTarget(s, night.witchVotes);
  if (target === null) return;
  if (constableSeat(s) !== null && night.protect === null) return;
  const alive = aliveSeats(s);
  if (!alive.every((seat) => seat in night.confessions)) return;
  const confessed = /* @__PURE__ */ new Set();
  for (const seat of alive) {
    const tid = night.confessions[seat];
    if (tid && getPlayer(s, seat).alive && !isEnded(s)) {
      revealTryal(s, seat, tid, "confess");
      confessed.add(seat);
    }
  }
  for (const seat of isEnded(s) ? [] : night.silent ?? []) {
    if (!getPlayer(s, seat).alive) continue;
    confessed.add(seat);
    s.log.push({ t: "ability", seat, ability: "official" });
  }
  s.night = null;
  if (isEnded(s)) return;
  const victim = getPlayer(s, target);
  const died = victim.alive && night.protect !== target && !victim.blue.some((c) => c.kind === "asylum") && !confessed.has(target);
  s.log.push({ t: "nightResult", target, died });
  if (died) killPlayer(s, target, "night");
  if (isEnded(s)) return;
  resetCards(s, rng);
  s.endTurnAfter = true;
  proceed(s, rng);
}
function resetCards(s, rng) {
  const all = [...s.deck, ...s.discard];
  for (const p of s.players) {
    all.push(...p.hand, ...p.red.map(toCard), ...p.blue, ...p.green);
    p.hand = [];
    p.red = [];
    p.blue = [];
    p.green = [];
  }
  const deck = shuffle(all.filter((c) => !isBlack(c.kind)), rng);
  const n = s.players.length;
  for (let round = 0; round < 3; round++) {
    for (let i = 1; i <= n; i++) {
      const p = s.players[(s.turn + i) % n];
      const card = p.alive ? deck.shift() : void 0;
      if (card) p.hand.push(card);
    }
  }
  s.deck = shuffle([...deck, ...all.filter((c) => isBlack(c.kind))], rng);
  s.discard = [];
  s.drawn = [];
  s.log.push({ t: "nightReset" });
}

// ../engine/src/trial.ts
var DEFAULT_TRIAL_THRESHOLD = 7;
var JUDGE_THRESHOLD = 6;
var STRONGMAN_THRESHOLD = 8;
function trialThreshold(s, target, initiator) {
  if (initiator !== null && hasAbility(s, initiator, "judge")) return JUDGE_THRESHOLD;
  if (hasAbility(s, target, "strongman")) return STRONGMAN_THRESHOLD;
  return DEFAULT_TRIAL_THRESHOLD;
}
function checkTrial(s, target, initiator, rng) {
  const p = getPlayer(s, target);
  if (!p.alive || isEnded(s)) return;
  if (redTotal(p) < trialThreshold(s, target, initiator)) return;
  s.steps.push({ kind: "trial", target, initiator });
  if (hasAbility(s, initiator, "maiden")) {
    s.log.push({ t: "ability", seat: initiator, ability: "maiden" });
    s.steps.push({ kind: "draw", seat: initiator }, { kind: "draw", seat: initiator });
  }
  proceed(s, rng);
}
function finishTrial(s, target, initiator) {
  const p = getPlayer(s, target);
  if (p.alive) {
    s.discard.push(...p.red.map(toCard));
    p.red = [];
  }
  const init = getPlayer(s, initiator);
  if (init.alive && hasAbility(s, initiator, "child")) {
    const drop = init.red.filter((c) => c.kind !== "witness");
    if (drop.length > 0) {
      s.discard.push(...drop.map(toCard));
      init.red = init.red.filter((c) => c.kind === "witness");
      s.log.push({ t: "ability", seat: initiator, ability: "child" });
    }
  }
  backToPlaying(s);
}

// ../engine/src/flow.ts
function proceed(s, rng) {
  while (!isEnded(s)) {
    const step = s.steps.pop();
    if (!step) break;
    if (runStep(s, step, rng) === "paused") return;
  }
  if (isEnded(s)) return;
  if (s.endTurnAfter) {
    s.endTurnAfter = false;
    endTurn(s);
  }
}
function runStep(s, step, rng) {
  switch (step.kind) {
    case "draw": {
      if (!getPlayer(s, step.seat).alive) return "done";
      const card = drawOne(s, rng);
      return card ? takeCard(s, step.seat, card, rng) : "done";
    }
    case "trial":
      if (!getPlayer(s, step.target).alive) {
        backToPlaying(s);
        return "done";
      }
      s.log.push({ t: "trial", target: step.target, initiator: step.initiator });
      setPhase(s, { kind: "trialReveal", target: step.target, initiator: step.initiator });
      return "paused";
    case "finishTrial":
      finishTrial(s, step.target, step.initiator);
      return "done";
    case "picks":
      return beginPicks(s);
    case "drawing":
      return resumeDrawing(s, rng);
    case "night":
      startNight(s);
      return "paused";
  }
}
function takeCard(s, seat, card, rng) {
  if (card.kind === "night") {
    s.log.push({ t: "blackDrawn", seat, kind: "night" });
    s.discard.push(card);
    s.steps.unshift({ kind: "night" });
    s.endTurnAfter = true;
    return "done";
  }
  if (card.kind === "conspiracy") {
    s.log.push({ t: "blackDrawn", seat, kind: "conspiracy" });
    return startConspiracy(s, card);
  }
  getPlayer(s, seat).hand.push(card);
  s.log.push({ t: "draw", seat });
  return "done";
}
function backToPlaying(s) {
  setPhase(s, { kind: "day", mode: "playing" });
  if (!s.players[s.turn].alive) s.endTurnAfter = true;
}
function pushHousewifeDraws(s, revealed) {
  if (isEnded(s)) return;
  const seats = s.players.filter((p) => p.alive && p.seat !== revealed && hasAbility(s, p.seat, "housewife")).map((p) => p.seat);
  for (const seat of seats) s.log.push({ t: "ability", seat, ability: "housewife" });
  for (const seat of [...seats].reverse()) s.steps.push({ kind: "draw", seat });
}

// ../engine/src/conspiracy.ts
function startConspiracy(s, card) {
  s.discard.push(card);
  const holder = catHolder(s);
  if (holder !== null) {
    s.steps.push({ kind: "picks" });
    setPhase(s, { kind: "catReveal", holder });
    return "paused";
  }
  return beginPicks(s);
}
function catReveal(s, seat, tryalId, rng) {
  if (s.phase.kind !== "catReveal" || s.phase.holder !== seat) throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u7FFB\u5F00\u8EAB\u4EFD\u5361");
  revealTryal(s, seat, tryalId, "cat");
  pushHousewifeDraws(s, seat);
  proceed(s, rng);
}
function conspiracyPickers(s) {
  return aliveSeats(s).filter((seat) => {
    const left = leftOf(s, seat);
    return left !== null && unrevealed(getPlayer(s, left)).length > 0;
  });
}
function beginPicks(s) {
  s.conspiracyPicks = {};
  setPhase(s, { kind: "conspiracyPick" });
  if (conspiracyPickers(s).length > 0) return "paused";
  finishConspiracy(s);
  return "done";
}
function conspiracyPick(s, seat, index, rng) {
  if (s.phase.kind !== "conspiracyPick") throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u62FF\u8EAB\u4EFD\u5361");
  if (!conspiracyPickers(s).includes(seat)) throw new RuleError("\u4F60\u4E0D\u9700\u8981\u62FF\u8EAB\u4EFD\u5361");
  if (seat in s.conspiracyPicks) throw new RuleError("\u4F60\u5DF2\u7ECF\u62FF\u8FC7\u4E86");
  const left = leftOf(s, seat);
  const count = unrevealed(getPlayer(s, left)).length;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RuleError("\u9009\u62E9\u7684\u4F4D\u7F6E\u65E0\u6548");
  s.conspiracyPicks[seat] = index;
  if (conspiracyPickers(s).every((p) => p in s.conspiracyPicks)) {
    finishConspiracy(s);
    proceed(s, rng);
  }
}
function finishConspiracy(s) {
  const moves = conspiracyPickers(s).map((seat) => {
    const from = leftOf(s, seat);
    const tryal = unrevealed(getPlayer(s, from))[s.conspiracyPicks[seat]];
    return { seat, from, tryalId: tryal.id };
  });
  for (const m of moves) {
    const giver = getPlayer(s, m.from);
    const i = giver.tryals.findIndex((t) => t.id === m.tryalId);
    const [tryal] = giver.tryals.splice(i, 1);
    const receiver = getPlayer(s, m.seat);
    receiver.tryals.push(tryal);
    if (tryal.kind === "witch") receiver.witchFaction = true;
  }
  s.conspiracyPicks = {};
  s.log.push({ t: "conspiracyDone" });
  checkWin(s);
}

// ../engine/src/turn.ts
function startTurn(s, fromSeat) {
  if (s.phase.kind === "ended") return;
  const n = s.players.length;
  let seat = (fromSeat % n + n) % n;
  for (let i = 0; i < n * 2; i++) {
    const p = s.players[seat];
    if (p.alive) {
      const idx = p.green.findIndex((c) => c.kind === "stocks");
      if (idx >= 0) {
        s.discard.push(...p.green.splice(idx, 1));
        s.log.push({ t: "skipped", seat });
      } else {
        s.turn = seat;
        s.drawsLeft = 0;
        setPhase(s, { kind: "day", mode: "choose" });
        s.log.push({ t: "turn", seat });
        return;
      }
    }
    seat = (seat + 1) % n;
  }
  throw new RuleError("\u6CA1\u6709\u53EF\u4EE5\u884C\u52A8\u7684\u73A9\u5BB6");
}
function endTurn(s) {
  startTurn(s, s.turn + 1);
}
function drawOne(s, rng) {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null;
    s.deck = shuffle(s.discard, rng);
    s.discard = [];
    s.log.push({ t: "reshuffle" });
  }
  return s.deck.shift() ?? null;
}
function startDrawing(s, rng) {
  s.drawsLeft = 2;
  s.drawn = [];
  setPhase(s, { kind: "day", mode: "drawing" });
  continueDrawing(s, rng);
}
function continueDrawing(s, rng) {
  while (s.drawsLeft > 0) {
    const card = drawOne(s, rng);
    if (!card) {
      s.drawsLeft = 0;
      break;
    }
    if (card.kind === "night") {
      s.log.push({ t: "blackDrawn", seat: s.turn, kind: "night" });
      s.discard.push(card);
      s.drawsLeft = 0;
      startNight(s);
      return "paused";
    }
    if (card.kind === "conspiracy") {
      s.log.push({ t: "blackDrawn", seat: s.turn, kind: "conspiracy" });
      s.steps.push({ kind: "drawing" });
      if (startConspiracy(s, card) === "paused") return "paused";
      s.steps.pop();
      return resumeDrawing(s, rng);
    }
    s.players[s.turn].hand.push(card);
    s.drawn.push(card.kind);
    s.drawsLeft--;
    s.log.push({ t: "draw", seat: s.turn });
    if (s.drawsLeft === 0 && landlordBonus(s)) s.drawsLeft = 1;
  }
  endTurn(s);
  return "done";
}
function resumeDrawing(s, rng) {
  if (isEnded(s) || s.endTurnAfter) return "done";
  setPhase(s, { kind: "day", mode: "drawing" });
  if (!s.players[s.turn].alive) {
    s.drawsLeft = 0;
    endTurn(s);
    return "done";
  }
  return continueDrawing(s, rng);
}
function landlordBonus(s) {
  if (s.drawn.length !== 2 || !s.drawn.every((k) => k === "accusation")) return false;
  if (!hasAbility(s, s.turn, "landlord")) return false;
  s.log.push({ t: "ability", seat: s.turn, ability: "landlord" });
  return true;
}

// ../engine/src/abilities.ts
function atTurnStart(s, seat) {
  return s.phase.kind === "day" && s.phase.mode === "choose" && s.turn === seat;
}
function priestDraw(s, seat, cardIds) {
  if (!atTurnStart(s, seat)) throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u4F7F\u7528\u7267\u5E08\u6280\u80FD");
  if (!canUse(s, seat, "priest")) throw new RuleError("\u4F60\u4E0D\u80FD\u4F7F\u7528\u7267\u5E08\u6280\u80FD");
  if (cardIds.length < 1 || cardIds.length > 2 || new Set(cardIds).size !== cardIds.length) {
    throw new RuleError("\u8BF7\u9009\u62E9 1\u20132 \u5F20\u4E0D\u540C\u7684\u724C");
  }
  const cards = cardIds.map((id) => s.discard.find((c) => c.id === id));
  if (cards.some((c) => !c || isBlack(c.kind))) throw new RuleError("\u53EA\u80FD\u62FF\u5F03\u724C\u5806\u91CC\u7684\u975E\u9ED1\u5361");
  s.discard = s.discard.filter((c) => !cardIds.includes(c.id));
  getPlayer(s, seat).hand.push(...cards);
  useAbility(s, seat, "priest");
  s.log.push({ t: "ability", seat, ability: "priest", count: cardIds.length });
  endTurn(s);
}
function storyStart(s, seat) {
  if (!atTurnStart(s, seat)) throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u8C03\u6574\u724C\u5806");
  if (!canUse(s, seat, "storyteller")) throw new RuleError("\u4F60\u4E0D\u80FD\u8C03\u6574\u724C\u5806");
  useAbility(s, seat, "storyteller");
  setPhase(s, { kind: "storytelling", seat });
}
function storyReorder(s, seat, order) {
  if (s.phase.kind !== "storytelling" || s.phase.seat !== seat) throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u8C03\u6574\u724C\u5806");
  const byId = new Map(s.deck.map((c) => [c.id, c]));
  if (order.length !== s.deck.length || new Set(order).size !== order.length || order.some((id) => !byId.has(id))) {
    throw new RuleError("\u65B0\u987A\u5E8F\u5FC5\u987B\u5305\u542B\u724C\u5806\u91CC\u7684\u6BCF\u4E00\u5F20\u724C");
  }
  s.deck = order.map((id) => byId.get(id));
  s.log.push({ t: "ability", seat, ability: "storyteller" });
  setPhase(s, { kind: "day", mode: "choose" });
}

// ../engine/src/play.ts
var MINISTER_EVIDENCE = 1;
function accusationValue(s, kind, _actor, target) {
  if (kind === "evidence" && hasAbility(s, target, "minister")) return MINISTER_EVIDENCE;
  return RED_POINTS[kind];
}
function targetCount(kind) {
  return kind === "scapegoat" || kind === "robbery" ? 2 : 1;
}
var ALIBI_OPTIONS = ["accusation", "evidence", "witness"];
function maidBlocks(s, seat, kind) {
  return (kind === "blackCat" || kind === "matchmaker") && hasAbility(s, seat, "maid");
}
function playCard(s, seat, cardId, targets2, option, rng) {
  if (s.phase.kind !== "day" || s.phase.mode === "drawing" || s.turn !== seat) {
    throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u51FA\u724C");
  }
  const actor = getPlayer(s, seat);
  const idx = actor.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new RuleError("\u624B\u724C\u4E2D\u6CA1\u6709\u8FD9\u5F20\u5361");
  const card = actor.hand[idx];
  if (isBlack(card.kind)) throw new RuleError("\u9ED1\u5361\u4E0D\u80FD\u4E3B\u52A8\u6253\u51FA");
  const need = targetCount(card.kind);
  if (targets2.length !== need) throw new RuleError(`\u8FD9\u5F20\u5361\u9700\u8981\u9009\u62E9 ${need} \u540D\u76EE\u6807`);
  const ts = targets2.map((t) => getPlayer(s, t));
  if (ts.some((t) => !t.alive)) throw new RuleError("\u76EE\u6807\u5FC5\u987B\u662F\u6D3B\u7740\u7684\u73A9\u5BB6");
  if (need === 2 && targets2[0] === targets2[1]) throw new RuleError("\u4E24\u4E2A\u76EE\u6807\u4E0D\u80FD\u76F8\u540C");
  const target = ts[0];
  const asWitness = card.kind === "alibi" && option === "witness";
  if (asWitness && !hasAbility(s, seat, "doctor")) throw new RuleError("\u53EA\u6709\u533B\u751F\u53EF\u4EE5\u628A\u8FA9\u62A4\u5F53\u4F5C\u76EE\u51FB");
  if (isRed(card.kind) || asWitness) {
    if (target.seat === seat) throw new RuleError("\u4E0D\u80FD\u5BF9\u81EA\u5DF1\u6253\u51FA\u7EA2\u5361");
    if (target.blue.some((c) => c.kind === "piety")) throw new RuleError("\u4FE1\u5F92\uFF1A\u4E0D\u80FD\u5BF9\u8BE5\u73A9\u5BB6\u6253\u51FA\u7EA2\u5361");
  }
  if (card.kind === "matchmaker" && target.blue.some((c) => c.kind === "matchmaker")) {
    throw new RuleError("\u8BE5\u73A9\u5BB6\u5DF2\u7ECF\u6709\u60C5\u4FA3\u5361");
  }
  if (card.kind === "stocks" && target.green.some((c) => c.kind === "stocks")) {
    throw new RuleError("\u8BE5\u73A9\u5BB6\u5DF2\u88AB\u62D8\u7559");
  }
  if (card.kind === "curse" && !target.blue.some((c) => c.id === option)) {
    throw new RuleError("\u8BF7\u9009\u62E9\u8BE5\u73A9\u5BB6\u9762\u524D\u7684\u4E00\u5F20\u84DD\u5361");
  }
  if (card.kind === "alibi" && option !== void 0 && !ALIBI_OPTIONS.includes(option)) {
    throw new RuleError("\u8FA9\u62A4\u9009\u9879\u65E0\u6548");
  }
  actor.hand.splice(idx, 1);
  setPhase(s, { kind: "day", mode: "playing" });
  s.log.push({ t: "play", seat, kind: card.kind, targets: targets2 });
  switch (card.kind) {
    case "accusation":
    case "evidence":
    case "witness":
      addRed(s, seat, target.seat, card, card.kind, rng);
      return;
    case "matchmaker":
    case "asylum":
    case "piety":
    case "blackCat":
      if (maidBlocks(s, target.seat, card.kind)) {
        blocked(s, target.seat, "maid", card);
        return;
      }
      target.blue.push(card);
      return;
    case "stocks":
      target.green.push(card);
      return;
    case "alibi": {
      if (asWitness) {
        s.log.push({ t: "ability", seat, ability: "doctor" });
        addRed(s, seat, target.seat, card, "witness", rng);
        return;
      }
      const mode = option ?? (target.red.some((c) => c.kind === "accusation") ? "accusation" : "evidence");
      const limit = mode === "accusation" ? 3 : 1;
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
    case "arson":
      if (hasAbility(s, target.seat, "beggar")) {
        blocked(s, target.seat, "beggar", card);
        return;
      }
      s.discard.push(...target.hand, card);
      target.hand = [];
      return;
    case "robbery": {
      if (hasAbility(s, target.seat, "beggar")) {
        blocked(s, target.seat, "beggar", card);
        return;
      }
      const to = ts[1];
      to.hand.push(...target.hand);
      target.hand = [];
      s.discard.push(card);
      return;
    }
    case "scapegoat": {
      const to = ts[1];
      const alreadyHas = (cards, kind) => cards.some((c) => c.kind === kind);
      const hasMatchmaker = alreadyHas(to.blue, "matchmaker");
      const hasStocks = alreadyHas(to.green, "stocks");
      to.red.push(...target.red);
      for (const c of target.blue) {
        if (c.kind === "matchmaker" && hasMatchmaker) s.discard.push(c);
        else if (maidBlocks(s, to.seat, c.kind)) blocked(s, to.seat, "maid", c);
        else to.blue.push(c);
      }
      for (const c of target.green) {
        if (c.kind === "stocks" && hasStocks) s.discard.push(c);
        else to.green.push(c);
      }
      target.red = [];
      target.blue = [];
      target.green = [];
      s.discard.push(card);
      checkTrial(s, to.seat, seat, rng);
      return;
    }
    case "curse": {
      const i = target.blue.findIndex((c) => c.id === option);
      s.discard.push(...target.blue.splice(i, 1), card);
      return;
    }
  }
}
function addRed(s, actor, target, card, kind, rng) {
  const points = accusationValue(s, kind, actor, target);
  if (points < RED_POINTS[kind]) s.log.push({ t: "ability", seat: target, ability: "minister" });
  const red = { id: card.id, kind, points };
  if (card.kind !== kind) red.source = card.kind;
  getPlayer(s, target).red.push(red);
  checkTrial(s, target, actor, rng);
}
function blocked(s, seat, ability, card) {
  s.discard.push(card);
  s.log.push({ t: "ability", seat, ability, kind: card.kind });
}

// ../engine/src/apply.ts
function apply(state, action, rng) {
  const s = JSON.parse(JSON.stringify(state));
  if (s.phase.kind === "ended") throw new RuleError("\u6E38\u620F\u5DF2\u7ED3\u675F");
  if (!getPlayer(s, action.seat).alive) throw new RuleError("\u6B7B\u4EA1\u7684\u73A9\u5BB6\u4E0D\u80FD\u884C\u52A8");
  switch (action.type) {
    case "play":
      playCard(s, action.seat, action.cardId, action.targets, action.option, rng);
      break;
    case "endTurn":
      if (s.phase.kind !== "day" || s.phase.mode !== "playing" || s.turn !== action.seat) {
        throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u7ED3\u675F\u56DE\u5408");
      }
      endTurn(s);
      break;
    case "revealTryal":
      handleReveal(s, action.seat, action.tryalId, rng);
      break;
    case "witchVote":
      witchVote(s, action.seat, action.target, rng);
      break;
    case "protect":
      protect(s, action.seat, action.target, rng);
      break;
    case "confess":
      confess(s, action.seat, action.tryalId, action.silent === true, rng);
      break;
    case "draw":
      if (s.phase.kind !== "day" || s.phase.mode !== "choose" || s.turn !== action.seat) {
        throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u62BD\u724C");
      }
      startDrawing(s, rng);
      break;
    case "conspiracyPick":
      conspiracyPick(s, action.seat, action.index, rng);
      break;
    case "pickCharacter":
      pickCharacter(s, action.seat, action.index);
      break;
    case "priestDraw":
      priestDraw(s, action.seat, action.cardIds);
      break;
    case "storyStart":
      storyStart(s, action.seat);
      break;
    case "storyReorder":
      storyReorder(s, action.seat, action.order);
      break;
    default:
      throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u6267\u884C\u8FD9\u4E2A\u64CD\u4F5C");
  }
  s.version++;
  return s;
}
function handleReveal(s, seat, tryalId, rng) {
  const ph = s.phase;
  if (ph.kind === "trialReveal" && ph.target === seat) {
    revealTryal(s, seat, tryalId, "trial");
    s.steps.push({ kind: "finishTrial", target: seat, initiator: ph.initiator });
    pushHousewifeDraws(s, seat);
    proceed(s, rng);
    return;
  }
  if (ph.kind === "catReveal") {
    catReveal(s, seat, tryalId, rng);
    return;
  }
  throw new RuleError("\u73B0\u5728\u4E0D\u80FD\u7FFB\u5F00\u8EAB\u4EFD\u5361");
}

// ../engine/src/auto.ts
function majority(votes) {
  const counts = /* @__PURE__ */ new Map();
  for (const v of Object.values(votes)) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [target, count] of counts) {
    if (count > bestCount) {
      best = target;
      bestCount = count;
    }
  }
  return best;
}
function autoActions(s, rng) {
  const ph = s.phase;
  switch (ph.kind) {
    case "characterPick":
      return s.players.filter((p) => p.character === null && s.characterOffers[p.seat]).map((p) => ({ type: "pickCharacter", seat: p.seat, index: rng.next() < 0.5 ? 0 : 1 }));
    case "storytelling":
      return [{ type: "storyReorder", seat: ph.seat, order: s.deck.map((c) => c.id) }];
    case "day":
      if (ph.mode === "choose") return [{ type: "draw", seat: s.turn }];
      if (ph.mode === "playing") return [{ type: "endTurn", seat: s.turn }];
      return [];
    case "trialReveal":
      return [{ type: "revealTryal", seat: ph.target, tryalId: pick(unrevealed(getPlayer(s, ph.target)), rng).id }];
    case "catReveal":
      return [{ type: "revealTryal", seat: ph.holder, tryalId: pick(unrevealed(getPlayer(s, ph.holder)), rng).id }];
    case "conspiracyPick":
      return conspiracyPickers(s).filter((seat) => !(seat in s.conspiracyPicks)).map((seat) => {
        const count = unrevealed(getPlayer(s, leftOf(s, seat))).length;
        return { type: "conspiracyPick", seat, index: Math.floor(rng.next() * count) };
      });
    case "dawn": {
      const allowed = aliveSeats(s).filter((seat) => !hasAbility(s, seat, "maid"));
      const target = majority(s.dawnVotes) ?? pick(allowed, rng);
      return witchSeats(s).map((seat) => ({ type: "witchVote", seat, target }));
    }
    case "night": {
      const night = s.night;
      if (!night) return [];
      const alive = aliveSeats(s);
      const actions = [];
      const constable = constableSeat(s);
      const others = alive.filter((x) => x !== constable);
      if (constable !== null && night.protect === null && others.length > 0) {
        actions.push({ type: "protect", seat: constable, target: pick(others, rng) });
      }
      for (const seat of alive) {
        if (!(seat in night.confessions)) actions.push({ type: "confess", seat, tryalId: null });
      }
      const target = majority(night.witchVotes) ?? pick(alive, rng);
      for (const seat of witchSeats(s)) actions.push({ type: "witchVote", seat, target });
      return actions;
    }
    default:
      return [];
  }
}

// ../engine/src/view.ts
function projectPublic(s) {
  const ended = s.phase.kind === "ended";
  return {
    players: s.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      character: p.character,
      ability: abilityOf(s, p.seat),
      usesLeft: limitedLeft(s, p.seat),
      alive: p.alive,
      handCount: p.hand.length,
      tryals: p.tryals.map((t) => ({ revealed: t.revealed, kind: t.revealed || ended ? t.kind : null })),
      red: p.red.map((c) => ({ kind: c.kind, points: c.points })),
      redTotal: redTotal(p),
      threshold: trialThreshold(s, p.seat, null),
      blue: p.blue,
      green: p.green,
      witchFaction: ended ? p.witchFaction : null
    })),
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    discard: s.discard,
    turn: s.turn,
    phase: s.phase,
    log: s.log,
    version: s.version
  };
}
function projectPrivate(s, seat) {
  const p = getPlayer(s, seat);
  return {
    seat,
    hand: p.hand,
    tryals: p.tryals,
    witchFaction: p.witchFaction,
    witchPartners: p.witchFaction ? s.players.filter((q) => q.witchFaction && q.seat !== seat).map((q) => q.seat) : [],
    isConstable: constableSeat(s) === seat,
    pending: p.alive ? pendingFor(s, seat) : null
  };
}
function pendingFor(s, seat) {
  const ph = s.phase;
  const p = getPlayer(s, seat);
  switch (ph.kind) {
    case "day":
      if (s.turn !== seat || ph.mode === "drawing") return null;
      return { kind: "turn", mode: ph.mode };
    case "trialReveal":
      return ph.target === seat ? { kind: "revealTryal", reason: "trial" } : null;
    case "catReveal":
      return ph.holder === seat ? { kind: "revealTryal", reason: "cat" } : null;
    case "conspiracyPick": {
      if (!conspiracyPickers(s).includes(seat) || seat in s.conspiracyPicks) return null;
      const from = leftOf(s, seat);
      return { kind: "conspiracyPick", from, count: unrevealed(getPlayer(s, from)).length };
    }
    case "characterPick": {
      const offers = s.characterOffers[seat];
      return offers && p.character === null ? { kind: "characterPick", offers } : null;
    }
    case "storytelling":
      return ph.seat === seat ? { kind: "storytelling", deck: s.deck } : null;
    case "dawn":
      return p.witchFaction ? { kind: "dawnVote", votes: s.dawnVotes } : null;
    case "night": {
      const night = s.night;
      if (!night) return null;
      const isConstable = constableSeat(s) === seat;
      return {
        kind: "night",
        witch: p.witchFaction,
        votes: p.witchFaction ? night.witchVotes : null,
        constable: isConstable,
        protect: isConstable ? night.protect : null,
        confessed: seat in night.confessions
      };
    }
    default:
      return null;
  }
}

// src/types.ts
var ROOMS = "rooms";
var GAMES = "games";
var HANDS = "hands";
var MIN_PLAYERS = 4;
var MAX_PLAYERS = 12;
var BOT_PREFIX = "bot-";
var isBot = (openid) => openid.startsWith(BOT_PREFIX);
var handId = (code, openid) => `${code}_${openid}`;

// src/deadlines.ts
var TURN_MS = 9e4;
var BOT_TURN_MS = 3e3;
var CHOICE_MS = 45e3;
var PICK_MS = 3e4;
var STORY_MS = 12e4;
function waitingSeats(s) {
  var _a;
  const votes = s.phase.kind === "night" ? ((_a = s.night) == null ? void 0 : _a.witchVotes) ?? {} : s.phase.kind === "dawn" ? s.dawnVotes : {};
  const seats = autoActions(s, seededRng(0)).filter((a) => !(a.type === "witchVote" && a.seat in votes)).map((a) => a.seat);
  return [...new Set(seats)];
}
function botsOnly(s) {
  if (s.phase.kind === "day") return false;
  const seats = waitingSeats(s);
  return seats.length > 0 && seats.every((seat) => isBot(s.players[seat].openid));
}
function deadlineKey(s) {
  const key = phaseKey(s);
  return botsOnly(s) ? `${key}:bots` : key;
}
function phaseKey(s) {
  const ph = s.phase;
  switch (ph.kind) {
    case "day": {
      const turnCount = s.log.filter((e) => e.t === "turn").length;
      const arranged = s.log.filter((e) => e.t === "ability" && e.ability === "storyteller").length;
      return `day:${s.turn}:${turnCount}:${arranged}`;
    }
    case "night":
      return `night:${s.log.filter((e) => e.t === "nightResult").length}`;
    case "trialReveal":
      return `trial:${ph.target}`;
    case "catReveal":
      return `cat:${ph.holder}`;
    default:
      return ph.kind;
  }
}
function phaseDuration(s) {
  if (s.phase.kind === "characterPick") return PICK_MS;
  if (s.phase.kind === "storytelling") return STORY_MS;
  if (s.phase.kind !== "day") return botsOnly(s) ? BOT_TURN_MS : CHOICE_MS;
  return isBot(s.players[s.turn].openid) ? BOT_TURN_MS : TURN_MS;
}

// src/lobby.ts
var STALE_MS = 6 * 36e5;
var ENDED_GRACE_MS = 30 * 6e4;
var STRIP_FROM_NAME = /[\u0000-\u001F\u007F-\u009F​-‍﻿]/g;
function checkAvatar(v) {
  if (typeof v !== "string") return "";
  if (v === "") return "";
  if (v.length > 512) return "";
  if (!v.startsWith("https://")) return "";
  return v;
}
function checkProfile(p) {
  const raw = p ?? {};
  const name = typeof raw.name === "string" ? raw.name.replace(STRIP_FROM_NAME, "").trim() : "";
  if ([...name].length < 1 || [...name].length > 12) throw new RuleError("\u6635\u79F0\u9700\u8981 1\u201312 \u4E2A\u5B57");
  return { name, avatar: checkAvatar(raw.avatar) };
}
async function loadRoom(tx, code) {
  const room = await tx.get(ROOMS, code);
  if (!room) throw new RuleError("\u623F\u95F4\u4E0D\u5B58\u5728");
  return room;
}
function requireHost(room, openid) {
  if (room.host !== openid) throw new RuleError("\u53EA\u6709\u623F\u4E3B\u53EF\u4EE5\u8FD9\u6837\u505A");
}
function requireLobby(room) {
  if (room.status !== "lobby") throw new RuleError("\u6E38\u620F\u5DF2\u7ECF\u5F00\u59CB");
}
async function createRoom(tx, openid, profile, now, rng) {
  const me = checkProfile(profile);
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = String(1e3 + Math.floor(rng.next() * 9e3));
    const existing = await tx.get(ROOMS, code);
    if (existing) {
      const active = existing.status !== "ended" && now - existing.updatedAt <= STALE_MS;
      const recentlyEnded = existing.status === "ended" && now - existing.updatedAt <= ENDED_GRACE_MS;
      if (active || recentlyEnded) continue;
    }
    const room = {
      code,
      host: openid,
      status: "lobby",
      seats: [{ openid, ...me }],
      view: null,
      deadline: null,
      gameId: null,
      updatedAt: now
    };
    await tx.set(ROOMS, code, room);
    return { code, openid };
  }
  throw new RuleError("\u6682\u65F6\u6CA1\u6709\u7A7A\u95F2\u7684\u623F\u95F4\u53F7\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
}
async function joinRoom(tx, code, openid, profile, now) {
  const room = await loadRoom(tx, code);
  const seat = room.seats.find((s) => s.openid === openid);
  if (seat) {
    if (room.status !== "lobby") return { code, openid };
    const me = checkProfile(profile);
    seat.name = me.name;
    seat.avatar = me.avatar;
  } else {
    if (room.status === "ended") throw new RuleError("\u623F\u95F4\u5DF2\u7ED3\u675F");
    if (room.status !== "lobby") throw new RuleError("\u6E38\u620F\u5DF2\u7ECF\u5F00\u59CB\uFF0C\u4E0D\u80FD\u52A0\u5165");
    if (room.seats.length >= MAX_PLAYERS) throw new RuleError("\u623F\u95F4\u5DF2\u6EE1");
    const me = checkProfile(profile);
    room.seats.push({ openid, ...me });
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return { code, openid };
}
async function leaveRoom(tx, code, openid, now) {
  const room = await loadRoom(tx, code);
  if (room.status === "ended") throw new RuleError("\u623F\u95F4\u5DF2\u7ED3\u675F");
  requireLobby(room);
  if (!room.seats.some((s) => s.openid === openid)) throw new RuleError("\u4F60\u4E0D\u5728\u8FD9\u4E2A\u623F\u95F4\u91CC");
  room.seats = room.seats.filter((s) => s.openid !== openid);
  const humans = room.seats.filter((s) => !isBot(s.openid));
  if (humans.length === 0) {
    room.status = "ended";
  } else if (room.host === openid) {
    room.host = humans[0].openid;
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}
async function reorderSeats(tx, code, openid, order, now) {
  const room = await loadRoom(tx, code);
  requireHost(room, openid);
  requireLobby(room);
  const current = room.seats.map((s) => s.openid);
  const valid = Array.isArray(order) && order.length === current.length && new Set(order).size === order.length && order.every((o) => current.includes(o));
  if (!valid) throw new RuleError("\u5EA7\u4F4D\u987A\u5E8F\u65E0\u6548");
  room.seats = order.map((o) => room.seats.find((s) => s.openid === o));
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}
async function addBots(tx, code, openid, count, now) {
  const room = await loadRoom(tx, code);
  requireHost(room, openid);
  requireLobby(room);
  let n = room.seats.filter((s) => s.openid.startsWith(BOT_PREFIX)).length;
  for (let i = 0; i < count && room.seats.length < MAX_PLAYERS; i++) {
    n++;
    room.seats.push({ openid: `${BOT_PREFIX}${n}`, name: `\u673A\u5668\u4EBA${n}`, avatar: "" });
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}

// src/validate.ts
function fail() {
  throw new RuleError("\u64CD\u4F5C\u53C2\u6570\u65E0\u6548");
}
function isSeat(v, playerCount) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < playerCount;
}
function isNonNegInt(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}
function isBoundedString(v, maxLen, minLen = 1) {
  return typeof v === "string" && v.length >= minLen && v.length <= maxLen;
}
function targets(v, playerCount) {
  if (!Array.isArray(v) || v.length < 1 || v.length > 2) fail();
  for (const t of v) if (!isSeat(t, playerCount)) fail();
  return v;
}
function idList(v, min, max) {
  if (!Array.isArray(v) || v.length < min || v.length > max) fail();
  for (const id of v) if (!isBoundedString(id, 64)) fail();
  return v;
}
function parseClientAction(raw, playerCount) {
  const r = raw ?? {};
  switch (r.type) {
    case "draw":
      return { type: "draw" };
    case "endTurn":
      return { type: "endTurn" };
    case "play": {
      if (!isBoundedString(r.cardId, 64)) fail();
      const ts = targets(r.targets, playerCount);
      const action = { type: "play", cardId: r.cardId, targets: ts };
      if (r.option !== void 0) {
        if (!isBoundedString(r.option, 64, 0)) fail();
        action.option = r.option;
      }
      return action;
    }
    case "revealTryal": {
      if (!isBoundedString(r.tryalId, 64)) fail();
      return { type: "revealTryal", tryalId: r.tryalId };
    }
    case "witchVote": {
      if (!isSeat(r.target, playerCount)) fail();
      return { type: "witchVote", target: r.target };
    }
    case "protect": {
      if (!isSeat(r.target, playerCount)) fail();
      return { type: "protect", target: r.target };
    }
    case "confess": {
      if (r.silent === true) {
        if (r.tryalId !== null) fail();
        return { type: "confess", tryalId: null, silent: true };
      }
      if (r.silent !== void 0 && r.silent !== false) fail();
      if (r.tryalId === null) return { type: "confess", tryalId: null };
      if (!isBoundedString(r.tryalId, 64)) fail();
      return { type: "confess", tryalId: r.tryalId };
    }
    case "conspiracyPick": {
      if (!isNonNegInt(r.index)) fail();
      return { type: "conspiracyPick", index: r.index };
    }
    case "pickCharacter": {
      const index = r.index === 0 ? 0 : r.index === 1 ? 1 : fail();
      return { type: "pickCharacter", index };
    }
    case "priestDraw":
      return { type: "priestDraw", cardIds: idList(r.cardIds, 1, 2) };
    case "storyStart":
      return { type: "storyStart" };
    case "storyReorder":
      return { type: "storyReorder", order: idList(r.order, 0, TOTAL_GAME_CARDS) };
    default:
      fail();
  }
}

// src/game.ts
async function persist(tx, room, state, prev, now) {
  const key = deadlineKey(state);
  const deadline = prev && prev.deadlineKey === key ? prev.deadline : now + phaseDuration(state);
  const ended = state.phase.kind === "ended";
  const gameDoc = { state, deadlineKey: key, deadline };
  const roomDoc = {
    ...room,
    status: ended ? "ended" : "playing",
    view: projectPublic(state),
    deadline: ended ? null : deadline,
    updatedAt: now
  };
  await tx.set(GAMES, room.code, gameDoc);
  await tx.set(ROOMS, room.code, roomDoc);
  const gameId = room.gameId;
  for (const p of state.players) {
    if (isBot(p.openid)) continue;
    const hand = { _openid: p.openid, roomId: room.code, gameId, view: projectPrivate(state, p.seat) };
    await tx.set(HANDS, handId(room.code, p.openid), hand);
  }
}
async function loadGame(tx, code) {
  const game = await tx.get(GAMES, code);
  if (!game) throw new RuleError("\u6E38\u620F\u6570\u636E\u4E0D\u5B58\u5728");
  return game;
}
async function startGame(tx, code, openid, now, rng) {
  const room = await loadRoom(tx, code);
  if (room.host !== openid) throw new RuleError("\u53EA\u6709\u623F\u4E3B\u53EF\u4EE5\u5F00\u59CB\u6E38\u620F");
  if (room.status !== "lobby") throw new RuleError("\u6E38\u620F\u5DF2\u7ECF\u5F00\u59CB");
  if (room.seats.length < MIN_PLAYERS) throw new RuleError(`\u81F3\u5C11\u9700\u8981 ${MIN_PLAYERS} \u540D\u73A9\u5BB6`);
  let state = createGame(
    room.seats.map((s) => ({ openid: s.openid, name: s.name })),
    rng
  );
  if (state.phase.kind === "characterPick") {
    for (const p of state.players) {
      if (isBot(p.openid)) state = apply(state, { type: "pickCharacter", seat: p.seat, index: rng.next() < 0.5 ? 0 : 1 }, rng);
    }
  }
  await persist(tx, { ...room, gameId: `${code}-${now}` }, state, null, now);
  return { version: state.version };
}
async function act(tx, code, openid, rawAction, expectedVersion, now, rng) {
  const room = await loadRoom(tx, code);
  if (room.status !== "playing") throw new RuleError("\u6E38\u620F\u6CA1\u6709\u5728\u8FDB\u884C");
  const game = await loadGame(tx, code);
  if (expectedVersion !== void 0 && expectedVersion !== game.state.version) {
    throw new RuleError("\u72B6\u6001\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u8BD5");
  }
  const seat = game.state.players.findIndex((p) => p.openid === openid);
  if (seat < 0) throw new RuleError("\u4F60\u4E0D\u5728\u8FD9\u5C40\u6E38\u620F\u4E2D");
  const action = parseClientAction(rawAction, game.state.players.length);
  const next = apply(game.state, { ...action, seat }, rng);
  await persist(tx, room, next, game, now);
  return { version: next.version };
}
async function tick(tx, code, now, rng) {
  const room = await loadRoom(tx, code);
  if (room.status !== "playing") return { changed: false };
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

// src/handler.ts
function checkCode(code) {
  if (typeof code !== "string" || !/^\d{4}$/.test(code)) throw new RuleError("\u623F\u95F4\u53F7\u65E0\u6548");
  return code;
}
async function handle(store2, openid, input, now, rng) {
  if (!openid) return { ok: false, error: "\u672A\u767B\u5F55" };
  const req = input ?? {};
  try {
    const data = await store2.transaction(async (tx) => {
      switch (req.type) {
        case "createRoom":
          return createRoom(tx, openid, req.profile, now, rng);
        case "joinRoom":
          return joinRoom(tx, checkCode(req.code), openid, req.profile, now);
        case "leaveRoom":
          return leaveRoom(tx, checkCode(req.code), openid, now);
        case "reorderSeats":
          return reorderSeats(tx, checkCode(req.code), openid, req.order, now);
        case "addBots":
          return addBots(tx, checkCode(req.code), openid, Number(req.count) || 0, now);
        case "startGame":
          return startGame(tx, checkCode(req.code), openid, now, rng);
        case "act":
          return act(tx, checkCode(req.code), openid, req.action, req.version, now, rng);
        case "tick":
          return tick(tx, checkCode(req.code), now, rng);
        default:
          throw new RuleError("\u672A\u77E5\u8BF7\u6C42");
      }
    });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "\u670D\u52A1\u5668\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" };
  }
}

// src/wxStore.ts
var NOT_FOUND = /does not exist|DOCUMENT_NOT_EXIST|-502004/i;
function errorText(e) {
  const err = e;
  return [err == null ? void 0 : err.errCode, err == null ? void 0 : err.errMsg, err == null ? void 0 : err.message, String(e)].filter((x) => x !== void 0).join(" ");
}
function wxStore(db) {
  return {
    async transaction(fn) {
      let thrown = void 0;
      try {
        return await db.runTransaction(async (t) => {
          thrown = void 0;
          const tx = {
            async get(collection, id) {
              try {
                const res = await t.collection(collection).doc(id).get();
                const { _id, ...rest } = res.data;
                return rest;
              } catch (e) {
                if (NOT_FOUND.test(errorText(e))) return null;
                throw e;
              }
            },
            async set(collection, id, data) {
              await t.collection(collection).doc(id).set({ data });
            }
          };
          try {
            return await fn(tx);
          } catch (e) {
            thrown = e;
            throw e;
          }
        });
      } catch (e) {
        throw thrown ?? e;
      }
    }
  };
}

// src/index.ts
import_wx_server_sdk.default.init({ env: import_wx_server_sdk.default.DYNAMIC_CURRENT_ENV });
var store = wxStore(import_wx_server_sdk.default.database());
async function main(event) {
  const { OPENID } = import_wx_server_sdk.default.getWXContext();
  return handle(store, OPENID, event, Date.now(), mathRng);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
