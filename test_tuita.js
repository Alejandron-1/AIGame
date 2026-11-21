/* =====================================================================
   口算推塔对战 · 无浏览器逻辑回归测试（DOM 桩 + vm 跑真实内联脚本）
   ===================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');

const HTML = 'C:/Users/aa109/Desktop/AIGame/小学一年级/推塔口算对战.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/test_tuita_result.txt';

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
    tagName: String(tag || 'div').toUpperCase(), _cls: new Set(), _children: [], _parent: null,
    _html: '', dataset: {}, _text: '', disabled: false, id: '', _ev: {},
    style: { _p: {}, setProperty(k, v) { this._p[k] = v; }, removeProperty() {} },
    classList: {
      add(...c) { c.forEach(x => el._cls.add(x)); }, remove(...c) { c.forEach(x => el._cls.delete(x)); },
      contains(c) { return el._cls.has(c); },
      toggle(c, force) { const on = force === undefined ? !el._cls.has(c) : !!force; if (on) el._cls.add(c); else el._cls.delete(c); return on; }
    },
    get className() { return [...el._cls].join(' '); },
    set className(v) { el._cls = new Set(String(v || '').split(/\s+/).filter(Boolean)); },
    get children() { return el._children; }, get parentNode() { return el._parent; },
    get parentElement() { return el._parent; },
    get textContent() { return el._text; }, set textContent(v) { el._text = String(v); },
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = String(v); el._children = []; parseHTML(el, el._html); },
    appendChild(c) { c._parent = el; el._children.push(c); return c; },
    prepend(c) { c._parent = el; el._children.unshift(c); return c; },
    removeChild(c) { const i = el._children.indexOf(c); if (i >= 0) el._children.splice(i, 1); },
    remove() { if (el._parent) el._parent.removeChild(el); },
    setAttribute(k, v) { if (k === 'class') el.className = v; else if (k === 'id') el.id = v; else el.dataset[k.replace(/^data-/, '')] = v; },
    addEventListener(t, fn) { (el._ev[t] = el._ev[t] || []).push(fn); }, removeEventListener() {},
    querySelector(sel) { return queryAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(el, sel); },
    click() { (el._ev.click || []).forEach(fn => fn({ target: el, stopPropagation() {} })); },
    getBoundingClientRect() { return { left: 100, top: 100, width: 300, height: 200 }; }
  };
  return el;
}
function parseHTML(root, html) {
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m, stack = [root], textBuf = '', last = 0;
  const flush = () => { if (textBuf.trim() && stack.length) stack[stack.length - 1]._text += textBuf.trim(); textBuf = ''; };
  while ((m = re.exec(html))) {
    const txt = html.slice(last, m.index);
    if (txt && txt.trim()) textBuf += txt.trim();
    last = re.lastIndex; flush();
    const closing = m[1] === '/', tag = m[2], attrs = m[3] || '';
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const child = mkEl(tag);
    const cm = attrs.match(/class="([^"]*)"/); if (cm) child.className = cm[1];
    const im = attrs.match(/id="([^"]*)"/); if (im) { child.id = im[1]; registry.set(im[1], child); }
    [...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].forEach(d => { child.dataset[d[1]] = d[2]; });
    if (/\bdisabled\b/.test(attrs)) child.disabled = true;
    stack[stack.length - 1].appendChild(child);
    if (!m[4] && !/^(br|img|input|hr|meta|link|circle|ellipse|line|path|polygon|rect|stop|use)$/i.test(tag)) stack.push(child);
  }
  const tail = html.slice(last);
  if (tail && tail.trim()) textBuf += tail.trim();
  flush();
}
function matches(el, sel) {
  sel = sel.trim(); if (!sel) return false;
  const re = /([.#]?)([^.#]+)/g; let m;
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
  const walk = (n) => { n._children.forEach(c => { if (parts.some(p => matches(c, p))) out.push(c); walk(c); }); };
  walk(root); return out;
}
const doc = {
  documentElement: mkEl('html'), body: mkEl('body'), head: mkEl('head'), fullscreenElement: undefined, _keyHandlers: [],
  getElementById(id) {
    if (registry.has(id)) return registry.get(id);
    const find = (root) => { if (root.id === id) return root; for (const c of root._children) { const f = find(c); if (f) return f; } return null; };
    const found = find(doc.body) || find(doc.documentElement);
    if (found) { registry.set(id, found); return found; }
    const e = mkEl('div'); e.id = id; registry.set(id, e); return e;
  },
  createElement(t) { return mkEl(t); },
  addEventListener(t, fn) { if (t === 'keydown') doc._keyHandlers.push(fn); }
};
/* 预置静态 HTML 里的关键子结构 */
['hpL', 'hpR'].forEach(id => {
  const w = doc.getElementById(id);
  const f = mkEl('div'); f.className = 'hpfill';
  const n = mkEl('div'); n.className = 'hpnum';
  w.appendChild(f); w.appendChild(n);
});
const windowStub = {
  document: doc, addEventListener() {}, AudioContext: undefined, speechSynthesis: undefined,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
const clock = { now: 2000000 };
let timers = [], tid = 0, clearedInt = new Set();
function fakeSetTimeout(fn, ms) { timers.push({ at: clock.now + (ms || 0), fn, id: ++tid }); return tid; }
function fakeClearTimeout(id) { timers = timers.filter(t => t.id !== id); }
function fakeSetInterval(fn, ms) {
  const id = ++tid;
  const step = () => { if (clearedInt.has(id)) return; try { fn(); } catch (e) {} fakeSetTimeout(step, ms); };
  fakeSetTimeout(step, ms); return id;
}
function flushMs(ms) {
  const end = clock.now + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at);
    const due = timers.find(t => t.at <= end && !t.cleared);
    if (!due) break;
    clock.now = Math.max(clock.now, due.at); due.cleared = true;
    try { due.fn(); } catch (e) { console.log('timer error: ' + e.message); }
  }
  clock.now = Math.max(clock.now, end);
}
const sandbox = {
  console, document: doc, window: windowStub, navigator: { userAgent: 'node' },
  location: { search: '' }, URLSearchParams, innerWidth: 1920, innerHeight: 1080, alert: () => {},
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
  setInterval: fakeSetInterval, clearInterval(id) { clearedInt.add(id); },
  requestAnimationFrame: (fn) => fakeSetTimeout(fn, 0),
  performance: { now: () => clock.now }, Date: { now: () => clock.now },
  Math, JSON, Number, String, Array, Object, Boolean, RegExp, Error
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;

const code = fs.readFileSync(HTML, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

const TEST = `
const T = window.__T;
const S = T.S;
const $ = id => document.getElementById(id);
const flush = ms => __flushMs(ms);

/* 1. 启动：设置浮层显示，两面板已出题 */
__okT(S.phase === 'setup' && $('setup')._cls.has('show'), '1 启动显示设置页');
__okT(!!S.teams[0].q && !!S.teams[1].q, '1 两队面板已备题');

/* 2. 出题抽样 400 题：数值约束全合法 */
{
  let bad = 0, n = 0;
  const kinds = ['mix', 'fig', 'lian'];
  for (const k of kinds) {
    S.kind = k;
    for (let i = 0; i < 130; i++) {
      const q = T.buildQuestion(); n++;
      if (!(q.arity === 2 || q.arity === 3)) bad++;
      if (q.arity === 2) {
        if (!(q.nums.length === 2 && q.res >= 0 && q.res <= 10)) bad++;
        if (q.kind === 'add' && !(q.nums[0] >= 1 && q.nums[1] >= 1 && q.res === q.nums[0] + q.nums[1] && q.res <= 10)) bad++;
        if (q.kind === 'part') {
          const [c, cut] = q.nums;
          if (!(c >= 3 && c <= 10 && cut >= 1 && cut <= c - 2 && q.res === c - cut)) bad++;
        }
      } else {
        if (!(q.nums.length === 3)) bad++;
        const [a, b, c] = q.nums;
        if (q.op === '+' && !(a >= 1 && b >= 1 && c >= 1 && a + b + c <= 10 && q.res === a + b + c)) bad++;
        if (q.op === '-' && !(q.nums[0] >= 5 && q.nums[0] <= 10 && b >= 1 && c >= 1 && q.res >= 1 && q.res === a - b - c)) bad++;
        if (q.kind === 'sub3' && !(a - b - c >= 1)) bad++;
      }
    }
  }
  __okT(n >= 350, '2 抽样量足够', String(n));
  __okT(bad === 0, '2 抽样全部合法无负数', String(bad));
}

/* 3. 开局：run 状态、面板渲染、键盘按钮就绪 */
T.startRound();
__okT(S.phase === 'run' && S.hp[0] === 100 && S.hp[1] === 100, '3 开局双方满血');
__okT($('panel0')._html.indexOf('确定') >= 0 && $('panel0')._html.indexOf('＋') >= 0, '3 面板键盘含运算符与确定');

/* 4. 答对 → solved+1、出兵、对面掉血 */
{
  const foe = 1;
  const hpBefore = S.hp[foe];
  const q = S.teams[0].q;
  /* 依次按运算符与数字（自动判定） */
  T.pressKey(0, q.op);
  q.nums.forEach(v => { String(v).split('').forEach(ch => T.pressKey(0, Number(ch))); });
  T.pressKey(0, Number(q.res));
  __okT(S.teams[0].solved === 1, '4 答对计砍1次');
  __okT($('field')._html.indexOf('soldier') >= 0 || $('field')._children.length > 0, '4 战场上出现小兵');
  flush(6000);   /* 走路1.7s+砍3次+换题 全部跑完 */
  __okT(S.hp[foe] === hpBefore - 21, '4 出兵砍塔对面-21', S.hp[foe] + ' vs ' + hpBefore);
  __okT(!!S.teams[0].q, '4 判定后换新题');
}

/* 5. 答错：不掉血，提示重答 */
{
  const q = S.teams[1].q;
  const hpBefore = S.hp[0];
  /* 填一个必错的数：res 填 0（若 res 恰为 0 则填 1） */
  T.pressKey(1, q.op);
  q.nums.forEach(v => String(v).split('').forEach(ch => T.pressKey(1, Number(ch))));
  T.pressKey(1, q.res + 2 <= 10 ? q.res + 2 : q.res - 3);
  __okT(S.hp[0] === hpBefore, '5 答错不掉对面血');
    __okT(S.teams[1].msg.indexOf('再想') >= 0, '5 提示再想一想');
  flush(500);
}

/* 6. 求另一部分宽容判定：想加算减也算对 */
{
  S.teams[0].q = { kind:'part', arity:2, op:'-', nums:[8,3], res:5, figMarked:{total:8,cut:3,em:'🐒'} };
  S.teams[0].ans = {}; S.teams[0].ops = []; S.teams[0].cur = null;
  /* 标准：8-3=5 */
  T.pressKey(0, '-'); T.pressKey(0, 8); T.pressKey(0, 3); T.pressKey(0, 5);
  __okT(S.teams[0].solved === 2, '6 标准减法判对');
  flush(6000);
  /* 宽容：5+3=8 */
  S.teams[0].q = { kind:'part', arity:2, op:'-', nums:[8,3], res:5, figMarked:{total:8,cut:3,em:'🐒'} };
  S.teams[0].ans = {}; S.teams[0].ops = []; S.teams[0].cur = null;
  T.pressKey(0, '+'); T.pressKey(0, 5); T.pressKey(0, 3); T.pressKey(0, 8);
  __okT(S.teams[0].solved === 3, '6 想加算减也算对');
  flush(6000);
}

/* 7. 两位数答案 10：1 后按 0 组成 */
{
  S.teams[1].q = { kind:'plain', arity:2, op:'+', nums:[6,4], res:10, fig:null };
  S.teams[1].ans = {}; S.teams[1].ops = []; S.teams[1].cur = null; S.teams[1].clicked = false;
  T.pressKey(1, '+');
  T.pressKey(1, 6); T.pressKey(1, 4);
  T.pressKey(1, 1);
    __okT(String(S.teams[1].ans['res']) === '1', '7 res 先落 1');
  T.pressKey(1, 0);
    __okT(Number(S.teams[1].ans['res']) === 10, '7 再按0组成10');
  flush(6000);
  __okT(S.hp[0] === 79, '7 蓝队答对砍红方-21', String(S.hp[0]));
}

/* 7b. 被减数 10（两位数）连减输入：1 后按 0 拼进同一槽 */
{
  S.teams[1].q = { kind:'plain', arity:3, op:'-', nums:[10,3,2], res:5, fig:null };
  S.teams[1].ans = {}; S.teams[1].ops = []; S.teams[1].cur = null; S.teams[1].clicked = false;
  T.pressKey(1, '-');
  T.pressKey(1, 1);
  __okT(String(S.teams[1].ans['n0']) === '1', '7b 先落 1');
  T.pressKey(1, 0);
  __okT(Number(S.teams[1].ans['n0']) === 10, '7b 拼 10 到同一槽', JSON.stringify(S.teams[1].ans));
  T.pressKey(1, 3); T.pressKey(1, 2); T.pressKey(1, 5);
  __okT(S.teams[1].solved >= 1, '7b 被减数10判对出兵');
  flush(6000);
}

/* 8. 推平：对面血量打到 0 → 结算胜利 */
{
  const startHp = S.hp[1];
  S.hp[1] = 7; T.renderHP();
  const hpLog=[]; S.hpLog=hpLog;
  const q = S.teams[0].q;
    T.pressKey(0, q.op);
  q.nums.forEach(v => String(v).split('').forEach(ch => T.pressKey(0, Number(ch))));
  T.pressKey(0, Number(q.res));
    flush(6000);
    __okT(S.hp[1] === 0, '8 蓝方塔血量归零');
  __okT(S.phase === 'over' && $('over')._cls.has('show'), '8 推平触发结算浮层');
  __okT($('winnerBig')._text.indexOf('红队') >= 0, '8 红队获胜标语');
}

/* 9. 再来一轮回设置 */
{
  const again = $('againBtn');
  if (again) again.click();
  __okT($('over')._cls && !$('over')._cls.has('show'), '9 结算浮层关闭');
  __okT(S.phase === 'setup' || $('setup')._cls.has('show') || S.phase === 'run', '9 回到可开局状态');
}

/* 10. 时间到 → 血多者胜 */
T.startRound();
S.hp = [60, 40]; T.renderHP();
T.gameOver();
__okT(S.phase === 'over', '10 时间到进结算');
__okT($('winnerBig')._text.indexOf('红队') >= 0, '10 血多者红队胜');
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

const lines = [];
lines.push('口算推塔对战 逻辑回归：' + pass + ' 通过 / ' + fail + ' 失败');
if (err) lines.push('脚本异常: ' + err.message);
fails.forEach(f => lines.push('  FAIL ' + f));
lines.push('');
const report = lines.join('\n');
console.log(report);
fs.writeFileSync(OUT, report + '\n', 'utf8');
process.exit(fail || err ? 1 : 0);
