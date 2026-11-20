// 探针：抓完一个娃娃后，打印 .bins 的真实 DOM 与命中区域，确认娃娃确实落在筐里
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const PROBE = path.join(OUT, '_probe_bin.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
const injected = `
<div id="__out" style="position:fixed;left:0;top:0;z-index:99999;color:#000"></div>
<script>
window.addEventListener('load', function(){
  setTimeout(function(){
    var T = window.__T, S = T.S;
    if (S.paused) T.startGame();
    var p = S.players[0], q = p.q;
    var map = { a:q.a, b:q.b, third:q.third, c:q.c };
    p.answers = {}; p.ops = q.arity === 3 ? { 0:q.op, 1:q.op } : { 0:q.op };
    p.slots.forEach(function(s){ p.answers[s] = String(map[s]); });
    p.cur = 0; T.renderEquation(p); T.confirmAnswer(p);
    setTimeout(function(){
      var st = document.createElement('style');
      st.textContent = '*{animation:none!important;transition:none!important}';
      document.head.appendChild(st);
      var bins = document.querySelector('.bins');
      var first = document.querySelector('.bin');
      var got = first.querySelector('.got');
      var br = first.getBoundingClientRect();
      var gr = got ? got.getBoundingClientRect() : null;
      document.getElementById('__out').textContent = JSON.stringify({
        nGot: first.querySelectorAll('.got').length,
        binDisp: getComputedStyle(first).display + '/' + getComputedStyle(first).alignItems,
        gotFs: got ? getComputedStyle(got).fontSize + '/' + getComputedStyle(got).lineHeight : null,
        gotPos: got ? getComputedStyle(got).position : null,
        boxRect: (function(){ var g = first.querySelector('.gotbox'); if (!g) return null;
          var r = g.getBoundingClientRect();
          return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height),
                  getComputedStyle(g).position, getComputedStyle(g).bottom]; })(),
        gotOffset: got ? [got.offsetTop, got.offsetHeight, got.offsetParent ? got.offsetParent.className : 'null'] : null,
        binRect: [Math.round(br.x), Math.round(br.y), Math.round(br.width), Math.round(br.height)],
        gotRect: gr ? [Math.round(gr.x), Math.round(gr.y), Math.round(gr.width), Math.round(gr.height)] : null,
        binHTML: first.innerHTML.slice(0, 300),
        stageRect: (function(){ var s = document.getElementById('stage').getBoundingClientRect();
          return [Math.round(s.x), Math.round(s.y), Math.round(s.width), Math.round(s.height)]; })()
      }, null, 1);
    }, 3600);
  }, 450);
});
</script>
`;
html = html.replace('</body>', injected + '</body>');
fs.writeFileSync(PROBE, html, 'utf8');

const url = 'file:///' + encodeURI(PROBE.replace(/\\/g, '/')).replace(/#/g, '%23') + '?demo=1';
const out = execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1920,1080', '--virtual-time-budget=4500',
  '--dump-dom', url
], { stdio: 'pipe', timeout: 60000, maxBuffer: 1 << 26 }).toString();
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1920,1080', '--virtual-time-budget=4500',
  '--screenshot=' + path.join(OUT, '08-landed.png'), url
], { stdio: 'pipe', timeout: 60000 });
console.log('08-landed ok');
/* 09：筐里塞满 8 个，检查排布不溢出 */
const PROBE2 = path.join(OUT, '_probe_binfull.html');
fs.writeFileSync(PROBE2, html.replace('</body>', `
<script>
window.addEventListener('load', function(){
  setTimeout(function(){
    var T = window.__T, S = T.S;
    if (S.paused) T.startGame();
    document.head.insertAdjacentHTML('beforeend','<style>*{animation:none!important;transition:none!important}</style>');
    var bags = ['🐻','🐼','🦊','🐧','🐸','🐰','🐨','🐯','🐷','🐵'];
    document.querySelectorAll('.gotbox').forEach(function(gb, gi){
      for (var i = 0; i < 6; i++){ var sp = document.createElement('span'); sp.className = 'got';
        sp.textContent = bags[(i + gi) % bags.length]; gb.appendChild(sp); }
    });
  }, 500);
});
</script>` + '</body>'));
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1920,1080', '--virtual-time-budget=1200',
  '--screenshot=' + path.join(OUT, '09-binfull.png'),
  'file:///' + encodeURI(PROBE2.replace(/\\/g, '/')).replace(/#/g, '%23')
], { stdio: 'pipe', timeout: 60000 });
console.log('09-binfull ok');
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
console.log(m ? m[1] : out.slice(0, 2000));
