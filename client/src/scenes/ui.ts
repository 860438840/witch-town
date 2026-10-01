import type { Screen } from '../core/app';
import type { Animator } from '../core/tween';
import type { Controller } from '../controller';

/** 场景需要的全部外部能力；测试时用假的实现 */
export interface Ui {
  screen: Screen;
  animator: Animator;
  ctl: Controller;
  render(): void;
  /** 弹出输入框；用户点确定时回调（已去掉首尾空格） */
  prompt(title: string, placeholder: string, cb: (text: string) => void, cancellable?: boolean): void;
  confirm(title: string, content: string, cb: () => void): void;
  copy(text: string): void;
  share(title: string, query: string): void;
}
