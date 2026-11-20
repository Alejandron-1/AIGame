# -*- coding: utf-8 -*-
"""平滑推拉镜头：OpenCV 亚像素仿射逐帧渲染，替代抖动的 zoompan
每图 3.5s@30fps，1920x1080，模糊补边，缓入缓出，奇偶交替推近/拉远"""
import cv2
import numpy as np
import subprocess
import os
import sys
import shutil

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

FF = r'C:\Users\aa109\Desktop\AIGame\视频\ffmpeg.exe'
SRC = r'C:\Users\aa109\Desktop\AIGame\视频制作\视频1\无水印'
WORK = r'C:\Users\aa109\Desktop\AIGame\视频制作\视频1\_work'
W, H = 1920, 1080
FPS = 30
N_FRAMES = 105          # 3.5s
ZOOM = 0.08             # 总缩放幅度

def imread_cn(path):
    return cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)

def compose_canvas(img):
    """原图 -> 1920x1080 画布：模糊放大垫底，完整图居中"""
    h, w = img.shape[:2]
    bg = cv2.resize(img, (W, H), interpolation=cv2.INTER_LANCZOS4)
    bg = cv2.GaussianBlur(bg, (0, 0), 30)
    fh = H
    fw = int(round(w * H / h))
    fg = cv2.resize(img, (fw, fh), interpolation=cv2.INTER_LANCZOS4)
    x0 = (W - fw) // 2
    canvas = bg.copy()
    canvas[:, x0:x0 + fw] = fg
    # 2x 超采样，供仿射采样用
    return cv2.resize(canvas, (W * 2, H * 2), interpolation=cv2.INTER_LANCZOS4)

for i in range(1, 8):
    img = imread_cn(os.path.join(SRC, '%d.jpg' % i))
    up = compose_canvas(img)
    fdir = os.path.join(WORK, 'frames_%d' % i)
    os.makedirs(fdir, exist_ok=True)
    zoom_in = (i % 2 == 1)
    for f in range(N_FRAMES):
        p = f / (N_FRAMES - 1)
        ease = p * p * (3 - 2 * p)          # smoothstep 缓入缓出
        s = 1 + ZOOM * ease if zoom_in else 1 + ZOOM * (1 - ease)
        # 正向映射：up(2x) -> 输出帧，中心缩放
        M = np.float32([[s / 2, 0, W / 2 - W / 2 * s], [0, s / 2, H / 2 - H / 2 * s]])
        frame = cv2.warpAffine(up, M, (W, H),
                               flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_REPLICATE)
        ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        assert ok
        buf.tofile(os.path.join(fdir, 'f_%04d.jpg' % f))
    out = os.path.join(WORK, 'clip_%d.mp4' % i)
    r = subprocess.run([FF, '-y', '-framerate', str(FPS),
                        '-start_number', '0',
                        '-i', os.path.join(fdir, 'f_%04d.jpg'),
                        '-pix_fmt', 'yuv420p',
                        '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', out],
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if r.returncode != 0:
        print('frames left in', fdir)
    else:
        shutil.rmtree(fdir)
    if r.returncode != 0:
        print('clip %d FAILED' % i)
        print(r.stderr.decode('utf-8', 'replace')[-1000:])
        sys.exit(1)
    print('clip_%d.mp4 ok (%.1f MB)' % (i, os.path.getsize(out) / 1048576))
print('all smooth clips done')
