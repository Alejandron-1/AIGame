#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小学数学课本插图 → 动态教学视频生成器
用法：把课本插图命名为 input.png 放在同目录，运行 python 课本插图转视频.py
"""

import os
import math
import subprocess
import sys
import shutil
from PIL import Image, ImageDraw, ImageFont

# Windows 控制台默认 GBK，打印 emoji 会崩，这里切到 UTF-8
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ==================== 配置区（按需修改）====================
W, H = 1280, 720          # 视频分辨率
FPS = 30                  # 帧率
DURATION = 25             # 视频时长（秒）

# 输入输出
INPUT_IMG = "input.png"
OUTPUT_MP4 = "动态课件.mp4"

# 元素在原图中的大致坐标（根据你的插图调整）
SUN_POS = (125, 125)                    # 太阳中心
BIRD_POSITIONS = [                      # 鸟儿中心坐标
    (280, 200), (420, 170), (520, 220),
    (220, 280), (350, 240), (180, 480),
    (880, 80), (980, 120), (1050, 60)
]
BUTTERFLY_POSITIONS = [                 # 蝴蝶中心坐标
    (80, 950), (150, 980), (220, 920),
    (300, 960), (380, 1000), (450, 950),
    (620, 920), (700, 950), (800, 900), (900, 950)
]
JUMP_BEAR_POS = (680, 580)              # 会跳的小熊中心

# 对话气泡配置（时间单位：秒）
BUBBLES = [
    {
        'text': '数一数，\n有几只小兔？',
        'box': (20, 245, 240, 340),         # 气泡框 (x1,y1,x2,y2)
        'arrow': (100, 340, 189, 362),      # 箭头 (起点x,起点y,终点x,终点y)
        'time_in': (2.0, 3.0),              # 淡入时间段
        'time_out': (8.0, 8.5),             # 淡出时间段
        'bg': (255, 250, 220), 'border': (255, 180, 60)
    },
    {
        'text': '小学也有\n跳房子游戏啊！',
        'box': (370, 155, 630, 245),
        'arrow': (480, 245, 478, 267),
        'time_in': (8.0, 9.0), 'time_out': (12.0, 12.5),
        'bg': (220, 240, 255), 'border': (80, 160, 220)
    },
    {
        'text': '在幼儿园我是大（2）班的，\n现在我是……',
        'box': (490, 170, 800, 280),
        'arrow': (550, 280, 534, 289),
        'time_in': (12.0, 13.0), 'time_out': (16.0, 16.5),
        'bg': (230, 255, 230), 'border': (80, 180, 100)
    },
    {
        'text': '球是圆圆的，\n门是长长的、方方的……',
        'box': (560, 320, 850, 430),
        'arrow': (640, 430, 606, 267),
        'time_in': (16.0, 17.0), 'time_out': (22.0, 22.5),
        'bg': (255, 230, 240), 'border': (220, 100, 140)
    },
]

# 小熊跳跃时间段 (开始帧, 结束帧)，基于30fps
JUMP_FRAMES = (300, 330)  # 10秒到11秒

# ==================== 核心代码（一般不需要改）====================
TOTAL_FRAMES = DURATION * FPS

def main():
    print("=" * 50)
    print("  课本插图 → 动态教学视频生成器")
    print("=" * 50)

    # 1. 加载资源
    src = Image.open(INPUT_IMG).convert('RGBA')
    sc = H / src.height
    iw = int(src.width * sc)
    ox = (W - iw) // 2
    bg = src.resize((iw, H), Image.LANCZOS)

    # 中文字体候选（Linux + Windows 都试试）
    _font_candidates = [
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",   # Linux 文泉驿
        "C:/Windows/Fonts/msyh.ttc",                     # 微软雅黑
        "C:/Windows/Fonts/msyhbd.ttc",                   # 微软雅黑粗
        "C:/Windows/Fonts/simhei.ttf",                   # 黑体
        "C:/Windows/Fonts/simsun.ttc",                   # 宋体
    ]
    font = None
    for fp in _font_candidates:
        try:
            font = ImageFont.truetype(fp, 26)
            print(f"✅ 使用字体: {fp}")
            break
        except:
            continue
    if font is None:
        font = ImageFont.load_default()

    # 2. 预生成静态背景
    static = Image.new('RGBA', (W, H), (135, 206, 235, 255))
    d = ImageDraw.Draw(static)
    for x in range(ox):
        r = int(135 + 65 * x / ox)
        g = int(206 + 34 * x / ox)
        b = int(235 + 20 * x / ox)
        d.line([(x, 0), (x, H)], fill=(r, g, b, 255))
    rs = ox + iw
    for x in range(rs, W):
        r = int(200 - 65 * (x - rs) / (W - rs))
        g = int(240 - 34 * (x - rs) / (W - rs))
        b = int(255 - 20 * (x - rs) / (W - rs))
        d.line([(x, 0), (x, H)], fill=(r, g, b, 255))
    static.paste(bg, (ox, 0), bg)
    print("✅ 背景预生成完成")

    # 3. 裁剪动态元素
    def crop(s, x, y, w, h):
        x1, y1 = max(0, int(x - w / 2)), max(0, int(y - h / 2))
        x2, y2 = min(s.width, x1 + w), min(s.height, y1 + h)
        return s.crop((x1, y1, x2, y2)).resize((int((x2 - x1) * sc), int((y2 - y1) * sc)), Image.LANCZOS)

    sun = crop(src, *SUN_POS, 210, 210)
    sp = (int(SUN_POS[0] * sc) - sun.width // 2 + ox, int(SUN_POS[1] * sc) - sun.height // 2)

    birds = []
    for i, (bx, by) in enumerate(BIRD_POSITIONS):
        b = crop(src, bx, by, 80, 80)
        birds.append({
            'img': b, 'pos': (int(bx * sc) - b.width // 2 + ox, int(by * sc) - b.height // 2),
            'ph': i * 0.7, 'fr': 2 + i * 0.3, 'am': 6 + i % 3 * 2
        })

    bflies = []
    for i, (bx, by) in enumerate(BUTTERFLY_POSITIONS):
        b = crop(src, bx, by, 70, 70)
        bflies.append({
            'img': b, 'pos': (int(bx * sc) - b.width // 2 + ox, int(by * sc) - b.height // 2),
            'ph': i * 1.2, 'fr': 3 + i * 0.4
        })

    jb = crop(src, *JUMP_BEAR_POS, 120, 120)
    jp = (int(JUMP_BEAR_POS[0] * sc) - jb.width // 2 + ox, int(JUMP_BEAR_POS[1] * sc) - jb.height // 2)

    print(f"✅ 元素裁剪完成：太阳1个，鸟儿{len(birds)}只，蝴蝶{len(bflies)}只，跳跃小熊1个")

    # 4. 渲染帧
    frame_dir = "frames"
    os.makedirs(frame_dir, exist_ok=True)

    def render(fi):
        t = fi / FPS
        f = static.copy()
        dr = ImageDraw.Draw(f)

        # 太阳脉动+微笑
        pu = 1.0 + 0.04 * math.sin(t * 3)
        ns = sun.resize((int(sun.width * pu), int(sun.height * pu)), Image.LANCZOS)
        sx = sp[0] + sun.width // 2 - ns.width // 2
        sy = sp[1] + sun.height // 2 - ns.height // 2
        f.paste(ns, (sx, sy), ns)
        cx, cy = sx + ns.width // 2, sy + ns.height // 2 + int(12 * pu)
        sw = int(20 * pu)
        sh = int(6 + 3 * math.sin(t * 4))
        for i in range(5):
            a = math.radians(210 + i * 15)
            dr.ellipse([cx + math.cos(a) * sw - 2, cy + math.sin(a) * sh - 2,
                       cx + math.cos(a) * sw + 2, cy + math.sin(a) * sh + 2], fill=(80, 40, 20, 180))

        # 鸟儿晃动
        for b in birds:
            ox_ = int(math.sin(t * b['fr'] + b['ph']) * b['am'])
            oy_ = int(math.sin(t * b['fr'] * 0.6 + b['ph']) * b['am'] * 0.3)
            f.paste(b['img'], (b['pos'][0] + ox_, b['pos'][1] + oy_), b['img'])

        # 蝴蝶晃动
        for b in bflies:
            ox_ = int(math.sin(t * b['fr'] + b['ph']) * 4)
            f.paste(b['img'], (b['pos'][0] + ox_, b['pos'][1]), b['img'])

        # 小熊跳跃
        jx, jy = jp
        if JUMP_FRAMES[0] <= fi <= JUMP_FRAMES[1]:
            jo = -int(math.sin((fi - JUMP_FRAMES[0]) / (JUMP_FRAMES[1] - JUMP_FRAMES[0]) * math.pi) * 40)
            f.paste(jb, (jx, jy + jo), jb)
        else:
            f.paste(jb, (jx, jy), jb)

        # 对话气泡
        for bb in BUBBLES:
            a = 0
            if bb['time_in'][0] <= t < bb['time_in'][1]:
                a = int(255 * (t - bb['time_in'][0]) / (bb['time_in'][1] - bb['time_in'][0]))
            elif bb['time_in'][1] <= t < bb['time_out'][0]:
                a = 255
            elif bb['time_out'][0] <= t < bb['time_out'][1]:
                a = int(255 * (1 - (t - bb['time_out'][0]) / (bb['time_out'][1] - bb['time_out'][0])))
            if a > 0:
                x1, y1, x2, y2 = bb['box']
                dr.rounded_rectangle([x1, y1, x2, y2], radius=18, fill=bb['bg'], outline=bb.get('border', (0, 0, 0)), width=3)
                ax1, ay1, ax2, ay2 = bb['arrow']
                dr.polygon([(ax1 - 8, ay1), (ax1 + 8, ay1), (ax2, ay2)], fill=bb['bg'])
                lines = bb['text'].split('\n')
                for i, ln in enumerate(lines):
                    bw = dr.textbbox((0, 0), ln, font=font)
                    tw = bw[2] - bw[0]
                    dr.text((x1 + (x2 - x1 - tw) // 2, y1 + 15 + i * 28), ln, fill=(60, 60, 60), font=font)

        return f.convert('RGB')

    print(f"\n🎬 开始渲染 {TOTAL_FRAMES} 帧...")
    for i in range(TOTAL_FRAMES):
        render(i).save(os.path.join(frame_dir, f'frame_{i:04d}.jpg'), 'JPEG', quality=92)
        if (i + 1) % 75 == 0:
            print(f"  {((i+1)/TOTAL_FRAMES*100):.0f}% ({i+1}/{TOTAL_FRAMES})")

    # 5. 合成视频
    print("\n🔧 合成MP4...")
    # 定位 ffmpeg：系统 PATH 优先，其次脚本同目录的 ffmpeg.exe
    ff = shutil.which('ffmpeg')
    if not ff:
        _local = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ffmpeg.exe')
        if os.path.exists(_local):
            ff = _local
    if not ff:
        print("❌ 未找到 ffmpeg。请安装 ffmpeg，或把 ffmpeg.exe 放到本脚本同目录。")
        return
    cmd = [ff, '-y', '-framerate', str(FPS), '-i', os.path.join(frame_dir, 'frame_%04d.jpg'),
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'fast', OUTPUT_MP4]
    # 输出走文件而非管道，规避 Python 3.7 在 Windows 上读 ffmpeg 管道的 bug
    _log = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ffmpeg_log.txt')
    with open(_log, 'w', encoding='utf-8', errors='replace') as errf:
        r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=errf)

    if r.returncode == 0:
        sz = os.path.getsize(OUTPUT_MP4)
        print(f"\n{'='*50}")
        print(f"  ✅ 成功！{OUTPUT_MP4}")
        print(f"  📊 大小: {sz/1024/1024:.2f} MB")
        print(f"  ⏱️  时长: {DURATION}秒")
        print(f"{'='*50}")
    else:
        print("❌ ffmpeg失败，请确认已安装ffmpeg")

if __name__ == '__main__':
    main()