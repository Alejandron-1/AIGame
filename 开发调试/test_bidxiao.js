/* 比大小 V2.0（极简版）· 无浏览器逻辑回归测试
 * 用法: node test_bidxiao.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML = path.join(__dirname, '小学一年级', '比大小.html');
const code = fs.readFileSync(HTML, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------- 虚拟时钟 + 定时器收集 ---------- */
const clock = { now: 0 };
let timers = [];
let timerSeq = 0;
function setTimeout(fn, ms) { timers.push({ fn, at: clock.now + ms, id: ++timerSeq }); return timerSeq; }
function clearTimeout(id) { timers = timers.filter(t => t.id !== id); }
function advance(ms) {
  clock.now += ms;
  const due = timers.filter(t => t.at <= clock.now);
  timers = timers.filter(t => t.at > clock.now);
  due.forEach(t => { try { t.fn(); } catch (e) { errors.push('timer: ' + e.message); } });
}

/* ---------- 极简 DOM 桩 ---------- */
const errors = [];
function mkEl(tag) {
  const el = {
    tag, _cls: new Set(), _ev: {}, _children: [], _parent: null,
    style: {}, dataset: {}, offsetWidth: 0, disabled: false,
    _txt: '', _html: '', _attrs: {},
  };
  el.classList = {
    add: (...c) => c.forEach(x => el._cls.add(x)),
    remove: (...c) => c.forEach(x => el._cls.delete(x)),
    contains: (c) => el._cls.has(c),
    toggle: (c) => el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c),
  };
  Object.defineProperty(el, 'className', {
    get() { return [...el._cls].join(' '); },
    set(v) { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  });
  Object.defineProperty(el, 'textContent', {
    get() { return el._txt; },
    set(v) { el._txt = String(v); }
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) { el._html = String(v); el._children = []; } // 本游戏只用 innerHTML='' 清空
  });
  Object.defineProperty(el, 'children', { get() { return el._children; } });
  Object.defineProperty(el, 'lastElementChild', {
    get() { return el._children[el._children.length - 1] || null; }
  });
  Object.defineProperty(el, 'parentNode', { get() { return el._parent; } });
  el.addEventListener = (t, f) => { (el._ev[t] = el._ev[t] || []).push(f); };
  el.appendChild = (c) => { c._parent = el; el._children.push(c); return c; };
  el.removeChild = (c) => { const i = el._children.indexOf(c); if (i >= 0) el._children.splice(i, 1); return c; };
  el.setAttribute = (k, v) => {
    el._attrs[k] = String(v);
    if (k.startsWith('data-')) el.dataset[k.replace(/^data-/, '')] = String(v);
  };
  el.getAttribute = (k) => (el._attrs[k] != null ? el._attrs[k] : null);
  el.querySelector = () => null;
  el.querySelectorAll = () => [];
  return el;
}

/* ---------- 静态元素注册表 ---------- */
const registry = {};
[
  'topbar', 'title', 'roundTag', 'main', 'sideL', 'sideR', 'gridL', 'gridR',
  'numL', 'numR', 'center', 'centerQ', 'centerSym', 'centerWord',
  'btnRow', 'btnGt', 'btnEq', 'btnLt', 'toast', 'stage',
].forEach(id => { registry[id] = mkEl('div'); });

const keyHandlers = [];
const documentStub = {
  getElementById: (id) => (registry[id] || (registry[id] = mkEl('div'))),
  createElement: (t) => mkEl(t),
  createElementNS: (ns, t) => mkEl(t),
  body: mkEl('body'),
  addEventListener: (t, f) => { if (t === 'keydown') keyHandlers.push(f); },
  removeEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
};
const windowStub = {
  document: documentStub,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  addEventListener: () => {},
  location: { href: '' },
  AudioContext: undefined,
  innerWidth: 1920, innerHeight: 1080,
};

/* ---------- 断言 ---------- */
let pass = 0, fail = 0;
const lines = [];
function ok(cond, name) {
  if (cond) { pass++; lines.push('PASS ' + name); }
  else { fail++; lines.push('FAIL ' + name); }
}
function fire(elm, ev) { (elm._ev[ev] || []).forEach(f => f({ preventDefault: () => {} })); }
function fireKey(k) { keyHandlers.forEach(f => f({ key: k, preventDefault: () => {} })); }

/* ---------- 测试正文（vm 内执行） ---------- */
const TEST = `
// ===== A. 初始化与出题 =====
__ok(typeof S === 'object', 'A1 状态对象存在');
__ok(S.round === 1, 'A2 第一题');
__ok(S.left >= 1 && S.left <= 10, 'A3 左数量 1~10: ' + S.left);
__ok(S.right >= 1 && S.right <= 10, 'A4 右数量 1~10: ' + S.right);
__ok($('gridL')._children.length === S.left, 'A5 左图案数与数量一致');
__ok($('gridR')._children.length === S.right, 'A6 右图案数与数量一致');
__ok(S.eL !== S.eR, 'A7 左右图案类型不同');
__ok($('roundTag')._txt === '第 1 题', 'A8 题号显示正确');
__ok($('center')._cls.has('ok') === false, 'A9 初始未显示符号');
__ok($('numL')._cls.has('show') === false, 'A10 初始隐藏数字（先数数）');

// ===== B. 随机 300 题不变量 =====
var bBad = 0, bEq = 0, bGt = 0, bLt = 0;
for (var bi = 0; bi < 300; bi++) {
  newQuestion();
  if (S.left < 1 || S.left > 10 || S.right < 1 || S.right > 10) bBad++;
  if (S.eL === S.eR) bBad++;
  if ($('gridL')._children.length !== S.left || $('gridR')._children.length !== S.right) bBad++;
  var a = answerOf();
  if (a === 'gt' && !(S.left > S.right)) bBad++;
  if (a === 'lt' && !(S.left < S.right)) bBad++;
  if (a === 'eq' && S.left !== S.right) bBad++;
  if (a === 'eq') bEq++; else if (a === 'gt') bGt++; else bLt++;
}
__ok(bBad === 0, 'B1 300 题数量/图案/答案全部一致 (bad=' + bBad + ')');
__ok(bEq > 0 && bGt > 0 && bLt > 0, 'B2 三种答案都出现 (gt=' + bGt + ', lt=' + bLt + ', eq=' + bEq + ')');

// ===== C. 答错：抖动 + 提示，不锁定可重选 =====
var guard = 0;
do { newQuestion(); } while (answerOf() !== 'gt' && ++guard < 200);
__ok(answerOf() === 'gt', 'C0 已造出左>右的题');
var r0 = S.round;
onPick('lt'); // 错
__ok(S.locked === false, 'C1 答错不锁定');
__ok($('btnLt')._cls.has('shake'), 'C2 错误按钮抖动');
__ok($('toast').style.visibility === 'visible', 'C3 出现鼓励提示');
__ok($('toast')._txt.indexOf('想一想') >= 0, 'C4 提示文案: ' + $('toast')._txt);
onPick('eq'); // 再错
__ok(S.round === r0 && S.locked === false, 'C5 连续答错仍留在本题');

// ===== D. 答对：符号 + 数字 + 绿色 + 自动下一题 =====
onPick('gt');
__ok(S.locked === true, 'D1 答对后锁定');
__ok($('btnGt')._cls.has('good'), 'D2 正确按钮变绿');
__ok($('btnEq')._cls.has('dim') && $('btnLt')._cls.has('dim'), 'D3 其他按钮变淡');
__ok($('center')._cls.has('ok'), 'D4 中央显示符号');
__ok($('centerSym')._txt === '＞' && $('centerWord')._txt === '大于', 'D5 符号和文字正确');
__ok($('numL')._cls.has('show') && $('numR')._cls.has('show'), 'D6 亮出两侧数字');
__ok($('numL')._txt === S.left + ' 个', 'D7 左数字正确: ' + $('numL')._txt);
var roundAtD = S.round;
onPick('gt'); // 锁定后再点无效
__ok(S.round === roundAtD, 'D8 锁定后点击无效');
advance(1900);
__ok(S.round === roundAtD, 'D9 2 秒内不换题（提前触发检查）');
advance(200);
__ok(S.round === roundAtD + 1, 'D10 2 秒后自动下一题');
__ok(S.locked === false, 'D11 新题解锁');
__ok($('center')._cls.has('ok') === false, 'D12 新题符号复位');
__ok($('numL')._cls.has('show') === false, 'D13 新题数字重新隐藏');

// ===== E. 等于题 / 小于题全流程 =====
guard = 0; do { newQuestion(); } while (answerOf() !== 'eq' && ++guard < 600);
if (answerOf() === 'eq') {
  onPick('eq');
  __ok($('centerSym')._txt === '＝' && $('centerWord')._txt === '等于', 'E1 等于题符号正确');
  advance(2200);
} else { __ok(false, 'E0 未抽到等于题'); }
guard = 0; do { newQuestion(); } while (answerOf() !== 'lt' && ++guard < 600);
if (answerOf() === 'lt') {
  onPick('lt');
  __ok($('centerSym')._txt === '＜' && $('centerWord')._txt === '小于', 'E2 小于题符号正确');
  advance(2200);
} else { __ok(false, 'E0b 未抽到小于题'); }

// ===== F. 教师快捷键 =====
var fr = S.round;
fireKey('a'); // 显示答案
__ok(S.locked === true && S.round === fr, 'F1 A 键显示答案');
fireKey(' '); // 空格提前下一题
__ok(S.round === fr + 1 && S.locked === false, 'F2 空格键下一题');
// 连点保护：答对后立刻空格，旧的自动下一题定时器不得再触发
fireKey('a');
var fRound = S.round;
fireKey(' ');
advance(5000);
__ok(S.round === fRound + 1, 'F3 手动换题后旧定时器不串题');

// ===== G. 50 题随机全流程（含随机错选） =====
var gBad = 0;
for (var gi = 0; gi < 50; gi++) {
  var kinds = ['gt', 'eq', 'lt'];
  var wrongs = kinds.filter(function (k) { return k !== answerOf(); });
  onPick(wrongs[Math.floor(Math.random() * wrongs.length)]); // 先错一次
  onPick(answerOf()); // 再答对
  var rBefore = S.round;
  advance(2200); // 自动下一题
  if (S.round !== rBefore + 1 || S.locked !== false) gBad++;
}
__ok(gBad === 0, 'G1 50 题随机全流程零失败 (bad=' + gBad + ')');
`;

/* ---------- 运行 ---------- */
const sandbox = {
  document: documentStub, window: windowStub,
  setTimeout, clearTimeout, advance,
  console, JSON, Math, String, Number, parseInt, parseFloat, Boolean, Array, Object, Date, RegExp, Error,
  __ok: ok, $: (id) => documentStub.getElementById(id), fire, fireKey,
};
vm.createContext(sandbox);
let vmErr = null;
try {
  vm.runInContext(code + '\n' + TEST, sandbox, { filename: 'bidxiao-v2-test.js' });
} catch (e) { vmErr = e; }

lines.push('');
if (vmErr) {
  fail++;
  lines.push('VM ERROR: ' + (vmErr && vmErr.stack ? vmErr.stack.split('\n').slice(0, 6).join('\n') : String(vmErr)));
}
errors.forEach(e => lines.push('RUNTIME: ' + e));
lines.push('', '==== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 ====');
const out = '==== 比大小 V2.0（极简版）回归测试 ====\n' + lines.join('\n');
fs.writeFileSync(path.join(__dirname, 'test_bidxiao_result.txt'), out, 'utf8');
console.log(out);
