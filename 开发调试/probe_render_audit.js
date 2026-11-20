// 渲染审题探针：真的画出来之后，数一数图上画了几个、划了几个、框了几个，跟题目数据对
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_ra.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S;
  var mx = Number((new URLSearchParams(location.search)).get('max') || 10);
  S.settings.max = mx;
  T.startGame(); S.paused = false;
  var p = S.players[0];
  var TYPES = ['add','part','cross','box','add3','sub3'];
  var bad = [], lines = [];
  TYPES.forEach(function(type){
    for (var n = 0; n < 25; n++){
      var q = T.buildQuestion(type);
      p.q = q; p.slots = q.slots.slice(); p.answers = {}; p.ops = {}; p.cur = 0;
      p.locked = false; p.done = false;
      T.renderQuestion(p);
      var fig = p.fig;
      var its = fig.querySelectorAll('.it').length;
      var sl = fig.querySelectorAll('.sl').length;
      var boxes = fig.querySelectorAll('.dashbox'), boxIn = 0;
      Array.prototype.forEach.call(boxes, function(b){ boxIn += b.querySelectorAll('.it').length; });
      var qm = fig.querySelectorAll('.qmark').length;
      var lbEl = fig.querySelector('.lb');
      var lb = lbEl ? (lbEl.textContent || '') : '';
      var gsecs = fig.querySelectorAll('.gsec').length;
      var errs = [];

      if (type === 'add'){
        if (its !== q.a + q.b) errs.push('图上' + its + '个≠' + q.a + '+' + q.b);
        if (gsecs !== 2) errs.push('不是两组(' + gsecs + ')');
        if (lb !== '?') errs.push('括号不是 ?（' + lb + '）');
        if (qm) errs.push('加法不该有问号占位');
      } else if (type === 'add3'){
        if (its !== q.a + q.b + q.third) errs.push('图上' + its + '个≠三组之和');
        if (gsecs !== 3) errs.push('不是三组(' + gsecs + ')');
        if (lb !== '?') errs.push('括号不是 ?（' + lb + '）');
      } else if (type === 'part'){
        if (its !== q.b) errs.push('图上' + its + '个≠已知部分' + q.b);
        if (qm !== 1) errs.push('问号占位' + qm + '个');
        if (lb !== q.a + q.unit) errs.push('括号应标' + q.a + q.unit + '，实际' + lb);
      } else if (type === 'cross'){
        if (its !== q.a) errs.push('图上' + its + '个≠' + q.a);
        if (sl !== q.b) errs.push('划掉' + sl + '≠' + q.b);
        if (lb || qm) errs.push('减法多了标注（' + lb + '）');
      } else if (type === 'box'){
        if (its !== q.a) errs.push('图上' + its + '个≠' + q.a);
        if (boxIn !== q.b) errs.push('框住' + boxIn + '≠' + q.b);
        if (lb || qm) errs.push('减法多了标注（' + lb + '）');
      } else {
        if (its !== q.a) errs.push('图上' + its + '个≠' + q.a);
        if (sl !== q.b) errs.push('划掉' + sl + '≠' + q.b);
        if (boxIn !== q.third) errs.push('框住' + boxIn + '≠' + q.third);
        if (lb || qm) errs.push('连减多了标注');
      }
      if (errs.length) bad.push(type + ' ' + JSON.stringify({a:q.a,b:q.b,t:q.third,c:q.c}) + ' 图上' + its + '个 → ' + errs.join('；'));
      if (n === 0){
        var desc = '';
        if (type === 'add') desc = '图上 ' + q.a + ' 个 + ' + q.b + ' 个，括号问号 → ' + q.a + '+' + q.b + '=' + q.c;
        else if (type === 'add3') desc = '图上 ' + q.groups.join('+') + ' 三组，括号问号 → 和=' + q.c;
        else if (type === 'part') desc = '图上 ' + q.b + ' 个 + 问号，括号标' + q.a + q.unit + ' → ' + q.a + '-' + q.b + '=' + q.c;
        else if (type === 'cross') desc = '图上 ' + q.a + ' 个，划掉 ' + q.b + ' 个 → ' + q.a + '-' + q.b + '=' + q.c;
        else if (type === 'box') desc = '图上 ' + q.a + ' 个，框住 ' + q.b + ' 个 → ' + q.a + '-' + q.b + '=' + q.c;
        else desc = '图上 ' + q.a + ' 个，划掉 ' + q.b + '、框住 ' + q.third + ' → ' + q.a + '-' + q.b + '-' + q.third + '=' + q.c;
        lines.push(type + ': ' + desc);
      }
    }
  });
  document.getElementById('__out').textContent = JSON.stringify({ bad: bad.slice(0, 20), badCount: bad.length, lines: lines });
}, 500); });
</script>`);
fs.writeFileSync(P, html, 'utf8');

function run(max){
  const url = 'file:///' + encodeURI(P.replace(/\\/g, '/')) + '?max=' + max;
  const out = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080',
    '--virtual-time-budget=2500', '--dump-dom', url],
    { stdio: 'pipe', timeout: 60000, maxBuffer: 1 << 26 }).toString();
  const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
  const raw = (m ? m[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const o = JSON.parse(raw);
  console.log('=== 渲染核对 · 数的范围 1~' + max + ' · 每题型 25 道 ===');
  console.log('不一致的题：' + o.badCount);
  o.bad.forEach(function(s){ console.log('  ✗ ' + s); });
  o.lines.forEach(function(s){ console.log('  ' + s); });
}
run(10);
run(5);
fs.unlinkSync(P);
