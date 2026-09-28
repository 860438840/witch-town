import type { CardKind } from '../../../engine/src/index';
import type { Scene } from '../core/app';
import { rect, type Rect } from '../core/geom';
import type { Node } from '../core/node';
import {
  ALIBI_CHOICES,
  cardKindOf,
  optionNeed,
  playableCardIds,
  targetCount,
  targetOptions,
  type ClientAction,
} from '../model/actions';
import { CARD_INFO } from '../model/cards';
import { logLines } from '../model/log';
import { buildTable, formatCountdown, phaseTitle, type TableModel } from '../model/table';
import { drawCardFace, drawPanel, drawText } from '../theme/draw';
import { C } from '../theme/palette';
import { choicePanel, type ChoiceState } from './choicePanels';
import { detailPanel, logPanel, myTryalsPanel } from './infoPanels';
import { tableLayout, type TableLayout } from './tableLayout';
import { drawCell, drawMeBar, type CellOpts } from './tableParts';
import type { Ui } from './ui';
import { button, ScrollBox, sheet, skyNode } from './widgets';

const TWO_TARGET_HINT = ['先选被拿走的人', '再选接收的人'];

/** 动效参数；Task 9 之前全部是静态值 */
export interface AnimState {
  darkness: number;
  glow: number;
  cell(seat: number): Pick<CellOpts, 'alpha' | 'flip'>;
  cardIn(id: string): number;
  overlay: Node[];
  panelSlide: number;
}

export class TableScene implements Scene {
  protected sel: string | null = null;
  protected targets: number[] = [];
  protected option: string | undefined = undefined;
  protected askOption = false;
  protected peek: string | null = null;
  protected detail: number | null = null;
  protected mine = false;
  protected logOpen = false;
  protected readonly logBox = new ScrollBox();
  protected layout: TableLayout | null = null;
  protected readonly choice: ChoiceState = { key: '', picked: null, suspect: null };

  constructor(protected readonly ui: Ui) {}

  build(now: number): Node[] {
    const ctl = this.ui.ctl;
    const room = ctl.room;
    if (!room || !ctl.openid) return [];
    const m = buildTable(room, ctl.hand, ctl.openid);
    if (!m) return [];
    this.sync(m);
    const L = tableLayout(this.ui.screen, m.others.length);
    this.layout = L;
    const a = this.anim(m, now);
    const nodes: Node[] = [skyNode(this.ui.screen, a.darkness)];
    nodes.push(this.topBar(m, L.top, now));
    m.others.forEach((p, i) => nodes.push(this.cell(m, p.seat, L.grid[i], a)));
    nodes.push(this.logNode(m, L.log), this.meNode(m, L.me, a), this.infoNode(m, L.info));
    nodes.push(...this.handNodes(m, L.hand, a), ...this.buttonNodes(m, L.buttons));
    nodes.push(...a.overlay);
    nodes.push(...this.panels(m, now, a));
    return nodes;
  }

  /** 动效钩子（Task 9 覆盖为真正的动画） */
  protected anim(m: TableModel, _now: number): AnimState {
    return {
      darkness: m.view.phase.kind === 'night' ? 1 : 0,
      glow: 0.6,
      cell: (seat) => ({ alpha: m.view.players[seat]?.alive ? 1 : 0.4, flip: null }),
      cardIn: () => 1,
      overlay: [],
      panelSlide: 1,
    };
  }

  /** 叠在最上层的面板；需要做选择时优先显示选择面板 */
  protected panels(m: TableModel, now: number, a: AnimState): Node[] {
    const choice = choicePanel(this.ui, m, this.choice, now, a.panelSlide);
    if (choice.length) return choice;
    if (this.askOption) return this.optionSheet(m);
    if (this.detail !== null) return detailPanel(this.ui, m, this.detail, () => (this.detail = null));
    if (this.mine) return myTryalsPanel(this.ui, m, () => (this.mine = false));
    if (this.logOpen) return logPanel(this.ui, m, this.logBox, () => (this.logOpen = false));
    return [];
  }

  /** 某个座位在画面上的位置（我自己是信息栏）；给出牌飞行动画用 */
  protected seatRect(m: TableModel, seat: number): Rect | null {
    const L = this.layout;
    if (!L) return null;
    if (seat === m.mySeat) return L.me;
    const i = m.others.findIndex((p) => p.seat === seat);
    return i >= 0 ? L.grid[i] : null;
  }

  private sync(m: TableModel): void {
    if (this.sel && !playableCardIds(m).includes(this.sel)) this.clearSel();
    if (this.peek && !m.priv?.hand.some((c) => c.id === this.peek)) this.peek = null;
  }

  private clearSel(): void {
    this.sel = null;
    this.targets = [];
    this.option = undefined;
    this.askOption = false;
  }

  private selKind(m: TableModel): CardKind | null {
    return this.sel ? cardKindOf(m, this.sel) : null;
  }

  private topBar(m: TableModel, r: Rect, now: number): Node {
    return {
      rect: r,
      draw: (ctx) => {
        const cy = r.y + r.h / 2;
        drawText(ctx, phaseTitle(m), r.x, cy, { size: 15, bold: true, color: C.gold, maxWidth: r.w * 0.46 });
        const cd = formatCountdown(m.deadline, now);
        if (cd) drawText(ctx, cd, r.x + r.w * 0.6, cy, { size: 15, bold: true, color: m.pending ? C.gold : C.text, align: 'center' });
        drawText(ctx, `牌堆 ${m.view.deckCount} · 弃 ${m.view.discardCount}`, r.x + r.w, cy, { size: 11, color: C.textDim, align: 'right' });
      },
    };
  }

  private cell(m: TableModel, seat: number, r: Rect, a: AnimState): Node {
    const p = m.view.players[seat];
    const kind = this.selKind(m);
    const targetable = !!kind && targetOptions(m, kind, this.targets).includes(seat);
    const turn = m.view.phase.kind === 'day' && m.turnSeat === seat;
    const opts: CellOpts = { turn, glow: a.glow, targetable, order: this.targets.indexOf(seat) + 1, ...a.cell(seat) };
    return { id: `seat:${seat}`, rect: r, onTap: () => this.tapSeat(m, seat), draw: (ctx) => drawCell(ctx, r, p, opts) };
  }

  private tapSeat(m: TableModel, seat: number): void {
    const kind = this.selKind(m);
    if (!kind) {
      this.detail = seat;
      return;
    }
    if (this.targets.includes(seat)) {
      this.targets = this.targets.filter((t) => t !== seat);
      this.option = undefined;
      return;
    }
    const need = targetCount(kind);
    if (this.targets.length >= need || !targetOptions(m, kind, this.targets).includes(seat)) return;
    this.targets = [...this.targets, seat];
    if (this.targets.length === need) this.resolveOption(m, kind);
  }

  private resolveOption(m: TableModel, kind: CardKind): void {
    const need = optionNeed(m, kind, this.targets[0]);
    if (!need) return;
    if (need.kind === 'curse' && need.cards.length === 1) {
      this.option = need.cards[0].id;
      return;
    }
    this.askOption = true;
  }

  private ready(m: TableModel): boolean {
    const kind = this.selKind(m);
    if (!kind || this.targets.length !== targetCount(kind)) return false;
    return !optionNeed(m, kind, this.targets[0]) || this.option !== undefined;
  }

  private confirmPlay(): void {
    if (!this.sel) return;
    const action: ClientAction = {
      type: 'play',
      cardId: this.sel,
      targets: this.targets,
      ...(this.option !== undefined ? { option: this.option } : {}),
    };
    this.clearSel();
    void this.ui.ctl.act(action);
  }

  private logNode(m: TableModel, r: Rect): Node {
    const count = r.h >= 54 ? 3 : 2;
    const lines = logLines(m.view).slice(-count);
    return {
      id: 'log',
      rect: r,
      onTap: () => {
        this.logOpen = true;
        this.logBox.reset();
      },
      draw: (ctx) => {
        drawPanel(ctx, r, { fill: C.logBg, stroke: C.lineDark });
        const lh = (r.h - 8) / count;
        lines.forEach((t, i) =>
          drawText(ctx, t, r.x + 8, r.y + 4 + lh * (i + 0.5), { size: 11, color: i === lines.length - 1 ? C.text : C.textDim, maxWidth: r.w - 16 }),
        );
      },
    };
  }

  private meNode(m: TableModel, r: Rect, a: AnimState): Node {
    const kind = this.selKind(m);
    const me = m.mySeat;
    const targetable = me !== null && !!kind && targetOptions(m, kind, this.targets).includes(me);
    const order = me === null ? 0 : this.targets.indexOf(me) + 1;
    return {
      id: 'me',
      rect: r,
      onTap: () => {
        if (kind && me !== null) this.tapSeat(m, me);
        else if (!kind && m.priv) this.mine = true;
      },
      draw: (ctx) => drawMeBar(ctx, r, m, { targetable, order, glow: a.glow }),
    };
  }

  private infoText(m: TableModel): string {
    const kind = this.selKind(m);
    if (kind) {
      const name = CARD_INFO[kind].name;
      const need = targetCount(kind);
      if (this.targets.length < need) return need === 2 ? `「${name}」：${TWO_TARGET_HINT[this.targets.length]}` : `「${name}」：选择目标`;
      return this.ready(m) ? `「${name}」：点「确认出牌」` : `「${name}」：请选择选项`;
    }
    if (this.peek) {
      const k = cardKindOf(m, this.peek);
      if (k) return `${CARD_INFO[k].name}：${CARD_INFO[k].desc}`;
    }
    if (m.me && !m.me.alive) return '你已出局，可以继续观看';
    if (m.pending?.kind === 'turn') return m.pending.mode === 'choose' ? '你的回合：抽 2 张，或点一张手牌打出' : '可以继续出牌，或结束回合';
    if (m.view.phase.kind === 'day') return `等待 ${m.view.players[m.turnSeat].name} 行动…`;
    return phaseTitle(m);
  }

  private infoNode(m: TableModel, r: Rect): Node {
    const text = this.infoText(m);
    return { rect: r, draw: (ctx) => drawText(ctx, text, r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: C.gold, align: 'center', maxWidth: r.w }) };
  }

  private handNodes(m: TableModel, r: Rect, a: AnimState): Node[] {
    const hand = m.priv?.hand ?? [];
    if (!hand.length) {
      return [{ rect: r, draw: (ctx) => drawText(ctx, m.priv ? '没有手牌' : '', r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: C.textMuted, align: 'center' }) }];
    }
    const playable = playableCardIds(m);
    const ch = r.h - 12;
    const cw = Math.round(ch * 0.69);
    const n = hand.length;
    const step = n > 1 ? Math.min(cw + 6, (r.w - cw) / (n - 1)) : 0;
    const x0 = r.x + (r.w - (cw + step * (n - 1))) / 2;
    return hand.map((c, i) => {
      const lifted = c.id === this.sel;
      const p = a.cardIn(c.id);
      const cr = rect(x0 + step * i, r.y + (lifted ? 0 : 12) + (1 - p) * 40, cw, ch);
      return {
        id: `card:${c.id}`,
        rect: cr,
        onTap: () => this.tapCard(c.id, playable),
        draw: (ctx) => {
          ctx.globalAlpha = p;
          drawCardFace(ctx, cr, c.kind, { selected: lifted, dim: m.pending?.kind === 'turn' && !playable.includes(c.id) });
          ctx.globalAlpha = 1;
        },
      };
    });
  }

  private tapCard(id: string, playable: string[]): void {
    if (playable.includes(id)) {
      if (this.sel === id) this.clearSel();
      else {
        this.clearSel();
        this.sel = id;
        this.peek = null;
      }
      return;
    }
    this.peek = this.peek === id ? null : id;
  }

  private buttonNodes(m: TableModel, r: Rect): Node[] {
    const ctl = this.ui.ctl;
    const busy = ctl.busy;
    const half = (r.w - 10) / 2;
    if (this.sel) {
      return [
        button('cancel', rect(r.x, r.y, half, r.h), '取消', () => this.clearSel(), 'secondary'),
        button('confirm-play', rect(r.x + half + 10, r.y, half, r.h), '确认出牌', this.ready(m) && !busy ? () => this.confirmPlay() : null),
      ];
    }
    if (m.pending?.kind !== 'turn') return [];
    if (m.pending.mode === 'choose') return [button('draw', r, '抽 2 张', busy ? null : () => void ctl.act({ type: 'draw' }))];
    return [button('end-turn', r, '结束回合', busy ? null : () => void ctl.act({ type: 'endTurn' }), 'secondary')];
  }

  private optionSheet(m: TableModel): Node[] {
    const kind = this.selKind(m);
    const target = this.targets[0];
    const need = kind && target !== undefined ? optionNeed(m, kind, target) : null;
    if (!need) {
      this.askOption = false;
      return [];
    }
    const close = () => {
      this.askOption = false;
      this.targets = this.targets.slice(0, -1);
    };
    const title = need.kind === 'curse' ? '诅咒：丢弃哪张蓝卡？' : '辩护：丢弃哪种红卡？';
    const { nodes, body } = sheet(this.ui.screen, 280, title, close);
    const choices =
      need.kind === 'curse'
        ? need.cards.map((c) => ({ value: c.id, label: CARD_INFO[c.kind].name }))
        : ALIBI_CHOICES.map((c) => ({ value: c.value as string, label: c.label as string }));
    choices.forEach((c, i) =>
      nodes.push(
        button(`option:${c.value}`, rect(body.x, body.y + i * 52, body.w, 44), c.label, () => {
          this.option = c.value;
          this.askOption = false;
        }, 'secondary'),
      ),
    );
    return nodes;
  }
}
