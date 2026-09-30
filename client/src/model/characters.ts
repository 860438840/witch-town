import type { CharacterId } from '../../../engine/src/index';

/** name：全名；short：格子里用的两字简称；desc：技能说明 */
export const CHAR_INFO: Record<CharacterId, { name: string; short: string; desc: string }> = {
  doctor: { name: '医生', short: '医生', desc: '可以把「辩护」当作「目击」（7 点）打出' },
  beggar: { name: '乞丐', short: '乞丐', desc: '对你打出的「抢劫」「纵火」无效，并立刻丢弃' },
  landlord: { name: '地主', short: '地主', desc: '抽牌时如果抽出 2 张「指控」，展示这 2 张，再抽一张' },
  judge: { name: '法官', short: '法官', desc: '你打出的红卡使目标累计达到 6 点，即可审判该玩家' },
  priest: { name: '牧师', short: '牧师', desc: '游戏中两次：抽牌时可以改为从弃牌堆选最多 2 张非黑卡加入手牌' },
  storyteller: { name: '说书人', short: '说书', desc: '游戏中一次：你的回合抽牌前，可以任意调整牌堆顺序，限时 2 分钟' },
  tailor: { name: '裁缝', short: '裁缝', desc: '技能与右手边第一名活着的玩家一致' },
  housewife: { name: '家庭主妇', short: '主妇', desc: '其他玩家的身份卡因审判或黑猫被翻开时，你从牌堆抽一张牌' },
  farmer: { name: '农民', short: '农民', desc: '有玩家死亡时，你获得他的所有手牌和面前的蓝卡' },
  child: { name: '小孩', short: '小孩', desc: '你发起的审判结束后，丢弃你自己面前所有「指控」和「证据」' },
  minister: { name: '部长', short: '部长', desc: '对你打出的「证据」只算 1 点' },
  official: { name: '官员', short: '官员', desc: '游戏中一次：你自首时无需翻开身份卡' },
  strongman: { name: '大力士', short: '力士', desc: '对你的审判线为 8 点' },
  maid: { name: '女仆', short: '女仆', desc: '「黑猫」和「情侣」对你无效' },
  maiden: { name: '少女', short: '少女', desc: '你发起审判时，审判前先抽 2 张牌，本回合可以立即使用' },
};
