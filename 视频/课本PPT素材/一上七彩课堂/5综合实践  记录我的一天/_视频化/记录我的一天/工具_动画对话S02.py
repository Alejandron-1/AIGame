# -*- coding: utf-8 -*-
"""S02 对话动画（剪纸动画）：谁说话谁点头，气泡逐句弹出，重排布局消除钟面遮挡
管线：抠精灵 -> PIL 重画气泡 -> SAPI 逐句配音 -> 逐帧合成 -> ffmpeg"""
import cv2
import numpy as np
import subprocess
import os
import sys
import re
import math
import shutil
from PIL import Image, ImageDraw, ImageFont

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

FF = r'C:\Users\aa109\Desktop\AIGame\视频\ffmpeg.exe'
BASE = os.path.dirname(os.path.abspath(__file__))
KF = os.path.join(BASE, '01_关键帧')
AUD = os.path.join(BASE, '04_音频')
DRAFT = os.path.join(BASE, '02_草稿')
OUT = os.path.join(BASE, '03_成片')
FPS = 30
LEAD, GAP, TAIL = 0.7, 0.35, 0.9
FONT = r'C:\Windows\Fonts\STKAITI.TTF'
if not os.path.exists(FONT):
    FONT = r'C:\Windows\Fonts\simkai.ttf'

BEATS = [
    dict(speaker='mom', wav='S02_02_b1.mp3',
         text='淘气，你该出门啦！再不去上学就要迟到了！',
         bubble=dict(xy=(400, 170, 818, 388), border=(247, 166, 48), font=40,
                     lines=['淘气，你该出门啦！', '再不去上学', '就要迟到了！'],
                     tail=('bl', (430, 330, 512, 402)))),
    dict(speaker='dad', wav='S02_02_b2.mp3',
         text='我们先吃早餐，我上班的时间还早呢。',
         bubble=dict(xy=(1390, 170, 1808, 388), border=(238, 128, 56), font=40,
                     lines=['我们先吃早餐，', '我上班的时间', '还早呢。'],
                     tail=('br', (1700, 330, 1790, 402)))),
    dict(speaker='boy', wav='S02_02_b3.mp3',
         text='奇怪，妈妈怎么知道我上学要迟到了呢？爸爸为什么不着急上班呢？',
         bubble=dict(xy=(730, 552, 1245, 868), border=(52, 168, 192), font=40,
                     lines=['奇怪，妈妈怎么知道我', '上学要迟到了呢？爸爸', '为什么不着急上班呢？'],
                     tail=('l', (655, 660, 735, 745)))),
    dict(speaker='boy', wav='S02_02_b4.mp3',
         text='原来家里有钟表！',
         bubble=dict(xy=(730, 905, 1180, 1022), border=(52, 168, 192), font=44,
                     lines=['原来家里有钟表！'],
                     tail=('l', (655, 930, 735, 1000)))),
]

# ---------- 精灵抠取 ----------
def load(p):
    return cv2.imdecode(np.fromfile(p, dtype=np.uint8), cv2.IMREAD_COLOR)

def sprite(img, rect):
    x1, y1, x2, y2 = rect
    roi = img[y1:y2, x1:x2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    a = np.where(gray < 240, 255, 0).astype(np.uint8)
    a = cv2.GaussianBlur(a, (3, 3), 0)
    out = np.dstack([roi, a])
    return out

src = load(os.path.join(KF, 'S02_家庭对话_原版.png'))
base = load(os.path.join(KF, 'S02_家庭对话_去文字.png'))
H, W = base.shape[:2]
# 精灵从去文字底图上抠：人物完整且不带旧气泡的尾巴/边框残留
SPR = {
    'mom': (sprite(base, (60, 225, 443, 1050)), (60, 225)),
    'boy': (sprite(base, (465, 620, 705, 1238)), (465, 620)),
    'dad': (sprite(base, (1700, 148, 2140, 1105)), (1700, 148)),
}

# ---------- 气泡精灵（PIL 重画，白底新布局） ----------
def make_bubble(b):
    x1, y1, x2, y2 = b['xy']
    # 高度按行数自适应
    y2 = y1 + int(len(b['lines']) * b['font'] * 1.42) + 46
    w, h = x2 - x1, y2 - y1
    im = Image.new('RGBA', (w + 160, h + 160), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    ox, oy = 80, 80
    bx1, by1, bx2, by2 = ox, oy, ox + w, oy + h
    pos = b['tail'][0]
    if pos == 'bl':     # 左下角伸出，指向左下
        tri = [(bx1 + 30, by2 - 3), (bx1 + 100, by2 - 3), (bx1 - 34, by2 + 66)]
    elif pos == 'br':   # 右下角伸出，指向右下
        tri = [(bx2 - 100, by2 - 3), (bx2 - 30, by2 - 3), (bx2 + 34, by2 + 66)]
    else:               # 左边中段伸出，指向左
        tri = [(bx1 + 3, by1 + 42), (bx1 + 3, by1 + 108), (bx1 - 66, by1 + 74)]
    dr.polygon(tri, fill=(255, 255, 255, 255), outline=b['border'] + (255,), width=4)
    dr.rounded_rectangle([bx1, by1, bx2, by2], radius=26, fill=(255, 255, 255, 255),
                         outline=b['border'] + (255,), width=4)
    if pos == 'bl':     dr.rectangle([bx1 + 28, by2 - 6, bx1 + 102, by2 + 2], fill=(255, 255, 255, 255))
    elif pos == 'br':   dr.rectangle([bx2 - 102, by2 - 6, bx2 - 28, by2 + 2], fill=(255, 255, 255, 255))
    else:               dr.rectangle([bx1 - 2, by1 + 44, bx1 + 6, by1 + 106], fill=(255, 255, 255, 255))
    fnt = ImageFont.truetype(FONT, b['font'])
    ty = by1 + 24
    for ln in b['lines']:
        dr.text((bx1 + 34, ty), ln, font=fnt, fill=(45, 45, 45, 255))
        ty += int(b['font'] * 1.42)
    return cv2.cvtColor(np.array(im), cv2.COLOR_RGBA2BGRA), (x1 - ox, y1 - oy)

BUB = [(make_bubble(bt['bubble']), i) for i, bt in enumerate(BEATS)]

# ---------- TTS ----------
def tts():
    from 工具_百度TTS import baidu_tts
    for bt in BEATS:
        n = baidu_tts(bt['text'], os.path.join(AUD, bt['wav']), spd=6)
        print('%s: %d B' % (bt['wav'], n))

def probe(p):
    r = subprocess.run([FF, '-i', p], capture_output=True)
    m = re.search(rb'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))

tts()
# 分声线：变调不変わ速（asetrate 改音高 + atempo 补偿时长）
PITCH = {'mom': 1.00, 'dad': 0.93, 'boy': 1.12}
for bt in BEATS:
    pf = PITCH[bt['speaker']]
    if abs(pf - 1.0) < 0.01:
        continue
    srcp = os.path.join(AUD, bt['wav'])
    tmpp = srcp + '.t.mp3'
    r = subprocess.run([FF, '-y', '-i', srcp,
                        '-af', 'asetrate=16000*%.3f,aresample=16000,atempo=%.4f' % (pf, 1.0 / pf),
                        '-c:a', 'libmp3lame', '-q:a', '4', tmpp], capture_output=True)
    assert r.returncode == 0, r.stderr.decode('utf-8', 'replace')[-400:]
    os.replace(tmpp, srcp)
    print('pitch %.2f -> %s' % (pf, bt['wav']))
durs = [probe(os.path.join(AUD, bt['wav'])) for bt in BEATS]
starts, t = [], LEAD
for d in durs:
    starts.append(t); t += d + GAP
total = t - GAP + TAIL
print('beats:', ['%.1f' % s for s in starts], 'total %.1f' % total)

# ---------- 逐帧合成 ----------
def paste(frame, spr, pos, dy=0, alpha=1.0):
    s, (x, y) = spr
    h, w = s.shape[:2]
    px, py = x, y + dy
    x1, y1 = max(px, 0), max(py, 0)
    x2, y2 = min(px + w, W), min(py + h, H)
    if x2 <= x1 or y2 <= y1:
        return
    roi = frame[y1:y2, x1:x2]
    ss = s[y1 - py:y2 - py, x1 - px:x2 - px]
    a = (ss[..., 3:4].astype(np.float32) / 255.0) * alpha
    frame[y1:y2, x1:x2] = (ss[..., :3].astype(np.float32) * a + roi.astype(np.float32) * (1 - a)).astype(np.uint8)

def paste_bubble(frame, bi, tnow):
    (spr, pos), beat_i = BUB[bi]
    tb = starts[beat_i]
    if tnow < tb - 0.05:
        return
    p = min((tnow - tb) / 0.28, 1.0)
    s = 0.85 + 0.15 * p + 0.05 * math.sin(p * math.pi)
    h, w = spr.shape[:2]
    nw, nh = int(w * s), int(h * s)
    rs = cv2.resize(spr, (nw, nh), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
    px = pos[0] + w // 2 - nw // 2
    py = pos[1] + h // 2 - nh // 2
    x1, y1 = max(px, 0), max(py, 0)
    x2, y2 = min(px + nw, W), min(py + nh, H)
    roi = frame[y1:y2, x1:x2]
    ss = rs[y1 - py:y2 - py, x1 - px:x2 - px]
    a = ss[..., 3:4].astype(np.float32) / 255.0
    frame[y1:y2, x1:x2] = (ss[..., :3].astype(np.float32) * a + roi.astype(np.float32) * (1 - a)).astype(np.uint8)

n_frames = int(round(total * FPS))
fdir = os.path.join(DRAFT, 'frames_S02_02')
os.makedirs(fdir, exist_ok=True)
TMP = r'C:\Users\aa109\AppData\Local\Temp\ppt_extract'
for f in range(n_frames):
    tnow = f / FPS
    fr = base.copy()
    for name in ('mom', 'boy', 'dad'):
        spr = SPR[name]
        bi = next((i for i, bt in enumerate(BEATS) if bt['speaker'] == name), None)
        speaking = bi is not None and starts[bi] - 0.1 <= tnow <= starts[bi] + durs[bi] + 0.2
        if speaking:
            dy = -(3.5 + 3.5 * abs(math.sin(2 * math.pi * 0.85 * (tnow - starts[bi]))))
        else:
            dy = -1.5 * abs(math.sin(2 * math.pi * 0.33 * tnow + hash(name) % 5))
        paste(fr, spr, spr[1], dy=int(dy))
    for bi in range(len(BEATS)):
        paste_bubble(fr, bi, tnow)
    zz = 1.0 + 0.06 * (f / max(n_frames - 1, 1))     # 镜头缓推（参考样片都有镜头运动）
    cw = int(W / zz)
    ch = int(cw * 1080 / 1920)
    cx0, cy0 = (W - cw) // 2, (H - ch) // 2
    crop = fr[cy0:cy0 + ch, cx0:cx0 + cw]
    out = cv2.resize(crop, (1920, 1080), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 95])
    buf.tofile(os.path.join(fdir, 'f_%04d.jpg' % f))
    if f == int(2.0 * FPS):
        cv2.imencode('.jpg', out)[1].tofile(os.path.join(TMP, 'anim_b1.jpg'))
    if f == int((starts[1] + 1.5) * FPS):
        cv2.imencode('.jpg', out)[1].tofile(os.path.join(TMP, 'anim_b2.jpg'))
    if f == int((starts[3] + 1.2) * FPS):
        cv2.imencode('.jpg', out)[1].tofile(os.path.join(TMP, 'anim_b4.jpg'))

# ---------- 合成 ----------
adelay = ';'.join('[%d:a]adelay=%d|%d[a%d]' % (i + 1, int(s * 1000), int(s * 1000), i) for i, s in enumerate(starts))
amix = ''.join('[a%d]' % i for i in range(len(starts)))
fc = ('[0:v]fade=t=in:st=0:d=0.5:color=white,fade=t=out:st=%.2f:d=0.7:color=white,format=yuv420p[v];'
      '%s;%s amix=inputs=%d:normalize=0,apad,atrim=0:%.2f[a]'
      % (total - 0.7, adelay, amix, len(starts), total))
cmd = [FF, '-y', '-framerate', str(FPS), '-start_number', '0',
       '-i', os.path.join(fdir, 'f_%04d.jpg')]
for bt in BEATS:
    cmd += ['-i', os.path.join(AUD, bt['wav'])]
cmd += ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', '%.2f' % total,
        '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '44100',
        os.path.join(OUT, '记录我的一天_S02_02_家里有钟表_动画.mp4')]
r = subprocess.run(cmd, capture_output=True)
shutil.rmtree(fdir)
assert r.returncode == 0, r.stderr.decode('utf-8', 'replace')[-1200:]
outp = os.path.join(OUT, '记录我的一天_S02_02_家里有钟表_动画.mp4')
print('动画版 ok (%.1fs, %.1f MB)' % (total, os.path.getsize(outp) / 1048576))
