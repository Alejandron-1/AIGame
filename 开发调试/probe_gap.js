const fs = require('fs'); const { execFileSync } = require('child_process'); const path = require('path');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_gap.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S; if (S.paused) T.startGame();
  document.head.insertAdjacentHTML('beforeend','<style>*{animation:none!important;transition:none!important}</style>');
  var res = [];
  document.querySelectorAll('.pfig').forEach(function(fig, i){
    var line = fig.querySelector('.figline');
    if (!line) return;
    var cs = getComputedStyle(line);
    var kids = Array.from(line.children).map(function(k){
      var b = k.getBoundingClientRect();
      return { cls: k.className, x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) };
    });
    var gaps = [];
    for (var j = 1; j < kids.length; j++) gaps.push(kids[j].x - (kids[j-1].x + kids[j-1].w));
    var fb = fig.querySelector('.figbox').getBoundingClientRect();
    var fsb = fig.getBoundingClientRect();
    res.push({ i: i, isz: getComputedStyle(fig).getPropertyValue('--isz').trim(),
      gap: cs.columnGap, kids: kids, gaps: gaps,
      boxW: Math.round(fb.width), figW: Math.round(fsb.width),
      lineW: Math.round(line.getBoundingClientRect().width) });
  });
  document.getElementById('__out').textContent = JSON.stringify(res, null, 1);
}, 400); });
</script>`);
fs.writeFileSync(P, html, 'utf8');
const out = execFileSync(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',
  '--no-first-run','--no-default-browser-check','--window-size=1920,1080','--virtual-time-budget=1200','--dump-dom',
  'file:///' + encodeURI(P.replace(/\\/g,'/')).replace(/#/g,'%23')], { stdio:'pipe', timeout:60000, maxBuffer:1<<26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
console.log(m ? m[1] : 'no out');
