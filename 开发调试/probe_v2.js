// 探针 V2：把四种「最挤」的题固定到四个面板，量是否一行、是否溢出，并截图
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_v2.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9;font-size:10px">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S;
  T.startGame(); S.paused = false;
  var qs = [
    /* 10 个 + 划去 4：最宽的单排 */
    { type:'cross', emoji:'\\uD83C\\uDF53', unit:'条', op:'-', arity:2, a:10, b:4, c:6,
      given:false, slots:['a','b','c'],
      items: Array.from({length:10}, function(_, i){ return { mark: i >= 6 ? 'slash' : '' }; }) },
    /* 老师截图里的那类：5 个划去 1 */
    { type:'cross', emoji:'\\uD83D\\uDC2F', unit:'只', op:'-', arity:2, a:5, b:1, c:4,
      given:false, slots:['a','b','c'],
      items: Array.from({length:5}, function(_, i){ return { mark: i >= 4 ? 'slash' : '' }; }) },
    /* 求另一部分：总数 6、已知 5（原来会把 ? 挤到第二行） */
    { type:'part', emoji:'\\uD83D\\uDC26', unit:'只', op:'-', arity:2, a:6, b:5, c:1,
      groups:[5], unknown:true, brace:{from:0,to:1,label:'6只'}, labelText:'?',
      given:false, slots:['a','b','c'], items:[] },
    /* 加法 5+5 两组分开 */
    { type:'add', emoji:'\\uD83C\\uDF4E', unit:'个', op:'+', arity:2, a:5, b:5, c:10,
      groups:[5,5], brace:{from:0,to:1,label:'?'}, given:false, slots:['a','b','c'], items:[] }
  ];
  S.players.forEach(function(p, i){
    var q = qs[i];
    p.q = q; p.slots = q.slots.slice(); p.answers = {}; p.ops = {}; p.cur = 0;
    p.locked = false; p.done = false;
    T.renderQuestion(p);
  });
  document.head.insertAdjacentHTML('beforeend','<style>*{animation:none!important;transition:none!important}#__out{display:none!important}</style>');
  var info = S.players.map(function(p, i){
    var fig = p.fig, line = fig.querySelector('.figline');
    var rows = fig.querySelectorAll('.irow').length;
    var over = line.scrollWidth - line.clientWidth;
    return { i:i+1, type:p.q.type, n:(p.q.items||[]).length || p.q.groups.join('+'),
      rows:rows, isz:getComputedStyle(fig.querySelector('.figline')).getPropertyValue('--isz').trim(),
      lineW: Math.round(line.getBoundingClientRect().width),
      avail: Math.round(fig.clientWidth - 14),
      over: over, h: Math.round(fig.getBoundingClientRect().height),
      brace: (fig.querySelector('.lb')||{}).textContent };
  });
  document.getElementById('__out').textContent = JSON.stringify(info);
}, 500); });
</script>`);
fs.writeFileSync(P, html, 'utf8');

const url = 'file:///' + encodeURI(P.replace(/\\/g, '/')).replace(/#/g, '%23');
const WS = process.env.WS || '--window-size=1920,1080';
const tag = process.env.TAG || '1920';
const out = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check', WS, '--virtual-time-budget=2000', '--dump-dom', url],
  { stdio: 'pipe', timeout: 60000, maxBuffer: 1 << 26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
const raw = (m ? m[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
try {
  JSON.parse(raw).forEach(function (o) {
    console.log('面板' + o.i + ' ' + o.type + ' n=' + o.n + ' rows=' + o.rows + ' isz=' + o.isz +
      ' lineW=' + o.lineW + '/' + o.avail + ' overflow=' + o.over + ' 图高=' + o.h + ' 括号=' + o.brace);
  });
} catch (e) { console.log('parse fail', raw.slice(0, 400)); }

execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check', WS, '--virtual-time-budget=2000',
  '--screenshot=' + path.join(OUT, '20-fit-' + tag + '.png'), url], { stdio: 'pipe', timeout: 60000 });
console.log('shot 20-fit-' + tag + '.png');
