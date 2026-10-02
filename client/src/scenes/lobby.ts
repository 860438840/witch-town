import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { drawBadge, drawPanel, drawText } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { button, requestButton, skyNode, textNode } from './widgets';

const MAX = 12;
const MIN = 4;

export class LobbyScene implements Scene {
  constructor(private readonly ui: Ui) {}

  build(_now: number): Node[] {
    const { W, top, bottom } = this.ui.screen;
    const ctl = this.ui.ctl;
    const room = ctl.room;
    if (!room) return [];
    const isHost = room.host === ctl.openid;
    const busy = ctl.busy;
    const seats = room.seats;
    const nodes: Node[] = [skyNode(this.ui.screen, 0, 'lobby')];

    nodes.push({
      rect: rect(0, top, W, 90),
      draw: (ctx) => {
        drawText(ctx, '房间号', W / 2, top + 12, { size: 13, color: C.textDim, align: 'center' });
        drawText(ctx, room.code, W / 2, top + 54, { size: 46, serif: true, color: C.gold, align: 'center' });
      },
    });
    const half = (W - 24 - 10) / 2;
    nodes.push(
      button('copy', rect(12, top + 92, half, 38), '复制房号', () => this.ui.copy(room.code), 'secondary'),
      button('invite', rect(12 + half + 10, top + 92, half, 38), '邀请朋友', () =>
        this.ui.share(`${ctl.nickname ?? '朋友'} 邀请你来女巫镇 · 房间 ${room.code}`, `room=${room.code}`), 'secondary'),
      textNode(rect(12, top + 136, W - 24, 20), '把房号发到群里，朋友在首页输入就能加入', { size: 12, color: C.textDim, align: 'center' }),
    );

    const startY = bottom - 12 - 48;
    const rowY = startY - 8 - 40;
    const listTop = top + 164;
    const rowH = Math.min(46, (rowY - 8 - listTop) / Math.max(seats.length, 1));
    seats.forEach((s, i) => {
      const r = rect(12, listTop + i * rowH, W - 24, rowH - 4);
      const tags = [
        s.openid === room.host ? '房主' : '',
        s.openid.startsWith('bot-') ? '机器人' : '',
        s.openid === ctl.openid ? '我' : '',
      ].filter(Boolean);
      nodes.push({
        rect: r,
        draw: (ctx) => {
          drawPanel(ctx, r, { radius: 8 });
          drawBadge(ctx, r.x + 20, r.y + r.h / 2, Math.min(14, r.h / 2 - 3), s.name, i);
          drawText(ctx, `${i + 1}. ${s.name}`, r.x + 42, r.y + r.h / 2, { size: 14, maxWidth: r.w - 170 });
          if (tags.length) drawText(ctx, tags.join(' · '), r.x + r.w - (isHost ? 84 : 10), r.y + r.h / 2, { size: 11, color: C.gold, align: 'right' });
        },
      });
      if (isHost) {
        const bh = r.h - 8;
        if (i > 0) nodes.push(button(`seat-up:${i}`, rect(r.x + r.w - 76, r.y + 4, 34, bh), '↑', busy ? null : () => void ctl.moveSeat(i, -1), 'secondary'));
        if (i < seats.length - 1) nodes.push(button(`seat-down:${i}`, rect(r.x + r.w - 38, r.y + 4, 34, bh), '↓', busy ? null : () => void ctl.moveSeat(i, 1), 'secondary'));
      }
    });

    const leave = () => this.ui.confirm('离开房间？', '离开后可以用房号重新加入', () => void ctl.leaveRoom());
    if (isHost) {
      nodes.push(
        requestButton('leave', rect(12, rowY, half, 40), '离开', leave, busy, 'danger'),
        requestButton('add-bot', rect(12 + half + 10, rowY, half, 40), '加机器人', seats.length >= MAX ? null : () => void ctl.addBot(), busy, 'secondary'),
        requestButton('start', rect(12, startY, W - 24, 48), `开始游戏（${seats.length}/${MAX}）`, seats.length < MIN ? null : () => void ctl.startGame(), busy),
      );
    } else {
      nodes.push(
        requestButton('leave', rect(12, rowY, W - 24, 40), '离开', leave, busy, 'danger'),
        textNode(rect(12, startY, W - 24, 48), `等待房主开始…（${seats.length}/${MAX}）`, { size: 14, color: C.textDim, align: 'center' }),
      );
    }
    return nodes;
  }
}
