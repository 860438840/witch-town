import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { C } from '../theme/palette';
import { HomeScene } from './home';
import { LobbyScene } from './lobby';
import { ResultScene } from './result';
import { TableScene } from './table';
import type { Ui } from './ui';
import { button, skyNode, textNode } from './widgets';

export class RootScene implements Scene {
  private readonly home: HomeScene;
  private readonly lobby: LobbyScene;
  private readonly result: ResultScene;
  private table: TableScene | null = null;
  private tableKey = '';

  constructor(private readonly ui: Ui) {
    this.home = new HomeScene(ui);
    this.lobby = new LobbyScene(ui);
    this.result = new ResultScene(ui);
  }

  build(now: number): Node[] {
    const ctl = this.ui.ctl;
    if (!ctl.code) {
      // 回到首页就丢掉游戏桌；再进同一局时从新画面开始，不会把离开期间的变化当动效重放
      this.table = null;
      this.tableKey = '';
      return this.home.build(now);
    }
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

  private ended(now: number): Node[] {
    return this.result.build(now);
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
