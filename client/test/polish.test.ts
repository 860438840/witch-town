import { describe, expect, it } from 'vitest';
import { alpha, C } from '../src/theme/palette';
import { rect } from '../src/core/geom';
import { drawButton, drawPanel, drawPressShade, drawText, type ButtonStyle } from '../src/theme/draw';
import { ScrollBox, sheet } from '../src/scenes/widgets';
import { fakeCtx } from './fakes';
import { projectPublic } from '../../engine/src/index';
import { RULES } from '../src/model/rules';
import { HomeScene } from '../src/scenes/home';
import { LobbyScene } from '../src/scenes/lobby';
import { ResultScene } from '../src/scenes/result';
import { TableScene } from '../src/scenes/table';
import { drawCell } from '../src/scenes/tableParts';
import { drawNodes, type Node } from '../src/core/node';
import { buildTable, phaseTitle } from '../src/model/table';
import { handOf, lobbyRoom, newState, roomOf } from './fixtures';
import { fakeCtl, fakeUi, SCREEN, tap } from './sceneKit';

/** 画某段文字时生效的字体（所有出现处） */
function fontsOf(ops: string[], text: string): string[] {
  const out: string[] = [];
  let font = '';
  for (const o of ops) {
    if (o.startsWith('font=')) font = o.slice(5);
    if (o === `fillText:${text}`) out.push(font);
  }
  return out;
}

const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,(0|1|0?\.\d+)\))$/;

describe('调色板：酒红金线', () => {
  it('面板、按钮、文字的新颜色都在，格式合法', () => {
    for (const k of ['panelBigTop', 'panelBigBottom', 'panelTop', 'panelBottom', 'buttonTop', 'buttonBottom', 'buttonFill', 'dangerText', 'greyLine'] as const) {
      expect(C[k], k).toMatch(COLOR);
    }
  });
  it('调色板里所有颜色格式都合法', () => {
    for (const [k, v] of Object.entries(C)) expect(v, k).toMatch(COLOR);
  });
});

describe('文字：衬线选项', () => {
  it('serif 用标题字体，默认仍是无衬线', () => {
    const { ctx, ops } = fakeCtx();
    drawText(ctx, '标题', 0, 0, { size: 17, serif: true });
    drawText(ctx, '正文', 0, 0, { size: 13 });
    expect(fontsOf(ops, '标题')).toEqual(['bold 17px serif']);
    expect(fontsOf(ops, '正文')).toEqual(['13px sans-serif']);
  });
  it('滚动列表里的衬线行，量宽和绘制用同一种字体', () => {
    const { ctx, ops } = fakeCtx();
    new ScrollBox().node('l', rect(0, 0, 200, 100), [{ text: '小标题', size: 15, serif: true }]).draw!(ctx);
    const fonts = ops.filter((o) => o.startsWith('font='));
    expect(fonts.length).toBeGreaterThan(0);
    expect(new Set(fonts)).toEqual(new Set(['font=bold 15px serif']));
    expect(fontsOf(ops, '小标题')).toEqual(['bold 15px serif']);
  });
});

const count = (ops: string[], name: string): number => ops.filter((o) => o === name).length;

describe('面板分档', () => {
  it('普通面板：一次填充、一条 1px 暗金线', () => {
    const { ctx, ops } = fakeCtx();
    drawPanel(ctx, rect(0, 0, 200, 80));
    expect(count(ops, 'fill')).toBe(1);
    expect(count(ops, 'stroke')).toBe(1);
    expect(ops).toContain(`strokeStyle=${C.goldDark}`);
    expect(ops).toContain('lineWidth=1');
    expect(ops).toContain('fillStyle=[object]');
  });
  it('信息条外观同普通面板', () => {
    const a = fakeCtx();
    const b = fakeCtx();
    drawPanel(a.ctx, rect(0, 0, 200, 40));
    drawPanel(b.ctx, rect(0, 0, 200, 40), { tier: 'strip' });
    expect(b.ops).toEqual(a.ops);
  });
  it('大面板：1.5px 金线、内金线、顶部菱形', () => {
    const { ctx, ops } = fakeCtx();
    drawPanel(ctx, rect(0, 0, 200, 80), { tier: 'big' });
    expect(count(ops, 'stroke')).toBe(2);
    expect(ops).toContain(`strokeStyle=${C.goldLine}`);
    expect(ops).toContain('lineWidth=1.5');
    expect(ops).toContain(`strokeStyle=${alpha(C.gold, 0.28)}`);
    expect(count(ops, 'fill')).toBe(2);
    expect(ops).toContain(`fillStyle=${C.gold}`);
  });
  it('窄于 120 的大面板不画菱形', () => {
    const { ctx, ops } = fakeCtx();
    drawPanel(ctx, rect(0, 0, 100, 80), { tier: 'big' });
    expect(count(ops, 'fill')).toBe(1);
    expect(count(ops, 'stroke')).toBe(2);
  });
  it('tint 叠在底色上，fill 整个替换底色，stroke 和 lineWidth 覆盖默认', () => {
    const t = fakeCtx();
    drawPanel(t.ctx, rect(0, 0, 200, 80), { tint: 'rgba(1,2,3,0.5)' });
    expect(count(t.ops, 'fill')).toBe(2);
    expect(t.ops).toContain('fillStyle=rgba(1,2,3,0.5)');
    const f = fakeCtx();
    drawPanel(f.ctx, rect(0, 0, 200, 80), { fill: C.transparent, stroke: C.danger, lineWidth: 2 });
    expect(f.ops).toContain(`fillStyle=${C.transparent}`);
    expect(f.ops).not.toContain('fillStyle=[object]');
    expect(f.ops).toContain(`strokeStyle=${C.danger}`);
    expect(f.ops).toContain('lineWidth=2');
  });
});

/** 画某段文字时的填充色 */
function colorOf(ops: string[], text: string): string {
  let color = '';
  for (const o of ops) {
    if (o.startsWith('fillStyle=')) color = o.slice(10);
    if (o === `fillText:${text}`) return color;
  }
  throw new Error(`没画 ${text}`);
}

describe('按钮', () => {
  const draw = (kind: ButtonStyle) => {
    const { ctx, ops } = fakeCtx();
    drawButton(ctx, rect(0, 0, 120, 44), '确定', kind);
    return ops;
  };
  it('主要：渐变底、金线加内金线、金色衬线字', () => {
    const ops = draw('primary');
    expect(ops).toContain('fillStyle=[object]');
    expect(ops).toContain(`strokeStyle=${C.gold}`);
    expect(ops).toContain('lineWidth=1.5');
    expect(ops).toContain(`strokeStyle=${alpha(C.gold, 0.35)}`);
    expect(count(ops, 'stroke')).toBe(2);
    expect(colorOf(ops, '确定')).toBe(C.gold);
    expect(fontsOf(ops, '确定')).toEqual(['bold 15px serif']);
  });
  it('次要：深红半透明底、金线加淡内线', () => {
    const ops = draw('secondary');
    expect(ops).toContain(`fillStyle=${C.buttonFill}`);
    expect(ops).toContain(`strokeStyle=${alpha(C.gold, 0.25)}`);
    expect(count(ops, 'stroke')).toBe(2);
    expect(colorOf(ops, '确定')).toBe(C.gold);
  });
  it('危险：红线，没有内线，亮红字', () => {
    const ops = draw('danger');
    expect(ops).toContain(`strokeStyle=${C.danger}`);
    expect(count(ops, 'stroke')).toBe(1);
    expect(colorOf(ops, '确定')).toBe(C.dangerText);
  });
  it('不可用：灰线，没有内线，灰字', () => {
    const ops = draw('disabled');
    expect(ops).toContain(`strokeStyle=${C.greyLine}`);
    expect(count(ops, 'stroke')).toBe(1);
    expect(colorOf(ops, '确定')).toBe(C.textMuted);
    expect(fontsOf(ops, '确定')).toEqual(['bold 15px serif']);
  });
});

function opsOf(nodes: Node[]): string[] {
  const { ctx, ops } = fakeCtx();
  drawNodes(ctx, nodes);
  return ops;
}

const CELL = { turn: false, glow: 0, targetable: false, order: 0, alpha: 1, flip: null, partner: false };

describe('格子状态', () => {
  it('出局的格子是灰线', () => {
    const s = newState(5);
    s.players[1].alive = false;
    const { ctx, ops } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), projectPublic(s).players[1], CELL);
    expect(ops).toContain(`strokeStyle=${C.greyLine}`);
  });
  it('轮到的格子是 2px 金线加发光', () => {
    const s = newState(5);
    const { ctx, ops } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), projectPublic(s).players[1], { ...CELL, turn: true, glow: 0.8 });
    expect(ops).toContain(`strokeStyle=${C.gold}`);
    expect(ops).toContain('lineWidth=2');
    expect(ops).toContain('shadowBlur=12');
  });
  it('可选目标的格子叠一层淡金', () => {
    const s = newState(5);
    const { ctx, ops } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), projectPublic(s).players[1], { ...CELL, targetable: true });
    expect(count(ops, 'fill')).toBeGreaterThanOrEqual(2);
    expect(ops.some((o) => o.startsWith('fillStyle=rgba(232,199,116,'))).toBe(true);
  });
});

describe('衬线标题的位置', () => {
  it('首页标题', () => {
    const ui = fakeUi(fakeCtl());
    expect(fontsOf(opsOf(new HomeScene(ui).build(0)), '女巫镇')).toEqual(['bold 46px serif']);
  });
  it('规则页小标题是衬线，正文不是', () => {
    const ui = fakeUi(fakeCtl());
    const sc = new HomeScene(ui);
    tap(sc.build(0), 'rules');
    const ops = opsOf(sc.build(0));
    expect(fontsOf(ops, RULES[0].title)[0]).toMatch(/serif$/);
    expect(fontsOf(ops, RULES[0].title)[0]).not.toMatch(/sans-serif$/);
  });
  it('大厅房间号', () => {
    const room = lobbyRoom(6);
    const ui = fakeUi(fakeCtl({ room }));
    expect(fontsOf(opsOf(new LobbyScene(ui).build(0)), room.code)).toEqual(['bold 46px serif']);
  });
  it('弹窗标题和大面板', () => {
    const ops = opsOf(sheet(SCREEN, 300, '弹窗标题', null).nodes);
    expect(fontsOf(ops, '弹窗标题')).toEqual(['bold 17px serif']);
    expect(ops).toContain(`strokeStyle=${alpha(C.gold, 0.28)}`);
  });
  it('牌桌顶栏阶段标题', () => {
    const s = newState(5);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' });
    const ui = fakeUi(ctl);
    const title = phaseTitle(buildTable(ctl.room!, ctl.hand, 'u0')!);
    expect(fontsOf(opsOf(new TableScene(ui).build(0)), title)).toContain('bold 15px serif');
  });
  it('出局玩家的底栏描边是灰线', () => {
    const s = newState(5);
    s.players[0].alive = false;
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' });
    const ops = opsOf(new TableScene(fakeUi(ctl)).build(0));
    expect(ops).toContain(`strokeStyle=${C.greyLine}`);
  });
  it('提示行底下有条形面板', () => {
    const s = newState(5);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' });
    const ops = opsOf(new TableScene(fakeUi(ctl)).build(0));
    // 夜晚时提示行文字就是阶段标题；顶栏里也有一份，取最后一处（提示行是最后画的节点）
    const i = ops.lastIndexOf('fillText:' + phaseTitle(buildTable(ctl.room!, ctl.hand, 'u0')!));
    expect(i).toBeGreaterThan(0);
    const prevText = ops.slice(0, i).map((o, k) => (o.startsWith('fillText:') ? k : -1)).filter((k) => k >= 0).pop() ?? -1;
    expect(ops.slice(prevText + 1, i)).toContain('stroke');
  });
  it('结算标题', () => {
    const s = newState(6);
    s.phase = { kind: 'ended', winner: 'village' };
    const ui = fakeUi(fakeCtl({ room: roomOf(s) }));
    const ops = opsOf(new ResultScene(ui).build(0));
    expect(ops.some((o) => o === 'font=bold 36px serif')).toBe(true);
  });
});

describe('酒红底上的红字用亮红', () => {
  it('结算页女巫阵营那行', () => {
    const s = newState(6);
    s.phase = { kind: 'ended', winner: 'village' };
    const ui = fakeUi(fakeCtl({ room: roomOf(s) }));
    const ops = opsOf(new ResultScene(ui).build(0));
    const line = ops.find((o) => o.startsWith('fillText:女巫阵营 · '));
    expect(line).toBeDefined();
    expect(colorOf(ops, line!.slice(9))).toBe(C.dangerText);
  });
  it('格子上的同伴标签', () => {
    const s = newState(5);
    const { ctx, ops } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), projectPublic(s).players[1], { ...CELL, partner: true });
    expect(colorOf(ops, '同伴')).toBe(C.dangerText);
  });
});

describe('按下效果用的暗色与遮罩', () => {
  it('drawPressShade 用调色板里的按下暗色', () => {
    const { ctx, ops } = fakeCtx();
    drawPressShade(ctx, rect(0, 0, 50, 20));
    expect(ops).toContain(`fillStyle=${C.pressShade}`);
    expect(ops).toContain('fill');
  });
  it('弹窗的遮罩和底板不显示按下效果', () => {
    const { nodes } = sheet(SCREEN, 300, '标题', null);
    expect(nodes.find((n) => n.id === 'overlay')?.noPress).toBe(true);
    expect(nodes.find((n) => n.id === 'sheet')?.noPress).toBe(true);
  });
});

describe('格子动效', () => {
  const firstMoveX = (calls: [string, unknown[]][]): number => calls.find(([n]) => n === 'moveTo')![1][0] as number;
  it('晃动只改画的位置', () => {
    const p = projectPublic(newState(5)).players[1];
    const a = fakeCtx();
    drawCell(a.ctx, rect(0, 0, 83, 88), p, CELL);
    const b = fakeCtx();
    drawCell(b.ctx, rect(0, 0, 83, 88), p, { ...CELL, shake: 3 });
    expect(firstMoveX(b.calls) - firstMoveX(a.calls)).toBeCloseTo(3);
  });
  it('闪光叠在格子上', () => {
    const p = projectPublic(newState(5)).players[1];
    const { ctx, ops } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), p, { ...CELL, flash: 'rgba(1,2,3,0.4)' });
    expect(ops).toContain('fillStyle=rgba(1,2,3,0.4)');
  });
  it('出局印章：盖到一半时放大约 1.3 倍，盖好后正常大小且有倾斜', () => {
    const s = newState(5);
    s.players[1].alive = false;
    const p = projectPublic(s).players[1];
    const half = fakeCtx();
    drawCell(half.ctx, rect(0, 0, 83, 88), p, { ...CELL, stamp: 0.5 });
    expect(half.calls).toContainEqual(['scale', [1.3, 1.3]]);
    const done = fakeCtx();
    drawCell(done.ctx, rect(0, 0, 83, 88), p, CELL);
    expect(done.calls).toContainEqual(['scale', [1, 1]]);
    expect(done.calls).toContainEqual(['rotate', [-0.12]]);
    expect(done.texts).toContain('出局');
  });
});
