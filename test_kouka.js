/* =====================================================================
   3D口算卡 · 无浏览器逻辑回归测试（DOM 桩 + vm 跑真实内联脚本）
   ===================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');

const HTML = 'C:/Users/aa109/Desktop/AIGame/小学一年级/3D口算卡.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/test_kouka_result.txt';

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
    _cls: new Set(), _children: [], _parent: null, _html: '', dataset: {}, _text: '',
    disabled: false, id: '', _ev: {},
    style: { _p: {}, setProperty(k, v) { this._p[k] = v; }, removeProperty(k) { delete this._p[k]; } },
    classList: {
      add(...c) { c.forEach(x => el._cls.add(x)); },
      remove(...c) { c.forEach(x => el._cls.delete(x)); },
      contains(c) { return el._cls.has(c); },
      toggle(c, force) { const on = force === undefined ? !el._cls.has(c) : !!force; if (on) el._cls.add(c); else el._cls.delete(c); return on; }
    },
    get className() { return [...el._cls].join(' '); },
    set className(v) { el._cls = new Set(String(v || '').split(/\s+/).filter(Boolean)); },
    get children() { return el._children; },
    get parentNode() { return el._parent; },
    get parentElement() { return el._parent; },
    get textContent() { return el._text; },
    set textContent(v) { el._text = String(v); },
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = String(v); el._children = []; parseHTML(el, el._html); },
    appendChild(c) { c._parent = el; el._children.push(c); if (el.id === 'book' && c.id === 'coverLeaf') registry.set('coverLeaf', c); return c; },
    removeChild(c) { const i = el._children.indexOf(c); if (i >= 0) el._children.splice(i, 1); c._parent = null; },
    remove() { if (el._parent) el._parent.removeChild(el); if (el.id === 'coverLeaf') registry.delete('coverLeaf'); },
    setAttribute(k, v) { if (k === 'class') el.className = v; else if (k === 'id') { el.id = v; } else el.dataset[k.replace(/^data-/, '')] = v; },
    addEventListener(t, fn) { (el._ev[t] = el._ev[t] || []).push(fn); },
    removeEventListener() {},
    querySelector(sel) { return queryAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(el, sel); },
    click() {
      /* 冒泡：button 点击会触发卡片上绑定的 handler（e.target 保持为按钮） */
      let node = el;
      const evs = [];
      while (node) { (node._ev.click || []).forEach(fn => evs.push(fn)); node = node._parent; }
      evs.forEach(fn => fn({ target: el, stopPropagation(){} }));
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 500 }; }
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
    const cm = attrs.match(/class="([^"]*)"/);
    if (cm) child.className = cm[1];
    const im = attrs.match(/id="([^"]*)"/);
    if (im) { child.id = im[1]; registry.set(im[1], child); }
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
  documentElement: mkEl('html'), body: mkEl('body'), fullscreenElement: undefined, _keyHandlers: [],
  getElementById(id) {
    if (registry.has(id)) return registry.get(id);
    const find = (root) => {
      if (root.id === id) return root;
      for (const c of root._children) { const f = find(c); if (f) return f; }
      return null;
    };
    const found = find(doc.body) || find(doc.documentElement);
    if (found) { registry.set(id, found); return found; }
    const e = mkEl('div'); e.id = id; registry.set(id, e); return e;
  },
  createElement(t) { return mkEl(t); },
  addEventListener(t, fn) { if (t === 'keydown') doc._keyHandlers.push(fn); }
};
const windowStub = {
  document: doc, addEventListener() {}, AudioContext: undefined, speechSynthesis: undefined,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
const clock = { now: 1000000 };
let timers = [], tid = 0;
function fakeSetTimeout(fn, ms) { timers.push({ at: clock.now + (ms || 0), fn, id: ++tid }); return tid; }
function fakeClearTimeout(id) { timers = timers.filter(t => t.id !== id); }
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
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, setInterval: fakeSetTimeout, clearInterval: fakeClearTimeout,
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

/* 1. 启动：封面态，封皮全宽盖上，键盘藏起 */
__okT(S.phase === 'cover', '1 启动是封面态');
__okT(!!$('coverLeaf'), '1 封皮叶子存在');
__okT(!$('keypad')._cls.has('show'), '1 键盘隐藏');

/* 2. 点封皮翻开 → 扉页 */
T.openBook();
__okT(S.phase === 'title' && S.flipping === true, '2 翻开中进入扉页');
flush(T.FLIP_MS + 50);
__okT(S.flipping === false, '2 翻页完成');
__okT($('rightHalf').innerHTML.indexOf('10以内的加减法') >= 0, '2 扉页标题出现');
__okT($('rightHalf').innerHTML.indexOf('data-setn') >= 0, '2 扉页有题数设置');

/* 3. 扉页设置 pills 点击生效 */
{
  const card = $('curcard');
  const b10 = card.querySelectorAll('button').filter(b => b.dataset.setn === '15')[0];
  b10.click();
  __okT(S.set.n === 15, '3 点15题生效');
  const bm = card.querySelectorAll('button').filter(b => b.dataset.setk === 'sub')[0];
  bm.click();
  __okT(S.set.kind === 'sub', '3 点减法生效');
  S.set.n = 10; S.set.kind = 'mix';
}

/* 4. 开局 → 第一题 */
T.startRound();
flush(T.FLIP_MS + 50);
__okT(S.phase === 'q' && S.deck.length === 10, '4 开局10题');
__okT($('keypad')._cls.has('show'), '4 键盘弹出');
const pg=$('rightHalf').querySelector('.page');__okT($('rightHalf').querySelector('.page')._html.indexOf('第 1 张') >= 0, '4 页码第1张');

/* 5. 答错：抖动/计错/不翻页 */
{
  const q = S.deck[0];
  const bad = q.ans === 10 ? 5 : (q.ans === 9 ? 0 : q.ans + 1);
  T.pressKey(Number(String(bad)[0]));
  if (String(bad).length > 1) T.pressKey(Number(String(bad)[1]));
  __okT(S.wrong === 1, '5 答错计1次');
  __okT(S.wrongIdx.has(0), '5 记录首错题');
  __okT(S.idx === 0 && S.phase === 'q', '5 答错不翻页');
  flush(500);
  __okT(S.input === '', '5 答错后输入清空');
}

/* 6. 答对：延迟 680ms 后进入翻页 */
{
  const q = S.deck[0];
  String(q.ans).split('').forEach(ch => T.pressKey(Number(ch)));
  flush(700);
  __okT(S.flipping === true, '6 答对进入翻页');
  flush(T.FLIP_MS + 200);
  __okT(S.idx === 1 && S.flipping === false, '6 自动翻到第2题');
}

/* 7. 连答到结束 → 成绩页 */
let guard = 0;
while (S.phase === 'q' && guard++ < 40) {
  const q = S.deck[S.idx];
  String(q.ans).split('').forEach(ch => T.pressKey(Number(ch)));
  flush(T.FLIP_MS + 800);
}
flush(2600);   /* 等收尾连翻级联定时器全部跑完 */
__okT(S.phase === 'score', '7 全部答完进成绩页');
__okT($('rightHalf').innerHTML.indexOf('全部答完') >= 0, '7 成绩卡出现');
__okT($('rightHalf').innerHTML.indexOf('用时') >= 0 && $('rightHalf').innerHTML.indexOf('正确率') >= 0, '7 三项统计齐全');
__okT(S.wrong === 1, '7 答错1次统计正确');

/* 8. 错题重做 */
{
  const rb = $('redoBtn');
  __okT(!!rb, '8 成绩卡上有错题重做按钮');
  if (rb) rb.click();
  flush(T.FLIP_MS + 100);
  __okT(S.phase === 'q', '8 错题重做进入答题');
  __okT(S.deck.every(q => q.wrongOnce) && S.deck.length === 1, '8 重做队列只有错题', String(S.deck.length));
  const q = S.deck[0];
  String(q.ans).split('').forEach(ch => T.pressKey(Number(ch)));
  flush(T.FLIP_MS + 2600);
  __okT(S.phase === 'score', '8 重做完回成绩');
}

/* 9. 再来一轮回扉页 */
{
  const again = $('againBtn');
  if (again) again.click();
  __okT(S.phase === 'title', '9 再来一轮回扉页');
}

/* 10. 牌堆约束抽样 */
{
  let bad = 0, n = 0;
  const kinds = ['mix', 'add', 'sub'];
  for (const k of kinds) {
    S.set.kind = k;
    for (let r = 0; r < 8; r++) {
      const d = T.buildDeck();
      const seen = new Set();
      for (const q of d) {
        n++;
        const sig = q.op + q.a + '_' + q.b;
        if (seen.has(sig)) bad++;
        seen.add(sig);
        if (q.op === '+') { if (!(q.a >= 0 && q.b >= 0 && q.a + q.b <= 10 && q.ans === q.a + q.b)) bad++; }
        else { if (!(q.a >= 1 && q.a <= 10 && q.b >= 0 && q.b <= q.a && q.ans === q.a - q.b)) bad++; }
      }
    }
  }
  __okT(n >= 200, '10 抽样量足够', String(n));
  __okT(bad === 0, '10 抽样全部合法且无重复', String(bad));
}

/* 11. 两位数答案（10）输入 */
S.set.kind = 'add';
T.startRound();
flush(T.FLIP_MS + 100);
S.deck = [{ op: '+', a: 6, b: 4, ans: 10, wrongOnce: false }]; S.idx = 0; S.wrong = 0; S.wrongIdx = new Set();
S.phase = 'q'; S.input = '';
__flushMs(10);
T.pressKey(1);
__okT(S.input === '1' && S.phase === 'q' && !S.flipping, '11 按1等待第二位不判');
T.pressKey(0);
__okT(S.input === '10', '11 再按0组成10即判对');
T.pressKey('ok');
flush(T.FLIP_MS + 800);
__okT(S.phase === 'score', '11 答10判对进成绩');
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
lines.push('3D口算卡 逻辑回归：' + pass + ' 通过 / ' + fail + ' 失败');
if (err) lines.push('脚本异常: ' + err.message);
fails.forEach(f => lines.push('  FAIL ' + f));
lines.push('');
const report = lines.join('\n');
console.log(report);
fs.writeFileSync(OUT, report + '\n', 'utf8');
process.exit(fail || err ? 1 : 0);
