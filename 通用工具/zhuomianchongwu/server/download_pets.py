#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从洛克王国BWiki批量下载宠物精灵图
图片来源: wiki.biligame.com/rocokingdom
"""

import os
import urllib.request
import urllib.error
import ssl
import time
import json

# 目标目录
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'themes', 'pets')
os.makedirs(SAVE_DIR, exist_ok=True)

# 忽略 SSL 证书验证（部分CDN可能有问题）
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# 所有可用的宠物图片（名称, 来源URL, 描述）
PET_IMAGES = [
    # === 火系进化链（4阶段） ===
    {
        "filename": "01_火花_精灵.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/1/1d/is7igmtgcv0tz6sg5ao0cbmkl0trh0x.png",
        "pet": "火花",
        "type": "fire",
        "stage": 1,
        "desc": "火系初始宠物 - 火花"
    },
    {
        "filename": "01_火花_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/2/22/9krz789w7wu1sziotivu05trc37t8d0.png",
        "pet": "火花",
        "type": "fire",
        "stage": 1,
        "desc": "火系初始宠物 - 火花(头像)"
    },
    {
        "filename": "02_焰火_精灵.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/9/90/ru2g76qm60xnmwav8d1ade4r4ehycl0.png",
        "pet": "焰火",
        "type": "fire",
        "stage": 2,
        "desc": "火系一阶进化 - 焰火"
    },
    {
        "filename": "02_焰火_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/1/1b/p9h2jm28wo274znz3xvtqa222xmze2t.png",
        "pet": "焰火",
        "type": "fire",
        "stage": 2,
        "desc": "火系一阶进化 - 焰火(头像)"
    },
    {
        "filename": "03_火神_精灵.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/4/43/e71vub1opxumr5nlz9wygu1r30wz3lx.png",
        "pet": "火神",
        "type": "fire",
        "stage": 3,
        "desc": "火系二阶进化(最终) - 火神"
    },
    {
        "filename": "03_火神_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/e/e4/bs3f6gmxql0ml3nu6nz0l8tm9nwrh6l.png",
        "pet": "火神",
        "type": "fire",
        "stage": 3,
        "desc": "火系二阶进化(最终) - 火神(头像)"
    },
    {
        "filename": "04_烈火战神_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/6/60/3om93zi5u3ix7o8fkh00m3q9o85n04s.png",
        "pet": "烈火战神",
        "type": "fire",
        "stage": 4,
        "desc": "火系超进化 - 烈火战神(头像)"
    },

    # === 草系进化链（3阶段） ===
    {
        "filename": "05_喵喵_精灵.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/9/94/tjomvtr8rbs6ceve5v3u3k9n98jmz7q.png",
        "pet": "喵喵",
        "type": "grass",
        "stage": 1,
        "desc": "草系初始宠物 - 喵喵"
    },
    {
        "filename": "05_喵喵_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/e/e7/rv0nsrvn6kneokmx7zdtk00n3pruwn9.png",
        "pet": "喵喵",
        "type": "grass",
        "stage": 1,
        "desc": "草系初始宠物 - 喵喵(头像)"
    },
    {
        "filename": "06_喵呜_精灵.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/a/a7/hbmtys37rxyg9lt2rychyszumqe65rl.png",
        "pet": "喵呜",
        "type": "grass",
        "stage": 2,
        "desc": "草系一阶进化 - 喵呜"
    },
    {
        "filename": "06_喵呜_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/9/99/015csm2s1s2q5cpsfrmqn1fqcyqv4vb.png",
        "pet": "喵呜",
        "type": "grass",
        "stage": 2,
        "desc": "草系一阶进化 - 喵呜(头像)"
    },
    {
        "filename": "07_魔力喵_精灵.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/7/75/iewd2csyevtshxt69rmcfu681ru4rua.png",
        "pet": "魔力喵",
        "type": "grass",
        "stage": 3,
        "desc": "草系二阶进化(最终) - 魔力喵"
    },
    {
        "filename": "07_魔力喵_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/b/ba/dakgvm8kme3c44e79c25v9hzd9jbo5d.png",
        "pet": "魔力喵",
        "type": "grass",
        "stage": 3,
        "desc": "草系二阶进化(最终) - 魔力喵(头像)"
    },

    # === 水系（仅头像） ===
    {
        "filename": "08_水蓝蓝_头像.png",
        "url": "https://patchwiki.biligame.com/images/rocokingdom/a/ad/7oucc8axgupbfsbmgj01nzl02ly930n.png",
        "pet": "水蓝蓝",
        "type": "water",
        "stage": 1,
        "desc": "水系初始宠物 - 水蓝蓝(头像)"
    },
]

def download_image(item, dest_path):
    """下载单张图片，带重试机制"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(item["url"], headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://wiki.biligame.com/rocokingdom/'
            })
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=30) as resp:
                data = resp.read()
                with open(dest_path, 'wb') as f:
                    f.write(data)
                file_size = len(data)
                print(f"  [OK] {os.path.basename(dest_path)} ({file_size:,} bytes)")
                return {"status": "ok", "size": file_size, "path": dest_path}
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  [RETRY {attempt+1}] {os.path.basename(dest_path)}: {e}")
                time.sleep(1)
            else:
                print(f"  [FAIL] {os.path.basename(dest_path)}: {e}")
                return {"status": "fail", "error": str(e)}

def main():
    print("=" * 60)
    print("  洛克王国宠物精灵图批量下载")
    print("  来源: wiki.biligame.com/rocokingdom")
    print("=" * 60)
    print(f"\n保存目录: {SAVE_DIR}\n")

    results = []
    success_count = 0
    fail_count = 0

    for i, item in enumerate(PET_IMAGES):
        dest_path = os.path.join(SAVE_DIR, item["filename"])
        print(f"[{i+1}/{len(PET_IMAGES)}] {item['pet']} ({item['type']}系, 阶段{item['stage']})")

        # 如果已存在则跳过
        if os.path.exists(dest_path):
            existing_size = os.path.getsize(dest_path)
            print(f"  [SKIP] 已存在 ({existing_size:,} bytes)")
            results.append({"filename": item["filename"], "status": "skip", "size": existing_size, "pet": item["pet"], "type": item["type"], "stage": item["stage"]})
            success_count += 1
            continue

        result = download_image(item, dest_path)
        result.update({"filename": item["filename"], "pet": item["pet"], "type": item["type"], "stage": item["stage"]})
        results.append(result)

        if result["status"] == "ok":
            success_count += 1
        else:
            fail_count += 1

        # 礼貌间隔，避免被限流
        time.sleep(0.5)

    # 输出汇总
    print("\n" + "=" * 60)
    print(f"  下载完成！成功: {success_count}, 失败: {fail_count}")
    print("=" * 60)

    # 按进化链分组展示
    print("\n📂 文件列表（按进化链分组）:")
    print("-" * 60)
    print("  🔥 火系进化链 (4阶段):")
    for r in results:
        if r["type"] == "fire":
            status_icon = "✅" if r["status"] != "fail" else "❌"
            print(f"    {status_icon} {r['filename']}")

    print("\n  🌿 草系进化链 (3阶段):")
    for r in results:
        if r["type"] == "grass":
            status_icon = "✅" if r["status"] != "fail" else "❌"
            print(f"    {status_icon} {r['filename']}")

    print("\n  💧 水系 (仅头像):")
    for r in results:
        if r["type"] == "water":
            status_icon = "✅" if r["status"] != "fail" else "❌"
            print(f"    {status_icon} {r['filename']}")

    # 保存索引文件
    index_path = os.path.join(SAVE_DIR, "index.json")
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n📋 索引文件已保存: {index_path}")
    print("\n所有图片存放在: " + SAVE_DIR)

if __name__ == "__main__":
    main()
