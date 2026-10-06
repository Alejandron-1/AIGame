#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
立体王国导入视频 —— 批量生成脚本（智谱 BigModel API）
流程：CogView 生成每镜头首帧图（统一角色形象）→ CogVideoX 图生视频
产出：shots/ 下 12 张首帧图 + 12 段 MP4（1080p，16:9）

用法：
  python generate_videos.py                 # 全流程（12 镜头）
  python generate_videos.py --shots 1       # 只做第 1 镜头（用来先验证）
  python generate_videos.py --shots 2-12 --quality speed   # 快速廉价模式
断点续跑：state.json 记录图片 URL 与视频任务 ID，重跑自动跳过已完成步骤。
"""
import os, sys, json, time, argparse
import urllib.request, urllib.error

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ==================== 配置区 ====================
API_KEY = "9aa383ed88bc409583aad7b478c77ee7.xnAeaBZptaldV1em"
BASE = "https://open.bigmodel.cn/api/paas/v4"

# 图片/视频模型按顺序尝试（前面不可用自动落到下一个）
# 2026-10-06 实测：本账户 cogvideox-flash 免费可用；cogvideox-3/2 需视频资源包(1113)
IMAGE_MODELS = ["cogview-3-flash", "cogview-4"]
VIDEO_MODELS = ["cogvideox-flash", "cogvideox-3", "cogvideox-2"]

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SHOTS_DIR = os.path.join(OUT_DIR, "shots")
STATE_FILE = os.path.join(OUT_DIR, "state.json")

# 统一角色/场景描述（所有镜头复用同一份，保证跨镜头一致性）
WIZ = "白胡子老魔法师，戴着深紫色缀金色星星的尖顶帽，穿着同色长袍，圆框眼镜，红扑扑的脸颊，手握顶端有金色星星的法杖"
SHAPES = ("四个可爱的立体图形小精灵：蓝色长长方方的长方体积木精灵、红色方方正正的正方体积木精灵、"
          "黄色罐子状的圆柱精灵、粉色圆滚滚的球精灵，都有大大的眼睛、小腮红和两只白色小手")
ROOM = "魔法学院尖塔顶层的魔法师房间，家具全由立体图形组成：长方体木书桌上摞着正方体魔法书，黄色圆柱撑起圆顶，球形水晶吊灯洒下星光，圆形地毯"
STYLE = "皮克斯风格3D卡通渲染，色彩明快饱满，温馨梦幻，高清细节"

# ==================== 12 个镜头 ====================
# img = 首帧图提示词；vid = 图生视频的运动提示词；dur = 尝试的视频秒数(不支持则自动回落默认5秒)
SHOTS = [
    dict(no=1, name="开场王国", dur=10,
         img="梦幻童话场景，金色云海之上悬浮着一座由巨大立体图形组成的魔法学院城堡：长方体塔楼、正方体主楼、圆柱形尖塔、球形水晶穹顶，彩色小旗飘扬，窗户透出暖黄灯光，门上镶嵌四个发光的图形徽章，黄昏金色光线，星光粒子漂浮，" + STYLE,
         vid="镜头从远处缓缓向前推进，穿过漂浮的星光粒子，云雾轻轻散开，逐渐靠近魔法城堡大门，城堡窗户里的暖黄灯光轻轻闪烁，梦幻唯美"),
    dict(no=2, name="开门魔法", dur=None,
         img="巨大的橡木魔法大门特写，门上镶嵌四个发光的图形徽章，门缝里透出耀眼的金色光芒，金色星星粒子从门缝飞出，" + STYLE,
         vid="橡木魔法大门缓缓向内打开，门缝里的金色光芒越来越亮，漫天金色星星粒子喷涌而出，光芒照亮四周，梦幻魔法氛围"),
    dict(no=3, name="魔法师欢迎", dur=10,
         img=ROOM + "，" + WIZ + "站在房间中央的圆形地毯上，面向镜头张开双臂开心大笑，温馨暖光，" + STYLE,
         vid="镜头缓缓上升进入房间，白胡子魔法师转身面向镜头张开双臂开心大笑，白胡子飘飘，球形水晶吊灯洒下闪烁的星光"),
    dict(no=4, name="客人亮相", dur=10,
         img=ROOM + "，" + SHAPES + "，四个小精灵在地毯上排成一排向镜头挥手，旁边站着" + WIZ + "，魔法师身旁的木质帽架空空如也，活泼欢快，" + STYLE,
         vid="四个立体图形小精灵蹦蹦跳跳地挥动白色小手，表情活泼可爱，魔法师在旁边微笑着看向他们"),
    dict(no=5, name="提问会滚", dur=None,
         img=ROOM + "，粉色球小精灵在圆形地毯上开心转圈，蓝色长方体、红色正方体、黄色圆柱三个小精灵并排站好看向镜头，" + WIZ + "托着下巴好奇地打量他们，欢快俏皮，" + STYLE,
         vid="粉色球小精灵开心地在圆形地毯上滚动转圈，其他三个小精灵好奇地观看，魔法师托着下巴点点头，若有所思"),
    dict(no=6, name="球否认", dur=None,
         img="粉色圆滚滚的球小精灵特写，大大的眼睛，两只白色小手左右摆动做不的手势，摇着头俏皮地眨眼，背景是温馨的魔法师房间，" + STYLE,
         vid="粉色球小精灵摇着头，两只白色小手左右摆动做不的手势，然后俏皮地眨眨眼"),
    dict(no=7, name="提问滚立", dur=None,
         img=ROOM + "，黄色罐子状的圆柱小精灵在圆形地毯上侧身准备滚动，其他三个小精灵在旁观看，" + WIZ + "竖起一根手指，若有所思，" + STYLE,
         vid="黄色圆柱小精灵在地毯上侧身滚了一圈，然后稳稳地立起来站好，得意地拍拍身体，魔法师竖起手指点头"),
    dict(no=8, name="圆柱否认", dur=None,
         img="黄色罐子状的圆柱小精灵特写，摇着头摆着白色小手，一只小白手挡在嘴边，做出说悄悄话的神秘表情，背景是温馨的魔法师房间，" + STYLE,
         vid="黄色圆柱小精灵摇摇头摆摆手，然后神秘地凑近镜头，白色小手挡在嘴边，做出凑近说悄悄话的样子"),
    dict(no=9, name="提问长短面", dur=None,
         img=ROOM + "，蓝色长方体小精灵和红色正方体小精灵并排站立互相看着，" + WIZ + "在旁边用双手比划一长一短的长度作思考状，粉色球和黄色圆柱在一旁围观，" + STYLE,
         vid="蓝色长方体小精灵和红色正方体小精灵互相看了一眼，魔法师用双手比划一长一短的长度，认真地思考"),
    dict(no=10, name="长方体否认", dur=None,
         img=ROOM + "，蓝色长方体小精灵摇着头开心摆手，一只小白手指向旁边紧张的红色正方体小精灵，正方体小精灵捂住眼睛，粉色球和黄色圆柱在一旁围观，" + STYLE,
         vid="蓝色长方体小精灵摇着头摆摆手，然后伸出白色小手指向旁边的红色正方体小精灵，正方体小精灵紧张地捂住眼睛"),
    dict(no=11, name="终极提问", dur=None,
         img=ROOM + "，" + WIZ + "激动地高高举起星星法杖，" + SHAPES + "，四个小精灵并排站立一齐看向镜头，金色星星粒子在空中环绕，充满悬念的魔法氛围，" + STYLE,
         vid="魔法师激动地高高举起法杖挥舞，金色星星粒子在四位小精灵头顶环绕闪烁，大家紧张又期待地看向镜头"),
    dict(no=12, name="还帽庆祝", dur=10,
         img=ROOM + "，红色正方体小精灵红着脸从身后捧出一顶深紫色缀金色星星的魔法帽，递给面前开心的" + WIZ + "，其他三个小精灵欢呼跳跃，金色星星烟花在房间绽放，" + STYLE,
         vid="红色正方体小精灵把魔法帽递给魔法师，魔法师接过戴上后开心地挥动法杖，金色星星烟花绽放，四个小精灵欢呼跳跃庆祝"),
]


# ==================== 基础工具 ====================
def is_insufficient(err_msg):
    return any(k in err_msg for k in ('余额', '欠费', 'balance', '1113'))


def api(method, path, payload=None, timeout=180):
    """带重试的 API 调用；余额不足(1113)属于永久错误不重试；HTTPError 转成 RuntimeError"""
    url = BASE + path
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    last_err = None
    for attempt in range(5):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header('Authorization', 'Bearer ' + API_KEY)
        req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'replace')
            if is_insufficient(body):
                raise RuntimeError('HTTP %s: %s' % (e.code, body))
            if e.code in (429, 500, 502, 503, 504):
                last_err = RuntimeError('HTTP %s: %s' % (e.code, body))
                time.sleep(15 * (attempt + 1))
                continue
            raise RuntimeError('HTTP %s: %s' % (e.code, body))
        except Exception as e:
            last_err = e
            time.sleep(10)
    raise RuntimeError('网络重试仍失败: %s' % last_err)


def is_insufficient(err_msg):
    return any(k in err_msg for k in ('余额', '欠费', 'balance', '1113'))


def download(url, path):
    req = urllib.request.Request(url)
    req.add_header('User-Agent', 'Mozilla/5.0')
    with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
        f.write(r.read())


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"images": {}, "videos": {}}


def save_state(st):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(st, f, ensure_ascii=False, indent=1)


def log(msg):
    print(time.strftime('[%H:%M:%S] ') + msg, flush=True)


# ==================== 第一步：首帧图 ====================
def gen_image(shot):
    """生成首帧图，返回 (本地文件, 线上URL)。付费模型余额不足时自动降级到免费模型，不终止。"""
    no, name = shot['no'], shot['name']
    path = os.path.join(SHOTS_DIR, '%02d_%s.jpg' % (no, name))
    for model in IMAGE_MODELS:
        for size in ("1344x768", "1152x864", "1024x1024"):
            try:
                r = api('POST', '/images/generations', {
                    "model": model, "prompt": shot['img'],
                    "size": size, "response_format": "url"})
                url = r['data'][0]['url']
                download(url, path)
                log('  首帧图 %02d_%s 完成（%s %s）' % (no, name, model, size))
                return path, url
            except RuntimeError as e:
                log('  [%s %s 失败] %s' % (model, size, str(e)[:160]))
    raise RuntimeError('镜头%d 首帧图所有模型均失败' % no)


# ==================== 第二步：图生视频 ====================
def submit_video(shot, image_url, quality):
    """提交图生视频任务，返回 task_id。模型名/秒数参数不支持时自动回落。"""
    no = shot['no']

    def try_submit(model, dur, q):
        payload = {"model": model, "prompt": shot['vid'],
                   "image_url": image_url, "quality": q, "with_audio": False}
        if dur:
            payload["duration"] = dur
        r = api('POST', '/videos/generations', payload)
        return r['id']

    for model in VIDEO_MODELS:
        dur = shot.get('dur')
        if 'flash' in model:
            dur = None  # flash 模型不支持自定义时长，用默认
        while True:
            try:
                tid = try_submit(model, dur, quality)
                log('  镜头%d 已提交（%s, %s%s）' % (no, model, quality, '，%ds' % dur if dur else ''))
                return tid
            except RuntimeError as e:
                msg = str(e)
                if is_insufficient(msg):
                    raise
                if dur and ('duration' in msg.lower() or '参数' in msg or '400' in msg.split(':')[0]):
                    log('  镜头%d 不支持 duration=%s，改用默认时长重试' % (no, dur))
                    dur = None
                    continue
                if '400' in msg.split(':')[0] and model != VIDEO_MODELS[-1]:
                    log('  [%s 被拒绝] %s' % (model, msg[:160]))
                    break  # 换下一个模型
                raise
    raise RuntimeError('镜头%d 视频提交所有模型均失败' % no)


def poll_video(tid, max_minutes=30):
    """轮询异步任务直到 SUCCESS / FAIL / 超时"""
    deadline = time.time() + max_minutes * 60
    while time.time() < deadline:
        try:
            r = api('GET', '/async-result/' + tid)
        except RuntimeError as e:
            if is_insufficient(str(e)):
                raise
            log('  轮询出错（60s 后重试）: %s' % str(e)[:120])
            time.sleep(60)
            continue
        st = r.get('task_status', '')
        if st == 'SUCCESS':
            vr = r.get('video_result') or []
            if vr:
                return vr[0].get('url')
            raise RuntimeError('任务成功但没有视频地址: %s' % json.dumps(r, ensure_ascii=False)[:200])
        if st in ('FAIL', 'FAILED'):
            raise RuntimeError('视频生成失败: %s' % json.dumps(r, ensure_ascii=False)[:300])
        time.sleep(20)
    raise TimeoutError('任务超时未完成: %s' % tid)


# ==================== 主流程 ====================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default='1-12', help='如 1-12 或 1,3,5')
    ap.add_argument('--quality', default='quality', choices=['quality', 'speed'])
    ap.add_argument('--stage', default='all', choices=['images', 'videos', 'all'],
                    help='images=只生成首帧图；videos=只提交并等待视频；all=全流程')
    args = ap.parse_args()
    stage = args.stage

    picked = set()
    for part in args.shots.split(','):
        if '-' in part:
            a, b = part.split('-')
            picked.update(range(int(a), int(b) + 1))
        else:
            picked.add(int(part))
    todo = [s for s in SHOTS if s['no'] in picked]

    os.makedirs(SHOTS_DIR, exist_ok=True)
    st = load_state()
    quality = args.quality

    log('=' * 56)
    log('立体王国导入视频生成：共 %d 个镜头，画质=%s，阶段=%s' % (len(todo), quality, stage))
    log('=' * 56)

    # ---- 第一步：首帧图 ----
    if stage in ('images', 'all'):
        for shot in todo:
            key = str(shot['no'])
            if key in st['images'] and os.path.exists(st['images'][key]['file']):
                log('镜头%d 首帧图已存在，跳过' % shot['no'])
                continue
            log('镜头%d 生成首帧图：%s' % (shot['no'], shot['name']))
            try:
                path, url = gen_image(shot)
            except RuntimeError as e:
                log('❌ %s' % e)
                return 1
            st['images'][key] = {"file": path, "url": url}
            save_state(st)
        if stage == 'images':
            log('首帧图阶段完成。')
            return 0

    # ---- 第二步：提交视频任务 ----
    if stage in ('videos', 'all'):
        missing = [s['no'] for s in todo if str(s['no']) not in st['images']]
        if missing:
            log('❌ 镜头 %s 缺少首帧图，请先运行 --stage images' % missing)
            return 1
        for shot in todo:
            key = str(shot['no'])
            v = st['videos'].get(key, {})
            if v.get('task_id') and not v.get('error'):
                log('镜头%d 视频任务已在队列（%s），跳过提交' % (shot['no'], v['task_id']))
                continue
            log('镜头%d 提交视频任务：%s' % (shot['no'], shot['name']))
            try:
                tid = submit_video(shot, st['images'][key]['url'], quality)
            except RuntimeError as e:
                if is_insufficient(str(e)) and quality == 'quality':
                    log('⚠️ 余额不足高质量模式，自动降级为 speed 模式重试')
                    quality = 'speed'
                    try:
                        tid = submit_video(shot, st['images'][key]['url'], quality)
                    except RuntimeError as e2:
                        log('❌ 镜头%d 提交失败: %s' % (shot['no'], str(e2)[:200]))
                        st['videos'][key] = {"error": str(e2)}
                        save_state(st)
                        return 1
                else:
                    log('❌ 镜头%d 提交失败: %s' % (shot['no'], str(e)[:200]))
                    st['videos'][key] = {"error": str(e)}
                    save_state(st)
                    return 1
            st['videos'][key] = {"task_id": tid, "status": "PROCESSING"}
            save_state(st)
            time.sleep(3)  # 轻微间隔，避免提交限流

    # ---- 第三步：轮询 + 下载 ----
    pending = {str(s['no']): s for s in todo
               if st['videos'].get(str(s['no']), {}).get('task_id')
               and not st['videos'][str(s['no'])].get('file')}
    log('等待 %d 个视频生成完成（每 20 秒轮询一次）...' % len(pending))
    while pending:
        done_now = []
        for key, shot in pending.items():
            v = st['videos'][key]
            try:
                url = poll_video(v['task_id'], max_minutes=1)  # 短轮询，循环外层统一等待
            except TimeoutError:
                continue  # 还没好，下轮再看
            except RuntimeError as e:
                if is_insufficient(str(e)):
                    log('❌ 余额不足，终止')
                    return 1
                log('❌ 镜头%d %s: %s' % (shot['no'], shot['name'], str(e)[:200]))
                v['error'] = str(e)
                save_state(st)
                done_now.append(key)
                continue
            path = os.path.join(SHOTS_DIR, '%02d_%s.mp4' % (shot['no'], shot['name']))
            log('⬇️  镜头%d %s 生成完成，下载中...' % (shot['no'], shot['name']))
            download(url, path)
            v['file'] = path
            v['status'] = 'SUCCESS'
            save_state(st)
            log('✅ 镜头%d %s 完成 → %s' % (shot['no'], shot['name'], os.path.basename(path)))
            done_now.append(key)
        for k in done_now:
            pending.pop(k)
        if pending:
            time.sleep(20)

    ok = sum(1 for s in todo if st['videos'].get(str(s['no']), {}).get('file'))
    log('=' * 56)
    log('全部结束：成功 %d / %d 个镜头，产出目录 %s' % (ok, len(todo), SHOTS_DIR))
    log('=' * 56)
    return 0 if ok == len(todo) else 2


if __name__ == '__main__':
    sys.exit(main())
