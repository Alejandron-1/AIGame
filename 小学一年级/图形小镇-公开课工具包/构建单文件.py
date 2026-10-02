# -*- coding: utf-8 -*-
"""把课件模板中的 ASSET:名 标记替换为 base64 data URI，输出单文件课件"""
import base64, io, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
TPL  = os.path.join(BASE, '课件模板.html')
LIB  = os.path.join(BASE, '素材库')
OUT  = os.path.join(BASE, '..', '认识立体图形-图形小镇课件.html')

html = io.open(TPL, encoding='utf-8').read()
tokens = set(re.findall(r'ASSET:([a-z_]+)', html))
print('需要素材:', len(tokens), '张')
total = 0
for name in sorted(tokens):
    p = os.path.join(LIB, name + '.png')
    if not os.path.exists(p):
        print('!! 缺少素材:', name); sys.exit(1)
    b64 = base64.b64encode(io.open(p, 'rb').read()).decode()
    total += len(b64)
    html = html.replace('ASSET:' + name, 'data:image/png;base64,' + b64)
left = re.findall(r'ASSET:[a-z_]+', html)
if left:
    print('!! 未替换的标记:', left); sys.exit(1)
io.open(OUT, 'w', encoding='utf-8').write(html)
print('输出:', os.path.abspath(OUT), f'{os.path.getsize(OUT)//1024}KB (base64共{total//1024}KB)')
