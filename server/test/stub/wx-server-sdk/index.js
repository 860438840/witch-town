// 构建冒烟测试用的 wx-server-sdk 桩
module.exports = {
  DYNAMIC_CURRENT_ENV: 'stub',
  init() {},
  database() {
    return {};
  },
  getWXContext() {
    return { OPENID: '' };
  },
};
