import { describe, expect, it } from 'vitest';
import { alpha, C } from '../src/theme/palette';
import { rect } from '../src/core/geom';
import { drawButton, drawPanel, drawText, type ButtonStyle } from '../src/theme/draw';
import { ScrollBox } from '../src/scenes/widgets';
import { fakeCtx } from './fakes';

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
