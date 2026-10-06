#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
立体王国导入视频 —— 预览版成片合成
输入：shots/ 下 12 张首帧图（state.json 记录） + audio/ 下 12 段 TTS 旁白
处理：每个镜头做 Ken Burns 动态镜头（推近/拉远/横移，逐镜头交替），对齐旁白时长，
      互动提问镜头后自动留 3 秒学生回答停顿；拼接成 1080p 成片，并输出同步 SRT 字幕。
产出：立体王国导入视频_预览版.mp4 / .srt
用法：python build_final_video.py [-c]
  -c / --concat-only：跳过渲染，直接拼接 shots/ 下已有的 NN_clip.mp4
  （用于把即梦/可灵生成的真视频片段替换进来后重新出片，时长按 ffmpeg 实测）
"""
import os, sys, json, subprocess

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS_DIR = os.path.join(HERE, 'shots')
AUDIO_DIR = os.path.join(HERE, 'audio')
STATE = os.path.join(HERE, 'state.json')
NARRATION = os.path.join(HERE, 'narration.json')

FPS = 30
W, H = 1920, 1080
LEAD = 0.8      # 旁白前的静音铺垫（秒）
TAIL = 0.9      # 旁白后的余韵（秒）
MIN_DUR = 4.0   # 单镜头最短时长

# Ken Burns 镜头运动逐镜头分配（in=推近 out=拉远 pr=右移 pl=左移）
MOVES = ['in', 'pr', 'out', 'pr', 'in', 'out', 'pl', 'in', 'pr', 'in', 'in', 'out']


def find_ffmpeg():
    ff = os.path.join(os.path.dirname(HERE), 'ffmpeg.exe')  # 视频/ffmpeg.exe
    if os.path.exists(ff):
        return ff
    import shutil
    p = shutil.which('ffmpeg')
    if p:
        return p
    raise SystemExit('未找到 ffmpeg.exe')


def wav_seconds(path):
    """PCM WAV 时长 = (字节数 - 44头) / (采样率*2字节*单声道)"""
    return max(0.0, (os.path.getsize(path) - 44) / (16000 * 2))


def srt_time(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return '%02d:%02d:%02d,%03d' % (h, m, s, ms)


def move_expr(kind, frames):
    if kind == 'in':
        return "z='1.0+0.28*on/%d'" % frames, "x='iw/2-(iw/zoom/2)'", "y='ih/2-(ih/zoom/2)'"
    if kind == 'out':
        return "z='1.30-0.30*on/%d'" % frames, "x='iw/2-(iw/zoom/2)'", "y='ih/2-(ih/zoom/2)'"
    if kind == 'pr':
        return "z='1.22'", "x='(iw-iw/zoom)*on/%d'" % frames, "y='ih/2-(ih/zoom/2)'"
    return "z='1.22'", "x='(iw-iw/zoom)*(1-on/%d)'" % frames, "y='ih/2-(ih/zoom/2)'"


def ffmpeg_duration(ff, path):
    """用 ffmpeg -i 的 stderr 输出解析媒体时长（秒）"""
    r = subprocess.run([ff, '-i', path], stdout=subprocess.DEVNULL,
                       stderr=subprocess.PIPE)
    for line in r.stderr.decode('utf-8', 'replace').splitlines():
        if 'Duration:' in line:
            h, m, s = line.split('Duration:')[1].split(',')[0].strip().split(':')
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


def main():
    ff = find_ffmpeg()
    concat_only = '-c' in sys.argv[1:] or '--concat-only' in sys.argv[1:]
    with open(STATE, 'r', encoding='utf-8') as f:
        st = json.load(f)
    with open(NARRATION, 'r', encoding='utf-8') as f:
        narr = {n['no']: n for n in json.load(f)['shots']}

    nos = sorted(int(k) for k in st['images'])
    print('发现首帧图镜头:', nos, flush=True)

    clips, timeline = [], []   # timeline: (start, dur, text)
    t = 0.0
    for no in nos:
        img = st['images'][str(no)]['file']
        wav = os.path.join(AUDIO_DIR, '%02d.wav' % no)
        n = narr[no]
        audio_dur = wav_seconds(wav) if os.path.exists(wav) else 0.0
        pause = float(n.get('pause', 0))
        dur = max(MIN_DUR, LEAD + audio_dur + TAIL + pause)
        frames = int(round(dur * FPS))
        dur = frames / float(FPS)

        clip = os.path.join(SHOTS_DIR, '%02d_clip.mp4' % no)
        if concat_only and os.path.exists(clip):
            dur = ffmpeg_duration(ff, clip)
            print('镜头%02d 使用已有片段（%.1fs，--concat-only）' % (no, dur), flush=True)
        else:
            real = (st.get('videos', {}).get(str(no), {}) or {}).get('file')
            af = ("aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,"
                  "adelay=%d|%d,apad" % (int(LEAD * 1000), int(LEAD * 1000)))
            if real and os.path.exists(real):
                # 真 AI 视频片段：循环播放铺满配音时长（含提问停顿）
                vf = ("scale=%d:%d:force_original_aspect_ratio=increase,"
                      "crop=%d:%d,fps=%d,format=yuv420p" % (W, H, W, H, FPS))
                cmd = [ff, '-y', '-stream_loop', '-1', '-i', real, '-i', wav,
                       '-filter_complex', '[0:v]%s[v];[1:a]%s[a]' % (vf, af),
                       '-map', '[v]', '-map', '[a]',
                       '-t', '%.3f' % dur,
                       '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
                       '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                       clip]
                print('渲染镜头%02d %s（%.1fs，真AI视频循环，旁白%.1fs%s）'
                      % (no, n['role'], dur, audio_dur,
                         '，停顿%.1fs' % pause if pause else ''), flush=True)
            else:
                z, x, y = move_expr(MOVES[(no - 1) % len(MOVES)], frames)
                vf = ("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
                      "zoompan=%s:%s:%s:d=%d:s=%dx%d:fps=%d,format=yuv420p"
                      % (3840, 2160, 3840, 2160, z, x, y, frames, W, H, FPS))
                cmd = [ff, '-y', '-i', img, '-i', wav,
                       '-filter_complex', '[0:v]%s[v];[1:a]%s[a]' % (vf, af),
                       '-map', '[v]', '-map', '[a]',
                       '-t', '%.3f' % dur,
                       '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
                       '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                       clip]
                print('渲染镜头%02d %s（%.1fs，Ken Burns 运动=%s，旁白%.1fs%s）'
                      % (no, n['role'], dur, MOVES[(no - 1) % len(MOVES)], audio_dur,
                         '，停顿%.1fs' % pause if pause else ''), flush=True)
            r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            if r.returncode != 0:
                print(r.stderr.decode('utf-8', 'replace')[-800:])
                raise SystemExit('镜头%02d 合成失败' % no)
        clips.append(clip)
        timeline.append((t, dur, n['text']))
        t += dur

    # 拼接
    lst = os.path.join(HERE, 'concat_list.txt')
    with open(lst, 'w', encoding='utf-8') as f:
        for c in clips:
            f.write("file '%s'\n" % c.replace('\\', '/').replace("'", "'\\''"))
    out = os.path.join(HERE, '立体王国导入视频_预览版.mp4')
    r = subprocess.run([ff, '-y', '-f', 'concat', '-safe', '0', '-i', lst,
                        '-c', 'copy', out], stdout=subprocess.DEVNULL,
                       stderr=subprocess.PIPE)
    if r.returncode != 0:
        print(r.stderr.decode('utf-8', 'replace')[-800:])
        raise SystemExit('拼接失败')

    # SRT 字幕
    srt = os.path.join(HERE, '立体王国导入视频_预览版.srt')
    with open(srt, 'w', encoding='utf-8-sig') as f:
        for i, (start, dur, text) in enumerate(timeline, 1):
            f.write('%d\n%s --> %s\n%s\n\n'
                    % (i, srt_time(start + 0.4), srt_time(start + dur - 0.3), text))

    print('=' * 52)
    print('✅ 成片: %s（%.1f 秒，%d 个镜头）' % (out, t, len(clips)))
    print('✅ 字幕: %s' % srt)


if __name__ == '__main__':
    main()
