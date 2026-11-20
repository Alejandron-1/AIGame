// 探针 V3：极端不均衡分组（9+1 / 1+1+8 / 框走 9+1 / 求另一部分 9+1），检查有没有被裁掉
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_v3.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9;font-size:10px">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S;
  T.startGame(); S.paused = false;
  var qs = [
    { type:'add', emoji:'\\uD83D\\uDC24', unit:'只', op:'+', arity:2, a:9, b:1, c:10,
      groups:[9,1], brace:{from:0,to:1,label:'?'}, given:false, slots:['a','b','c'], items:[] },
    { type:'add3', emoji:'\\uD83D\\uDC26', unit:'只', op:'+', arity:3, a:1, b:1, third:8, c:10,
      groups:[1,1,8], brace:{from:0,to:2,label:'?'}, given:false, slots:['a','b','c'], items:[] },
    { type:'box', emoji:'\\uD83C\\uDF4E', unit:'个', op:'-', arity:2, a:10, b:1, c:9,
      brace:{from:0,to:0,label:'?'}, given:false, slots:['a','b','c'],
      items: Array.from({length:10}, function(_, i){ return { mark: i >= 9 ? 'box' : '' }; }) },
    { type:'part', emoji:'\\uD83C\\uDF53', unit:'条', op:'-', arity:2, a:10, b:9, c:1,
      groups:[9], unknown:true, brace:{from:0,to:1,label:'10条'}, labelText:'?',
      given:false, slots:['a','b','c'], items:[] }
  ];
  S.players.forEach(function(p, i){
    var q = qs[i];
    p.q = q; p.slots = q.slots.slice(); p.answers = {}; p.ops = {}; p.cur = 0;
    p.locked = false; p.done = false;
    T.renderQuestion(p);
  });
  document.head.insertAdjacentHTML('beforeend','<style>*{animation:none!important;transition:none!important}#__out{display:none!important}</style>');
  var info = S.players.map(function(p, i){
    var fig = p.fig, fr = fig.getBoundingClientRect();
    var items = [].slice.call(fig.querySelectorAll('.it'));
    var outside = items.filter(function(el){
      var r = el.getBoundingClientRect();
      return r.left < fr.left + 1 || r.right > fr.right - 1;
    }).length;
    var line = fig.querySelector('.figline');
    return { i:i+1, type:p.q.type, cls:line.className.replace('figline','').trim(),
      n:items.length, rows:fig.querySelectorAll('.irow').length,
      isz:getComputedStyle(line).getPropertyValue('--isz').trim(),
      clipped:outside, over: line.scrollWidth - line.clientWidth };
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
    console.log('面板' + o.i + ' ' + o.type + ' cls=[' + o.cls + '] 图案=' + o.n + ' 行=' + o.rows +
      ' isz=' + o.isz + ' 被裁=' + o.clipped + ' overflow=' + o.over);
  });
} catch (e) { console.log('parse fail', raw.slice(0, 400)); }

execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check', WS, '--virtual-time-budget=2000',
  '--screenshot=' + path.join(OUT, '30-unbalanced-' + tag + '.png'), url], { stdio: 'pipe', timeout: 60000 });
console.log('shot 30-unbalanced-' + tag + '.png');
