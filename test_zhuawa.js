/* =====================================================================
   抓娃娃看图列式 · 无浏览器逻辑回归测试
   做法：极简 DOM 桩 + vm 跑真实内联脚本，断言直接读游戏状态（window.__T）
   ===================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/test_zhuawa_result.txt';

/* ---------------- 结果收集 ---------------- */
let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, extra) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (extra ? '  [' + extra + ']' : '')); console.log('FAIL ' + name + (extra ? '  ' + extra : '')); }
}

/* ---------------- 极简 DOM 桩 ---------------- */
const registry = new Map();

function mkEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    _cls: new Set(),
    _children: [],
    _parent: null,
    _html: '',
    dataset: {},
    _text: '',
    offsetWidth: 0, clientWidth: 800, clientHeight: 320,
    onclick: null, oninput: null,
    _ev: {},
    style: {
      _p: {},
      setProperty(k, v) { this._p[k] = v; },
      removeProperty(k) { delete this._p[k]; }
    },
    classList: {
      add(...c) { c.forEach(x => el._cls.add(x)); },
      remove(...c) { c.forEach(x => el._cls.delete(x)); },
      contains(c) { return el._cls.has(c); },
      toggle(c, force) {
        const on = force === undefined ? !el._cls.has(c) : !!force;
        if (on) el._cls.add(c); else el._cls.delete(c);
        return on;
      }
    },
    get className() { return [...el._cls].join(' '); },
    set className(v) { el._cls = new Set(String(v || '').split(/\s+/).filter(Boolean)); },
    get children() { return el._children; },
    get childNodes() { return el._children; },
    get parentNode() { return el._parent; },
    get lastElementChild() { return el._children[el._children.length - 1] || null; },
    get textContent() { return el._text; },
    set textContent(v) { el._text = String(v); el._children = []; },
    get innerHTML() { return el._html; },
    set innerHTML(v) {
      el._html = String(v);
      el._children = [];
      parseHTML(el, el._html);
    },
    appendChild(c) { c._parent = el; el._children.push(c); return c; },
    removeChild(c) { const i = el._children.indexOf(c); if (i >= 0) el._children.splice(i, 1); c._parent = null; },
    remove() { if (el._parent) el._parent.removeChild(el); },
    setAttribute(k, v) { if (k === 'class') el.className = v; else el.dataset[k.replace(/^data-/, '')] = v; },
    addEventListener(t, fn) { (el._ev[t] = el._ev[t] || []).push(fn); },
    removeEventListener() {},
    closest(sel) {
      let n = el;
      while (n) { if (matches(n, sel)) return n; n = n._parent; }
      return null;
    },
    querySelector(sel) { return queryAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(el, sel); },
    focus() {}, click() { if (el.onclick) el.onclick({ target: el }); }
  };
  return el;
}

/* 解析 innerHTML 里的标签（够用：class / data-* / 嵌套 / 文本） */
function parseHTML(root, html) {
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m, stack = [root], textBuf = '', last = 0;
  const flush = () => {
    if (textBuf.trim() && stack.length) {
      const top = stack[stack.length - 1];
      top._text += textBuf.trim();
    }
    textBuf = '';
  };
  while ((m = re.exec(html))) {
    /* 标签之间的纯文本也要收集，否则 el.innerHTML='?个' 取不到文本 */
    const txt = html.slice(last, m.index);
    if (txt && txt.trim()) textBuf += txt.trim();
    last = re.lastIndex;
    flush();
    const closing = m[1] === '/', tag = m[2], attrs = m[3] || '';
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const child = mkEl(tag);
    const cm = attrs.match(/class="([^"]*)"/);
    if (cm) child.className = cm[1];
    const dm = [...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)];
    dm.forEach(d => { child.dataset[d[1]] = d[2]; });
    stack[stack.length - 1].appendChild(child);
    if (!m[4] && !/^(br|img|input|hr|meta|link)$/i.test(tag)) stack.push(child);
  }
  const tail = html.slice(last);
  if (tail && tail.trim()) textBuf += tail.trim();
  flush();
}

function matches(el, sel) {
  sel = sel.trim();
  if (!sel) return false;
  if (sel[0] === '.') {
    const mm = sel.match(/^\.([\w-]+)(?:\[data-([\w-]+)="([^"]*)"\])?$/);
    if (!mm) return false;
    if (!el._cls.has(mm[1])) return false;
    if (mm[2]) return String(el.dataset[mm[2]]) === mm[3];
    return true;
  }
  if (sel[0] === '#') return el.id === sel.slice(1);
  if (sel === '*') return true;
  return el.tagName === sel.toUpperCase();
}

function queryAll(root, selector) {
  const parts = selector.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  const walk = (n) => {
    n._children.forEach(c => {
      if (parts.some(p => matches(c, p.split(/\s+/).pop()))) out.push(c);
      walk(c);
    });
  };
  walk(root);
  return out;
}

/* ---------------- document / window ---------------- */
const doc = {
  documentElement: mkEl('html'),
  body: mkEl('body'),
  _keyHandlers: [],
  _resize: [],
  getElementById(id) {
    if (!registry.has(id)) { const e = mkEl('div'); e.id = id; registry.set(id, e); }
    return registry.get(id);
  },
  createElement(t) { return mkEl(t); },
  createElementNS(ns, t) { return mkEl(t); },
  querySelector(sel) {
    if (sel[0] === '#') return doc.getElementById(sel.slice(1));
    return queryAll(doc.body, sel)[0] || null;
  },
  querySelectorAll(sel) { return queryAll(doc.body, sel); },
  addEventListener(t, fn) { if (t === 'keydown') doc._keyHandlers.push(fn); }
};

const fakeLS = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};

const windowStub = {
  document: doc,
  localStorage: fakeLS,
  addEventListener(t, fn) { if (t === 'resize') doc._resize.push(fn); },
  speechSynthesis: undefined,
  AudioContext: undefined
};

/* ---------------- 预置静态元素（对应 HTML 里写死的结构） ---------------- */
(function seed() {
  const ids = ['app', 'topbar', 'brand', 'timer', 'btnSet', 'btnMute', 'btnPause', 'btnRestart',
    'badges', 'stage', 'panels', 'setMask', 'setModal', 'setClose', 'pcPills', 'tmPills', 'mxPills',
    'selScope', 'selAnim', 'nameInputs', 'typeChecks', 'btnStart', 'resMask', 'resModal',
    'resSub', 'podium', 'btnAgain', 'btnAdjust', 'btnLook', 'toast'];
  ids.forEach(id => doc.getElementById(id));

  /* 舞台里写死的层 */
  const stage = registry.get('stage');
  ['.bokeh', '.spot', '.rainbow', '.stars', '.piles', '.rails', '.marquee', '.floor', '.bins', '.glass'].forEach(cls => {
    const d = mkEl('div'); d.className = cls.slice(1); stage.appendChild(d);
  });

  /* 人数 / 时间胶囊 */
  const pc = registry.get('pcPills');
  [2, 3, 4].forEach(c => { const b = mkEl('button'); b.className = 'pill'; b.dataset.c = String(c); b.textContent = c + '人'; pc.appendChild(b); });
  const tm = registry.get('tmPills');
  [60, 100, 180].forEach(t => { const b = mkEl('button'); b.className = 'pill'; b.dataset.t = String(t); b.textContent = String(t); tm.appendChild(b); });

  /* 数的范围胶囊：5 / 6 / 7 / 8 / 9 / 10 */
  const mx = registry.get('mxPills');
  for (let m = 5; m <= 10; m++) {
    const b = mkEl('button'); b.className = 'pill';
    b.dataset.m = String(m); b.textContent = String(m); mx.appendChild(b);
  }

  /* select 的 value 由测试直接设置，这里给默认；options 供「教学范围文案跟随」使用 */
  const sc = registry.get('selScope');
  sc.options = ['mix', 'add', 'sub'].map(v => ({ value: v, text: '' }));
  sc.value = 'mix';
  registry.get('selAnim').value = 'auto';
  registry.get('setMask')._cls.add('on');
})();

/* ---------------- 定时器：手动推进 ---------------- */
const clock = { now: 0 };
const timers = [];
let tid = 1;
function fakeSetTimeout(fn, ms) {
  const t = { id: tid++, at: clock.now + (ms || 0), fn, cleared: false };
  timers.push(t);
  return t.id;
}
function fakeClearTimeout(id) { const t = timers.find(x => x.id === id); if (t) t.cleared = true; }
function fakeSetInterval(fn, ms) { return fakeSetTimeout(fn, ms); }
function fakeClearInterval(id) { fakeClearTimeout(id); }

function flushMs(budget) {
  const end = clock.now + (budget || 0);
  for (let guard = 0; guard < 5000; guard++) {
    const due = timers.filter(t => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    clock.now = Math.max(clock.now, due.at);
    due.cleared = true;
    try { due.fn(); } catch (e) { console.log('timer error: ' + e.message); }
  }
  clock.now = Math.max(clock.now, end);
}
function flushAll() { flushMs(1e7); }

/* ---------------- 沙箱 ---------------- */
const sandbox = {
  console,
  document: doc,
  window: windowStub,
  navigator: { userAgent: 'node' },
  setTimeout: fakeSetTimeout,
  clearTimeout: fakeClearTimeout,
  setInterval: fakeSetInterval,
  clearInterval: fakeClearInterval,
  requestAnimationFrame: (fn) => fakeSetTimeout(fn, 16),
  performance: { now: () => clock.now },
  Date: { now: () => clock.now },
  Math, JSON, Number, String, Array, Object, Boolean, RegExp, Error
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const code = fs.readFileSync(HTML, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------------- 测试主体 ---------------- */
const TEST = `
const T = window.__T;
const S = T.S;
function reset(){
  /* 只重开比赛，保留测试刚设置的规则 */
  __flushAll();
  T.startGame();
  S.paused = false;
  __flushMs(50);
}
function fillRight(p){
  const q = p.q, c = q.c, s = p.slots;
  p.ops = q.arity === 3 ? { 0: q.op, 1: q.op } : { 0: q.op };
  if (q.arity === 2){
    if (q.given){ p.answers[s[0]] = String(c); }
    else { p.answers[s[0]] = String(q.a); p.answers[s[1]] = String(q.b); p.answers[s[2]] = String(c); }
  } else {
    if (q.given){ p.answers[s[0]] = String(c); }
    else { p.answers[s[0]] = String(q.a); p.answers[s[1]] = String(q.b); p.answers[s[2]] = String(q.third); p.answers[s[3]] = String(c); }
  }
  p.cur = 0;
  __okT(T.checkAnswer(p).ok === true, '填充正确答案后校验通过 ' + q.type);
}

/* ========== 1. 出题器：六种题型各 400 题不变量 ========== */
Object.keys(T.TYPES).forEach(type => {
  for (let i = 0; i < 400; i++){
    const q = T.buildQuestion(type);
    const tag = type + '#' + i;
    if (type === 'add' || type === 'add3' || type === 'part' || type === 'cross' || type === 'box' || type === 'sub3'){
      __okT(q.arity === (type === 'add3' || type === 'sub3' ? 3 : 2), '元数正确 ' + tag);
    }
    if (type === 'add'){
      __okT(q.a >= 1 && q.b >= 1 && q.a + q.b <= 10 && q.c === q.a + q.b, '加法不越界 ' + tag);
      __okT(q.groups.length === 2 && q.groups[0] + q.groups[1] === q.c, '加法两组之和=' + tag);
      __okT(q.brace && q.brace.label === '?', '加法大括号问号 ' + tag);
    }
    if (type === 'cross' || type === 'box'){
      const total = q.a, k = q.b;
      __okT(total >= 2 && total <= 10 && k >= 1 && k < total && q.c === total - k, '减法范围 ' + tag);
      __okT(q.items.length === total, '物体数=总数 ' + tag);
      const mk = q.items.filter(o => o.mark === (type === 'box' ? 'box' : 'slash')).length;
      __okT(mk === k, '记号数=去掉数 ' + tag + ' 记号' + mk + ' k' + k);
      /* 减法只靠斜线 / 虚线框说话。大括号在课本里是「合起来」的意思（加法），
         两种符号画在同一个区域，学生会读成两道互相矛盾的题 */
      __okT(!q.labelText, '不出现「还剩」提示语 ' + tag);
      __okT(!q.brace, '减法不画大括号（大括号=加法） ' + tag);
    }
    if (type === 'part'){
      __okT(q.a >= 3 && q.a <= 10 && q.b >= 1 && q.b < q.a && q.c === q.a - q.b, '求另一部分范围 ' + tag);
      __okT(q.groups[0] === q.b && q.unknown === true, '已知部分+问号占位 ' + tag);
      __okT(q.brace.label === q.a + q.unit, '括号标总数 ' + tag);
      __okT(q.labelText === '?', '问句为? ' + tag);
    }
    if (type === 'add3'){
      __okT(q.a >= 1 && q.b >= 1 && q.third >= 1 && q.a + q.b + q.third <= 10, '连加不越界 ' + tag);
      __okT(q.c === q.a + q.b + q.third && q.groups.length === 3, '连加和正确 ' + tag);
    }
    if (type === 'sub3'){
      const n = q.a, k1 = q.b, k2 = q.third;
      __okT(k1 >= 1 && k2 >= 1 && k1 + k2 <= n - 1 && q.c === n - k1 - k2, '连减不越界 ' + tag);
      __okT(q.items.filter(o => o.mark === 'slash').length === k1, '连减划去数 ' + tag);
      __okT(q.items.filter(o => o.mark === 'box').length === k2, '连减速线框数 ' + tag);
      __okT(!q.labelText && !q.brace, '连减不画大括号、不写提示语 ' + tag);
    }
    /* 槽位 */
    const expSlots = q.given ? 1 : (q.arity === 2 ? 3 : 4);
    __okT(q.slots.length === expSlots, '槽位数量 ' + tag);
  }
});

/* ========== 1b. 数的范围（设置里可选 5~10 以内） ========== */
/* 老师按教学进度设 N 以内：出题时任何数都不该超过 N，题目本身仍然成立 */
const TYPES_ALL = Object.keys(T.TYPES);
[5, 6, 7, 8, 9, 10].forEach(function(mx){
  S.settings.max = mx;
  TYPES_ALL.forEach(function(type){
    for (let i = 0; i < 120; i++){
      const q = T.buildQuestion(type);
      const tag = 'max=' + mx + ' ' + type + '#' + i;
      __okT(q.c >= 0 && q.c <= mx, '得数不超过数的范围 ' + tag, 'c=' + q.c);
      __okT(q.a >= 1 && q.a <= mx, '第一个数不超过范围 ' + tag, 'a=' + q.a);
      if (type === 'add'){
        __okT(q.a + q.b <= mx, '加法和不超范围 ' + tag, 'a+b=' + (q.a + q.b));
      }
      if (type === 'add3'){
        __okT(q.a + q.b + q.third <= mx, '连加和不超范围 ' + tag);
      }
      if (type === 'cross' || type === 'box' || type === 'part' || type === 'sub3'){
        __okT(q.a <= mx, '减法的总数不超范围 ' + tag);
      }
      if (type === 'sub3'){
        __okT(q.b + q.third <= q.a - 1, '连减两次仍留得下 ' + tag);
      }
    }
  });
});
S.settings.max = 10;

/* 设置界面：6 个胶囊、默认 10 高亮；点 5 后高亮切换、教学范围文案跟着变 */
T.buildSettingsUI();
let mxKids = __kids(__reg('mxPills'), 'pill');
__okT(mxKids.length === 6, '数的范围 5~10 共 6 个胶囊', 'n=' + mxKids.length);
__okT(mxKids.filter(b => b._cls.has('on')).length === 1, '只有一个胶囊高亮');
__okT(mxKids[5]._cls.has('on'), '默认高亮 10');
__okT(__reg('selScope').options[0].text === '10以内综合', '教学范围文案跟随默认值', __reg('selScope').options[0].text);

const pill5 = mxKids[0];
__reg('mxPills').onclick({ target: pill5 });
__okT(S.settings.max === 5, '点「5」后数的范围=5');
__okT(pill5._cls.has('on') && !mxKids[5]._cls.has('on'), '高亮从 10 切到 5');
__okT(__reg('selScope').options[0].text === '5以内综合', '教学范围文案变 5以内综合', __reg('selScope').options[0].text);
__okT(__reg('selScope').options[2].text === '5以内减法', '减法文案也跟着变', __reg('selScope').options[2].text);

/* 落盘：只记数的范围，别把人数/名字也带出去 */
const rawSaved = window.localStorage.getItem('zhuawa_settings');
__okT(!!rawSaved && JSON.parse(rawSaved).max === 5, '设置写入 localStorage', String(rawSaved));
__okT(Object.keys(JSON.parse(rawSaved)).length === 1, '只持久化 max 一项');

/* 读回：换个新页面重开，5 以内还留着 */
S.settings.max = 10;
T.loadSettings();
__okT(S.settings.max === 5, '重开时读回上次选的 5 以内', 'max=' + S.settings.max);
/* 脏数据不能把范围带飞 */
window.localStorage.setItem('zhuawa_settings', '{"max":40}');
S.settings.max = 10; T.loadSettings();
__okT(S.settings.max === 10, '超范围的脏值被拒', 'max=' + S.settings.max);
window.localStorage.setItem('zhuawa_settings', '{oops');
S.settings.max = 10; T.loadSettings();
__okT(S.settings.max === 10, '坏 JSON 不抛错、保持默认');

/* 键盘：5 以内按 7 不落格；1 后面按 0 不能再拼出 10 */
/* 键盘：比范围大的数字键置灰，按了也不落格 */
S.settings.max = 5; reset();
const grayKeys = __kids(S.players[0].key, 'dis').map(b => b._text).sort().join(',');
__okT(grayKeys === '6,7,8,9', '5 以内时 6~9 键置灰', grayKeys);
S.settings.max = 10; reset();
__okT(__kids(S.players[0].key, 'dis').length === 0, '10 以内没有灰键');

reset();
const pk = S.players[0];
pk.q = { type:'add', emoji:'🍎', unit:'个', op:'+', arity:2, a:2, b:3, c:5,
         groups:[2,3], brace:{from:0,to:1,label:'?个'}, given:false,
         slots:['a','b','c'], items:[] };
pk.slots = ['a','b','c']; pk.answers = {}; pk.ops = {}; pk.cur = 0; pk.done = false; pk.locked = false;
S.settings.max = 5;
T.pressKey(pk, 7);
__okT(pk.answers.a == null, '5 以内按 7 不落格', String(pk.answers.a));
T.pressKey(pk, 2);
__okT(pk.answers.a === '2', '按 2 正常落格');
T.pressKey(pk, 1);
__okT(pk.answers.a === '2' && pk.answers.b === '1', '拼成 21 越界 → 拆到下一槽', JSON.stringify(pk.answers));
T.pressKey(pk, 0);
__okT(pk.answers.b === '1' && pk.answers.c === '0', '5 以内不接受 10 → 继续往下一槽走', JSON.stringify(pk.answers));
S.settings.max = 10;

/* ========== 2. 开局：4 名玩家 / 面板 / 独立题目 ========== */
reset();
__okT(S.players.length === 4, '4 名玩家');
__okT(__kids(__reg('badges'), 'badge').length === 4, '4 个积分徽章');
__okT(__kids(__reg('panels'), 'panel').length === 4, '4 个题目面板');
__okT(S.players.every(p => p.q && p.q.slots.length >= 1), '每人都有题');
__okT(S.running === true, '比赛进行中');

/* ========== 3. 答对：+1 分、抓娃娃、换新题 ========== */
reset();
let p0 = S.players[0];
const oldQ = p0.q;
fillRight(p0);
const beforeScore = p0.score;
T.confirmAnswer(p0);
__okT(p0.score === beforeScore + 1, '答对加 1 分', '分数=' + p0.score);
__okT(p0.done === true, '答对后标记完成');
__okT(p0.els.ok.textContent === '答对啦！', '确定按钮变答对啦', p0.els.ok.textContent);
__okT(p0.els.ok._cls.has('right'), '确定按钮变绿');
/* 抓娃娃动画走到落筐：娃娃进筐 + 得奖提示 */
__okMs(T.CONFIG.CLAW_STEP[5] + 60);
__okT(__kids(__reg('stage'), 'got').length >= 1, '娃娃落进自己的筐');
__okT(__kids(__reg('stage'), 'pop1').length >= 1, '得奖 +1 飘字出现');
__okT(__kids(__reg('stage'), 'spark').length >= 3, '得奖星星出现', 'spark=' + __kids(__reg('stage'), 'spark').length);
__okMs(T.CONFIG.NEXT_MS + 1000);
__okT(p0.q !== oldQ && p0.done === false, '到时间自动换新题');
__okT(p0.els.ok.textContent === '确定' && !p0.els.ok._cls.has('right'), '按钮复位');
__okT(S.players[1].score === 0, '其他人分数不受影响');

/* ========== 4. 答错：不加分、清空重填、不锁死 ========== */
reset();
let p1 = S.players[1];
const q1 = p1.q;
const wrongQ = p1.slots.slice();
p1.ops = q1.arity === 3 ? { 0: q1.op, 1: q1.op } : { 0: q1.op };
p1.slots.forEach((s, i) => { p1.answers[s] = '9'; });
if (p1.slots.length === 1) p1.answers[wrongQ[0]] = '9';
p1.cur = 0;
__okT(T.checkAnswer(p1).ok === false, '全填 9 必然不对（除非答案就是 9）');
T.confirmAnswer(p1);
__okT(p1.score === 0, '答错不加分');
__okT(p1.q === q1, '答错保留原题');
__okMs(800);
__okT(Object.keys(p1.answers).length === 0, '答错后清空可重填');
__okT(p1.locked !== true, '答错不锁死');

/* ========== 5. 未填完点确定：不弹提示、只抖空槽、不判错 ========== */
reset();
let p2 = S.players[2];
p2.answers = {};
T.confirmAnswer(p2);
__okT(!__reg('toast')._cls.has('on') && !__reg('toast').textContent, '未填完不弹任何提示文字');
__okT(p2.score === 0 && p2.q !== null, '未填完不判错不加分');

/* ========== 5b. 运算符：不预先显示，学生自己选，选错判错 ========== */
reset();
let pOp = S.players[0];
const qOp = pOp.q;
__okT(__kids(pOp.eq, 'opslot').length === (qOp.arity === 3 ? 2 : 1), '算式里有运算符槽');
__okT(__kids(pOp.eq, 'opslot').every(o => !o._text), '运算符槽是空的（既不显示 ?，也不预先显示加减）');
__okT(__kids(pOp.eq, 'opcell').length === 0, '不再有预置的加减号');
/* 键盘 + 键：填进第一个空槽 */
T.pressKey(pOp, '+');
__okT(pOp.ops[0] === '+', '按 + 键选中加号');
if (qOp.arity === 3){ T.pressKey(pOp, '-'); __okT(pOp.ops[1] === '-', '连减第二个槽可选减号'); }
/* 运算符槽不预置任何字符（不画 ?，也不画 +），点它也没有任何反应 */
pOp.ops = {};
T.renderEquation(pOp);
const opSlots = __kids(pOp.eq, 'opslot');
__okT(opSlots.length === (qOp.arity === 3 ? 2 : 1), '符号位数量对');
__okT(opSlots.every(s => !s._text), '符号位是空的，不预置 ? 或 +');
__okT(opSlots.every(s => !s.onclick), '符号位不可点（加还是减只从键盘选）');
/* 按错了能直接改：先按 + 再按 -，以最后一次为准 */
T.pressKey(pOp, '+');
T.pressKey(pOp, '-');
__okT(pOp.ops[0] === '-', '符号选错后按另一个键能直接改', 'ops0=' + pOp.ops[0]);
/* 运算符没选 = 没填完 */
pOp.ops = {}; pOp.answers = {}; pOp.cur = 0;
fillNumbers(pOp);
__okT(T.checkAnswer(pOp).reason === 'empty', '运算符未选视为没填完');
/* 数字全对但运算符选错 → 判错 */
pOp.ops = { 0: qOp.op === '+' ? '-' : '+' };
if (qOp.arity === 3) pOp.ops[1] = qOp.op;
__okT(T.checkAnswer(pOp).ok === false, '数字全对但运算符选错判错');
__okT(T.checkAnswer(pOp).reason !== 'empty', '选错运算符不是「没填完」而是答错');
/* 运算符选对 → 通过 */
pOp.ops = qOp.arity === 3 ? { 0: qOp.op, 1: qOp.op } : { 0: qOp.op };
__okT(T.checkAnswer(pOp).ok === true, '运算符选对后校验通过');

function fillNumbers(p){
  const q = p.q, s = p.slots;
  if (q.arity === 2){
    if (q.given){ p.answers[s[0]] = String(q.c); }
    else { p.answers[s[0]] = String(q.a); p.answers[s[1]] = String(q.b); p.answers[s[2]] = String(q.c); }
  } else {
    if (q.given){ p.answers[s[0]] = String(q.c); }
    else { p.answers[s[0]] = String(q.a); p.answers[s[1]] = String(q.b); p.answers[s[2]] = String(q.third); p.answers[s[3]] = String(q.c); }
  }
}

/* ========== 6. 两位数输入（10）：1 后面按 0 组成 10 ========== */
S.settings.types = ['add'];
S.settings.scope = 'mix';
reset();
let p3 = S.players[0];
/* 构造一道 7+3=10 的题 */
p3.q = { type:'add', emoji:'🍎', unit:'个', op:'+', arity:2, a:7, b:3, c:10,
         groups:[7,3], brace:{from:0,to:1,label:'?个'}, given:false,
         slots:['a','b','c'], items:[] };
p3.slots = ['a','b','c']; p3.answers = {}; p3.ops = {0:'+'}; p3.cur = 0;
/* 7 → 跳到下一槽由「再按数字」触发；这里按 7 后按 3 自动进 b，再按 1、0 */
T.pressKey(p3, 7);
__okT(p3.answers.a === '7', '第一槽填 7');
T.pressKey(p3, 3);
__okT(p3.answers.b === '3', '第二槽填 3', JSON.stringify(p3.answers));
T.pressKey(p3, 1);
__okT(p3.answers.c === '1' && p3.cur === 2, '第三槽先填 1');
T.pressKey(p3, 0);
__okT(p3.answers.c === '10', '1 后按 0 组成 10', p3.answers.c);
__okT(T.checkAnswer(p3).ok === true, '10 判对');
T.confirmAnswer(p3);
__okT(p3.score === 1, '两位数答案也能得分');

/* ========== 7. 退格 ========== */
reset();
let p4 = S.players[3];
p4.answers = {}; p4.cur = 0;
T.pressKey(p4, 5);
__okT(String(p4.answers[p4.slots[0]]) === '5', '退格前已填');
T.pressBack(p4);
__okT(p4.answers[p4.slots[0]] == null, '退格清掉当前槽');
__okT(p4.cur === 0, '退格后光标回到第一个空槽');

/* ========== 8. 只有「求另一部分」时，题池只出这一种 ========== */
S.settings.types = ['part'];
for (let i = 0; i < 30; i++){
  const t = T.allowedTypes();
  __okT(t.length === 1 && t[0] === 'part', '题池过滤 part#' + i);
}
reset();
__okT(S.players.every(p => p.q.type === 'part'), '全部出求另一部分');

/* ========== 9. 教学范围：加法模式只出加法 ========== */
S.settings.types = ['add','cross','box','part','add3','sub3'];
S.settings.scope = 'add';
__okT(JSON.stringify(T.allowedTypes().sort()) === JSON.stringify(['add','add3']), '加法范围只含加法类');
for (let i = 0; i < 40; i++){
  const q = T.buildQuestion(T.allowedTypes()[0]);
  __okT(q.op === '+', '加法范围题目运算符为 +');
}
S.settings.scope = 'sub';
__okT(T.allowedTypes().indexOf('add') < 0 && T.allowedTypes().indexOf('add3') < 0, '减法范围排除加法类');
S.settings.scope = 'mix';

/* ========== 10. 人数 2 → 面板 / 徽章 / 爪子 都是 2 个 ========== */
S.settings.count = 2;
S.settings.types = ['add','cross','box','part'];
reset();
__okT(S.players.length === 2, '2 人开局');
__okT(__kids(__reg('badges'), 'badge').length === 2, '2 个徽章');
__okT(__kids(__reg('panels'), 'panel').length === 2, '2 个面板');
S.settings.count = 3;
reset();
__okT(S.players.length === 3 && __kids(__reg('panels'), 'panel').length === 3, '3 人开局');

/* ========== 11. 计时与结算 ========== */
S.settings.count = 4;
S.settings.time = 100;
reset();
__okT(S.timeLeft === 100 && __reg('timer').textContent === '01:40', '初始倒计时显示 01:40', __reg('timer').textContent);
S.timeLeft = 2;
T.startTimerTick();
__okT(S.timeLeft === 1 && S.over === false, '倒计时递减');
T.startTimerTick();
__okT(S.over === true && S.running === false, '时间到结束比赛');
__okT(__reg('resMask')._cls.has('on'), '结算弹窗弹出');
__okT(__kids(__reg('podium'), 'step').length === 4, '领奖台 4 阶');
__okT(__reg('resSub').textContent.indexOf('获得第一') >= 0 || __reg('resSub').textContent.indexOf('并列') >= 0, '结算标题含第一名');

/* ========== 12. 结算后不能再答题 ========== */
const pEnd = S.players[0];
const scEnd = pEnd.score;
pEnd.answers = {};
T.pressKey(pEnd, 5);
T.confirmAnswer(pEnd);
__okT(pEnd.score === scEnd, '比赛结束后答题无效');

/* ========== 13. 重开：分数清零、题目全新 ========== */
T.startGame();
S.paused = false;
__okT(S.players.every(p => p.score === 0), '重开后分数清零');
__okT(S.over === false && S.running === true, '重开后重新计时');
__okT(__reg('resMask')._cls.has('on') === false, '重开后结算弹窗关闭');

/* ========== 14. 图形渲染：记号数量与 DOM 一致 ========== */
S.settings.count = 4; S.settings.types = ['cross'];
S.settings.scope = 'mix';
reset();
S.players.forEach(p => {
  const q = p.q;
  const slashes = __kids(p.fig, 'sl').length;
  const items = __kids(p.fig, 'it').length;
  __okT(items === q.items.length, '渲染物体数=' + q.items.length);
  __okT(slashes === q.b, '渲染斜线数=去掉数', 'slashes=' + slashes + ' b=' + q.b);
});
S.settings.types = ['box'];
S.settings.scope = 'mix';
reset();
S.players.forEach(p => {
  const boxes = __kids(p.fig, 'dashbox').length;
  __okT(boxes === 1, '虚线框题目有 1 个 dashed box');
});
S.settings.types = ['add'];
S.settings.scope = 'mix';
reset();
S.players.forEach(p => {
  __okT(__kids(p.fig, 'bracewrap').length === 1, '加法有大括号');
  __okT(__kids(p.fig, 'qmark').length === 0, '加法无问号标注');
});
S.settings.types = ['part'];
S.settings.scope = 'mix';
reset();
S.players.forEach(p => {
  const qm = __kids(p.fig, 'qmark');
  __okT(qm.length === 1, '求另一部分有一个问号占位');
  __okT(qm[0] && qm[0]._text === '?', '问号占位只画一个 ?（不带只/条/个）', qm[0] && qm[0]._text);
  __okT(__kids(p.fig, 'bracewrap').length === 1, '求另一部分有大括号(标总数)');
});

/* ========== 15. 算式槽：当前槽高亮、已填变色 ========== */
S.settings.types = ['add'];
S.settings.scope = 'mix';
reset();
const pp = S.players[0];
/* 固定一道「全空」加法题，避开 given 随机 */
pp.q = { type:'add', emoji:'🍎', unit:'个', op:'+', arity:2, a:2, b:3, c:5,
         groups:[2,3], brace:{from:0,to:1,label:'?个'}, given:false,
         slots:['a','b','c'], items:[] };
pp.slots = ['a','b','c'];
pp.answers = {}; pp.cur = 0;
T.renderEquation(pp);
__okT(pp.slotEls['a']._cls.has('cur'), '第一个槽高亮为光标位');
pp.answers.a = '3';
pp.cur = 1;
T.renderEquation(pp);
__okT(pp.slotEls['a']._cls.has('filled') && pp.slotEls['b']._cls.has('cur'), '填后变色并移动光标');
__okT(__kids(pp.eq, 'opslot').length === 1, '算式里 1 个运算符槽');
__okT(__kids(pp.eq, 'opslot')[0]._text === '', '运算符槽不预置字符');

/* ========== 15b. 图题排布：区域左右并排、区内每行最多 4 个 ========== */
/* 直接构造题目对象，验证渲染结构 */
pp.q = { type:'cross', emoji:'🐟', unit:'条', op:'-', arity:2, a:10, b:8, c:2,
         given:false, slots:['a','b','c'],
         items: Array.from({length:10}, (_, i) => ({ mark: i >= 2 ? 'slash' : '' })) };
pp.slots = ['a','b','c'];
T.renderFigure(pp);
const fl = __kids(pp.fig, 'figline')[0];
/* 划去题：整排摆成一块（跟课本一致），不再拆成左右两段 */
const gees = __kids(pp.fig, 'gsec');
__okT(gees.length === 1, '划去题整排摆成一块', 'gsec=' + gees.length);
__okT(__kids(gees[0], 'it').length === 10, '整排 10 个物体');
__okT(__kids(pp.fig, 'irow').length === 1, '10 个排成一行（不再 4+4+2 折行）', 'rows=' + __kids(pp.fig, 'irow').length);
__okT(__kids(pp.fig, 'sl').length === 8, '划去记号 8 个');
/* 前 2 个不带斜线，第 3 个开始带 */
const flat = __kids(gees[0], 'it');
__okT(__kids(flat[0], 'sl').length === 0 && __kids(flat[1], 'sl').length === 0, '前 2 个保持干净');
__okT(__kids(flat[2], 'sl').length === 1 && __kids(flat[9], 'sl').length === 1, '后 8 个才有斜线');
__okT(fl._cls.has('gsub'), '减法走「两组挨近」样式');

/* 虚线框题：自由段与虚线框段并排 */
pp.q = { type:'box', emoji:'🐟', unit:'条', op:'-', arity:2, a:9, b:7, c:2,
         given:false, slots:['a','b','c'],
         items: Array.from({length:9}, (_, i) => ({ mark: i >= 2 ? 'box' : '' })) };
T.renderFigure(pp);
const fl2 = __kids(pp.fig, 'figline')[0];
__okT(__kids(fl2, 'gsec').length === 1 && __kids(fl2, 'dashbox').length === 1, '自由段与虚线框并排在同一行');
__okT(fl2._cls.has('grpline') && fl2._cls.has('gsub'), '虚线框题：与图案挨在一起');

/* 求另一部分：图案与「?只」并排 */
pp.q = { type:'part', emoji:'🐤', unit:'只', op:'-', arity:2, a:6, b:2, c:4,
         groups:[2], unknown:true, brace:{from:0,to:1,label:'6只'}, labelText:'?只',
         given:false, slots:['a','b','c'], items:[] };
T.renderFigure(pp);
const fl3 = __kids(pp.fig, 'figline')[0];
__okT(__kids(fl3, 'gsec').length === 1 && __kids(fl3, 'qmark').length === 1, '图案与问号并排');
__okT(fl3._cls.has('grpline') && fl3._cls.has('gsub'), '求另一部分：图案与问号挨在一起');
__okT(__kids(pp.fig, 'bracewrap').length === 1, '求另一部分仍带大括号');

/* 只有一个区域时不需要组间空隙，保持紧凑居中 */
pp.q = { type:'sum', emoji:'🍐', unit:'个', op:'+', arity:2, a:3, b:0, c:3,
         labelText:'?个', given:false, slots:['a','b','c'],
         items: Array.from({length:3}, () => ({ mark:'' })) };
T.renderFigure(pp);
const fl4 = __kids(pp.fig, 'figline')[0];
__okT(!fl4._cls.has('grpline'), '单区域题不加组间空隙');

/* 加法题：两组要分开放（grpline 等分，不带 gsub） */
pp.q = { type:'add', emoji:'🍎', unit:'个', op:'+', arity:2, a:5, b:5, c:10,
         groups:[5,5], brace:{from:0,to:1,label:'?个'}, labelText:'?个',
         given:false, slots:['a','b','c'], items:[] };
T.renderFigure(pp);
const fl5 = __kids(pp.fig, 'figline')[0];
__okT(fl5._cls.has('grpline') && !fl5._cls.has('gsub'), '加法两组分开摆（不等分成一排）');
__okT(__kids(pp.fig, 'gsec').length === 2, '加法仍是两段图案');

/* ========== 15c. 一行排开（不再 4+1）、标签只剩问号、四人题目不重样 ========== */
/* 5 个图案：课本画法是一行，不能 4 个 + 1 个"孤儿行" */
pp.q = { type:'cross', emoji:'🐯', unit:'只', op:'-', arity:2, a:5, b:1, c:4,
         given:false, slots:['a','b','c'],
         items: Array.from({length:5}, (_, i) => ({ mark: i >= 4 ? 'slash' : '' })) };
T.renderFigure(pp);
__okT(__kids(pp.fig, 'irow').length === 1, '5 个图案排成一行（不再 4+1）', 'rows=' + __kids(pp.fig, 'irow').length);
__okT(__kids(__kids(pp.fig, 'irow')[0], 'it').length === 5, '一行里正好 5 个图案');

/* 减法题（划去 / 框走 / 连减）一律不画大括号：
   大括号=「合起来」=加法，跟斜线/虚线框（减法）画在同一个区域，会读成两道题 */
__okT(__kids(pp.fig, 'bracewrap').length === 0, '划线题不画大括号');
__okT(__kids(pp.fig, 'lb').length === 0, '划线题下面不标任何字');

/* 实在要折行时折成等长：5→3+2、10→5+5、7→4+3，绝不 4+1 */
__okT(T.splitRows(5, 4).join(',') === '3,2', '5 个折成 3+2（不是 4+1）', T.splitRows(5, 4).join(','));
__okT(T.splitRows(10, 5).join(',') === '5,5', '10 个折成 5+5', T.splitRows(10, 5).join(','));
__okT(T.splitRows(7, 6).join(',') === '4,3', '7 个折成 4+3', T.splitRows(7, 6).join(','));
__okT(T.splitRows(4, 4).join(',') === '4', '刚好放得下就不折行');

/* 求另一部分：问号占位只画「?」 */
pp.q = { type:'part', emoji:'🐤', unit:'只', op:'-', arity:2, a:6, b:2, c:4,
         groups:[2], unknown:true, brace:{from:0,to:1,label:'6只'}, labelText:'?',
         given:false, slots:['a','b','c'], items:[] };
T.renderFigure(pp);
const qm2 = __kids(pp.fig, 'qmark')[0];
__okT(qm2 && qm2._text === '?', '问号占位不带单位', qm2 && qm2._text);

/* 四人题目两两不同：连开 30 局都不能撞（算式不撞、图案物种也不撞） */
S.settings.types = ['add','cross','box','part'];
S.settings.scope = 'mix';
S.settings.max = 10;
let dupSig = 0, dupEmoji = 0;
for (let t = 0; t < 30; t++){
  reset();
  const sigs = S.players.map(x => T.qSig(x.q));
  const ems = S.players.map(x => x.q.emoji);
  if (new Set(sigs).size !== sigs.length) dupSig++;
  if (new Set(ems).size !== ems.length) dupEmoji++;
}
__okT(dupSig === 0, '30 次开局四人算式从不重复', 'dup=' + dupSig);
__okT(dupEmoji === 0, '30 次开局四人图案不重复', 'dup=' + dupEmoji);

/* 5 以内题池更小，仍然要能排出四道不同的题 */
S.settings.max = 5;
let dup5 = 0;
for (let t = 0; t < 30; t++){
  reset();
  const sigs = S.players.map(x => T.qSig(x.q));
  if (new Set(sigs).size !== sigs.length) dup5++;
}
__okT(dup5 === 0, '5 以内四人算式也不重复', 'dup=' + dup5);
S.settings.max = 10;

/* 答对后换的新题也不能跟别人撞 */
reset();
const pa = S.players[0];
for (let t = 0; t < 20; t++){
  fillRight(pa);
  T.confirmAnswer(pa);
  __okMs(T.CONFIG.NEXT_MS + 400);
  const others = S.players.slice(1).map(x => T.qSig(x.q));
  __okT(others.indexOf(T.qSig(pa.q)) < 0, '换新题后仍与其他人不同 #' + t);
}

/* ========== 16. 长时间连打：不越界、不抛错 ========== */reset();
for (let round = 0; round < 60; round++){
  const pl = S.players[round % S.players.length];
  pl.done = false; pl.locked = false; pl.answers = {}; pl.cur = 0;
  fillRight(pl);
  T.confirmAnswer(pl);
  __okMs(100);
}
__okT(S.players.reduce((a, p) => a + p.score, 0) >= 40, '连续答题分数累计', '总得分=' + S.players.reduce((a,p)=>a+p.score,0));
`;

/* ---------------- 沙箱辅助函数 ---------------- */
function reg(id) {
  return registry.get(id) || doc.getElementById(id);
}
function kids(root, cls) {
  const out = [];
  const walk = (n) => n._children.forEach(c => { if (c._cls.has(cls)) out.push(c); walk(c); });
  walk(root);
  return out;
}

sandbox.__okT = (cond, name, extra) => ok(!!cond, name, extra);
sandbox.__reg = reg;
sandbox.__kids = kids;
sandbox.__flushMs = flushMs;
sandbox.__flushAll = flushAll;
sandbox.__clock = clock;

/* 测试里把 __okT / __okMs 映射成上面 ok()，并获得 80ms 级推进 */
sandbox.__okMs = (ms) => flushMs(ms);

vm.createContext(sandbox);
try {
  vm.runInContext(code + '\n;(function(){\n' + TEST + '\n})();', sandbox, { filename: 'game.js' });
} catch (e) {
  fail++;
  fails.push('脚本执行异常: ' + e.message);
  console.log('脚本执行异常：\n' + (e.stack || e.message));
}

/* ---------------- 输出 ---------------- */
const lines = [];
lines.push('抓娃娃看图列式 · 回归测试');
lines.push('时间: ' + new Date().toISOString());
lines.push('断言: ' + pass + ' 通过 / ' + fail + ' 失败');
lines.push('');
if (fail) { lines.push('失败清单:'); fails.forEach(f => lines.push('  ✗ ' + f)); }
else lines.push('全部通过 ✅');
const text = lines.join('\n');
fs.writeFileSync(OUT, text, 'utf8');
console.log(text);
