import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { C } from '../theme/palette';
import { HomeScene } from './home';
import { LobbyScene } from './lobby';
import { TableScene } from './table';
import type { Ui } from './ui';
import { button, skyNode, textNode } from './widgets';

export class RootScene implements Scene {
  private readonly home: HomeScene;
  private readonly lobby: LobbyScene;
  private table: TableScene | null = null;
  private tableKey = '';

  constructor(private readonly ui: Ui) {
    this.home = new HomeScene(ui);
    this.lobby = new LobbyScene(ui);
  }

  build(now: number): Node[] {
    const ctl = this.ui.ctl;
    if (!ctl.code) return this.home.build(now);
    const room = ctl.room;
    if (!room) return this.message(`正在进入房间 ${ctl.code}…`, 'loading-home');
    if (!room.view) return room.status === 'lobby' ? this.lobby.build(now) : this.message('房间已关闭', 'closed-home');
    if (room.view.phase.kind === 'ended') return this.ended(now);
    return this.playing(now);
  }

  private playing(now: number): Node[] {
    const room = this.ui.ctl.room!;
    const key = `${room.code}:${room.gameId}`;
    if (!this.table || key !== this.tableKey) {
      this.table = new TableScene(this.ui);
      this.tableKey = key;
    }
    return this.table.build(now);
  }

  /** Task 8 替换为结算页 */
  private ended(_now: number): Node[] {
    return this.message('游戏结束', 'closed-home');
  }

  private message(text: string, id: string): Node[] {
    const { W, H } = this.ui.screen;
    return [
      skyNode(this.ui.screen, 0),
      textNode(rect(0, H * 0.42, W, 30), text, { size: 16, color: C.text, align: 'center' }),
      button(id, rect((W - 200) / 2, H * 0.42 + 50, 200, 44), '返回首页', () => this.ui.ctl.backHome(), 'secondary'),
    ];
  }
}
