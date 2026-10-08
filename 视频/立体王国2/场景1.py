#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
场景1｜开场：云端立体王国（课本导入视频 镜头1）
画面A：魔法学院全景，缓慢推近 —— 旁白①
画面B：魔法大门，缓慢推近 —— 旁白②
配音：Windows TTS 女声（Huihui，温柔放慢）；底部大字幕。
产出：场景1_云端立体王国.mp4（1080p/30fps）
"""
import os, subprocess, sys, io

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(HERE, '..', 'ffmpeg.exe')
FPS = 30
LEAD, TAIL = 0.9, 1.1   # 旁白前后留白

PARTS = [
    {"bg": "素材/全景.jpg",
     "text": "在很远很远的地方，藏着一个奇妙的立体王国。",
     "zoom_to": 1.14},                      # 全景：推近到城堡
    {"bg": "素材/大门与内景.jpg", "crop_left_half": True,
     "text": "这里的所有物品，都是由不同的立体图形组成的。",
     "zoom_to": 1.12},                      # 大门：缓慢推近
]

def wav_seconds(path):
    return max(0.0, (os.path.getsize(path) - 44) / (16000 * 2))

os.makedirs('C:/Temp', exist_ok=True)
clips = []
for i, part in enumerate(PARTS, 1):
    # 配音
    wav = os.path.join(HERE, f'demo_tts_{i}.wav')
    ps = (
        'Add-Type -AssemblyName System.Speech\n'
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n'
        'try { $s.SelectVoice("Microsoft Huihui Desktop") } catch { }\n'
        '$s.Rate = -2\n'
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

    # 字幕
    subfile = f'C:/Temp/demo_sub{i}.txt'
    io.open(subfile, 'w', encoding='utf-8-sig').write(part['text'])
    sub_arg = subfile.replace(':', '\\:')

    bg = os.path.join(HERE, part['bg'].replace('/', os.sep))
    clip = os.path.join(HERE, f'demo_seg{i}.mp4')
    if part.get('crop_left_half'):
        pre = "crop=iw/2:ih:0:0,scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160"
    else:
        pre = "scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160"
    amp = part['zoom_to'] - 1.0
    vf = (
        f"[0:v]{pre},"
        f"zoompan=z='1.0+{amp:.3f}*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s=1920x1080:fps={FPS},format=yuv420p,"
        f"drawtext=fontfile='C\\:/Windows/Fonts/msyhbd.ttc':textfile='{sub_arg}':"
        "fontsize=54:fontcolor=white:borderw=5:bordercolor=0x3F3A34:"
        f"x=(w-text_w)/2:y=h-200:enable='between(t,0.3,{total-0.2})'"
    )
    subprocess.run([FF, '-y',
        '-i', bg,
        '-i', wav,
        '-filter_complex', vf,
        '-map', '0:v', '-map', '1:a',
        '-t', str(total), '-r', str(FPS),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast',
        '-c:a', 'aac', '-b:a', '128k',
        clip], check=True)
    clips.append(clip)
    print(f'段{i}: {total}s  {part["text"][:18]}…')

lst = os.path.join(HERE, 'demo_list.txt')
with io.open(lst, 'w', encoding='utf-8') as f:
    for c in clips:
        f.write("file '" + c.replace('\\', '/') + "'\n")
out = os.path.join(HERE, '场景1_云端立体王国.mp4')
subprocess.run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out], check=True)
for c in clips:
    os.remove(c)
print('完成:', out)
