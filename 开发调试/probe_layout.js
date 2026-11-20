// 探针：渲染一道 5+5 的加法题，把 DOM 结构打印出来，确认每行最多 4 个
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const PROBE = path.join(OUT, '_probe_layout.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
const injected = `
<script>
window.addEventListener('load', function(){
  var T = window.__T, S = T.S;
  if (S.paused) T.startGame();
  var p = S.players[1];
  p.q = { type:'add', emoji:'🍎', unit:'个', op:'+', arity:2, a:5, b:5, c:10,
          groups:[5,5], brace:{from:0,to:1,label:'?个'}, given:false, slots:['a','b','c'], items:[] };
  p.slots = ['a','b','c']; p.answers = {}; p.ops = {};
  T.renderFigure(p);
  function dump(n, d){
    var cls = n._cls ? Array.from(n._cls).join('.') : (n.className || '');
    var out = '';
    for (var i = 0; i < d; i++) out += '  ';
    out += '<' + n.tagName + (cls ? ' .' + cls : '') + '>';
    if (n.textContent && !n.children.length) out += ' "' + n.textContent + '"';
    out += '\\n';
    for (var k = 0; k < n.children.length; k++) out += dump(n.children[k], d + 1);
    return out;
  }
  var pre = document.createElement('pre');
  pre.id = 'dump';
  pre.textContent = dump(p.fig, 0);
  document.body.appendChild(pre);
});
</script>`;
html = html.replace('</body>', injected + '</body>');
fs.writeFileSync(PROBE, html, 'utf8');

const url = 'file:///' + encodeURI(PROBE.replace(/\\/g, '/')).replace(/#/g, '%23') + '?demo=1';
const dom = execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--virtual-time-budget=2500', '--dump-dom', url
], { stdio: 'pipe', timeout: 60000, maxBuffer: 40 * 1024 * 1024 }).toString('utf8');

const m = dom.match(/<pre id="dump">([\s\S]*?)<\/pre>/);
console.log(m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : 'NO DUMP');
