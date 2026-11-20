# -*- coding: utf-8 -*-
"""每张无水印图 -> 3.5s Ken Burns 片段（1920x1080@30fps，模糊补边，交替推近/拉远）"""
import subprocess
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

FF = r'C:\Users\aa109\Desktop\AIGame\视频\ffmpeg.exe'
SRC = r'C:\Users\aa109\Desktop\AIGame\视频制作\视频1\无水印'
WORK = r'C:\Users\aa109\Desktop\AIGame\视频制作\视频1\_work'
os.makedirs(WORK, exist_ok=True)

DUR = 3.5
FPS = 30
FRAMES = int(DUR * FPS)  # 105

for i in range(1, 8):
    src = os.path.join(SRC, '%d.jpg' % i)
    out = os.path.join(WORK, 'clip_%d.mp4' % i)
    if i % 2 == 1:   # 奇数段缓慢推近
        zexpr = "1+0.08*on/%d" % (FRAMES - 1)
    else:            # 偶数段缓慢拉远
        zexpr = "1.08-0.08*on/%d" % (FRAMES - 1)
    fc = (
        "[0:v]split[bg][fg];"
        "[bg]scale=1920:1080:force_original_aspect_ratio=increase,"
        "crop=1920:1080,boxblur=24:4[g];"
        "[fg]scale=-2:1080:flags=lanczos[f];"
        "[g][f]overlay=(W-w)/2:0,"
        "scale=3840:2160:flags=lanczos,setsar=1,"
        "zoompan=z='%s':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2'"
        ":d=%d:s=1920x1080:fps=%d,format=yuv420p[v]" % (zexpr, FRAMES, FPS)
    )
    cmd = [FF, '-y', '-i', src, '-filter_complex', fc, '-map', '[v]',
           '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', out]
    r = subprocess.run(cmd, stdout=subprocess.DEVNULL,
                       stderr=subprocess.PIPE)
    if r.returncode != 0:
        print('clip %d FAILED' % i)
        print(r.stderr.decode('utf-8', 'replace')[-1500:])
        sys.exit(1)
    print('clip_%d.mp4 ok (%.1f MB)' % (i, os.path.getsize(out) / 1048576))
print('all clips done')
