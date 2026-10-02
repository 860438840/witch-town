import { describe, expect, it } from 'vitest';
import { C } from '../src/theme/palette';

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
