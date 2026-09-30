// 只声明本项目用到的小游戏 API（没有 import/export，是全局声明文件）
interface WxRect { top: number; bottom: number; left: number; right: number; width: number; height: number }
interface WxTouch { identifier: number; clientX: number; clientY: number }
interface WxTouchEvent { touches: WxTouch[]; changedTouches: WxTouch[] }
interface WxLaunchOptions { scene?: number; query?: Record<string, string> }
interface WxWatchHandle { close(): void }
interface WxWatchOptions { onChange(snap: { docs: unknown[] }): void; onError(e: unknown): void }
interface WxDocRef { get(): Promise<{ data: unknown }>; watch(o: WxWatchOptions): WxWatchHandle }
interface WxQueryRef { watch(o: WxWatchOptions): WxWatchHandle }
interface WxCollection { doc(id: string): WxDocRef; where(q: Record<string, unknown>): WxQueryRef }
interface WxDatabase { collection(name: string): WxCollection }
interface WxCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D }
interface WxModalResult { confirm: boolean; cancel: boolean; content?: string }

declare const wx: {
  cloud: {
    init(o?: { env?: string; traceUser?: boolean }): void;
    callFunction(o: { name: string; data: unknown }): Promise<{ result?: unknown }>;
    database(): WxDatabase;
  };
  createCanvas(): WxCanvas;
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: WxRect };
  getMenuButtonBoundingClientRect(): WxRect;
  onTouchStart(cb: (e: WxTouchEvent) => void): void;
  onTouchMove(cb: (e: WxTouchEvent) => void): void;
  onTouchEnd(cb: (e: WxTouchEvent) => void): void;
  onTouchCancel(cb: (e: WxTouchEvent) => void): void;
  getLaunchOptionsSync(): WxLaunchOptions;
  onShow(cb: (o: WxLaunchOptions) => void): void;
  showModal(o: {
    title: string;
    content?: string;
    editable?: boolean;
    placeholderText?: string;
    showCancel?: boolean;
    success?(r: WxModalResult): void;
  }): void;
  showToast(o: { title: string; icon?: 'none' | 'success'; duration?: number }): void;
  setClipboardData(o: { data: string }): void;
  shareAppMessage(o: { title: string; query?: string }): void;
  showShareMenu(o: { menus: string[] }): void;
  onShareAppMessage(cb: () => { title: string; query?: string }): void;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
};
