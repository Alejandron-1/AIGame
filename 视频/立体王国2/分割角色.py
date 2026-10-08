#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从角色合影分割 5 个角色 → 透明 PNG（角色/01魔法师.png ... 05球.png）
分界由列投影低谷确定：0-842-1263-1782-2283-W"""
import io, os, sys, collections
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '素材', '角色合影.jpg')
OUT = os.path.join(HERE, '角色')
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()

seeds = []
for x in range(0, W, 40):
    seeds.append(px[x, 0]); seeds.append(px[x, H-1])
for y in range(0, H, 40):
    seeds.append(px[0, y]); seeds.append(px[W-1, y])
def is_bg(p):
    return any(abs(p[0]-c[0])+abs(p[1]-c[1])+abs(p[2]-c[2]) < 60 for c in seeds)

# 洪泛标记背景（BFS）
bg = bytearray(W*H)
q = collections.deque()
for x in range(W):
    for y in (0, H-1):
        if is_bg(px[x, y]) and not bg[y*W+x]:
            bg[y*W+x] = 1; q.append((x, y))
for y in range(H):
    for x in (0, W-1):
        if is_bg(px[x, y]) and not bg[y*W+x]:
            bg[y*W+x] = 1; q.append((x, y))
while q:
    x, y = q.popleft()
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx, ny = x+dx, y+dy
        if 0 <= nx < W and 0 <= ny < H and not bg[ny*W+nx] and is_bg(px[nx, ny]):
            bg[ny*W+nx] = 1; q.append((nx, ny))

rgba = im.convert('RGBA')
d = rgba.load()
for y in range(H):
    row = y*W
    for x in range(W):
        if bg[row+x]:
            d[x, y] = (0, 0, 0, 0)

# 按列分界切 5 段
CUTS = [0, 842, 1263, 1782, 2283, W]
NAMES = ['01魔法师', '02长方体', '03正方体', '04圆柱', '05球']
PAD = 14
sheet_items = []
for k in range(5):
    xa, xb = CUTS[k], CUTS[k+1]
    x0 = y0 = 10**9; x1 = y1 = -1
    for y in range(H):
        row = y*W
        for x in range(xa, xb):
            if not bg[row+x]:
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
    assert x1 >= 0, NAMES[k]
    x0 = max(0, x0-PAD); y0 = max(0, y0-PAD); x1 = min(W-1, x1+PAD); y1 = min(H-1, y1+PAD)
    crop = rgba.crop((x0, y0, x1+1, y1+1))
    crop.save(os.path.join(OUT, NAMES[k] + '.png'))
    sheet_items.append((NAMES[k], crop))
    print('保存', NAMES[k], crop.size)

# 预览拼图
cell = 300
sheet = Image.new('RGB', (cell*5, cell+26), (240,240,240))
dd = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 22)
except: font = None
for i, (nm, crop) in enumerate(sheet_items):
    t = crop.copy(); t.thumbnail((cell-12, cell-16))
    bgc = Image.new('RGBA', t.size, (255,255,255,255))
    dd2 = ImageDraw.Draw(bgc)
    for ty in range(0, t.height, 16):
        for tx in range(0, t.width, 16):
            if (tx//16 + ty//16) % 2:
                dd2.rectangle([tx,ty,tx+15,ty+15], fill=(222,222,222))
    bgc.alpha_composite(t)
    sheet.paste(bgc.convert('RGB'), (i*cell+6, 8))
    dd.text((i*cell+10, cell-4), nm, fill=(30,30,30), font=font)
sheet.save(os.path.join(OUT, '分割预览.png'))
print('预览: 角色/分割预览.png')
