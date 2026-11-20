// 用本机 Chrome 无头截图，做真实视觉验收：分与合早读
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'C:/Users/aa109/Desktop/AIGame/小学一年级/分与合早读.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
fs.mkdirSync(OUT, { recursive: true });

const url = (q) => 'file:///' + encodeURI(FILE.replace(/\\/g, '/')).replace(/#/g, '%23') + (q || '');

const shots = [
  { name: 'zd-01-setup', size: '1920,1080', q: '?still=1' },
  { name: 'zd-02-gallery', size: '1920,1080', q: '?demo=1&gallery=1&still=1' },
  { name: 'zd-03-card', size: '1920,1080', q: '?demo=1&max=8&still=1' },
  { name: 'zd-04-reveal', size: '1920,1080', q: '?demo=1&max=8&reveal=1&still=1' },
  { name: 'zd-06-flying', size: '1920,1080', q: '?demo=1&max=8&reveal=1', budget: '600' },
  { name: 'zd-05-1366', size: '1366,768', q: '?demo=1&reveal=1&still=1' }
];

for (const s of shots) {
  const out = path.join(OUT, s.name + '.png');
  try {
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
      '--window-size=' + s.size,
      '--virtual-time-budget=' + (s.budget || '3500'),
      '--screenshot=' + out,
      url(s.q)
    ], { stdio: 'pipe', timeout: 60000 });
    console.log('OK ', s.name);
  } catch (e) {
    console.log('FAIL', s.name, e.message);
  }
}
