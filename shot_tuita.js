// 用本机 Chrome 无头截图，做真实视觉验收：口算推塔对战
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'C:/Users/aa109/Desktop/AIGame/小学一年级/推塔口算对战.html';
const OUT = 'C:/Users/aa109/Desktop/AIGame/_shots';
fs.mkdirSync(OUT, { recursive: true });

const url = (q) => 'file:///' + encodeURI(FILE.replace(/\\/g, '/')).replace(/#/g, '%23') + (q || '');

const shots = [
  { name: 'tt-01-setup', size: '1920,1080', q: '?still=1' },
  { name: 'tt-02-battle', size: '1920,1080', q: '?demo=1&still=1' },
  { name: 'tt-03-midway', size: '1920,1080', q: '?demo=1&midway&still=1' },
  { name: 'tt-04-win', size: '1920,1080', q: '?demo=1&win&still=1' },
  { name: 'tt-05-1366', size: '1366,768', q: '?demo=1&midway&still=1' }
];

for (const s of shots) {
  const out = path.join(OUT, s.name + '.png');
  try {
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--no-first-run', '--no-default-browser-check',
      '--window-size=' + s.size,
      '--virtual-time-budget=3500',
      '--screenshot=' + out,
      url(s.q)
    ], { stdio: 'pipe', timeout: 60000 });
    console.log('OK ', s.name);
  } catch (e) {
    console.log('FAIL', s.name, e.message);
  }
}
