// 临时调试界面（计划 B1 Task 5）：验证云函数、数据库权限和实时推送。正式界面在计划 B2 中重做。
wx.cloud.init({ traceUser: true });
const db = wx.cloud.database();

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const { windowWidth: W, windowHeight: H, pixelRatio: DPR } = wx.getSystemInfoSync();
canvas.width = W * DPR;
canvas.height = H * DPR;
ctx.scale(DPR, DPR);

const state = { code: '', logs: [] };
let roomWatcher = null;
let handWatcher = null;

function print(label, value) {
  const time = new Date().toTimeString().slice(0, 8);
  state.logs.unshift(`[${time}] ${label}: ${JSON.stringify(value)}`);
  state.logs = state.logs.slice(0, 60);
  render();
}

async function call(data) {
  const t0 = Date.now();
  try {
    const res = await wx.cloud.callFunction({ name: 'game', data });
    print(`${data.type} (${Date.now() - t0}ms)`, res.result);
    return res.result;
  } catch (e) {
    print(`${data.type} 调用失败`, e.errMsg || String(e));
    return null;
  }
}

function askCode() {
  wx.showModal({
    title: '输入房间号',
    editable: true,
    placeholderText: '4 位数字',
    success: (res) => {
      if (res.confirm && res.content) {
        state.code = res.content.trim();
        render();
      }
    },
  });
}

function watch() {
  const code = state.code;
  if (roomWatcher) roomWatcher.close();
  if (handWatcher) handWatcher.close();
  roomWatcher = db.collection('rooms').doc(code).watch({
    onChange: (snap) => {
      const doc = snap.docs[0];
      print('rooms 推送', doc ? { status: doc.status, version: doc.view && doc.view.version, turn: doc.view && doc.view.turn, players: doc.view && doc.view.players.length, phase: doc.view && doc.view.phase, deadline: doc.deadline } : null);
    },
    onError: (e) => print('rooms 监听失败', e.errMsg || String(e)),
  });
  handWatcher = db
    .collection('hands')
    .where({ _openid: '{openid}', roomId: code })
    .watch({
      onChange: (snap) => {
        const doc = snap.docs[0];
        print('hands 推送', doc ? { seat: doc.view.seat, hand: doc.view.hand.map((c) => c.kind), pending: doc.view.pending } : null);
      },
      onError: (e) => print('hands 监听失败', e.errMsg || String(e)),
    });
  print('监听', `已开始监听房间 ${code}`);
}

async function readOthers() {
  const code = state.code;
  try {
    const g = await db.collection('games').doc(code).get();
    print('读 games（应该失败）', g.data);
  } catch (e) {
    print('读 games 被拒绝（正确）', e.errMsg || String(e));
  }
  try {
    const h = await db.collection('hands').doc(`${code}_bot-1`).get();
    print('读 bot-1 的 hands（应该失败）', h.data);
  } catch (e) {
    print('读别人的 hands 被拒绝（正确）', e.errMsg || String(e));
  }
}

const buttons = [
  { label: '建房', run: async () => { const r = await call({ type: 'createRoom', profile: { name: '测试' } }); if (r && r.ok) { state.code = r.data.code; render(); } } },
  { label: '输入房号', run: askCode },
  { label: '加入', run: () => call({ type: 'joinRoom', code: state.code, profile: { name: '测试' } }) },
  { label: '加 4 个机器人', run: () => call({ type: 'addBots', code: state.code, count: 4 }) },
  { label: '开始', run: () => call({ type: 'startGame', code: state.code }) },
  { label: '开始监听', run: watch },
  { label: '抽 2 张', run: () => call({ type: 'act', code: state.code, action: { type: 'draw' } }) },
  { label: '超时推进', run: () => call({ type: 'tick', code: state.code }) },
  { label: '读别人的数据', run: readOthers },
];

const TOP = 48;
const COLS = 3;
const GAP = 8;
const BTN_H = 40;
const btnW = (W - GAP * (COLS + 1)) / COLS;
buttons.forEach((b, i) => {
  b.x = GAP + (i % COLS) * (btnW + GAP);
  b.y = TOP + 36 + Math.floor(i / COLS) * (BTN_H + GAP);
  b.w = btnW;
  b.h = BTN_H;
});
const logTop = buttons[buttons.length - 1].y + BTN_H + 16;

function wrap(text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function render() {
  ctx.fillStyle = '#16121c';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#e8d9b5';
  ctx.font = 'bold 18px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('女巫镇 · 调试', GAP, TOP);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#b9a8d8';
  ctx.fillText(`房间号：${state.code || '（无）'}`, W / 2, TOP);

  for (const b of buttons) {
    ctx.fillStyle = '#3a2d4f';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#f2ead3';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    ctx.textAlign = 'left';
  }

  ctx.font = '11px monospace';
  ctx.fillStyle = '#cfc6dd';
  ctx.textBaseline = 'top';
  let y = logTop;
  for (const entry of state.logs) {
    for (const line of wrap(entry, W - GAP * 2)) {
      if (y > H - 14) break;
      ctx.fillText(line, GAP, y);
      y += 14;
    }
    y += 4;
  }
  ctx.textBaseline = 'middle';
}

// 分享试验：打开转发菜单，卡片带上房号；从卡片进入时读出房号
wx.showShareMenu({ menus: ['shareAppMessage'] });
wx.onShareAppMessage(() => {
  const card = { title: `女巫镇 · 房间 ${state.code || '（无）'}`, query: `room=${state.code}` };
  print('分享回调被调用', card);
  return card;
});
function readShareQuery(label, opts) {
  const room = opts && opts.query && opts.query.room;
  print(label, { scene: opts && opts.scene, query: opts && opts.query });
  if (room) {
    state.code = room;
    print('分享', `从分享进入，房号 ${room}`);
  }
}
readShareQuery('启动参数', wx.getLaunchOptionsSync());
wx.onShow((opts) => readShareQuery('回到前台参数', opts));

wx.onTouchStart((e) => {
  const t = e.touches[0];
  const hit = buttons.find((b) => t.clientX >= b.x && t.clientX <= b.x + b.w && t.clientY >= b.y && t.clientY <= b.y + b.h);
  if (hit) hit.run();
});

render();
