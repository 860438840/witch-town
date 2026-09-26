/** 玩家操作不符合规则时抛出，message 直接展示给玩家 */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
