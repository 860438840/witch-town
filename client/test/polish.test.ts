import { describe, expect, it } from 'vitest';
import { C } from '../src/theme/palette';
import { rect } from '../src/core/geom';
import { drawText } from '../src/theme/draw';
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
