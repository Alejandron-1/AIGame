#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
场景2｜魔法师的尖塔房间（课本导入视频 镜头2）
画面：教室内景（图三右半）固定为背景，魔法师贴纸原地上下跳动（贴图动画）
台词A：旁白「在魔法学院的尖塔上，住着一位充满智慧的魔法师。」（温柔女声）
台词B：魔法师「哈哈！我亲爱的小探险家们……」（同一女声放慢=爷爷音色替代）
产出：场景2_魔法师的房间.mp4（1080p/30fps）
"""
import os, subprocess, sys, io

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(HERE, '..', 'ffmpeg.exe')
FPS = 30
LEAD, TAIL = 0.8, 1.0
WIZ = os.path.join(HERE, '角色', '01魔法师.png')

PARTS = [
    {   # 2A 旁白：魔法师在右侧小幅上下浮动
        "text": "在魔法学院的尖塔上，住着一位充满智慧的魔法师。",
        "voice_rate": -2,
        "wx": 68, "wsize": 430, "bounce": 16, "period": 2.2,   # 魔法师位置/大小/跳动
    },
    {   # 2B 魔法师台词：居中偏左，跳动更欢快
        "text": "哈哈！我亲爱的小探险家们，欢迎来到魔法学院！你们终于找到了立体图形城堡啦！来得正好，我刚刚完成了伟大的立体魔法，正想邀请你们参观呢！",
        "voice_rate": -4,
        "wx": 30, "wsize": 500, "bounce": 26, "period": 1.5,
    },
]

def wav_seconds(path):
    return max(0.0, (os.path.getsize(path) - 44) / (16000 * 2))

# 内景背景：图三右半 → 16:9 裁切
INTERIOR = os.path.join(HERE, '_内景_16x9.jpg')
sub = subprocess.run([FF, '-y', '-i', os.path.join(HERE, '素材', '大门与内景.jpg'),
    '-filter_complex', "[0:v]crop=iw/2:ih:iw/2:0,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080",
    '-frames:v', '1', INTERIOR], capture_output=True)
assert os.path.exists(INTERIOR), '内景裁切失败'

os.makedirs('C:/Temp', exist_ok=True)
clips = []
for i, part in enumerate(PARTS, 1):
    wav = os.path.join(HERE, f'demo_tts_{i}.wav')
    ps = (
        'Add-Type -AssemblyName System.Speech\n'
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n'
        'try { $s.SelectVoice("Microsoft Huihui Desktop") } catch { }\n'
        f'$s.Rate = {part["voice_rate"]}\n'
        f'$s.SetOutputToWaveFile("{wav}", (New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)))\n'
        f'$s.Speak(@"\n{part["text"]}\n"@)\n'
        '$s.Dispose()\n'
    )
    psf = os.path.join(HERE, f'_tts_{i}.ps1')
    io.open(psf, 'w', encoding='utf-8-sig').write(ps)
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psf], check=True)
    os.remove(psf)
    dur = wav_seconds(wav)
    total = round(dur + LEAD + TAIL, 2)
    frames = int(total * FPS)

    # 长台词自动换行（每20字一行），行数决定字幕块高度
    raw = part['text']
    wrapped = '\n'.join(raw[k:k+20] for k in range(0, len(raw), 20))
    nlines = wrapped.count('\n') + 1
    subfile = f'C:/Temp/demo_sub{i}.txt'
    io.open(subfile, 'w', encoding='utf-8-sig').write(wrapped)
    sub_arg = subfile.replace(':', '\\:')
    wiz_arg = WIZ.replace('\\', '/').replace(':', '\\:')

    # 贴纸：宽度 wsize，底部贴地，上下正弦跳动 + 轻微摇摆
    vf = (
        f"[0:v][wiz]overlay="
        f"x='W*{part['wx']/100}-w/2+{part['bounce']//2}*sin(2*PI/{part['period']*1.7}*t)':"
        f"y='H-h-30-{part['bounce']}*(0.5-0.5*cos(2*PI/{part['period']}*t))':"
        f"shortest=1[v];"
        f"[v]drawtext=fontfile='C\\:/Windows/Fonts/msyhbd.ttc':textfile='{sub_arg}':"
        "fontsize=50:fontcolor=white:borderw=5:bordercolor=0x3F3A34:"
        f"x=(w-text_w)/2:y=h-140-{nlines}*62:enable='between(t,0.3,{total-0.2})'[v2]"
    )
    clip = os.path.join(HERE, f'demo_seg{i}.mp4')
    subprocess.run([FF, '-y',
        '-loop', '1', '-i', INTERIOR,
        '-loop', '1', '-i', WIZ,
        '-i', wav,
        '-filter_complex',
        f"[1:v]scale={part['wsize']}:-1,format=rgba[wiz];" + vf,
        '-map', '[v2]', '-map', '2:a',
        '-t', str(total), '-r', str(FPS),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast',
        '-c:a', 'aac', '-b:a', '128k',
        clip], check=True)
    clips.append(clip)
    print(f'段{i}: {total}s  跳动幅度{part["bounce"]}px')

lst = os.path.join(HERE, 'demo_list.txt')
with io.open(lst, 'w', encoding='utf-8') as f:
    for c in clips:
        f.write("file '" + c.replace('\\', '/') + "'\n")
out = os.path.join(HERE, '场景2_魔法师的房间.mp4')
subprocess.run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out], check=True)
for c in clips:
    os.remove(c)
print('完成:', out)
