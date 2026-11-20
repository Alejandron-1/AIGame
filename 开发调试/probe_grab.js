// 生成一份临时探针副本：自动答对第1列、答错第2列，用于截图核验抓娃娃动画
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const PROBE = path.join(OUT, '_probe.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
const injected = `
<script>
window.addEventListener('load', function(){
  setTimeout(function(){
    var T = window.__T, S = T.S;
    if (S.paused) T.startGame();
    function fill(p, wrong){
      var q = p.q;
      var map = { a:q.a, b:q.b, third:q.third, c:q.c };
      p.answers = {};
      p.ops = q.arity === 3 ? { 0:q.op, 1:q.op } : { 0:q.op };
      p.slots.forEach(function(s, i){
        p.answers[s] = String(wrong && i === p.slots.length - 1 ? (map[s] + 1) : map[s]);
      });
      p.cur = 0;
      T.renderEquation(p);
      T.confirmAnswer(p);
    }
    fill(S.players[0], false);
    fill(S.players[1], true);
  }, 450);
});
</script>
`;
html = html.replace('</body>', injected + '</body>');
fs.writeFileSync(PROBE, html, 'utf8');

const url = 'file:///' + encodeURI(PROBE.replace(/\\/g, '/')).replace(/#/g, '%23') + '?demo=1';
[['06-grab', 2900], ['07-done', 4200]].forEach(function(pair){
  const shot = path.join(OUT, pair[0] + '.png');
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--no-first-run', '--no-default-browser-check',
    '--window-size=1920,1080', '--virtual-time-budget=' + pair[1],
    '--screenshot=' + shot, url
  ], { stdio: 'pipe', timeout: 60000 });
  console.log(pair[0] + ' ok ' + Math.round(fs.statSync(shot).size / 1024) + 'KB');
});
