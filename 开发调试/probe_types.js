// 探针：把 6 种题型各渲染到 4 个面板里，检查分组间距与是否溢出
const fs = require('fs'); const { execFileSync } = require('child_process'); const path = require('path');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_types.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let html = fs.readFileSync(SRC, 'utf8');
const SET = JSON.stringify(process.env.SET || '0');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9;font-size:10px">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S; if (S.paused) T.startGame();
  var make = {
    add: function(){ return { type:'add', emoji:'\\uD83C\\uDF4E', unit:'只', op:'+', arity:2, a:5, b:5, c:10,
      groups:[5,5], brace:{from:0,to:1,label:'?只'}, given:false, slots:['a','b','c'], items:[] }; },
    cross: function(){ return { type:'cross', emoji:'\\uD83C\\uDF53', unit:'个', op:'-', arity:2, a:10, b:6, c:4,
      brace:{from:0,to:0,label:'?个'}, given:false, slots:['a','b','c'],
      items: Array.from({length:10}, function(_, i){ return { mark: i >= 4 ? 'slash' : '' }; }) }; },
    box: function(){ return { type:'box', emoji:'\\uD83C\\uDF51', unit:'个', op:'-', arity:2, a:9, b:6, c:3,
      brace:{from:0,to:0,label:'?个'}, given:false, slots:['a','b','c'],
      items: Array.from({length:9}, function(_, i){ return { mark: i >= 3 ? 'box' : '' }; }) }; },
    part: function(){ return { type:'part', emoji:'\\uD83C\\uDF7A', unit:'串', op:'-', arity:2, a:7, b:2, c:5,
      groups:[2], unknown:true, brace:{from:0,to:1,label:'7串'}, labelText:'?串', given:false, slots:['a','b','c'], items:[] }; }
  };
  var order = ['add','part','cross','box'];
  S.players.forEach(function(p, i){
    var q = make[order[i]]();
    p.q = q; p.slots = q.slots.slice(); p.answers = {}; p.ops = {}; p.cur = 0;
    p.locked = false; p.done = false;
    T.renderQuestion(p);
  });
  document.head.insertAdjacentHTML('beforeend','<style>*{animation:none!important;transition:none!important}#__out{display:none!important}</style>');
  var info = [];
  S.players.forEach(function(p, i){
    var fig = p.fig, line = fig.querySelector('.figline'), box = fig.querySelector('.figbox');
    var figR = fig.getBoundingClientRect(), lineR = line.getBoundingClientRect();
    info.push({ i:i, type:p.q.type, gap:getComputedStyle(line).columnGap,
      lineW: Math.round(lineR.width), avail: Math.round(figR.width - 12),
      isz: getComputedStyle(fig).getPropertyValue('--isz').trim() });
  });
  document.getElementById('__out').textContent = JSON.stringify(info);
}, 400); });
</script>`);
fs.writeFileSync(P, html, 'utf8');
const url = 'file:///' + encodeURI(P.replace(/\\/g,'/')).replace(/#/g,'%23');
const out = execFileSync(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',
  '--no-first-run','--no-default-browser-check', process.env.WS || '--window-size=1920,1080',
  '--virtual-time-budget=1500','--dump-dom', url], { stdio:'pipe', timeout:60000, maxBuffer:1<<26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
console.log(m ? m[1] : 'no out');
execFileSync(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',
  '--no-first-run','--no-default-browser-check', process.env.WS || '--window-size=1920,1080',
  '--virtual-time-budget=1500','--screenshot=' + path.join(OUT, '10-types.png'), url], { stdio:'pipe', timeout:60000 });
console.log('10-types ok');
