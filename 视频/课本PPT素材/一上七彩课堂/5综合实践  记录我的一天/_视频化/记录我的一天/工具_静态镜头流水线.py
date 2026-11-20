# -*- coding: utf-8 -*-
"""静态镜头流水线：SAPI TTS -> 亚像素推近渲染 -> ffmpeg 合成
台词、镜头参数集中在 SHOTS 表；换页只需加一行。"""
import cv2
import numpy as np
import subprocess
import os
import sys
import json
import math
import shutil

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
W, H = 1920, 1080
LEAD, TAIL = 0.6, 0.8   # 配音前留白/尾留白（秒）

SHOTS = [   # S02 静态版已被对话动画取代并移入 02_草稿，不再在此列表
    dict(id='S10_01', wav='S10_01_整时.mp3',
         out='记录我的一天_S10_01_整时_静态.mp4',
         img='S10_整时.png',
         z0=1.00, z1=1.35, cx=0.72, cy=0.36,
         text='分针都指向12，是整时。时针指向几，就是几时整。'),
    dict(id='S16_01', wav='S16_01_我的一天.mp3',
         out='记录我的一天_S16_01_我的一天_静态.mp4',
         img='S16_我的一天.png',
         z0=1.00, z1=1.30, cx=0.50, cy=0.47,
         text='早上7时半起床。9时上课。10时课间操。中午12时吃饭。下午5时放学。晚上9时半睡觉。这是我的一天。'),
]

def tts_all():
    from 工具_百度TTS import baidu_tts
    for sh in SHOTS:
        n = baidu_tts(sh['text'], os.path.join(AUD, sh['wav']), spd=6)
        print('%s: %d B' % (sh['wav'], n))

def probe_dur(path):
    r = subprocess.run([FF, '-i', path], capture_output=True)
    import re
    m = re.search(rb'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))

def render(sh, total):
    up = cv2.imdecode(np.fromfile(os.path.join(KF, sh['img']), dtype=np.uint8), cv2.IMREAD_COLOR)
    UH, UW = up.shape[:2]
    fdir = os.path.join(DRAFT, 'frames_' + sh['id'])
    os.makedirs(fdir, exist_ok=True)
    n = int(round(total * FPS))
    for f in range(n):
        p = f / (n - 1)
        ease = p * p * (3 - 2 * p)
        z = sh['z0'] + (sh['z1'] - sh['z0']) * ease
        # 画布中心（视口中心）从全图中心滑向目标点
        ex = 0.5 + (sh['cx'] - 0.5) * ease
        ey = 0.5 + (sh['cy'] - 0.5) * ease
        # 视口尺寸（原图坐标系）
        vw, vh = W / z * (UW / W), H / z * (UH / H)
        vw, vh = W / z, H / z
        # 原图 -> 1080p 输出的统一缩放因子
        sc = H / UH * (UW / W)  # 近似，用精确法：
        scx, scy = W / UW, H / UH
        s = max(scx, scy)
        # 视口映射：以 (ex*UW, ey*UH) 为中心、缩放 z
        M = np.float32([[s * z, 0, W / 2 - ex * UW * s * z],
                        [0, s * z, H / 2 - ey * UH * s * z]])
        frame = cv2.warpAffine(up, M, (W, H), flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_REPLICATE)
        ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        buf.tofile(os.path.join(fdir, 'f_%04d.jpg' % f))
    return n

def mux(sh, n, total):
    fdir = os.path.join(DRAFT, 'frames_' + sh['id'])
    outp = os.path.join(OUT, sh['out'])
    fade_out = max(total - 0.7, 0)
    fc = ('[0:v]fade=t=in:st=0:d=0.5:color=white,fade=t=out:st=%.2f:d=0.7:color=white,format=yuv420p[v];'
          '[1:a]adelay=%d|%d,apad,atrim=0:%.2f,afade=t=out:st=%.2f:d=0.4[a]'
          % (fade_out, int(LEAD * 1000), int(LEAD * 1000), total, total - 0.5))
    cmd = [FF, '-y', '-framerate', str(FPS), '-start_number', '0',
           '-i', os.path.join(fdir, 'f_%04d.jpg'),
           '-i', os.path.join(AUD, sh['wav']),
           '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
           '-t', '%.2f' % total,
           '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
           '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', outp]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print(r.stderr.decode('utf-8', 'replace')[-1200:])
        sys.exit(1)
    shutil.rmtree(fdir)
    print('%s ok (%.1fs, %.1f MB)' % (sh['out'], total, os.path.getsize(outp) / 1048576))

tts_all()
for sh in SHOTS:
    wav = os.path.join(AUD, sh['wav'])
    dur = probe_dur(wav)
    total = LEAD + dur + TAIL
    n = render(sh, total)
    mux(sh, n, total)
print('ALL DONE')
