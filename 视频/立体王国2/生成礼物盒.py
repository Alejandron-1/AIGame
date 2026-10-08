#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成皮克斯风精美礼物盒（3个候选）"""
import json, urllib.request, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
API_KEY = "9aa383ed88bc409583aad7b478c77ee7.xnAeaBZptaldV1em"

STYLE = "皮克斯风格3D卡通渲染，色彩明快饱满，温馨梦幻，柔和暖光，细节丰富，8K高清"
PROMPTS = {
    "礼物盒-粉金": f"一个精美的礼物盒特写，纯白背景：粉金色礼盒配深粉色缎带蝴蝶结，盒身有柔和光泽和细腻高光，旁边点缀金色星星与星光粒子，{STYLE}",
    "礼物盒-紫金": f"一个精美的魔法礼物盒特写，纯白背景：深紫色礼盒缀金色星星图案，金色缎带蝴蝶结微微发光，魔法星光粒子环绕，{STYLE}",
    "礼物盒-糖果": f"一个精美的礼物盒特写，纯白背景：马卡龙粉蓝配色礼盒，奶白色缎带大蝴蝶结，糖果质感圆润可爱，旁边有小星星装饰，{STYLE}",
}

os.makedirs('素材', exist_ok=True)
for name, prompt in PROMPTS.items():
    body = json.dumps({"model": "cogview-3-flash", "prompt": prompt, "size": "1024x1024"}).encode('utf-8')
    req = urllib.request.Request("https://open.bigmodel.cn/api/paas/v4/images/generations", data=body,
        headers={"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=120)
        url = json.loads(r.read())['data'][0]['url']
        data = urllib.request.urlopen(url, timeout=120).read()
        path = f'素材/{name}.png'
        open(path, 'wb').write(data)
        print('生成:', path, len(data)//1024, 'KB')
    except Exception as e:
        print(name, '失败:', str(e)[:200])
