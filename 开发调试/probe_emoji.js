// 探针：用 canvas 采样每种 emoji 的墨迹包围盒，算出「统一视觉大小」的缩放系数
const fs = require('fs'); const { execFileSync } = require('child_process');
const P = 'C:/Users/aa109/Desktop/AIGame/_probe_emoji.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let html = fs.readFileSync('C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html', 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;left:0;top:0;z-index:99999;font-size:9px;color:#000;background:#fff">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var list = (window.__T && window.__T.S) ? null : null;
  var chars = ['\\uD83D\\uDC26','\\uD83D\\uDC1F','\\uD83D\\uDC20','\\uD83D\\uDC2F','\\uD83C\\uDF4E',
               '\\uD83C\\uDF50','\\uD83C\\uDF47','\\uD83D\\uDC30','\\uD83E\\uDD8B','\\uD83C\\uDF53',
               '\\uD83D\\uDC24','\\uD83C\\uDF4A'];
  var N = 240, SZ = 160;
  var cv = document.createElement('canvas'); cv.width = cv.height = N;
  var ctx = cv.getContext('2d');
  var res = [];
  chars.forEach(function(ch){
    ctx.clearRect(0,0,N,N);
    ctx.font = SZ + 'px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, N/2, N/2);
    var d = ctx.getImageData(0,0,N,N).data;
    var x0=N, y0=N, x1=-1, y1=-1, px=0;
    for (var y=0;y<N;y++) for (var x=0;x<N;x++){
      var a = d[(y*N+x)*4+3];
      if (a > 24){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; px++; }
    }
    if (x1 < 0){ res.push({ch:ch, err:true}); return; }
    var w = x1-x0+1, h = y1-y0+1;
    res.push({ ch: ch, w: +(w/SZ).toFixed(3), h: +(h/SZ).toFixed(3),
               area: +(px/(SZ*SZ)).toFixed(4), fill: +(px/(w*h)).toFixed(3) });
  });
  document.getElementById('__out').textContent = JSON.stringify(res);
}, 400); });
</script>`);
fs.writeFileSync(P, html, 'utf8');
const u = 'file:///' + encodeURI(P.replace(/\\/g,'/')).replace(/#/g,'%23');
const out = execFileSync(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--allow-file-access-from-files',
  '--force-device-scale-factor=1','--no-first-run','--no-default-browser-check','--window-size=900,700',
  '--virtual-time-budget=2000','--dump-dom', u], { stdio:'pipe', timeout:60000, maxBuffer:1<<26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
console.log(m ? m[1] : 'no out');
