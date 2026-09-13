# -*- coding: utf-8 -*-
"""
AI宠物乐园 · 接口回归测试
使用 Flask test_client + 沙箱目录（不影响真实班级数据）。
运行：python test_api.py   （用 .venv 的 3.9 运行：..\.venv\Scripts\python test_api.py）
"""
import os
import sys
import io
import json
import shutil
import tempfile
import datetime

TMP = tempfile.mkdtemp(prefix="pet_test_")
os.environ["PET_DATA_DIR"] = os.path.join(TMP, "data")
os.environ["PET_THEMES_DIR"] = os.path.join(TMP, "themes")
os.environ["NO_BROWSER"] = "1"

import server  # noqa: E402  导入即初始化沙箱目录与内置主题

app = server.app
c = app.test_client()
FAILS = []

def ck(name, cond, extra=""):
    print(("  ✅ " if cond else "  ❌ ") + name + (f"   [{extra}]" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)

print("\n=== 1. 初始化 ===")
st = c.get("/api/state").get_json()
ck("默认班级自动创建，含内置主题", st["ok"] and st["themeName"] and len(st["students"]) == 0)
th = c.get("/api/themes").get_json()
ck("内置主题 4 套", len(th["themes"]) == 4, str(len(th["themes"])))
ck("主题含宠物定义", all(t["petCount"] == 4 for t in th["themes"]))
ck("state 含 recentEvents 字段", "recentEvents" in st)
import os as _os
baks = _os.listdir(_os.path.join(_os.environ["PET_DATA_DIR"], "backups"))
ck("启动即生成每日自动备份", any(f.startswith("auto_") for f in baks), str(baks))

print("\n=== 2. 班级管理 ===")
r = c.post("/api/classes", json={"name": "测试二班", "students": ["小明", "小红", "小刚"],
                                 "theme": "太空冒险", "switch": True}).get_json()
ck("新建班级(带名单)并切换", r["ok"])
st = c.get("/api/state").get_json()
ck("多班数据独立：班名/主题/人数", st["className"] == "测试二班" and st["themeName"] == "太空冒险" and len(st["students"]) == 3)
cls = c.get("/api/classes").get_json()["classes"]
ck("班级列表含两个班", len(cls) == 2 and any(x["current"] for x in cls))
sid = st["students"][0]["id"]

print("\n=== 3. 主题工厂 ===")
r = c.post("/api/themes/save", json={"origName": "太空冒险", "name": "太空冒险Pro",
    "theme": dict(st["theme"], rules=dict(st["theme"]["rules"], critChance=0))}).get_json()
ck("保存主题并重命名(改规则 crit=0)", r["ok"] and r["name"] == "太空冒险Pro")
st = c.get("/api/state").get_json()
ck("当前班级主题引用同步更新", st["themeName"] == "太空冒险Pro")
th = c.get("/api/themes").get_json()
ck("旧主题文件夹已迁移", all(t["name"] != "太空冒险" for t in th["themes"]))

print("\n=== 4. 投喂结算（确定性：crit=0） ===")
def feed(food=0):
    return c.post("/api/feed", json={"studentIds": [sid], "food": food, "tag": "课堂发言"}).get_json()
for _ in range(3):
    feed(0)
st = c.get("/api/state").get_json()
s0 = st["students"][0]
ck("投喂3次=15经验(无暴击)", s0["totalExp"] == 15, str(s0["totalExp"]))
ck("等级推导 Lv2 (10/20)", s0["level"] == 2 and s0["expInLevel"] == 5 and s0["expNeed"] == 20,
   f"{s0['level']}/{s0['expInLevel']}/{s0['expNeed']}")
ck("仍为蛋形态(0)", s0["stage"] == 0)
tl = c.get("/api/timeline?sid=" + sid).get_json()["timeline"]
ck("时间线3条且带行为标签", len(tl) == 3 and all(t["tag"] == "课堂发言" for t in tl))

print("\n=== 5. 暴击 / 升级 / 进化事件 ===")
r = c.post("/api/themes/save", json={"name": "太空冒险Pro",
    "theme": dict(st["theme"], rules=dict(st["theme"]["rules"], critChance=1))}).get_json()
r = feed(0)["results"][0]
ck("暴击必触发且经验×2", r["crit"] and r["exp"] == 10, f"{r['crit']}/{r['exp']}")
r = feed(1)["results"][0]     # 10经验(crit=1→20)：25+20=45 → 破壳(≥30)且升级(≥30)
ck("跨过30经验→进化事件", r["evolve"] and r["stage"] == 1, f"{r['evolve']}/{r['stage']}")
ck("跨过30经验→升级事件", r["levelup"] and r["level"] == 3)
st = c.get("/api/state").get_json()
ck("总经验=45", st["students"][0]["totalExp"] == 45, str(st["students"][0]["totalExp"]))

print("\n=== 6. 撤销 ===")
r = c.post("/api/undo").get_json()
st = c.get("/api/state").get_json()
ck("撤销后经验回退(45-20=25)", st["students"][0]["totalExp"] == 25, str(st["students"][0]["totalExp"]))
tl = c.get("/api/timeline?sid=" + sid).get_json()["timeline"]
ck("时间线同步回退", all(t.get("exp") != 20 or not t.get("crit") for t in tl))

print("\n=== 7. 学生管理 ===")
r = c.post("/api/students", json={"action": "update", "id": sid,
                                  "nickname": "闪电手", "totalExp": 30}).get_json()
ck("改昵称+调经验", r["ok"])
st = c.get("/api/state").get_json()
s0 = st["students"][0]
ck("昵称生效", s0["nickname"] == "闪电手")
ck("调经验后等级=3、形态=幼年", s0["level"] == 3 and s0["stage"] == 1, f"{s0['level']}/{s0['stage']}")
r = c.post("/api/students", json={"action": "add", "names": ["小新"]}).get_json()
st = c.get("/api/state").get_json()
ck("追加学生", len(st["students"]) == 4)

print("\n=== 8. 统计 / 表扬名单 ===")
stats = c.get("/api/stats").get_json()
ck("按行为标签统计", stats["byTag"].get("课堂发言", 0) >= 3)
pw = c.get("/api/praise_week").get_json()
ck("表扬名单含学生名", "小明" in pw["text"] and "本周表扬名单" in pw["text"])

print("\n=== 9. 素材上传 ===")
from PIL import Image
buf = io.BytesIO()
Image.new("RGB", (200, 120), (80, 160, 240)).save(buf, "PNG")
buf.seek(0)
r = c.post("/api/themes/upload_asset", data={
    "theme": "海洋乐园", "kind": "pet", "petId": "duck", "stage": "1",
    "file": (buf, "baby.png")}, content_type="multipart/form-data").get_json()
ck("上传宠物形态图", r["ok"])
tp = server.load_theme("海洋乐园")
ck("theme.json 记录素材路径", tp["pets"][0]["stages"][1] != "")
buf2 = io.BytesIO()
Image.new("RGB", (400, 250), (255, 240, 200)).save(buf2, "PNG")
buf2.seek(0)
r = c.post("/api/themes/upload_asset", data={
    "theme": "海洋乐园", "kind": "bg", "file": (buf2, "bg.png")}, content_type="multipart/form-data").get_json()
ck("上传背景图", r["ok"] and server.load_theme("海洋乐园").get("bgImage"))

print("\n=== 10. 主题应用 / 删除保护 ===")
r = c.post("/api/themes/apply", json={"name": "海洋乐园"}).get_json()
st = c.get("/api/state").get_json()
ck("应用主题→当前班级热切换", st["themeName"] == "海洋乐园")
r = c.post("/api/themes/delete", json={"name": "海洋乐园"}).get_json()
ck("使用中的主题禁止删除", not r["ok"])
r = c.post("/api/themes/save", json={"origName": "太空冒险Pro", "name": "太空冒险2.0",
    "theme": dict(st["theme"], name = "太空冒险2.0")}).get_json()
th = c.get("/api/themes").get_json()
ck("重命名后可删除旧名（改名迁移）", any(t["name"] == "太空冒险2.0" for t in th["themes"]))

print("\n=== 11. PIN 门禁 ===")
r = c.post("/api/pin/set", json={"pin": "123"}).get_json()
ck("设置 PIN（未设时免验证）", r["ok"])
resp = c.post("/api/classes/switch", json={"id": cls[0]["id"]})
ck("无 PIN 切班被拒(403)", resp.status_code == 403)
r = c.post("/api/classes/switch", json={"id": cls[0]["id"]},
           headers={"X-Pin": "123"}).get_json()
ck("带正确 PIN 可切班", r["ok"])

print("\n=== 12. 备份导出/导入 ===")
ex = c.get("/api/backup/export")
ck("导出备份为zip", ex.status_code == 200 and ex.data[:2] == b"PK")
r = c.post("/api/backup/import", data={"file": (io.BytesIO(ex.data), "b.zip")},
           content_type="multipart/form-data", headers={"X-Pin": "123"}).get_json()
ck("导入备份恢复", r["ok"])

print("\n=== 13. 页面可访问 ===")
for p in ("/show", "/admin", "/pets.js"):
    r = c.get(p)
    ck(f"{p} 200", r.status_code == 200)

print("\n" + "=" * 46)
if FAILS:
    print(f"❌ {len(FAILS)} 项未通过：{'、'.join(FAILS)}")
    sys.exit(1)
n = len([1])
print("✅ 全部回归测试通过")
shutil.rmtree(TMP, ignore_errors=True)
