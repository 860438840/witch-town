import { afterEach, describe, expect, it, vi } from 'vitest';
import { blit, setSurfaceFactory } from '../src/theme/art/cache';
import { crescent, ellipse, hatch, seeded } from '../src/theme/art/shapes';
import { alpha } from '../src/theme/palette';
import { fakeCtx, fakeSurfaces } from './fakes';
import { CHARACTERS, type CardKind, type TryalKind } from '../../engine/src/index';
import { CARD_INFO } from '../src/model/cards';
import { CHAR_INFO } from '../src/model/characters';
import { cardBack, cardFace, charCard, portrait, tryalFace } from '../src/theme/art/frames';
import { CARD_ICONS, CHAR_ICONS, TRYAL_ICONS } from '../src/theme/art/icons';
import { paintBackdrop, type Backdrop } from '../src/theme/art/scenes';
import { drawSky } from '../src/theme/draw';
import { rect } from '../src/core/geom';
import { drawBadge, drawCardFace, drawTryalChip } from '../src/theme/draw';
import { drawCell } from '../src/scenes/tableParts';
import { projectPublic } from '../../engine/src/index';
import { newState } from './fixtures';
import { RULES } from '../src/model/rules';
import { ScrollBox } from '../src/scenes/widgets';
import { findNode } from '../src/core/node';
import { buildTable } from '../src/model/table';
import { choicePanel } from '../src/scenes/choicePanels';
import { priestPanel } from '../src/scenes/abilityPanels';
import { TableScene } from '../src/scenes/table';
import { giveCard, handOf, roomOf, setDay } from './fixtures';
import { drawAll, fakeCtl, fakeUi, tap } from './sceneKit';
import type { Screen } from '../src/core/app';

afterEach(() => setSurfaceFactory(null));

describe('基础笔法', () => {
  it('alpha 把 #rrggbb 转成 rgba', () => {
    expect(alpha('#e8c774', 0.5)).toBe('rgba(232,199,116,0.5)');
  });
  it('固定种子的随机数每次一样', () => {
    const a = seeded(3);
    const b = seeded(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('弯月、椭圆、排线在假画布上能画完', () => {
    const { ctx } = fakeCtx();
    expect(() => {
      crescent(ctx, 50, 50, 20, 8, -4, '#fff');
      ellipse(ctx, 10, 10, 5, 3, 0.4);
      hatch(ctx, 0, 0, 40, 40, 0.7, 3, '#000', 1);
    }).not.toThrow();
  });
});

describe('隐藏画布缓存', () => {
  it('没有设置隐藏画布时每次直接画', () => {
    const paint = vi.fn();
    const { ctx } = fakeCtx();
    blit(ctx, 'x', 10, 10, paint, 0, 0);
    blit(ctx, 'x', 10, 10, paint, 0, 0);
    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('同一个 key 和尺寸只画一次；画布按像素比放大', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 3);
    const paint = vi.fn();
    const { ctx } = fakeCtx();
    blit(ctx, 'card:night', 58, 84, paint, 0, 0);
    blit(ctx, 'card:night', 58, 84, paint, 100, 0);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(created).toEqual([[174, 252]]);
    blit(ctx, 'card:night', 44, 64, paint, 0, 0);
    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('贴图宽度变化（翻牌动画）不重新画', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    for (const dw of [52, 30, 5]) blit(ctx, 'back', 52, 68, () => {}, 0, 0, dw, 68);
    expect(created).toHaveLength(1);
  });

  it('大图最多保留 2 张：画第 3 张后第 1 张要重画', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 1);
    const { ctx } = fakeCtx();
    for (const k of ['a', 'b', 'c', 'a']) blit(ctx, k, 375, 667, () => {}, 0, 0);
    expect(created).toHaveLength(4);
    blit(ctx, 'a', 375, 667, () => {}, 0, 0);
    expect(created).toHaveLength(4);
  });
});


const KINDS = Object.keys(CARD_INFO) as CardKind[];
const TRYALS: TryalKind[] = ['witch', 'constable', 'villager'];

describe('图标', () => {
  it('每种牌、身份、角色都有图标', () => {
    expect(Object.keys(CARD_ICONS).sort()).toEqual([...KINDS].sort());
    expect(Object.keys(TRYAL_ICONS).sort()).toEqual([...TRYALS].sort());
    expect(Object.keys(CHAR_ICONS).sort()).toEqual([...CHARACTERS].sort());
  });

  it('所有图标在各种尺寸下都能画完', () => {
    const { ctx } = fakeCtx();
    for (const s of [10, 40, 120]) {
      for (const f of [...Object.values(CARD_ICONS), ...Object.values(TRYAL_ICONS), ...Object.values(CHAR_ICONS)]) {
        expect(() => f(ctx, s / 2, s / 2, s)).not.toThrow();
      }
    }
  });
});

describe('卡框模板', () => {
  it('大卡面写牌名，迷你卡面（宽 < 40）不写字', () => {
    const big = fakeCtx();
    cardFace(big.ctx, 120, 168, 'blackCat');
    expect(big.texts).toContain('黑猫');
    const tiny = fakeCtx();
    cardFace(tiny.ctx, 28, 40, 'blackCat');
    expect(tiny.texts).toEqual([]);
  });

  it('红卡带点数，其他颜色不带', () => {
    const w = fakeCtx();
    cardFace(w.ctx, 58, 84, 'witness');
    expect(w.texts).toEqual(['目击', '7']);
    const b = fakeCtx();
    cardFace(b.ctx, 58, 84, 'asylum');
    expect(b.texts).toEqual(['避难']);
  });

  it('卡背、身份卡面、头像能画完', () => {
    const { ctx, texts } = fakeCtx();
    cardBack(ctx, 52, 68);
    cardBack(ctx, 14, 19);
    for (const t of TRYALS) tryalFace(ctx, 52, 68, t);
    for (const id of CHARACTERS) portrait(ctx, 24, id, '#8e3b5a');
    // 大力士的杠铃上画了「8」，所以头像里会有这一个字
    expect(texts).toEqual(['女巫', '警长', '村民', '8']);
  });

  it('角色卡写名字、技能说明；限次角色有「限 n 次」', () => {
    const p = fakeCtx();
    charCard(p.ctx, 160, 240, 'priest');
    const text = p.texts.join('');
    expect(text).toContain('牧师');
    expect(text).toContain('弃牌堆');
    expect(text).toContain('限 2 次');
    const j = fakeCtx();
    charCard(j.ctx, 160, 240, 'judge');
    expect(j.texts.join('')).not.toContain('限');
    expect(j.texts[0]).toBe(CHAR_INFO.judge.name);
  });
});


describe('场景', () => {
  const ALL: Backdrop[] = ['home', 'lobby', 'table', 'village', 'witch'];

  it('五种背景在大屏、小屏上都能画完', () => {
    const { ctx } = fakeCtx();
    for (const b of ALL) for (const [W, H] of [[375, 667], [320, 568]]) expect(() => paintBackdrop(ctx, W, H, b)).not.toThrow();
  });

  it('背景缓存：同一种背景只画一次；夜色叠加不进缓存', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    drawSky(ctx, 375, 667, 0, 'table');
    drawSky(ctx, 375, 667, 0.8, 'table');
    expect(created).toHaveLength(1);
    drawSky(ctx, 375, 667, 0, 'home');
    expect(created).toHaveLength(2);
  });
});


describe('接入游戏的绘制函数', () => {
  it('手牌：同一种牌同一尺寸只画一次', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    drawCardFace(ctx, rect(0, 0, 58, 84), 'night');
    drawCardFace(ctx, rect(70, 0, 58, 84), 'night', { selected: true });
    drawCardFace(ctx, rect(140, 0, 58, 84), 'night', { dim: true });
    expect(created).toHaveLength(1);
  });

  it('很小的身份卡（宽 < 16）保持颜色画法，不建隐藏画布；大的用卡面', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    drawTryalChip(ctx, rect(0, 0, 8, 11), 'witch', true);
    drawTryalChip(ctx, rect(0, 0, 8, 11), null, false);
    expect(created).toHaveLength(0);
    drawTryalChip(ctx, rect(0, 0, 52, 68), 'witch', true);
    drawTryalChip(ctx, rect(0, 0, 52, 68), null, false);
    expect(created).toHaveLength(2);
  });

  it('翻牌动画的不同进度复用同一张缓存', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    for (const sx of [1, 0.6, 0.2]) drawTryalChip(ctx, rect(0, 0, 52, 68), 'constable', true, sx);
    expect(created).toHaveLength(1);
  });

  it('头像：没有角色写名字首字；有角色画角色图标，不写字', () => {
    const a = fakeCtx();
    drawBadge(a.ctx, 10, 10, 9, '小明', 0);
    expect(a.texts).toEqual(['小']);
    const b = fakeCtx();
    drawBadge(b.ctx, 10, 10, 9, '小明', 0, 'judge');
    expect(b.texts).toEqual([]);
  });

  it('格子里面前的牌画成迷你卡面，不再写单字', () => {
    const s = newState(5);
    s.players[1].blue.push({ id: 'cat', kind: 'blackCat' });
    const p = projectPublic(s).players[1];
    const { ctx, texts } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), p, { turn: false, glow: 0, targetable: false, order: 0, alpha: 1, flip: null, partner: false });
    expect(texts).not.toContain('黑');
  });
});


describe('面板里的图标', () => {
  it('规则页：每种牌、每个角色的条目带图标', () => {
    const items = RULES.flatMap((s) => s.items);
    const cards = items.filter((i) => i.icon && 'card' in i.icon);
    const chars = items.filter((i) => i.icon && 'char' in i.icon);
    expect(cards).toHaveLength(15);
    expect(chars).toHaveLength(15);
  });

  it('带图标的行：文字往右缩进，内容照常画出', () => {
    const box = new ScrollBox();
    const node = box.node('x', rect(0, 0, 200, 300), [{ text: '黑猫：说明', icon: { card: 'blackCat' } }, { text: '法官：说明', icon: { char: 'judge' } }]);
    const { ctx, texts } = fakeCtx();
    node.draw!(ctx);
    expect(texts).toEqual(['黑猫：说明', '法官：说明']);
  });
});

describe('最终审查修复', () => {
  const SIZES: Screen[] = [
    { W: 320, H: 568, top: 64, bottom: 568 },
    { W: 375, H: 667, top: 60, bottom: 667 },
    { W: 414, H: 896, top: 92, bottom: 862 },
  ];

  it('选角色面板滑入时卡片尺寸不变：不会每帧新建隐藏画布', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 3);
    const s = newState(5);
    s.phase = { kind: 'characterPick' };
    s.characterOffers = { 0: ['judge', 'maid'], 1: ['priest', 'child'], 2: ['farmer', 'beggar'], 3: ['doctor', 'maiden'], 4: ['official', 'tailor'] };
    const ui = fakeUi(fakeCtl({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' }));
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    const st = { key: '', picked: null, suspect: null };
    drawAll(choicePanel(ui, m, st, 0, 1));
    const settled = created.length;
    for (const slide of [0.3, 0.45, 0.6, 0.8]) drawAll(choicePanel(ui, m, st, 0, slide));
    expect(created.length).toBe(settled);
  });

  it('牧师面板：弃牌堆里有全部 13 种非黑卡时，确认按钮仍在屏幕内', () => {
    const kinds = (Object.keys(CARD_INFO) as CardKind[]).filter((k) => CARD_INFO[k].color !== 'black');
    expect(kinds).toHaveLength(13);
    for (const sc of SIZES) {
      const s = newState(5);
      setDay(s, 0);
      s.players[0].character = 'priest';
      s.discard.push(...kinds.map((kind) => ({ id: `d-${kind}`, kind })));
      const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' });
      const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
      const r = findNode(priestPanel(fakeUi(ctl, sc), m, [], () => {}), 'confirm-priest')!.rect;
      expect(r.y + r.h).toBeLessThanOrEqual(sc.bottom);
    }
  });

  it('选中一张可打出的手牌后，信息栏仍显示这张牌的说明', () => {
    const s = newState(5);
    setDay(s, 0);
    const id = giveCard(s, 0, 'scapegoat');
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' });
    const scene = new TableScene(fakeUi(ctl));
    tap(scene.build(0), `card:${id}`);
    expect(drawAll(scene.build(0)).join('')).toContain(CARD_INFO.scapegoat.desc);
  });

  it('隐藏画布缓存有上限；被挤掉的画布会释放（width 设为 0）', () => {
    const { factory, canvases } = fakeSurfaces();
    setSurfaceFactory(factory, 1);
    const { ctx } = fakeCtx();
    for (let i = 0; i < 450; i++) blit(ctx, `k${i}`, 20, 30, () => {}, 0, 0);
    expect(canvases[0].width).toBe(0);
    expect(canvases.filter((c) => c.width > 0).length).toBeLessThanOrEqual(400);
    // 大图被挤掉时也释放
    const big = fakeSurfaces();
    setSurfaceFactory(big.factory, 1);
    for (const k of ['a', 'b', 'c']) blit(ctx, k, 375, 667, () => {}, 0, 0);
    expect(big.canvases[0].width).toBe(0);
    expect(big.canvases[2].width).toBeGreaterThan(0);
  });
});
