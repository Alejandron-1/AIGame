/* 探针：换人数时量「面板宽 / 键盘按键尺寸 / 图案字号」有没有变，并数空座位 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIR = 'C:/Users/aa109/Desktop/AIGame';
const SRC = path.join(DIR, '小学一年级/抓娃娃看图列式.html');
const TMP = path.join(DIR, '_probe_tmp.html');
const WS = process.env.WS || '1920,1080';
const TAG = process.env.TAG || '1920';

const PROBE = `
<script>
window.addEventListener('load', function(){
  setTimeout(function(){
    var log = [];
    var panel = document.querySelector('#panels .panel');
    var key = panel.querySelector('.pkey button');
    var it = panel.querySelector('.it');
    var pr = function(n){ return n ? Math.round(n.getBoundingClientRect().width * 10) / 10 : null; };
    var ph = function(n){ return n ? Math.round(n.getBoundingClientRect().height * 10) / 10 : null; };
    log.push('panelW=' + pr(panel));
    log.push('keyW=' + pr(key) + ' keyH=' + ph(key));
    log.push('itFont=' + (it ? getComputedStyle(it).fontSize : '-'));
    log.push('panels=' + document.querySelectorAll('#panels .panel').length);
    log.push('off=' + document.querySelectorAll('#panels .panel.off').length);
    log.push('piles=' + document.querySelectorAll('.pile').length);
    log.push('bins=' + document.querySelectorAll('.bin').length);
    log.push('claws=' + document.querySelectorAll('.claw').length);
    var over = 0;
    [].forEach.call(document.querySelectorAll('#panels .pfig'), function(f){
      var line = f.querySelector('.figline');
      if (line && line.scrollWidth > f.clientWidth + 1) over++;
      if (f.scrollHeight > f.clientHeight + 1) over++;
    });
    log.push('overflow=' + over);
    var d = document.createElement('div');
    d.id = 'probeout';
    d.textContent = log.join(' | ');
    document.body.appendChild(d);
  }, 1200);
});
</script>
`;

const src = fs.readFileSync(SRC, 'utf8');
fs.writeFileSync(TMP, src.replace('</body>', PROBE + '</body>'), 'utf8');

const probe = (qs) => {
  const out = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--virtual-time-budget=6000', '--window-size=' + WS, '--dump-dom', 'file:///' + TMP + qs],
    { encoding: 'utf8', timeout: 90000, maxBuffer: 1 << 28 });
  const m = out.match(/id="probeout"[^>]*>([^<]*)</);
  return m ? m[1] : '(probe out missing)';
};

['?demo=1', '?demo=1&pc=3', '?demo=1&pc=2'].forEach((qs) => {
  console.log(TAG, qs, '->', probe(qs));
});
fs.unlinkSync(TMP);
