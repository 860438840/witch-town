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
  buttonFill: 'rgba(0,0,0,0.25)',
  glowStrong: 'rgba(232,199,116,0.9)',
  lineDark: '#3b2d57',
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
