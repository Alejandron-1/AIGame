# -*- coding: utf-8 -*-
"""
AI宠物乐园 · 本地服务端（V2.1）
================================
三端架构中的服务端：展示前端(/show)与管理后台(/admin)的唯一数据入口。
- 多班级：data/classes/<班级id>/ 各自独立名单与数据
- 主题包：themes/<主题名>/（theme.json + 素材），一键应用、热切换
- 投喂结算：经验/暴击/升级/进化判定全部在服务端串行完成，保证多端一致
- 可靠性：操作日志支撑撤销；每日自动备份保留7份；JSON 原子写入

启动：python server.py [--open]   （--open 自动打开展示页与管理页）
测试：python test_api.py          （接口回归测试，使用临时沙箱目录）
"""
import os
import sys
import json
import io
import time
import random
import zipfile
import threading
import datetime
import webbrowser
from functools import wraps

from flask import Flask, request, jsonify, send_file, send_from_directory, redirect

# ================= 路径与常量 =================
BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("PET_DATA_DIR") or os.path.join(BASE, "data")
THEMES_DIR = os.environ.get("PET_THEMES_DIR") or os.path.join(BASE, "themes")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
PAGE_DIR = BASE

MAX_UPLOAD_IMG = 8 * 1024 * 1024      # 图片上传上限 8MB（超过自动压缩）
MAX_UPLOAD_BGM = 20 * 1024 * 1024     # 音乐上限 20MB
BACKUP_KEEP = 7                       # 自动备份保留份数

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024
_LOCK = threading.RLock()             # 全局写锁：多端并发投喂串行结算


# ================= 小工具 =================
def now_ts():
    return datetime.datetime.now().isoformat(timespec="seconds")


def today():
    return datetime.date.today().isoformat()


def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path, obj):
    """原子写入：先写临时文件再替换，防止写一半断电损坏"""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def class_dir(cid):
    return os.path.join(DATA_DIR, "classes", cid)


def load_class(cid):
    d = class_dir(cid)
    cfg = read_json(os.path.join(d, "config.json"), {})
    students = read_json(os.path.join(d, "students.json"), [])
    oplog = read_json(os.path.join(d, "oplog.json"), [])
    timeline = read_json(os.path.join(d, "timeline.json"), [])
    return cfg, students, oplog, timeline


def save_class(cid, cfg=None, students=None, oplog=None, timeline=None):
    d = class_dir(cid)
    os.makedirs(d, exist_ok=True)
    if cfg is not None:
        write_json(os.path.join(d, "config.json"), cfg)
    if students is not None:
        write_json(os.path.join(d, "students.json"), students)
    if oplog is not None:
        write_json(os.path.join(d, "oplog.json"), oplog[-200:])
    if timeline is not None:
        write_json(os.path.join(d, "timeline.json"), timeline[-600:])
    bump_version("dataVersion")


def current_class_id():
    return read_json(os.path.join(DATA_DIR, "current_class.json"), {}).get("cid", "")


def set_current_class(cid):
    write_json(os.path.join(DATA_DIR, "current_class.json"), {"cid": cid})
    bump_version("dataVersion")


def bump_version(kind):
    v = read_json(os.path.join(DATA_DIR, "version.json"), {"dataVersion": 1, "themeVersion": 1})
    v[kind] = v.get(kind, 1) + 1
    write_json(os.path.join(DATA_DIR, "version.json"), v)


def versions():
    v = read_json(os.path.join(DATA_DIR, "version.json"), {})
    return {"dataVersion": v.get("dataVersion", 1), "themeVersion": v.get("themeVersion", 1)}


def require_pin(fn):
    """管理类危险操作的门禁：设置了管理 PIN 后必须携带正确 X-Pin 头"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        pin = read_json(os.path.join(DATA_DIR, "config.json"), {}).get("adminPin", "")
        if pin:
            import hashlib
            got = request.headers.get("X-Pin", "")
            if hashlib.sha256(got.encode()).hexdigest() != pin:
                return jsonify({"ok": False, "error": "PIN 错误"}), 403
        return fn(*args, **kwargs)
    return wrapper


# ================= 数值规则（与 theme.rules 对应，缺省兜底） =================
def rules_of(theme):
    r = (theme or {}).get("rules") or {}
    return {
        "stageExp": r.get("stageExp", [30, 100, 250]),
        "levelExpBase": r.get("levelExpBase", 10),
        "maxLevel": r.get("maxLevel", 20),
        "critChance": r.get("critChance", 0.1),
    }


def level_of(exp, rules):
    base, mx = rules["levelExpBase"], rules["maxLevel"]
    lv, used = 1, 0
    while lv < mx and used + base * lv <= exp:
        used += base * lv
        lv += 1
    return lv, used            # used = 到达当前等级已消耗的累计经验


def stage_of(exp, rules):
    st = 0
    for i, t in enumerate(rules["stageExp"]):
        if exp >= t:
            st = i + 1
    return st                  # 0蛋 1幼年 2成熟 3进化


def decorate(student, theme):
    """给原始学生数据补充派生字段（等级/形态/进度/心情衰减）供前端直接渲染"""
    rules = rules_of(theme)
    exp = student.get("totalExp", 0)
    lv, used = level_of(exp, rules)
    need = rules["levelExpBase"] * lv if lv < rules["maxLevel"] else 0
    stage = stage_of(exp, rules)
    # 心情按天衰减（只在展示层计算，不落盘）：每天 -20，最低 0
    try:
        days = max(0, (datetime.date.today() - datetime.date.fromisoformat(student.get("lastActive", today()))).days)
    except ValueError:
        days = 0
    eff_mood = max(0, min(100, student.get("mood", 70)) - 20 * days)
    return dict(student, level=lv, stage=stage,
                expInLevel=exp - used, expNeed=need,
                progress=(exp - used) / need if need else 1.0,
                effMood=eff_mood)


# ================= 主题 =================
def theme_path(name):
    return os.path.join(THEMES_DIR, name)


def load_theme(name):
    return read_json(os.path.join(theme_path(name), "theme.json"), None)


def save_theme_file(name, theme):
    os.makedirs(theme_path(name), exist_ok=True)
    write_json(os.path.join(theme_path(name), "theme.json"), theme)


def list_themes():
    if not os.path.isdir(THEMES_DIR):
        return []
    out = []
    for d in sorted(os.listdir(THEMES_DIR)):
        t = load_theme(d)
        if t:
            out.append({"name": d, "petCount": len(t.get("pets", [])), "theme": t})
    return out


BUILTIN_THEMES = [
    {
        "name": "海洋乐园",
        "palette": {"bgTop": "#a8edea", "bgBottom": "#fed6e3", "card": "#ffffff", "accent": "#e84393"},
        "bgm": {"track": "", "volume": 0.3, "evolveSting": True},
        "animations": {"feed": "arc", "upgrade": "jumpGold", "evolve": "whiteFlash", "speed": 1.0},
        "foods": [
            {"icon": "🦐", "name": "小虾米", "exp": 5, "label": "课堂发言"},
            {"icon": "🐟", "name": "大鱼", "exp": 10, "label": "作业满分"},
            {"icon": "🦀", "name": "大螃蟹", "exp": 20, "label": "乐于助人"},
        ],
        "corpus": ["小鸭子为你骄傲！", "今天也要加油鸭！", "咕噜咕噜，吃饱啦！", "海底小知识：鱼睡觉不闭眼哦！"],
        "pets": [
            {"id": "duck", "name": "小鸭", "stages": ["", "", "", ""], "title": "海洋小卫士"},
            {"id": "fish", "name": "小鱼", "stages": ["", "", "", ""], "title": "泡泡骑士"},
            {"id": "octopus", "name": "章鱼", "stages": ["", "", "", ""], "title": "智慧博士"},
            {"id": "star", "name": "海星", "stages": ["", "", "", ""], "title": "闪亮之星"},
        ],
        "rules": {"stageExp": [30, 100, 250], "levelExpBase": 10, "maxLevel": 20, "critChance": 0.1},
    },
    {
        "name": "太空冒险",
        "palette": {"bgTop": "#0b1026", "bgBottom": "#2b3a67", "card": "#1c2340", "accent": "#4a9eff"},
        "bgm": {"track": "", "volume": 0.25, "evolveSting": True},
        "animations": {"feed": "drop", "upgrade": "starRing", "evolve": "stardust", "speed": 1.0},
        "foods": [
            {"icon": "⭐", "name": "星星饼", "exp": 5, "label": "课堂发言"},
            {"icon": "🔋", "name": "能量块", "exp": 10, "label": "作业满分"},
            {"icon": "🛸", "name": "太空餐", "exp": 20, "label": "乐于助人"},
        ],
        "corpus": ["3，2，1，发射！", "太空小知识：在太空里会长高哦！", "航线正确，继续保持！"],
        "pets": [
            {"id": "spacedog", "name": "太空犬", "stages": ["", "", "", ""], "title": "星际船长"},
            {"id": "rocketcat", "name": "火箭猫", "stages": ["", "", "", ""], "title": "引擎大师"},
            {"id": "uforabbit", "name": "UFO兔", "stages": ["", "", "", ""], "title": "飞行队长"},
            {"id": "stardragon", "name": "星龙", "stages": ["", "", "", ""], "title": "银河传奇"},
        ],
        "rules": {"stageExp": [30, 100, 250], "levelExpBase": 10, "maxLevel": 20, "critChance": 0.1},
    },
    {
        "name": "森林派对",
        "palette": {"bgTop": "#d9f2d9", "bgBottom": "#a1c4fd", "card": "#ffffff", "accent": "#2e9e5b"},
        "bgm": {"track": "", "volume": 0.3, "evolveSting": True},
        "animations": {"feed": "drop", "upgrade": "jumpGold", "evolve": "leafFall", "speed": 1.0},
        "foods": [
            {"icon": "🍓", "name": "浆果", "exp": 5, "label": "课堂发言"},
            {"icon": "🌰", "name": "松果", "exp": 10, "label": "作业满分"},
            {"icon": "🍯", "name": "蜂蜜", "exp": 20, "label": "乐于助人"},
        ],
        "corpus": ["森林小知识：大树是用叶子呼吸的！", "叽叽喳喳，真棒呀！", "森林伙伴为你鼓掌！"],
        "pets": [
            {"id": "bear", "name": "小熊", "stages": ["", "", "", ""], "title": "森林勇士"},
            {"id": "fox", "name": "狐狸", "stages": ["", "", "", ""], "title": "机智之星"},
            {"id": "mushroom", "name": "蘑菇精", "stages": ["", "", "", ""], "title": "雨后精灵"},
            {"id": "woodpecker", "name": "啄木鸟", "stages": ["", "", "", ""], "title": "森林医生"},
        ],
        "rules": {"stageExp": [30, 100, 250], "levelExpBase": 10, "maxLevel": 20, "critChance": 0.1},
    },
    {
        "name": "糖果王国",
        "palette": {"bgTop": "#fbc2eb", "bgBottom": "#a6c1ee", "card": "#ffffff", "accent": "#e84393"},
        "bgm": {"track": "", "volume": 0.3, "evolveSting": True},
        "animations": {"feed": "arc", "upgrade": "starRing", "evolve": "rainbow", "speed": 1.0},
        "foods": [
            {"icon": "🍭", "name": "棒棒糖", "exp": 5, "label": "课堂发言"},
            {"icon": "🍬", "name": "软糖", "exp": 10, "label": "作业满分"},
            {"icon": "🍰", "name": "小蛋糕", "exp": 20, "label": "乐于助人"},
        ],
        "corpus": ["甜甜的表扬给你！", "糖果小知识：彩虹是天空的糖纸！", "又甜又棒！"],
        "pets": [
            {"id": "candy", "name": "糖果兽", "stages": ["", "", "", ""], "title": "甜蜜骑士"},
            {"id": "lollipop", "name": "棒棒糖精灵", "stages": ["", "", "", ""], "title": "旋风舞者"},
            {"id": "marsh", "name": "棉花糖云", "stages": ["", "", "", ""], "title": "云朵诗人"},
            {"id": "pudding", "name": "布丁", "stages": ["", "", "", ""], "title": "Q弹冠军"},
        ],
        "rules": {"stageExp": [30, 100, 250], "levelExpBase": 10, "maxLevel": 20, "critChance": 0.1},
    },
]


def init_folders():
    """首次启动：建目录、写内置主题、建默认班级、每日自动备份"""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(THEMES_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    for t in BUILTIN_THEMES:
        name = t["name"]
        if not os.path.isdir(theme_path(name)):
            save_theme_file(name, t)
    cfg = read_json(os.path.join(DATA_DIR, "config.json"), {"adminPin": ""})
    write_json(os.path.join(DATA_DIR, "config.json"), cfg)
    if not current_class_id():
        cid = "class_" + datetime.datetime.now().strftime("%m%d") + "_1"
        os.makedirs(class_dir(cid), exist_ok=True)
        save_class(cid, cfg={"name": "一年(1)班", "theme": "海洋乐园", "sort": "level", "feedLocked": False})
        set_current_class(cid)
    daily_backup()


def daily_backup():
    """每日首次启动自动备份 data/，保留最近 7 份"""
    today_zip = os.path.join(BACKUP_DIR, f"auto_{today()}.zip")
    if os.path.exists(today_zip):
        return
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(DATA_DIR):
            for fn in files:
                if fn.endswith(".tmp"):
                    continue
                full = os.path.join(root, fn)
                z.write(full, os.path.relpath(full, DATA_DIR))
    with open(today_zip, "wb") as f:
        f.write(buf.getvalue())
    zips = sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith("auto_"))
    for old in zips[:-BACKUP_KEEP]:
        os.remove(os.path.join(BACKUP_DIR, old))


# ================= 页面路由 =================
@app.route("/")
def r_home():
    return redirect("/show")


@app.route("/show")
def r_show():
    return send_from_directory(PAGE_DIR, "show.html")


@app.route("/admin")
def r_admin():
    return send_from_directory(PAGE_DIR, "admin.html")


@app.route("/pets.js")
def r_petsjs():
    return send_from_directory(PAGE_DIR, "pets.js")


@app.route("/themes/<name>/<path:fn>")
def r_theme_asset(name, fn):
    safe = os.path.normpath(os.path.join(theme_path(name), fn))
    if not safe.startswith(os.path.abspath(THEMES_DIR)):
        return jsonify({"ok": False, "error": "非法路径"}), 400
    if not os.path.isfile(safe):
        return jsonify({"ok": False, "error": "文件不存在"}), 404
    return send_file(safe)


# ================= 状态 API =================
@app.route("/api/state")
def api_state():
    with _LOCK:
        cid = current_class_id()
        if not cid:
            return jsonify({"ok": False, "error": "没有班级，请先在管理后台创建"}), 400
        cfg, students, _, _ = load_class(cid)
        theme_name = cfg.get("theme", "")
        theme = load_theme(theme_name) or {}
        pin_set = bool(read_json(os.path.join(DATA_DIR, "config.json"), {}).get("adminPin", ""))
        _, _, _, timeline = load_class(cid)
        cutoff = (datetime.datetime.now() - datetime.timedelta(seconds=6)).isoformat(timespec="seconds")
        recent = [t for t in timeline if t.get("ts", "") >= cutoff and t.get("type", "feed") == "feed"]
        return jsonify({
            "ok": True,
            "classId": cid,
            "className": cfg.get("name", ""),
            "themeName": theme_name,
            "theme": theme,
            "students": [decorate(s, theme) for s in students],
            "recentEvents": recent,
            "config": {"sort": cfg.get("sort", "level"), "feedLocked": cfg.get("feedLocked", False)},
            "pinSet": pin_set,
            **versions(),
        })


@app.route("/api/classes", methods=["GET"])
def api_classes():
    base = os.path.join(DATA_DIR, "classes")
    out = []
    if os.path.isdir(base):
        for cid in sorted(os.listdir(base)):
            cfg, students, _, _ = load_class(cid)
            if cfg:
                out.append({"id": cid, "name": cfg.get("name", cid),
                            "students": len(students), "theme": cfg.get("theme", ""),
                            "current": cid == current_class_id()})
    return jsonify({"ok": True, "classes": out})


@app.route("/api/classes", methods=["POST"])
def api_classes_create():
    with _LOCK:
        body = request.get_json(force=True)
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"ok": False, "error": "班级名不能为空"}), 400
        cid = "class_" + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        os.makedirs(class_dir(cid), exist_ok=True)
        names = [n.strip() for n in (body.get("students") or []) if n.strip()]
        theme = body.get("theme") or "海洋乐园"
        students = [make_student(n, i) for i, n in enumerate(names)]
        save_class(cid, cfg={"name": name, "theme": theme, "sort": "level", "feedLocked": False},
                   students=students, oplog=[], timeline=[])
        if body.get("switch", True):
            set_current_class(cid)
        return jsonify({"ok": True, "id": cid})


def make_student(name, i):
    pet_ids = list(SPECIES_KEY_POOL)
    return {"id": f"s{int(time.time()*1000)}{i}{random.randint(100,999)}",
            "name": name, "petId": pet_ids[i % len(pet_ids)], "nickname": "",
            "group": "", "totalExp": 0, "mood": 70, "createdAt": now_ts(), "lastActive": today()}


import itertools
SPECIES_KEY_POOL = list(itertools.chain(
    ["duck", "fish", "octopus", "star"],
    ["spacedog", "rocketcat", "uforabbit", "stardragon"],
    ["bear", "fox", "mushroom", "woodpecker"],
    ["candy", "lollipop", "marsh", "pudding"],
))


@app.route("/api/classes/switch", methods=["POST"])
@require_pin
def api_classes_switch():
    with _LOCK:
        cid = request.get_json(force=True).get("id", "")
        if not os.path.isdir(class_dir(cid)):
            return jsonify({"ok": False, "error": "班级不存在"}), 404
        set_current_class(cid)
        return jsonify({"ok": True})


@app.route("/api/classes/delete", methods=["POST"])
@require_pin
def api_classes_delete():
    with _LOCK:
        import shutil
        cid = request.get_json(force=True).get("id", "")
        if cid == current_class_id():
            return jsonify({"ok": False, "error": "不能删除当前展示中的班级，请先切换"}), 400
        if os.path.isdir(class_dir(cid)):
            shutil.rmtree(class_dir(cid))
        return jsonify({"ok": True})


@app.route("/api/students", methods=["POST"])
def api_students():
    """统一入口：action = add / update / delete / adjust"""
    with _LOCK:
        cid = current_class_id()
        body = request.get_json(force=True)
        act = body.get("action")
        cfg, students, oplog, timeline = load_class(cid)
        if act == "add":
            names = body.get("names") or ([body.get("name")] if body.get("name") else [])
            start = len(students)
            for k, n in enumerate(n for n in names if n.strip()):
                students.append(make_student(n.strip(), start + k))
        elif act == "update":
            for s in students:
                if s["id"] == body.get("id"):
                    for k in ("name", "nickname", "petId", "group"):
                        if k in body:
                            s[k] = body[k]
                    if "totalExp" in body:   # 老师手动调整经验
                        s["totalExp"] = max(0, int(body["totalExp"]))
                        oplog.append({"ts": now_ts(), "type": "adjust", "sid": s["id"], "exp": s["totalExp"]})
                    break
        elif act == "delete":
            sid = body.get("id")
            archive = read_json(os.path.join(class_dir(cid), "archived.json"), [])
            for s in students:
                if s["id"] == sid:
                    archive.append(s)
            write_json(os.path.join(class_dir(cid), "archived.json"), archive)
            students = [s for s in students if s["id"] != sid]
        else:
            return jsonify({"ok": False, "error": "未知操作"}), 400
        save_class(cid, students=students, oplog=oplog, timeline=timeline)
        return jsonify({"ok": True})


# ================= 投喂 / 撤销 =================
@app.route("/api/feed", methods=["POST"])
def api_feed():
    with _LOCK:
        cid = current_class_id()
        cfg, students, oplog, timeline = load_class(cid)
        if cfg.get("feedLocked"):
            return jsonify({"ok": False, "error": "投喂已锁定"}), 403
        theme = load_theme(cfg.get("theme", "")) or {}
        rules = rules_of(theme)
        body = request.get_json(force=True)
        food_idx = int(body.get("food", 0))
        count = max(1, min(10, int(body.get("count", 1))))
        foods = theme.get("foods", [])
        if not foods:
            return jsonify({"ok": False, "error": "当前主题没有配置食物"}), 400
        food = foods[food_idx % len(foods)]
        results = []
        for _ in range(count):
            for sid in body.get("studentIds", [body.get("studentId")]):
                s = next((x for x in students if x["id"] == sid), None)
                if not s:
                    continue
                before_stage = stage_of(s["totalExp"], rules)
                before_lv, _ = level_of(s["totalExp"], rules)
                exp = food["exp"]
                crit = random.random() < rules["critChance"]
                if crit:
                    exp *= 2
                s["totalExp"] += exp
                s["mood"] = min(100, s.get("mood", 70) + 10)
                s["lastActive"] = today()
                after_stage = stage_of(s["totalExp"], rules)
                after_lv, _ = level_of(s["totalExp"], rules)
                entry = {"ts": now_ts(), "sid": s["id"], "name": s["name"], "tag": body.get("tag") or food.get("label", "课堂表现"),
                         "food": food["name"], "exp": exp, "crit": crit,
                         "levelup": after_lv > before_lv, "evolve": after_stage > before_stage,
                         "stage": after_stage, "level": after_lv}
                timeline.append(entry)
                oplog.append({"ts": now_ts(), "type": "feed", "sid": s["id"], "exp": exp})
                results.append(entry)
        save_class(cid, students=students, oplog=oplog, timeline=timeline)
        return jsonify({"ok": True, "results": results})


@app.route("/api/undo", methods=["POST"])
def api_undo():
    with _LOCK:
        cid = current_class_id()
        cfg, students, oplog, timeline = load_class(cid)
        if not oplog:
            return jsonify({"ok": False, "error": "没有可撤销的操作"}), 400
        op = oplog.pop()
        if op["type"] == "feed":
            s = next((x for x in students if x["id"] == op["sid"]), None)
            if s:
                s["totalExp"] = max(0, s["totalExp"] - op["exp"])
                s["mood"] = max(0, s.get("mood", 70) - 10)
            # 移除最近一条该学生的投喂记录
            for i in range(len(timeline) - 1, -1, -1):
                if timeline[i].get("sid") == op["sid"] and timeline[i].get("type", "feed") == "feed":
                    timeline.pop(i)
                    break
        elif op["type"] == "adjust":
            s = next((x for x in students if x["id"] == op["sid"]), None)
            if s:
                s["totalExp"] = max(0, op["exp"])   # adjust 记录的是调整后的值，撤销=还原为记录值前的状态由日志前推，简化为提示
        save_class(cid, students=students, oplog=oplog, timeline=timeline)
        return jsonify({"ok": True})


# ================= 主题 API =================
@app.route("/api/themes")
def api_themes():
    with _LOCK:
        cid = current_class_id()
        cfg, _, _, _ = load_class(cid)
        return jsonify({"ok": True, "themes": list_themes(), "current": cfg.get("theme", "")})


@app.route("/api/themes/apply", methods=["POST"])
def api_themes_apply():
    with _LOCK:
        name = request.get_json(force=True).get("name", "")
        theme = load_theme(name)
        if not theme or not os.path.isdir(theme_path(name)):
            return jsonify({"ok": False, "error": "主题不存在"}), 404
        cid = current_class_id()
        cfg, students, oplog, timeline = load_class(cid)
        cfg["theme"] = name
        # 跨主题切换：学生宠物跟随新主题"转生"（进度保留），避免出现主题里不存在的宠物
        theme_pets = theme.get("pets", [])
        theme_ids = [p.get("id") for p in theme_pets]
        if theme_ids:
            for i, s in enumerate(students):
                if s.get("petId") not in theme_ids:
                    new_pet = theme_pets[i % len(theme_pets)]
                    s["petId"] = new_pet["id"]
                    timeline.append({"ts": now_ts(), "sid": s["id"], "name": s["name"],
                                     "tag": "主题切换", "food": "转生", "exp": 0, "crit": False,
                                     "note": f"跟随「{name}」主题变成了{new_pet['name']}"})
        save_class(cid, cfg=cfg, students=students, oplog=oplog, timeline=timeline)
        bump_version("themeVersion")
        return jsonify({"ok": True})


@app.route("/api/themes/save", methods=["POST"])
def api_themes_save():
    with _LOCK:
        body = request.get_json(force=True)
        theme = body.get("theme") or {}
        name = (body.get("name") or theme.get("name") or "").strip()
        if not name or "/" in name or "\\" in name or name in (".", ".."):
            return jsonify({"ok": False, "error": "主题名不合法"}), 400
        orig = (body.get("origName") or "").strip()
        if orig and orig != name and os.path.isdir(theme_path(orig)):
            # 重命名：迁移旧文件夹（保留素材）
            os.rename(theme_path(orig), theme_path(name))
        save_theme_file(name, theme)
        bump_version("themeVersion")
        # 若当前班级正使用旧名，同步更新引用
        cid = current_class_id()
        cfg, students, oplog, timeline = load_class(cid)
        if orig and cfg.get("theme") == orig:
            cfg["theme"] = name
            save_class(cid, cfg=cfg, students=students, oplog=oplog, timeline=timeline)
        return jsonify({"ok": True, "name": name})


@app.route("/api/themes/delete", methods=["POST"])
@require_pin
def api_themes_delete():
    with _LOCK:
        import shutil
        name = request.get_json(force=True).get("name", "")
        base = os.path.join(DATA_DIR, "classes")
        for cid in os.listdir(base) if os.path.isdir(base) else []:
            cfg, *_ = load_class(cid)
            if cfg.get("theme") == name:
                return jsonify({"ok": False, "error": f"主题正在被「{cfg.get('name')}」使用，先切换别的主题"}), 400
        if os.path.isdir(theme_path(name)):
            shutil.rmtree(theme_path(name))
        bump_version("themeVersion")
        return jsonify({"ok": True})


@app.route("/api/themes/upload_asset", methods=["POST"])
def api_themes_upload():
    """上传主题素材：kind = bg 背景 / bgm 音乐 / pet 宠物形态图"""
    with _LOCK:
        name = request.form.get("theme", "")
        kind = request.form.get("kind", "")
        pet_id = request.form.get("petId", "")
        try:
            stage = int(request.form.get("stage", "0"))
        except ValueError:
            stage = 0
        f = request.files.get("file")
        if not f or not os.path.isdir(theme_path(name)):
            return jsonify({"ok": False, "error": "参数错误"}), 400
        theme = load_theme(name) or {}
        ext = os.path.splitext(f.filename)[1].lower() or ".png"
        os.makedirs(theme_path(name), exist_ok=True)

        if kind == "bg":
            data = f.read()
            if len(data) > MAX_UPLOAD_IMG:
                data = compress_image(data)
            path = os.path.join(theme_path(name), "bg" + ext)
            with open(path, "wb") as fp:
                fp.write(data)
            theme["bgImage"] = os.path.basename(path)
        elif kind == "bgm":
            data = f.read()
            if len(data) > MAX_UPLOAD_BGM:
                return jsonify({"ok": False, "error": "音乐超过 20MB"}), 400
            path = os.path.join(theme_path(name), "bgm" + ext)
            with open(path, "wb") as fp:
                fp.write(data)
            theme["bgm"] = theme.get("bgm") or {}
            theme["bgm"]["track"] = os.path.basename(path)
        elif kind == "pet":
            data = f.read()
            if len(data) > MAX_UPLOAD_IMG:
                data = compress_image(data)
            d = os.path.join(theme_path(name), "pets", pet_id)
            os.makedirs(d, exist_ok=True)
            path = os.path.join(d, f"stage{stage}{ext}")
            with open(path, "wb") as fp:
                fp.write(data)
            rel = os.path.relpath(path, theme_path(name)).replace("\\", "/")
            for p in theme.get("pets", []):
                if p.get("id") == pet_id:
                    p.setdefault("stages", ["", "", "", ""])
                    p["stages"][stage] = rel
        else:
            return jsonify({"ok": False, "error": "未知素材类型"}), 400
        save_theme_file(name, theme)
        bump_version("themeVersion")
        return jsonify({"ok": True})


def compress_image(data):
    """超大图自动压缩到最大 1600px 宽（沿用飞行棋方案）"""
    try:
        import numpy as _np
        arr = _np.frombuffer(data, dtype=np.uint8)
        import cv2
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return data
        h, w = img.shape[:2]
        if w > 1600:
            img = cv2.resize(img, (1600, int(h * 1600 / w)), interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return buf.tobytes() if ok else data
    except Exception:
        return data


# ================= 成长数据 / 统计 / 表扬 =================
@app.route("/api/timeline")
def api_timeline():
    cid = current_class_id()
    _, _, _, timeline = load_class(cid)
    sid = request.args.get("sid")
    items = [t for t in timeline if (not sid or t.get("sid") == sid)]
    return jsonify({"ok": True, "timeline": list(reversed(items[-100:]))})


@app.route("/api/stats")
def api_stats():
    cid = current_class_id()
    _, students, _, timeline = load_class(cid)
    by_tag = {}
    for t in timeline:
        if t.get("type", "feed") != "feed":
            continue
        by_tag[t.get("tag", "课堂表现")] = by_tag.get(t.get("tag", "课堂表现"), 0) + 1
    week = [t for t in timeline if t.get("ts", "") >= (datetime.date.today() - datetime.timedelta(days=7)).isoformat()]
    delta = {}
    for t in week:
        if t.get("type", "feed") != "feed":
            continue
        delta[t["sid"]] = delta.get(t["sid"], 0) + t.get("exp", 0)
    names = {s["id"]: s["name"] for s in students}
    progress = sorted(delta.items(), key=lambda kv: -kv[1])[:5]
    return jsonify({"ok": True, "byTag": by_tag,
                    "weekTop": [{"sid": k, "name": names.get(k, "?"), "exp": v} for k, v in progress]})


@app.route("/api/praise_week")
def api_praise_week():
    cid = current_class_id()
    cfg, students, _, timeline = load_class(cid)
    week = [t for t in timeline if t.get("ts", "") >= (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
            and t.get("type", "feed") == "feed"]
    cnt, exp = {}, {}
    for t in week:
        cnt[t["name"]] = cnt.get(t["name"], 0) + 1
        exp[t["name"]] = exp.get(t["name"], 0) + t.get("exp", 0)
    top_feed = sorted(cnt.items(), key=lambda kv: -kv[1])[:3]
    top_prog = sorted(exp.items(), key=lambda kv: -kv[1])[:3]
    lines = [f"🎉 {cfg.get('name','')} 本周表扬名单 🎉"]
    if top_feed:
        lines.append("【表现最积极】" + "、".join(f"{n}({c}次)" for n, c in top_feed))
    if top_prog:
        lines.append("【进步最大】" + "、".join(f"{n}(+{e}经验)" for n, e in top_prog))
    return jsonify({"ok": True, "text": "\n".join(lines)})


# ================= 备份 / PIN =================
@app.route("/api/backup/export")
def api_backup_export():
    with _LOCK:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(DATA_DIR):
                for fn in files:
                    if fn.endswith(".tmp"):
                        continue
                    full = os.path.join(root, fn)
                    z.write(full, os.path.relpath(full, DATA_DIR))
            for root, _, files in os.walk(THEMES_DIR):
                for fn in files:
                    full = os.path.join(root, fn)
                    z.write(full, os.path.relpath(full, THEMES_DIR))
        buf.seek(0)
        return send_file(buf, as_attachment=True,
                         download_name=f"宠物乐园备份_{today()}.zip",
                         mimetype="application/zip")


@app.route("/api/backup/import", methods=["POST"])
@require_pin
def api_backup_import():
    with _LOCK:
        f = request.files.get("file")
        if not f:
            return jsonify({"ok": False, "error": "没有文件"}), 400
        import tempfile
        tmpd = tempfile.mkdtemp()
        zpath = os.path.join(tmpd, "in.zip")
        f.save(zpath)
        try:
            with zipfile.ZipFile(zpath) as z:
                names = z.namelist()
                if "classes" not in " ".join(names):
                    return jsonify({"ok": False, "error": "不是有效的备份文件"}), 400
                z.extractall(tmpd)
                src_data = os.path.join(tmpd, "data")
                src_themes = os.path.join(tmpd, "themes")
                import shutil
                if os.path.isdir(src_data):
                    shutil.rmtree(DATA_DIR); shutil.copytree(src_data, DATA_DIR)
                if os.path.isdir(src_themes):
                    shutil.rmtree(THEMES_DIR); shutil.copytree(src_themes, THEMES_DIR)
                init_folders()
                return jsonify({"ok": True})
        except zipfile.BadZipFile:
            return jsonify({"ok": False, "error": "压缩包损坏"}), 400


@app.route("/api/pin/set", methods=["POST"])
@require_pin
def api_pin_set():
    import hashlib
    with _LOCK:
        pin = str(request.get_json(force=True).get("pin", "")).strip()
        cfg = read_json(os.path.join(DATA_DIR, "config.json"), {"adminPin": ""})
        cfg["adminPin"] = hashlib.sha256(pin.encode()).hexdigest() if pin else ""
        write_json(os.path.join(DATA_DIR, "config.json"), cfg)
        return jsonify({"ok": True})


@app.route("/api/pin/verify", methods=["POST"])
def api_pin_verify():
    import hashlib
    pin = read_json(os.path.join(DATA_DIR, "config.json"), {}).get("adminPin", "")
    got = str(request.get_json(force=True).get("pin", ""))
    if not pin:
        return jsonify({"ok": True, "need": False})
    ok = hashlib.sha256(got.encode()).hexdigest() == pin
    return jsonify({"ok": ok, "need": True})


@app.route("/api/config", methods=["POST"])
def api_config():
    """班级级配置：排序 / 投喂锁定"""
    with _LOCK:
        cid = current_class_id()
        cfg, students, oplog, timeline = load_class(cid)
        body = request.get_json(force=True)
        for k in ("sort", "feedLocked"):
            if k in body:
                cfg[k] = body[k]
        save_class(cid, cfg=cfg, students=students, oplog=oplog, timeline=timeline)
        return jsonify({"ok": True})


# ================= 启动 =================
def _open_pages(port):
    import webbrowser
    webbrowser.open(f"http://127.0.0.1:{port}/show")
    webbrowser.open(f"http://127.0.0.1:{port}/admin")


if __name__ == "__main__":
    init_folders()
    daily_backup()
    port = 5175
    if "--open" in sys.argv and os.environ.get("NO_BROWSER") != "1":
        threading.Timer(1.0, lambda: _open_pages(port)).start()
    print(f"🐱 AI宠物乐园服务已启动：\n   展示端  http://127.0.0.1:{port}/show\n   管理后台 http://127.0.0.1:{port}/admin\n   （关闭本窗口即停止服务）")
    app.run(host="0.0.0.0", port=port, threaded=True)
else:
    # 被 test_api.py 导入时：初始化目录但不打开浏览器
    init_folders()
