export interface StorageLike {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
}

export interface KeyStore {
  nickname(): string | null;
  setNickname(name: string): void;
  lastRoom(): string | null;
  setLastRoom(code: string): void;
  clearLastRoom(): void;
}

const NICK = 'witchtown.nickname';
const ROOM = 'witchtown.lastRoom';

export class LocalStore implements KeyStore {
  constructor(private readonly s: StorageLike) {}

  private get(key: string): string | null {
    try {
      const v = this.s.getStorageSync(key);
      return typeof v === 'string' && v ? v : null;
    } catch {
      return null;
    }
  }

  private set(key: string, v: string | null): void {
    try {
      if (v === null) this.s.removeStorageSync(key);
      else this.s.setStorageSync(key, v);
    } catch {
      // 本机存储失败不影响游戏
    }
  }

  nickname(): string | null {
    return this.get(NICK);
  }
  setNickname(name: string): void {
    this.set(NICK, name);
  }
  lastRoom(): string | null {
    return this.get(ROOM);
  }
  setLastRoom(code: string): void {
    this.set(ROOM, code);
  }
  clearLastRoom(): void {
    this.set(ROOM, null);
  }
}
