# -*- coding: utf-8 -*-
"""去除右下角"豆包AI生成"水印：局部背景差分找笔画 -> OpenCV inpaint
Windows 下 OpenCV 不认中文路径，统一用 fromfile/imdecode 读写"""
import cv2
import numpy as np
import os

SRC = r'C:\Users\aa109\Desktop\AIGame\视频制作\视频1'
DST = os.path.join(SRC, '无水印')

# 水印大致区域（1706x1279），留了余量
X1, Y1, X2, Y2 = 1445, 1190, 1704, 1277

def imread_cn(path):
    return cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)

def imwrite_cn(path, img, params=None):
    ok, buf = cv2.imencode(os.path.splitext(path)[1], img, params or [])
    assert ok
    buf.tofile(path)

for i in range(1, 8):
    name = '%d.jpg' % i
    img = imread_cn(os.path.join(SRC, name))
    roi = img[Y1:Y2, X1:X2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # 局部背景 = 大核中值滤波
    bg = cv2.medianBlur(gray, 31)
    dev = cv2.absdiff(gray, bg)
    mask = np.where(dev > 10, 255, 0).astype(np.uint8)
    # 去掉孤立噪点，膨胀盖住笔画边缘的 JPEG 光晕
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), 1)
    ys, xs = np.nonzero(mask)
    if len(xs):
        print('%s: mask %d px, bbox x[%d-%d] y[%d-%d]' % (
            name, len(xs), xs.min() + X1, xs.max() + X1, ys.min() + Y1, ys.max() + Y1))
    full = np.zeros(img.shape[:2], np.uint8)
    full[Y1:Y2, X1:X2] = mask
    out = cv2.inpaint(img, full, 4, cv2.INPAINT_NS)
    imwrite_cn(os.path.join(DST, name), out, [cv2.IMWRITE_JPEG_QUALITY, 95])
print('done')
