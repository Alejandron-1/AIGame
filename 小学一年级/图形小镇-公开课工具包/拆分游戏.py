# -*- coding: utf-8 -*-
"""
拆分游戏：把《认识立体图形-图形小镇课件》按环节拆成独立 HTML（每文件=一个游戏/环节，
自动隐藏课件壳层、内嵌全部素材、双击即玩）。输出到 一键启动/ 文件夹。
"""
import io, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '认识立体图形-图形小镇课件.html')
OUT = os.path.join(HERE, '一键启动')
os.makedirs(OUT, exist_ok=True)

SLIDES = [
    ('context',     '情境导入'),
    ('game1',       '第1关-认识小伙伴'),
    ('namecards',   '图形名片'),
    ('feat-cuboid', '认识长方体3D'),
    ('feat-cube',   '认识正方体3D'),
    ('feat-compare','长方体正方体比一比'),
    ('feat-cyl',    '认识圆柱3D'),
    ('feat-ball',   '认识球3D'),
    ('playtalk',    '玩一玩说一说'),
    ('game2',       '猜谜语'),
    ('game3',       '按形状分一分连线'),
    ('count',       '数一数'),
    ('song',        '儿歌齐读'),
    ('homework',    '课后小任务'),
]

html = io.open(SRC, encoding='utf-8').read()
assert '<script>' in html and 'renderDeck' in html

for sid, name in SLIDES:
    tag = f'<script>window.__ONLY="{sid}";window.__EMBED=1;</script>'
    # 注入到 <head> 最前（保证在主脚本执行前定义）
    out = html.replace('<head>', '<head>\n' + tag, 1)
    assert tag in out
    path = os.path.join(OUT, f'{name}.html')
    io.open(path, 'w', encoding='utf-8').write(out)
    print('生成', name + '.html', os.path.getsize(path)//1024, 'KB')
print('共', len(SLIDES), '个独立游戏文件 →', OUT)
