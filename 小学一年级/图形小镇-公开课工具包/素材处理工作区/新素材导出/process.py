# -*- coding: utf-8 -*-
"""新素材处理：边缘泛洪去白底→裁边→缩放→base64"""
from PIL import Image
import numpy as np
from collections import deque
import base64, io, os

SRC = r'C:\Users\aa109\Desktop\新素材导出'
DST = r'C:\Users\aa109\Desktop\AIGame\新素材导出\web'
os.makedirs(DST, exist_ok=True)

FILES = ['image1.png','image2.png','image3.png','image4.jpeg','image5.png',
         'image6.jpeg','image7.png','image8.png','image9.png','image10.png']

def flood_white_alpha(im, thr=242):
    """从四边泛洪：与边缘连通的近白像素变透明（保留物体内部的白色）"""
    im = im.convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)
    near_white = (rgb.min(axis=2) >= thr)
    mask = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x] and not mask[y, x]:
                mask[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not mask[y, x]:
                mask[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True; dq.append((ny, nx))
    a[mask, 3] = 0
    return Image.fromarray(a)

def trim(im, pad=4):
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 8)
    if len(ys) == 0: return im
    y0, y1 = max(0, ys.min()-pad), min(im.height, ys.max()+1+pad)
    x0, x1 = max(0, xs.min()-pad), min(im.width, xs.max()+1+pad)
    return im.crop((x0, y0, x1, y1))

out = {}
for f in FILES:
    im = Image.open(os.path.join(SRC, f))
    if im.mode != 'RGBA' or f in ('image7.png',):
        im = flood_white_alpha(im, thr=240 if f in ('image4.jpeg','image5.png') else 242)
    im = trim(im)
    if max(im.size) > 400:
        r = 400 / max(im.size)
        im = im.resize((int(im.width*r), int(im.height*r)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    b = buf.getvalue()
    out[f] = base64.b64encode(b).decode()
    im.save(os.path.join(DST, f.split('.')[0] + '.png'))
    print('%s -> %.1fKB base64' % (f, len(b)/1024))

import json
json.dump(out, open(os.path.join(DST, 'b64.json'), 'w'))
print('全部完成')
