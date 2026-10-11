#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一体化：抓帧 + 黑帧检测 + 编码 MP4，一次完成。"""
import os, sys, subprocess, time

HERE = r"C:\Users\aa109\Desktop\AIGame\视频\希沃小视频-正方体展开"
FRAMES = os.path.join(HERE, "frames")
FACEBOX = r"C:\Users\aa109\AppData\Local\Temp\facebox"
EDGE = r"C:\Users\aa109\AppData\Local\Temp\facebox\edge"   # 固定 user-data-dir
FFMPEG = r"C:\Users\aa109\Desktop\AIGame\视频\ffmpeg.exe"
PAGE = "render_faces.html?pair=lr"
URL = "http://127.0.0.1:8643/render_faces.html?pair=lr&frame=%d"
TOTAL = 600
OUT1 = r"C:\Users\aa109\Desktop\AIGame\小学一年级\图形小镇-公开课工具包\渲染素材\长方体相对面-左右上下前后.mp4"
OUT2 = r"C:\Users\aa109\Desktop\AIGame\小学一年级\长方体相对面-左右上下前后.mp4"

from PIL import Image

def capture(i):
    f = os.path.join(FRAMES, 'frame_%04d.png' % i)
    for attempt in range(4):
        prof = EDGE + '_prof'
        cmd = [EDGE, '--headless=new', '--disable-gpu', '--use-angle=swiftshader',
               '--no-first-run', '--no-default-browser-check',
               '--window-size=1920,1080', '--hide-scrollbars',
               '--virtual-time-budget=4000',
               '--user-data-dir=' + prof,
               '--screenshot=' + f, URL % i]
        try:
            subprocess.run(cmd, capture_output=True, timeout=40)
        except Exception:
            pass
        ok = os.path.isfile(f) and os.path.getsize(f) > 10000
        if ok:
            try:
                im = Image.open(f).convert('L')
                hist = im.histogram()
                mean = sum(j*v for j, v in enumerate(hist)) / max(1, sum(hist))
                if mean < 15:                # 黑帧
                    ok = False
            except Exception:
                ok = False
        if ok:
            return True
        try: os.remove(f)
        except OSError: pass
        time.sleep(0.6)
    return False

def main():
    os.makedirs(FRAMES, exist_ok=True)
    for f in os.listdir(FRAMES):
        os.remove(os.path.join(FRAMES, f))
    t0 = time.time()
    miss = list(range(TOTAL))
    rnd = 0
    while miss and time.time() - t0 < 3300:
        rnd += 1
        still = []
        for i in miss:
            if capture(i):
                pass
            else:
                still.append(i)
            if (i + 1) % 60 == 0:
                have = TOTAL - len(still) - (len(miss) - len(still))
                print('round %d progress, elapsed %ds' % (rnd, int(time.time()-t0)), flush=True)
        miss = still
        print('round %d done, missing=%d' % (rnd, len(miss)), flush=True)
    total = len([f for f in os.listdir(FRAMES) if f.endswith('.png')])
    print('frames ready:', total, flush=True)
    if total < TOTAL:
        print('INCOMPLETE', flush=True)
        return 1
    cmd = [FFMPEG, '-y', '-framerate', '30', '-i', os.path.join(FRAMES, 'frame_%04d.png'),
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
           '-movflags', '+faststart', OUT1]
    r = subprocess.run(cmd, capture_output=True)
    print('encode rc=', r.returncode, flush=True)
    import shutil
    shutil.copy2(OUT1, OUT2)
    print('FINAL OK', flush=True)
    return 0

if __name__ == '__main__':
    sys.exit(main())
