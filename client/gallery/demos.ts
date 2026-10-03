import { App, type Screen } from '../src/core/app';
import type { Controller } from '../src/controller';
import { HomeScene } from '../src/scenes/home';
import { RootScene } from '../src/scenes/root';
import { TableScene } from '../src/scenes/table';
import type { Ui } from '../src/scenes/ui';
import { drawPressShade } from '../src/theme/draw';
import type { GameState } from '../../engine/src/index';
import { revealTryal } from '../../engine/src/death';
import { handOf, newState, roomOf, setDay } from '../test/fixtures';
import { busy, ctlFor, dpr } from './harness';

/** 每个时刻一块画布：先显示“之前”，点「重播」后切到“之后”，用真实的 App 循环播放动效；鼠标可以按按钮试按下效果 */
const SIZE: Screen = { W: 320, H: 568, top: 64, bottom: 568 };

interface Demo {
  title: string;
  /** 生成“之前”的状态 */
  before(): GameState;
  /** 在“之前”的状态上做改动，得到“之后” */
  change(s: GameState): void;
  scene?: 'table' | 'root';
}

const bump = (s: GameState) => (s.version += 1);
/** 还没翻开的女巫牌所在座位；找不到时退回座位 1（调用方再取它第一张未翻开的审判牌） */
const witchSeat = (s: GameState) => {
  const i = s.players.findIndex((p) => p.tryals.some((t) => t.kind === 'witch' && !t.revealed));
  return i < 0 ? 1 : i;
};

const DEMOS: Demo[] = [
  { title: '我抽牌', before: busy, change: (s) => s.players[0].hand.push({ id: 'd1', kind: 'evidence' }, { id: 'd2', kind: 'witness' }) },
  { title: '别人抽牌', before: busy, change: (s) => s.players[2].hand.push({ id: 'o1', kind: 'evidence' }, { id: 'o2', kind: 'evidence' }) },
  {
    title: '出牌（红卡）',
    before: busy,
    change: (s) => {
      s.players[1].hand.pop();
      s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [3] });
    },
  },
  { title: '受审', before: busy, change: (s) => s.log.push({ t: 'trial', target: 2, initiator: 1 }) },
  {
    title: '翻出女巫',
    before: busy,
    change: (s) => {
      const seat = witchSeat(s);
      const p = s.players[seat];
      const w = p.tryals.find((x) => x.kind === 'witch' && !x.revealed);
      // 真实对局里翻出女巫会在同一次操作里出局：用引擎的 revealTryal 得到同样的日志和状态
      if (w) return revealTryal(s, seat, w.id, 'trial');
      const t = p.tryals.find((x) => !x.revealed) ?? p.tryals[0];
      t.revealed = true;
    },
  },
  { title: '出局', before: busy, change: (s) => (s.players[3].alive = false) },
  {
    title: '入夜',
    before: busy,
    change: (s) => {
      s.phase = { kind: 'night' };
      s.night = { witchVotes: {}, protect: null, confessions: {} };
    },
  },
  {
    title: '结算页（含换界面）',
    scene: 'root',
    before: () => {
      const s = newState(6);
      setDay(s, 0);
      return s;
    },
    change: (s) => (s.phase = { kind: 'ended', winner: 'village' }),
  },
];

function stage(title: string, setup: (app: App, ui: Ui) => () => void): void {
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = Math.round(SIZE.W * dpr);
  c.height = Math.round(SIZE.H * dpr);
  c.style.width = `${SIZE.W}px`;
  c.style.height = `${SIZE.H}px`;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  const app = new App(ctx, SIZE, (cb) => requestAnimationFrame(() => cb()), () => performance.now(), drawPressShade);
  const pos = (e: MouseEvent) => [e.offsetX, e.offsetY] as const;
  c.addEventListener('mousedown', (e) => app.touchStart(...pos(e)));
  c.addEventListener('mousemove', (e) => e.buttons && app.touchMove(...pos(e)));
  c.addEventListener('mouseup', (e) => app.touchEnd(...pos(e)));
  c.addEventListener('mouseleave', () => app.touchCancel());
  const ui: Ui = { screen: SIZE, animator: app.animator, ctl: null as unknown as Controller, render: () => app.render(), prompt: () => {}, confirm: () => {}, copy: () => {}, share: () => {} };
  const replay = setup(app, ui);
  const btn = document.createElement('button');
  btn.textContent = `重播：${title}`;
  btn.onclick = replay;
  fig.append(c, btn);
  document.getElementById('demos')?.append(fig);
  replay();
}

for (const d of DEMOS) {
  stage(d.title, (app, ui) => () => {
    const s = d.before();
    const ctl = ctlFor({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' }) as Controller & { room: unknown; hand: unknown };
    (ui as { ctl: Controller }).ctl = ctl;
    app.setScene(d.scene === 'root' ? new RootScene(ui) : new TableScene(ui));
    setTimeout(() => {
      d.change(s);
      bump(s);
      ctl.room = roomOf(s);
      ctl.hand = handOf(s, 0);
      app.render();
    }, 700);
  });
}

stage('按钮按下（用鼠标按住首页按钮试试）', (app, ui) => () => {
  (ui as { ctl: Controller }).ctl = ctlFor({});
  app.setScene(new HomeScene(ui));
});
