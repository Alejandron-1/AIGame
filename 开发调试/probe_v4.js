// 探针 V4：连开 30 局，检查四人有没有重复算式（真实浏览器里跑）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_v4.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9;font-size:10px">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S;
  var MAX = Number(new URLSearchParams(location.search).get('mx') || 10);
  S.settings.max = MAX;
  S.settings.types = ['add','cross','box','part'];
  S.settings.scope = 'mix';
  var dups = [], sigSet = {}, emojiDup = 0;
  for (var g = 0; g < 30; g++){
    T.startGame(); S.paused = false;
    var sigs = S.players.map(function(p){ return T.qSig(p.q); });
    var ems = S.players.map(function(p){ return p.q.emoji; });
    if (new Set(sigs).size !== sigs.length){
      dups.push({ game:g, qs: S.players.map(function(p){
        return p.q.type + ' a=' + p.q.a + ' b=' + p.q.b + (p.q.third != null ? ' t=' + p.q.third : '') +
               ' ' + p.q.emoji + ' sig=' + T.qSig(p.q);
      })});
    }
    if (new Set(ems).size !== ems.length) emojiDup++;
  }
  document.getElementById('__out').textContent = JSON.stringify({ max:MAX, dupGames:dups.length, emojiDup:emojiDup, sample:dups.slice(0,3) });
}, 400); });
</script>`);
fs.writeFileSync(P, html, 'utf8');

const url = 'file:///' + encodeURI(P.replace(/\\/g, '/')).replace(/#/g, '%23');
const out = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1920,1080', '--virtual-time-budget=4000', '--dump-dom', url + '?mx=5'],
  { stdio: 'pipe', timeout: 60000, maxBuffer: 1 << 26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
console.log((m ? m[1] : 'no out').replace(/&quot;/g, '"'));
