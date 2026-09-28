import type { HandDoc, RoomDoc } from '../../server/src/types';
import type { ClientAction } from './model/actions';
import type { ApiResult } from './net/api';
import type { KeyStore } from './net/storage';

export const STALE_ERROR = '状态已变化，请重试';
export const LEAVE_ERRORS = ['房间不存在', '房间已结束', '你不在这个房间里'];

export interface SessionLike {
  room: RoomDoc | null;
  hand: HandDoc | null;
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
}

export interface TickerLike {
  update(deadline: number | null): void;
  stop(): void;
}

export interface ControllerDeps {
  api: { call<T = unknown>(data: Record<string, unknown>): Promise<ApiResult<T>> };
  store: KeyStore;
  openSession(code: string, openid: string, onChange: () => void): SessionLike;
  makeTicker(tick: () => Promise<unknown>): TickerLike;
  toast(msg: string): void;
  render(): void;
}

/** 应用状态与全部命令。场景只读它的属性、调用它的方法。 */
export class Controller {
  openid: string | null = null;
  code: string | null = null;
  busy = false;
  private session: SessionLike | null = null;
  private ticker: TickerLike | null = null;

  constructor(private readonly d: ControllerDeps) {}

  get nickname(): string | null {
    return this.d.store.nickname();
  }

  get room(): RoomDoc | null {
    return this.session?.room ?? null;
  }

  get hand(): HandDoc | null {
    return this.session?.hand ?? null;
  }

  setNickname(name: string): boolean {
    const n = name.trim();
    const len = [...n].length;
    if (len < 1 || len > 12) {
      this.d.toast('昵称需要 1–12 个字');
      return false;
    }
    this.d.store.setNickname(n);
    this.d.render();
    return true;
  }

  async createRoom(): Promise<void> {
    const r = await this.run<{ code: string; openid: string }>({ type: 'createRoom', profile: this.profile() });
    if (r) this.enter(r.code, r.openid);
  }

  async joinRoom(code: string): Promise<void> {
    if (!/^\d{4}$/.test(code)) {
      this.d.toast('请输入 4 位房间号');
      return;
    }
    const r = await this.run<{ code: string; openid: string }>({ type: 'joinRoom', code, profile: this.profile() });
    if (r) this.enter(r.code, r.openid);
  }

  async leaveRoom(): Promise<void> {
    if (!this.code) return;
    if (this.room?.status === 'lobby') await this.run({ type: 'leaveRoom', code: this.code });
    this.backHome();
  }

  async addBot(): Promise<void> {
    if (this.code) await this.run({ type: 'addBots', code: this.code, count: 1 });
  }

  async moveSeat(index: number, dir: -1 | 1): Promise<void> {
    const seats = this.room?.seats;
    const j = index + dir;
    if (!this.code || !seats || j < 0 || j >= seats.length) return;
    const order = seats.map((s) => s.openid);
    [order[index], order[j]] = [order[j], order[index]];
    await this.run({ type: 'reorderSeats', code: this.code, order });
  }

  async startGame(): Promise<void> {
    if (this.code) await this.run({ type: 'startGame', code: this.code });
  }

  async act(action: ClientAction): Promise<void> {
    if (!this.code) return;
    await this.run({ type: 'act', code: this.code, action, version: this.room?.view?.version });
  }

  backHome(): void {
    this.session?.stop();
    this.ticker?.stop();
    this.session = null;
    this.ticker = null;
    this.code = null;
    this.d.store.clearLastRoom();
    this.d.render();
  }

  onShow(): void {
    void this.session?.refresh();
  }

  private profile(): { name: string; avatar: string } {
    return { name: this.nickname ?? '', avatar: '' };
  }

  private enter(code: string, openid: string): void {
    this.session?.stop();
    this.ticker?.stop();
    this.code = code;
    this.openid = openid;
    this.d.store.setLastRoom(code);
    this.ticker = this.d.makeTicker(() => this.d.api.call({ type: 'tick', code }));
    this.session = this.d.openSession(code, openid, () => this.onRoomChange());
    this.session.start();
    this.d.render();
  }

  private onRoomChange(): void {
    const room = this.room;
    this.ticker?.update(room?.status === 'playing' ? room.deadline : null);
    if (room && !room.seats.some((s) => s.openid === this.openid)) {
      this.d.toast('你已不在这个房间里');
      this.backHome();
      return;
    }
    if (room?.status === 'ended') this.d.store.clearLastRoom();
    this.d.render();
  }

  private async run<T>(req: Record<string, unknown>): Promise<T | null> {
    if (this.busy) return null;
    this.busy = true;
    this.d.render();
    try {
      const res = await this.d.api.call<T>(req);
      if (res.ok) return res.data;
      if (res.error === STALE_ERROR) {
        void this.session?.refresh();
        return null;
      }
      this.d.toast(res.error);
      if (LEAVE_ERRORS.includes(res.error) && this.code) this.backHome();
      return null;
    } finally {
      this.busy = false;
      this.d.render();
    }
  }
}
