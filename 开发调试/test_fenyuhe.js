/* =====================================================================
   分与合运动会 · 无浏览器逻辑回归测试
   做法：极简 DOM 桩 + vm 跑真实内联脚本，断言直接读游戏状态（window.__T）
   ===================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');

const HTML = 'C:/Users/aa109/Desktop/AIGame/小学一年级/分与合运动会.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/test_fenyuhe_result.txt';

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
    disabled: false,
    offsetWidth: 0, clientWidth: 800, clientHeight: 320,
    onclick: null,
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
    get parentElement() { return el._parent; },
    get textContent() { return el._text; },
    set textContent(v) { el._text = String(v); },
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
    focus() {},
    click() { (el._ev.click || []).forEach(fn => fn({ target: el })); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 120, height: 60 }; },
    getContext() {
      const t = {};
      return new Proxy(t, {
        get(o, k) { return k in o ? o[k] : () => {}; },
        set(o, k, v) { o[k] = v; return true; }
      });
    }
  };
  return el;
}

/* 解析 innerHTML 里的标签（够用：class / data-* / 嵌套 / 文本） */
function parseHTML(root, html) {
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m, stack = [root], textBuf = '', last = 0;
  const flush = () => {
    if (textBuf.trim() && stack.length) stack[stack.length - 1]._text += textBuf.trim();
    textBuf = '';
  };
  while ((m = re.exec(html))) {
    const txt = html.slice(last, m.index);
    if (txt && txt.trim()) textBuf += txt.trim();
    last = re.lastIndex;
    flush();
    const closing = m[1] === '/', tag = m[2], attrs = m[3] || '';
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const child = mkEl(tag);
    const cm = attrs.match(/class="([^"]*)"/);
    if (cm) child.className = cm[1];
    [...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].forEach(d => { child.dataset[d[1]] = d[2]; });
    if (/\bdisabled\b/.test(attrs)) child.disabled = true;
    stack[stack.length - 1].appendChild(child);
    if (!m[4] && !/^(br|img|input|hr|meta|link|line|path|circle|ellipse|rect|stop)$/i.test(tag)) stack.push(child);
  }
  const tail = html.slice(last);
  if (tail && tail.trim()) textBuf += tail.trim();
  flush();
}

function matches(el, sel) {
  sel = sel.trim();
  if (!sel) return false;
  const re = /([.#]?)([^.#]+)/g;
  let m;
  while ((m = re.exec(sel))) {
    const mark = m[1], name = m[2];
    if (mark === '.') { if (!el._cls.has(name)) return false; }
    else if (mark === '#') { if (el.id !== name) return false; }
    else { if (el.tagName !== name.toUpperCase()) return false; }
  }
  return true;
}

function queryAll(root, selector) {
  const parts = selector.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  const walk = (n) => {
    n._children.forEach(c => {
      if (parts.some(p => matches(c, p))) out.push(c);
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
  fullscreenElement: undefined,
  _keyHandlers: [],
  getElementById(id) {
    if (!registry.has(id)) { const e = mkEl('div'); e.id = id; registry.set(id, e); }
    return registry.get(id);
  },
  createElement(t) { return mkEl(t); },
  addEventListener(t, fn) { if (t === 'keydown') doc._keyHandlers.push(fn); }
};

const windowStub = {
  document: doc,
  addEventListener() {},
  AudioContext: undefined,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};

/* ---------------- 假时钟 ---------------- */
const clock = { now: Date.now() };
let timers = [], tid = 0;
function fakeSetTimeout(fn, ms) { timers.push({ at: clock.now + (ms || 0), fn, id: ++tid }); return tid; }
function fakeClearTimeout(id) { timers = timers.filter(t => t.id !== id); }
function flushMs(ms) {
  const end = clock.now + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at);
    const due = timers.find(t => t.at <= end && !t.cleared);
    if (!due) break;
    clock.now = Math.max(clock.now, due.at);
    due.cleared = true;
    try { due.fn(); } catch (e) { console.log('timer error: ' + e.message); }
  }
  clock.now = Math.max(clock.now, end);
}

/* ---------------- 沙箱 ---------------- */
const sandbox = {
  console,
  document: doc,
  window: windowStub,
  navigator: { userAgent: 'node' },
  location: { search: '' },
  URLSearchParams,
  innerWidth: 1920, innerHeight: 1080,
  alert: () => {},
  setTimeout: fakeSetTimeout,
  clearTimeout: fakeClearTimeout,
  setInterval: fakeSetTimeout,
  clearInterval: fakeClearTimeout,
  requestAnimationFrame: (fn) => fakeSetTimeout(fn, 16),
  performance: { now: () => clock.now },
  Date: { now: () => clock.now },
  Math, JSON, Number, String, Array, Object, Boolean, RegExp, Error
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const code = fs.readFileSync(HTML, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------------- 测试主体（在沙箱里跑） ---------------- */
const TEST = `
const T = window.__T;
const $ = id => document.getElementById(id);
const click = el => (el._ev.click || []).forEach(fn => fn({ target: el }));
const clickSeg = (id, v) => {
  const b = $(id).querySelectorAll('button').filter(x => x.dataset.v === v)[0];
  if (!b) throw new Error('seg按钮不存在: ' + id + ' ' + v);
  click(b);
};
const btnOf = (i, v) => $('teams').children[i].querySelectorAll('button.answer')
  .filter(b => b.dataset.value === String(v))[0];
const card = i => $('teams').children[i];

/* 1. 启动即显示赛前设置 */
__okT($('setup').classList.contains('show'), '1 启动先显示赛前设置页');
__okT(!T.state.started, '1 未点开始前比赛未启动');
const onDef = $('segMax').querySelectorAll('button.on');
__okT(onDef.length === 1 && onDef[0].dataset.v === '10', '1 最大数默认选中10');

/* 2. 教师选最大数5 → 应用 → 题目全部不超过5 */
clickSeg('segMax', '5');
clickSeg('segRounds', '10');
clickSeg('segType', 'mix');
__okT(T.pending.max === 5 && T.pending.rounds === 10 && T.pending.type === 'mix', '2 设置写入pending');
click($('startBtn'));
__okT(T.state.started && T.settings.max === 5, '2 开始比赛并应用最大数5');
__okT(!$('setup').classList.contains('show'), '2 设置页已关闭');
__okT(T.deck.length === 10, '2 每组10题', String(T.deck.length));
__okT(T.deck.every(q => q.total >= 1 && q.total <= 5 && q.answer <= 5), '2 题目全部在5以内且无总数0');
__okT(T.deck.every(q => q.a + q.b === q.total), '2 两部分相加=总数');
__okT(T.deck.filter(q => q.zero).length === 2, '2 含0特殊题恰2道', String(T.deck.filter(q => q.zero).length));

/* 3. 面板上比最大数大的键灰掉不可点 */
const offVals = card(0).querySelectorAll('button.answer').filter(b => b._cls.has('off')).map(b => b.dataset.value);
__okT(offVals.join(',') === '6,7,8,9,10', '3 >5按键全部灰掉', offVals.join(','));
__okT(card(0).querySelectorAll('button.answer').every(b => b._cls.has('off') ? b.disabled : !b.disabled), '3 灰掉的键均disabled');

/* 4. 答错：按钮变红锁定、扣5分、可换一个再答 */
{
  const q = T.teams[0].q;
  const wrongV = q.answer + 1 <= 5 ? q.answer + 1 : q.answer - 1;
  const btn = btnOf(0, wrongV);
  click(btn);
  __okT(T.teams[0].wrongCount === 1, '4 答错计错1次');
  __okT(T.teams[0].score === 0, '4 分数不为负(0)', String(T.teams[0].score));
  __okT(T.teams[0].feedbackType === 'bad', '4 错误反馈样式');
  __okT(btn._cls.has('wrong') && btn.disabled, '4 错误按钮红且锁');
  __okT(!T.teams[0].q.answered && T.teams[0].done === 0, '4 本题未跳过可继续答');
}

/* 5. 答对：前进一格、得分100/10=10、720ms后换题 */
{
  const q = T.teams[0].q;
  const btn = btnOf(0, q.answer);
  click(btn);
  __okT(T.teams[0].done === 1 && T.teams[0].progress === 1, '5 完成数与前进数+1');
  __okT(Math.abs(T.teams[0].score - 10) < 1e-9, '5 每题得分10', String(T.teams[0].score));
  __okT(btn._cls.has('correct'), '5 正确按钮变绿');
  __okT(T.teams[0].q.answered, '5 本题已答标记');
  __okT($('boats').children[0].style.left.indexOf('8.4%') >= 0, '5 小船位置=5.5%+8.4%', $('boats').children[0].style.left);
  __flushMs(720);
  __okT(T.teams[0].q !== q, '5 延迟后换下一题');
  __okT(T.teams[0].feedback === '答对了！继续', '5 换题反馈文案');
}

/* 6. 暂停/继续 + P 快捷键 */
click($('pauseBtn'));
__okT(T.state.paused, '6 暂停生效');
__okT($('pauseBtn').textContent.indexOf('继续') >= 0, '6 按钮文案切换');
__okT(card(0).querySelectorAll('button.answer').every(b => b.disabled), '6 暂停时按键全禁用');
document._keyHandlers.forEach(fn => fn({ key: 'p' }));
__okT(!T.state.paused, '6 P键继续比赛');

/* 7. 打完整一轮 → 结算榜 */
for (let r = 0; r < 10; r++) {
  for (let i = 0; i < 4; i++) {
    const a = T.teams[i].q.answer;
    click(btnOf(i, a));
    __flushMs(720);
  }
}
__okT(T.state.finished, '7 全队完成触发结算');
__okT($('modal').classList.contains('show'), '7 结算榜弹出');
__okT($('winnerList').children.length === 4, '7 榜上4队');
__okT($('winnerList').innerHTML.indexOf('🥇') >= 0, '7 第一名金牌');
__okT(T.teams.every(t => t.done === 10 && Math.abs(t.score - 100) < 1e-9), '7 全对每队100分');
__okT($('boats').children[0].style.left.indexOf('84%') >= 0, '7 满进度船到终点位', $('boats').children[0].style.left);

/* 8. 开始下一轮 */
click($('nextRound'));
__okT(T.state.roundNo === 2 && !T.state.finished, '8 下一轮轮次+1');
__okT(T.teams.every(t => t.done === 0 && t.score === 0), '8 分数清零');
__okT(!$('modal').classList.contains('show'), '8 结算榜关闭');

/* 9. 比赛中改设置：sum 题型 + 最大数6 + 每组5 */
click($('setupBtn'));
__okT($('setup').classList.contains('show'), '9 设置页可再打开');
__okT($('cancelSetup').style.display === '', '9 比赛中显示返回按钮');
clickSeg('segMax', '6'); clickSeg('segRounds', '5'); clickSeg('segType', 'sum');
click($('startBtn'));
__okT(T.settings.max === 6 && T.settings.rounds === 5 && T.settings.type === 'sum', '9 新设置应用');
__okT(T.deck.length === 5 && T.deck.every(q => q.missing === 'total' && q.total <= 6), '9 sum题型只求总数且≤6');
__okT(T.teams.every(t => t.done === 0), '9 应用设置重开本轮');

/* 10. part 题型 */
click($('setupBtn'));
clickSeg('segType', 'part');
click($('startBtn'));
__okT(T.deck.every(q => q.missing !== 'total'), '10 part题型只求部分');

/* 11. 取消设置：不应用改动且恢复比赛 */
{
  const before = T.settings.max;
  click($('setupBtn'));
  clickSeg('segMax', '10');
  __okT(T.pending.max === 10 && T.settings.max === before, '11 改动只进pending');
  click($('cancelSetup'));
  __okT(!$('setup').classList.contains('show'), '11 取消关闭设置页');
  __okT(T.settings.max === before, '11 取消后设置不变');
  __okT(!T.state.paused, '11 取消后恢复进行中');
}

/* 12. 重置比赛 */
click($('resetBtn'));
__okT(T.state.roundNo === 1, '12 重置回第1轮');

/* 13. 出题抽样：max10/每组20 连开5轮共100题，无超纲无负数无非法题 */
{
  click($('setupBtn'));
  clickSeg('segMax', '10'); clickSeg('segRounds', '20'); clickSeg('segType', 'mix');
  click($('startBtn'));
  let n = 0, bad = 0;
  for (let r = 0; r < 5; r++) {
    for (const q of T.deck) {
      n++;
      if (!(q.total >= 1 && q.total <= 10 && q.a >= 0 && q.b >= 0 && q.a + q.b === q.total &&
            (q.answer === q.total || q.answer === q.a || q.answer === q.b))) bad++;
    }
    click($('nextRound'));
  }
  __okT(n === 100, '13 抽样恰100题', String(n));
  __okT(bad === 0, '13 抽样全部合法', String(bad));
}

/* 14. 最大数5+每组20：题库足够不缺题 */
click($('setupBtn'));
clickSeg('segMax', '5'); clickSeg('segRounds', '20'); clickSeg('segType', 'mix');
click($('startBtn'));
__okT(T.deck.length === 20, '14 每组20题正常出满', String(T.deck.length));
__okT(T.deck.every(q => q.total <= 5), '14 20题仍全部≤5');
`;

sandbox.__okT = (cond, name, extra) => ok(!!cond, name, extra);
sandbox.__flushMs = flushMs;

vm.createContext(sandbox);
let err = null;
try {
  vm.runInContext(code + '\n;(function(){\n' + TEST + '\n})();', sandbox, { filename: 'game.js' });
} catch (e) {
  err = e;
  console.log('脚本异常: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : e));
}

/* ---------------- 输出 ---------------- */
const lines = [];
lines.push('分与合运动会 逻辑回归：' + pass + ' 通过 / ' + fail + ' 失败');
if (err) lines.push('脚本异常: ' + err.message);
fails.forEach(f => lines.push('  FAIL ' + f));
lines.push('');
const report = lines.join('\n');
console.log(report);
fs.writeFileSync(OUT, report + '\n', 'utf8');
process.exit(fail || err ? 1 : 0);
