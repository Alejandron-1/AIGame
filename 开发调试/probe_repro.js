// 探针：5 以内开局，导出四个面板的题目数据 + 图形 DOM 结构（复现「上下堆」「文字残留」「重复题」）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SRC = 'C:/Users/aa109/Desktop/AIGame/小学一年级/抓娃娃看图列式.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
const P = path.join(OUT, '_probe_repro.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', `
<div id="__out" style="position:fixed;z-index:9;font-size:10px">x</div>
<script>
window.addEventListener('load', function(){ setTimeout(function(){
  var T = window.__T, S = T.S;
  S.settings.max = 5;
  S.settings.count = 4;
  T.startGame();
  S.paused = false;
  function walk(n, d){
    if (!n || d > 6) return '';
    var cls = (n.className || '').toString().trim();
    var kids = [].slice.call(n.children || []).map(function(c){ return walk(c, d + 1); }).filter(Boolean);
    var txt = (n.children && n.children.length) ? '' : (n.textContent || '').trim();
    return (cls ? '.' + cls.split(/\\s+/).join('.') : n.tagName) + (txt ? '«' + txt + '»' : '') +
      (kids.length ? '{' + kids.join(' ') : '');
  }
  var info = S.players.map(function(p){
    var q = p.q;
    return {
      type: q.type, emoji: q.emoji, unit: q.unit, op: q.op,
      a: q.a, b: q.b, third: q.third, c: q.c,
      groups: q.groups, unknown: !!q.unknown, labelText: q.labelText || null,
      brace: q.brace ? q.brace.label : null,
      itemsLen: (q.items || []).length,
      fig: walk(p.fig, 0),
      lineW: Math.round(p.fig.querySelector('.figline').getBoundingClientRect().width),
      figW: Math.round(p.fig.getBoundingClientRect().width)
    };
  });
  document.getElementById('__out').textContent = JSON.stringify(info);
}, 500); });
</script>`);
fs.writeFileSync(P, html, 'utf8');

const url = 'file:///' + encodeURI(P.replace(/\\/g, '/')).replace(/#/g, '%23');
const WS = process.env.WS || '--window-size=1920,1080';
const out = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check', WS, '--virtual-time-budget=2000', '--dump-dom', url],
  { stdio: 'pipe', timeout: 60000, maxBuffer: 1 << 26 }).toString();
const m = out.match(/<div id="__out"[^>]*>([\s\S]*?)<\/div>/);
const raw = (m ? m[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
try {
  const arr = JSON.parse(raw);
  arr.forEach(function (o, i) {
    console.log('--- 面板' + (i + 1) + ' ' + o.type + ' ' + o.emoji + ' a=' + o.a + ' b=' + o.b +
      (o.third != null ? ' third=' + o.third : '') + ' c=' + o.c + ' groups=' + JSON.stringify(o.groups) +
      ' unknown=' + o.unknown + ' labelText=' + o.labelText + ' brace=' + o.brace +
      ' items=' + o.itemsLen + ' lineW=' + o.lineW + '/' + o.figW);
    console.log('    ' + o.fig);
  });
} catch (e) {
  console.log('parse fail:', raw.slice(0, 800));
}
