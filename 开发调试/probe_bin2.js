const fs = require('fs'); const { execFileSync } = require('child_process'); const path = require('path');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_bin2.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S; if (S.paused) T.startGame();
  document.head.insertAdjacentHTML('beforeend','<style>*{animation:none!important;transition:none!important}</style>');
  var gb = document.querySelector('.gotbox');
  ['\uD83D\uDC3B','\uD83D\uDC3C','\uD83E\uDD8A','\uD83D\uDC27','\uD83D\uDC38','\uD83D\uDC30'].forEach(function(d){
    var sp = document.createElement('span'); sp.className='got'; sp.textContent=d; gb.appendChild(sp); });
  var bin = document.querySelector('.bin');
  var r = function(e){ var b = e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]; };
  var cs = getComputedStyle(gb);
  var g0 = gb.querySelector('.got');
  document.getElementById('__out').textContent = JSON.stringify({
    bin: r(bin), box: r(gb), got: r(g0),
    boxH: cs.height, boxAlign: cs.alignItems, boxOverflow: cs.overflow,
    gotH: getComputedStyle(g0).fontSize + '/' + getComputedStyle(g0).lineHeight,
    binOverflow: getComputedStyle(bin).overflow, binH: getComputedStyle(bin).height
  });
}, 500); });
</script>`);
fs.writeFileSync(P, html, 'utf8');
const out = execFileSync(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',
  '--no-first-run','--no-default-browser-check','--window-size=1920,1080','--virtual-time-budget=1200','--dump-dom',
  'file:///' + encodeURI(P.replace(/\\/g,'/')).replace(/#/g,'%23')], { stdio:'pipe', timeout:60000, maxBuffer:1<<26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
console.log(m ? m[1] : 'no out');
