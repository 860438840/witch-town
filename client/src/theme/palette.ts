import type { CardColor } from '../model/cards';

export const C = {
  skyTop: '#3a2a5c',
  skyMid: '#1a1326',
  skyBottom: '#0d0a14',
  gold: '#e8c774',
  goldDark: '#b8913e',
  goldLine: '#d6a44a',
  text: '#e9dcb8',
  textDim: '#bfb2d6',
  textMuted: '#8a7fa3',
  panel: 'rgba(255,255,255,0.05)',
  panelSolid: '#221833',
  panelLine: '#4a3a6c',
  logBg: 'rgba(0,0,0,0.35)',
  danger: '#c0394d',
  moon: '#f1e3b3',
  overlay: 'rgba(8,5,14,0.72)',
  tryalHidden: '#2e2446',
  witch: '#b3263a',
  constable: '#c9a24a',
  villager: '#6b6384',
  star: '#ffffff',
  badgeText: '#fff',
  cardText: '#f3d9a0',
  badgeRing: 'rgba(232,199,116,0.7)',
  chipRevealedLine: 'rgba(255,255,255,0.4)',
  buttonDangerFill: 'rgba(192,57,77,0.25)',
  buttonFill: 'rgba(60,10,24,0.45)',
  glowStrong: 'rgba(232,199,116,0.9)',
  lineDark: '#3b2d57',
  // 酒红金线：大面板、普通面板、主按钮的上下渐变色
  panelBigTop: '#3a0d1c',
  panelBigBottom: '#1e0a14',
  panelTop: 'rgba(92,14,32,0.6)',
  panelBottom: 'rgba(34,6,16,0.78)',
  buttonTop: '#8a1c34',
  buttonBottom: '#4a0a18',
  /** 危险按钮的文字（比 danger 亮，压得住深色底） */
  dangerText: '#e5677a',
  /** 出局格子、不可用按钮的灰线 */
  greyLine: '#6b6378',
  transparent: 'rgba(0,0,0,0)',
} as const;

/** 夜色叠加层：alpha 通常取 0.55 * darkness */
export const nightShade = (alpha: number): string => `rgba(4,2,10,${alpha})`;

/** 金色发光：面板 glow 等需要可变透明度的金色场景 */
export const goldGlow = (alpha: number): string => `rgba(232,199,116,${alpha})`;

export const CARD_GRADIENT: Record<CardColor, [string, string]> = {
  red: ['#7a1428', '#4a0a18'],
  blue: ['#233d6e', '#142546'],
  green: ['#265a45', '#143528'],
  black: ['#2b2b2b', '#0e0e0e'],
};

const BADGE_COLORS = [
  '#8e3b5a', '#3b6e8e', '#5a8e3b', '#8e6a3b', '#6a3b8e', '#3b8e7a',
  '#8e3b3b', '#3b4a8e', '#7a8e3b', '#8e3b82', '#3b8e4a', '#8e5a3b',
];

export const badgeColor = (seat: number): string => BADGE_COLORS[((seat % 12) + 12) % 12];

export const font = (size: number, bold = false): string => `${bold ? 'bold ' : ''}${size}px sans-serif`;


/** 插画用色（剪影、羊皮纸、火焰、植物等），与上面的界面色同属一套调色板 */
export const INK = {
  ink: '#0d0a14',
  inkSoft: '#120c1c',
  townFar: '#251a3a',
  townNear: '#0f0a18',
  ground: '#0b0811',
  parchment: '#e3d3a8',
  parchmentDark: '#cdb98a',
  sepia: '#5a4020',
  sepiaDark: '#3a2614',
  brown: '#2b1d12',
  wood: '#3a2614',
  straw: '#b8913e',
  steel: '#cfc6dc',
  iron: '#9b93ad',
  wax: '#8e1a2c',
  wine: '#7a1428',
  wineDark: '#5a1020',
  leaf: '#3f6b4f',
  flameCore: '#fff1c4',
  lilac: '#bfb2d6',
  lilacText: '#d8cce8',
  portraitTop: '#5a4585',
  portraitBottom: '#241a38',
  backTop: '#2a1d44',
  backBottom: '#120c1e',
  poison: '#5d8a4a',
  poisonLight: '#a8d08d',
  dawnTop: '#4a3a6c',
  dawnMid: '#c97b4a',
  dawnLow: '#f0c27a',
  sun: '#ffd98a',
  bloodTop: '#2a0710',
  bloodMid: '#5a0f1c',
  bloodMoon: '#c0283a',
  white: '#ffffff',
  black: '#000000',
} as const;

/** 身份卡、角色卡的底色（上、下） */
export const FRAME_GRADIENT = {
  witch: ['#6e1424', '#2a0710'],
  constable: ['#6b5320', '#2e220a'],
  villager: ['#4a4560', '#221f30'],
  character: ['#3a2a5c', '#1a1326'],
  back: ['#2a1d44', '#120c1e'],
} as const satisfies Record<string, readonly [string, string]>;

/** 把 #rrggbb 转成带透明度的 rgba() */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 卡名、角色名用的衬线字体（手机自带） */
export const titleFont = (size: number): string => `bold ${size}px serif`;
