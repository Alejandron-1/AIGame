# -*- coding: utf-8 -*-
"""
图片转文档工具：把别人文档的【截图】扫描成可编辑的 Word / 一比一布局预览 / 纯文本
适合场景：拿到一份练习卷/教案的图片（没有源文件），想一比一复现打印。

用法：
    python 图片转文档.py 图片1.png [图片2.jpg ...]
    也可以直接把图片拖到「拖入图片转文档.bat」上

输出（保存在图片同目录，文件名加后缀）：
    xxx.docx   可编辑 Word（文字按阅读顺序；插图区域自动裁剪嵌入）
    xxx.html   一比一布局预览（原图淡化垫底 + 识别文字按原位置叠加）
    xxx.txt    纯文本
依赖安装：双击「一键安装依赖.bat」，或 pip install -r requirements.txt
"""
import os
import sys
import math

def fail(msg):
    print("\n[错误] " + msg)
    try:
        input("按回车键退出...")
    except EOFError:
        pass
    sys.exit(1)

# ---------- 依赖检查 ----------
try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    fail("缺少 OCR 组件。请先双击运行「一键安装依赖.bat」（或执行 pip install rapidocr-onnxruntime python-docx）")
try:
    from docx import Document
    from docx.shared import Pt, Inches, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
except ImportError:
    fail("缺少 Word 组件。请先双击运行「一键安装依赖.bat」（或执行 pip install python-docx）")
import numpy as np
from PIL import Image, ImageDraw

ENGINE = RapidOCR()

# ---------- 工具 ----------
def box_center(box):
    xs = [p[0] for p in box]; ys = [p[1] for p in box]
    return sum(xs) / 4.0, sum(ys) / 4.0

def box_rect(box):
    xs = [p[0] for p in box]; ys = [p[1] for p in box]
    return min(xs), min(ys), max(xs), max(ys)   # x0,y0,x1,y1

def group_lines(items):
    """把 OCR 小块按 y 归并成行，行内按 x 排序。items: [{box,text,score}]"""
    if not items:
        return []
    items = sorted(items, key=lambda it: box_center(it[0])[1])
    lines, cur, cur_y = [], [], None
    for it in items:
        _, cy = box_center(it[0])
        _, y0, _, y1 = box_rect(it[0])
        h = y1 - y0
        if cur_y is None or abs(cy - cur_y) <= max(h, 14) * 0.7:
            cur.append(it)
            cur_y = cy if cur_y is None else (cur_y * 0.6 + cy * 0.4)
        else:
            lines.append(cur); cur = [it]; cur_y = cy
    if cur:
        lines.append(cur)
    out = []
    for ln in lines:
        ln.sort(key=lambda it: box_rect(it[0])[0])
        x0 = min(box_rect(it[0])[0] for it in ln)
        y0 = min(box_rect(it[0])[1] for it in ln)
        x1 = max(box_rect(it[0])[2] for it in ln)
        y1 = max(box_rect(it[0])[3] for it in ln)
        text = "".join(it[1] for it in ln)
        out.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "text": text,
                    "h": y1 - y0, "score": min(it[2] for it in ln)})
    return out

def detect_figures(img_bgr, text_lines):
    """检测非文字的大块插图区域（深色或彩色），返回裁剪框列表 [(x0,y0,x1,y1)]"""
    H, W = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    # 内容掩码：非白底像素（深色 或 彩色）
    dark = (gray < 235).astype(np.uint8) * 255
    colored = (hsv[:, :, 1] > 60).astype(np.uint8) * 255   # 饱和度高的彩色图形
    content = cv2.bitwise_or(dark, colored)
    # 抹掉文字区域
    tmask = np.zeros((H, W), np.uint8)
    for ln in text_lines:
        cv2.rectangle(tmask, (int(ln["x0"]), int(ln["y0"])), (int(ln["x1"]), int(ln["y1"])), 255, -1)
    tmask = cv2.dilate(tmask, np.ones((9, 9), np.uint8))
    figures = content.copy()
    figures[tmask > 0] = 0
    figures = cv2.morphologyEx(figures, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cnts, _ = cv2.findContours(figures, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if area < W * H * 0.004 or w < 30 or h < 24:
            continue
        if w > W * 0.98 and h > H * 0.9:   # 整页边框忽略
            continue
        boxes.append((max(0, x - 8), max(0, y - 8), min(W, x + w + 8), min(H, y + h + 8)))
    boxes.sort(key=lambda b: (b[1], b[0]))
    # 合并重叠框
    merged = []
    for b in boxes:
        if merged and not (b[0] > merged[-1][2] or b[2] < merged[-1][0] or b[1] > merged[-1][3] or b[3] < merged[-1][1]):
            m = merged[-1]
            merged[-1] = (min(m[0], b[0]), min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3]))
        else:
            merged.append(b)
    return merged

def is_title_like(line, med_h):
    return line["h"] > med_h * 1.45 and len(line["text"]) <= 30

# ---------- 单图处理 ----------
def process(img_path):
    print(f"\n=== 处理：{os.path.basename(img_path)} ===")
    img_pil = Image.open(img_path).convert("RGB")
    img_bgr = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    H, W = img_bgr.shape[:2]
    result, _ = ENGINE(img_bgr)
    items = []
    for box, text, score in (result or []):
        text = text.strip()
        if text:
            items.append((box, text, float(score)))
    lines = group_lines(items)
    if not lines:
        print("  未识别到文字（图片太模糊或没有文字）")
    med_h = sorted(l["h"] for l in lines)[len(lines) // 2] if lines else 20
    figs = detect_figures(img_bgr, lines)
    print(f"  识别文字行：{len(lines)} 行，插图区域：{len(figs)} 块")

    base = os.path.splitext(img_path)[0]

    # ---- TXT ----
    with open(base + "_还原.txt", "w", encoding="utf-8") as f:
        for l in lines:
            f.write(l["text"] + "\n")

    # ---- DOCX（可编辑，阅读顺序 = 文字行与插图按 y 混排） ----
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style.font.size = Pt(11)
    seq = [{"kind": "text", "y": l["y0"], "line": l} for l in lines]
    seq += [{"kind": "fig", "y": f[1], "box": f} for f in figs]
    seq.sort(key=lambda s: s["y"])
    prev_y = None
    for s in seq:
        if s["kind"] == "fig":
            x0, y0, x1, y1 = s["box"]
            crop = img_pil.crop((x0, y0, x1, y1))
            fpath = base + f"_插图{int(y0)}.png"
            crop.save(fpath)
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.add_run().add_picture(fpath, width=Inches(min(4.5, (x1 - x0) / 200)))
            pPr = p.paragraph_format
            pPr.space_after = Pt(6)
        else:
            l = s["line"]
            p = doc.add_paragraph()
            if prev_y is not None and l["y0"] - prev_y > med_h * 1.8:
                p.paragraph_format.space_before = Pt(10)
            prev_y = l["y0"]
            r = p.add_run(l["text"])
            if is_title_like(l, med_h):
                r.font.bold = True
                r.font.size = Pt(16)
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.save(base + "_还原.docx")

    # ---- HTML（一比一布局预览：原图淡化垫底 + 文字原位叠加 + 插图原位） ----
    scale = 100.0 / W   # 用百分比定位，宽度自适应
    parts = [f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>布局还原预览 - {os.path.basename(img_path)}</title><style>
body {{ background:#555; margin:0; padding:24px; display:flex; justify-content:center; }}
.sheet {{ position:relative; width:min(96vw, {W}px); aspect-ratio:{W}/{H}; background:#fff;
    box-shadow:0 10px 40px rgba(0,0,0,.4); }}
.sheet img.bg {{ position:absolute; inset:0; width:100%; height:100%; opacity:.18; }}
.t {{ position:absolute; color:#d63031; font-weight:600; line-height:1.15; white-space:nowrap; }}
.f {{ position:absolute; }}
.tip {{ position:fixed; right:18px; top:14px; background:rgba(0,0,0,.65); color:#fff;
    padding:10px 18px; border-radius:10px; font-size:14px; }}
</style></head><body><div class="sheet">
<img class="bg" src="{os.path.basename(img_path)}">
<div class="tip">红色 = 识别出的文字（原位） · 背景淡化为原图 · 参照此版式在 Word 里排版</div>"""]
    for f in figs:
        x0, y0, x1, y1 = f
        parts.append(f'<img class="f" style="left:{x0*scale}%;top:{y0/H*100}%;width:{(x1-x0)*scale}%;" src="{os.path.basename(img_path)}">')
    for l in lines:
        fs = max(9, l["h"] * 0.92)
        parts.append(f'<div class="t" style="left:{l["x0"]*scale}%;top:{l["y0"]/H*100}%;font-size:{fs:.0f}px;">{l["text"]}</div>')
    parts.append("</div></body></html>")
    with open(base + "_布局预览.html", "w", encoding="utf-8") as f:
        f.write("".join(parts))

    print(f"  ✅ 输出：{os.path.basename(base)}_还原.docx / _布局预览.html / _还原.txt")
    low = [l["text"] for l in lines if l["score"] < 0.72]
    if low:
        print(f"  ⚠️ 有 {len(low)} 行识别置信度较低，Word 里请重点校对：{' / '.join(low[:3])}")

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not args:
        print("用法：把图片文件拖到「拖入图片转文档.bat」上；或命令行：python 图片转文档.py 图片.png")
        try:
            p = input("或直接输入图片路径后回车：").strip().strip('"')
        except EOFError:
            return
        if p:
            args = [p]
        if not args:
            return
    for p in args:
        if not os.path.isfile(p):
            print(f"[跳过] 找不到文件：{p}")
            continue
        try:
            process(p)
        except Exception as e:
            print(f"[失败] {p}: {e}")
    try:
        input("\n全部完成，按回车键退出...")
    except EOFError:
        pass

import cv2
if __name__ == "__main__":
    main()
