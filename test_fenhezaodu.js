/* =====================================================================
   分与合早读 · 无浏览器逻辑回归测试（DOM 桩 + vm 跑真实内联脚本）
   ===================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');

const HTML = 'C:/Users/aa109/Desktop/AIGame/小学一年级/分与合早读.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/test_fenhezaodu_result.txt';

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
    get parentNode() { return el._parent; },
    get parentElement() { return el._parent; },
    get textContent() { return el._text; },
    set textContent(v) { el._text = String(v); },
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = String(v); el._children = []; parseHTML(el, el._html); },
    appendChild(c) { c._parent = el; el._children.push(c); return c; },
    removeChild(c) { const i = el._children.indexOf(c); if (i >= 0) el._children.splice(i, 1); c._parent = null; },
    remove() { if (el._parent) el._parent.removeChild(el); },
    setAttribute(k, v) { if (k === 'class') el.className = v; else el.dataset[k.replace(/^data-/, '')] = v; },
    addEventListener(t, fn) { (el._ev[t] = el._ev[t] || []).push(fn); },
    removeEventListener() {},
    closest(sel) { return matches(el, sel) ? el : (el._parent && matches(el._parent, sel) ? el._parent : null); },
    querySelector(sel) { return queryAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(el, sel); },
    focus() {},
    click() { (el._ev.click || []).forEach(fn => fn({ target: el, stopPropagation(){} })); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 500 }; }
  };
  return el;
}

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
    if (!m[4] && !/^(br|img|input|hr|meta|link|circle|ellipse|line|path|polygon|rect|stop|use)$/i.test(tag)) stack.push(child);
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
  speechSynthesis: undefined,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};

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

const sandbox = {
  console, document: doc, window: windowStub,
  navigator: { userAgent: 'node' },
  location: { search: '?demo=1' },   /* demo 启动，跳过设置页，便于直接测卡片流 */
  URLSearchParams,
  innerWidth: 1920, innerHeight: 1080,
  alert: () => {},
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
  setInterval: fakeSetTimeout, clearInterval: fakeClearTimeout,
  requestAnimationFrame: (fn) => fakeSetTimeout(fn, 16),
  performance: { now: () => clock.now },
  Date: { now: () => clock.now },
  Math, JSON, Number, String, Array, Object, Boolean, RegExp, Error
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const code = fs.readFileSync(HTML, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

const TEST = `
const T = window.__T;
const S = T.S;
const $ = id => document.getElementById(id);

/* 1. demo 启动：直接开局，未揭晓 */
__okT(T.deck.length > 0 && T.idx === 0 && T.revealed === false, '1 demo直接开局在第一张');

/* 2. max=8 的牌堆结构 */
S.max = 8; S.kind = 'mix'; S.mode = 'think';
let d = T.buildDeck();
__okT(d.length === 32, '2 max8混合牌堆=32张', String(d.length));
__okT(d.every(c => c.total >= 2 && c.total <= 8), '2 总数全部在2~8');
__okT(d.every(c => c.a >= 1 && c.b >= 1 && c.a + c.b === c.total && c.a <= c.b), '2 部分非0、和=总数、a<=b');
__okT(d.every(c => (c.kind === 'fen' || c.kind === 'zu')), '2 只有两种卡型');
__okT(d.filter(c => c.total === 2 && c.kind === 'fen').length === 1, '2 total=2 只有一张分成卡(a=b去重)');
const pairsOf = t => d.filter(c => c.total === t);
__okT(pairsOf(5).filter(c => c.kind === 'fen').length === 2, '2 total=5 分成卡2张(1,4)(2,3)');
__okT(pairsOf(5).filter(c => c.kind === 'zu').length === 2, '2 total=5 组成卡2张');
/* 教学顺序：total 递增（忽略组内乱序） */
const seq = d.map(c => c.total);
__okT(seq.every((v, i) => i === 0 || v >= seq[i - 1]), '2 总数按教学进度递增排列');

/* 3. kind 过滤 */
S.kind = 'fen'; __okT(T.buildDeck().every(c => c.kind === 'fen'), '3 只练分成');
S.kind = 'zu'; __okT(T.buildDeck().every(c => c.kind === 'zu'), '3 只练组成');
S.kind = 'mix';

/* 4. 句式文案（HTML chip 与 TTS 两种） */
{
  const c = { total: 8, a: 2, b: 6, kind: 'fen', miss: 'a' };
  const q = T.cardText(c, false), r = T.cardText(c, true);
  __okT(q.indexOf('几') >= 0 && q.indexOf('6') >= 0 && q.indexOf('可以分成') >= 0, '4 分成问题句带几');
  __okT(r.indexOf('2') >= 0 && r.indexOf('6') >= 0 && r.indexOf('几') < 0, '4 分成揭晓句无几');
  __okT(q.indexOf('chip') >= 0 && q.indexOf('ji') >= 0, '4 chip/几有样式类');
  __okT(T.cardSpeak(c, false).indexOf('几') >= 0, '4 TTS问题句');
  __okT(T.cardSpeak(c, true) === '8可以分成2和6', '4 TTS揭晓句');
  const z = { total: 8, a: 7, b: 1, kind: 'zu', miss: 'a' };
  __okT(T.cardSpeak(z, false) === '几和1可以组成8', '4 组成问题句(视频同款)');
  __okT(T.cardSpeak(z, true) === '7和1可以组成8', '4 组成揭晓句(视频同款)');
  const z2 = { total: 8, a: 7, b: 1, kind: 'zu', miss: 'b' };
  __okT(T.cardSpeak(z2, false) === '7和几可以组成8', '4 组成问题句缺后项');
}

/* 5. 揭晓流程 */
S.max = 8; T.startSession();
__okT(T.idx === 0 && T.revealed === false, '5 重开后回到第一张');
const sentBefore = $('sentence').innerHTML;
T.reveal();
__okT(T.revealed === true, '5 揭晓标记');
__okT($('sentence').innerHTML.indexOf('几') < 0, '5 揭晓后句中无几');
__okT($('numRow').innerHTML.indexOf('<svg') >= 0 || $('numRow').innerHTML.indexOf('svg') >= 0, '5 舞台有数字SVG');
T.next();
__okT(T.idx === 1 && T.revealed === false, '5 下一张回到未揭晓');
T.prev();
__okT(T.idx === 0, '5 上一张回退');

/* 6. 纯齐读模式：句子一开始就无几 */
S.mode = 'read'; T.startSession();
__okT($('sentence').innerHTML.indexOf('几') < 0, '6 齐读模式直接全显示');
S.mode = 'think';

/* 7. 读完循环重洗 */
S.max = 2; T.startSession();
__okT(T.deck.length === 2, '7 max2牌堆2张', String(T.deck.length));
T.next(); T.next();
__okT(T.idx === 0, '7 读完回到开头重洗');

/* 8. max 2~10 全范围抽样：无超纲无0部分 */
{
  let bad = 0, n = 0;
  for (let m = 2; m <= 10; m++) {
    S.max = m;
    for (let r = 0; r < 10; r++) {
      const dd = T.buildDeck();
      for (const c of dd) {
        n++;
        if (!(c.total >= 2 && c.total <= m && c.a >= 1 && c.b >= 1 && c.a + c.b === c.total)) bad++;
      }
    }
  }
  __okT(n >= 800, '8 抽样量足够', String(n));
  __okT(bad === 0, '8 抽样全部合法', String(bad));
}

/* 9. 素材完备性：0~10 SVG 全部生成，主题色齐全 */
{
  let miss = 0;
  for (let i = 0; i <= 10; i++) { if (String(T.numSVG(i)).indexOf('svg') < 0) miss++; }
  __okT(miss === 0, '9 0~10数字SVG齐全');
  __okT(Object.keys(T.NCOLOR).length === 11, '9 主题色11个');
  __okT(String(T.numSVG(10)).indexOf('svg') >= 0 && String(T.numSVG(10)).split('svg').length > 4, '9 10由两个数字并排');
}
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
lines.push('分与合早读 逻辑回归：' + pass + ' 通过 / ' + fail + ' 失败');
if (err) lines.push('脚本异常: ' + err.message);
fails.forEach(f => lines.push('  FAIL ' + f));
lines.push('');
const report = lines.join('\n');
console.log(report);
fs.writeFileSync(OUT, report + '\n', 'utf8');
process.exit(fail || err ? 1 : 0);
