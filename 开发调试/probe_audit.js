// 审题探针：六种题型各出 N 道，逐题核对「图里能数出来的数」是否和答案一致
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_audit.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S;
  S.settings.max = Number((new URLSearchParams(location.search)).get('max') || 10);
  var TYPES = ['add','part','cross','box','add3','sub3'];
  var bad = [], sample = [];
  var N = 120;
  TYPES.forEach(function(type){
    for (var n = 0; n < N; n++){
      var q = T.buildQuestion(type);
      var errs = [];
      var isAdd = q.op === '+';
      if (q.arity === 2){
        if (isAdd){
          if (!q.groups || q.groups.length !== 2) errs.push('加法不是两组');
          else if (q.groups[0] + q.groups[1] !== q.c) errs.push('两组之和≠c');
          if (!q.brace || q.brace.label !== '?') errs.push('加法没有大括号问号');
          if (q.items && q.items.length) errs.push('加法混进了单排 items');
        } else if (q.type === 'part'){
          if (q.groups[0] !== q.b) errs.push('图上画的已知部分≠b');
          if (q.a - q.b !== q.c) errs.push('a-b≠c');
          if (!q.unknown) errs.push('没有问号占位');
          if (!q.brace || q.brace.label !== q.a + q.unit) errs.push('大括号没标已知总数');
        } else {
          if (q.items.length !== q.a) errs.push('图案数≠a');
          var k = q.items.filter(function(o){ return o.mark !== ''; }).length;
          if (k !== q.b) errs.push('去掉的个数≠b');
          if (q.a - q.b !== q.c) errs.push('a-b≠c');
          if (q.brace || q.labelText) errs.push('减法多了标注');
          if (q.c < 1) errs.push('减法结果<1');
        }
      } else {
        if (isAdd){
          if (q.groups.length !== 3) errs.push('连加不是三组');
          if (q.a + q.b + q.third !== q.c) errs.push('连加和≠c');
          if (!q.brace || q.brace.label !== '?') errs.push('连加没有大括号问号');
        } else {
          if (q.items.length !== q.a) errs.push('图案数≠a');
          var sl = q.items.filter(function(o){ return o.mark === 'slash'; }).length;
          var bx = q.items.filter(function(o){ return o.mark === 'box'; }).length;
          if (sl !== q.b) errs.push('划去数≠b');
          if (bx !== q.third) errs.push('框走数≠third');
          if (q.a - q.b - q.third !== q.c) errs.push('a-b-c≠c');
          if (q.brace || q.labelText) errs.push('连减多了标注');
          if (q.c < 1) errs.push('连减结果<1');
        }
      }
      /* 数的范围 */
      var mx = S.settings.max;
      if (q.a > mx || q.c > mx) errs.push('超出范围');
      if (q.arity === 3 && q.third > mx) errs.push('third 超范围');
      if (errs.length) bad.push(type + ' #' + n + ' ' + JSON.stringify({a:q.a,b:q.b,c:q.c,t:q.third,op:q.op}) + ' → ' + errs.join('；'));
      if (n < 2) sample.push(type + ': ' + (isAdd ? q.groups.join(' + ') : (q.groups ? q.groups[0] + ' (共' + q.a + ')' : q.items.length + ' 个')) + '  ' + q.op + '  → ' + q.c);
    }
  });
  document.getElementById('__out').textContent = JSON.stringify({ bad: bad.slice(0, 30), badCount: bad.length, sample: sample });
}, 400); });
</script>`);
fs.writeFileSync(P, html, 'utf8');

function run(max, ws){
  const url = 'file:///' + encodeURI(P.replace(/\\/g, '/')) + '?max=' + max;
  const out = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', ws || '--window-size=1920,1080',
    '--virtual-time-budget=2000', '--dump-dom', url],
    { stdio: 'pipe', timeout: 60000, maxBuffer: 1 << 26 }).toString();
  const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
  const raw = (m ? m[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const o = JSON.parse(raw);
  console.log('=== 数的范围 1~' + max + '，每题型 120 道 ===');
  console.log('问题题数：' + o.badCount);
  o.bad.forEach(function(s){ console.log('  ✗ ' + s); });
  if (!process.env.QUIET) o.sample.forEach(function(s){ console.log('  样例 ' + s); });
}
run(10);
run(5);
fs.unlinkSync(P);
