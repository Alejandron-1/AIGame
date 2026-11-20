// 探针：连出 240 题，检查图案区是否横向溢出面板（gap 加大后最容易出的问题）
const fs = require('fs'); const { execFileSync } = require('child_process'); const path = require('path');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_fit.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S; if (S.paused) T.startGame();
  document.head.insertAdjacentHTML('beforeend','<style>*{animation:none!important;transition:none!important}</style>');
  var bad = [], worst = 0, worstInfo = null, n = 0;
  for (var k = 0; k < 240; k++){
    var p = S.players[k % S.players.length];
    try { T.newQuestionFor(p); } catch(e){ bad.push({err:String(e)}); continue; }
    var fig = p.fig, box = fig.querySelector('.figbox'), line = fig.querySelector('.figline');
    if (!box) continue;
    n++;
    var figR = fig.getBoundingClientRect(), lineR = line.getBoundingClientRect();
    /* pfig 有 6px 左右 padding */
    var avail = figR.width - 12;
    /* line 现在被 stretch 到满宽，所以要按「子项自然宽度 + gap 下限」判断是否放得下 */
    var kids = Array.prototype.slice.call(line.children);
    var sum = 0;
    kids.forEach(function(k){ sum += k.getBoundingClientRect().width; });
    var gapPx = parseFloat(getComputedStyle(line).columnGap) || 0;
    var need = sum + gapPx * Math.max(0, kids.length - 1);
    var over = Math.max(0, Math.round(need - avail));
    var ratio = need / avail;
    if (ratio > worst){ worst = ratio; worstInfo = { type: p.q.type, e: p.q.emoji, a: p.q.a, b: p.q.b, c: p.q.c,
      groups: p.q.groups || null, arity: p.q.arity, needW: Math.round(need), avail: Math.round(avail),
      isz: getComputedStyle(fig).getPropertyValue('--isz').trim(), gap: getComputedStyle(line).columnGap }; }
    if (over > 0) bad.push({ over: over, type: p.q.type, e: p.q.emoji, a: p.q.a, b: p.q.b, needW: Math.round(need), avail: Math.round(avail) });
  }
  document.getElementById('__out').textContent = JSON.stringify({
    checked: n, overflow: bad.length, samples: bad.slice(0, 6),
    worst: worstInfo, worstRatio: Math.round(worst * 1000) / 1000
  }, null, 1);
}, 500); });
</script>`);
fs.writeFileSync(P, html, 'utf8');
const out = execFileSync(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',
  '--no-first-run','--no-default-browser-check',process.env.WS || '--window-size=1920,1080','--virtual-time-budget=2500','--dump-dom',
  'file:///' + encodeURI(P.replace(/\\/g,'/')).replace(/#/g,'%23')], { stdio:'pipe', timeout:60000, maxBuffer:1<<26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
console.log(m ? m[1] : 'no out');
