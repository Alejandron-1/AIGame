#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
贴图小视频生成器：背景不动，主体像贴纸一样左右摇摆，Windows TTS 念台词，底部大字幕。
改台词：编辑下面 LINES。换素材：替换 小样_背景.png / 小样_贴纸.png。
产出：小样_贴图视频.mp4（1080p/30fps）
"""
import os, subprocess, sys, io

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(HERE, 'ffmpeg.exe')

# ---------- 台词（voice: Huihui=中文女声 / Zira=英文；rate: -10~10 语速） ----------
LINES = [
    {"voice": "Huihui", "rate": 0, "text": "小朋友们好，我是立体王国的魔法师！"},
    {"voice": "Huihui", "rate": 3, "text": "魔法师爷爷，长方体和正方体，到底哪里不一样呀？"},
]

SWING = 30      # 贴纸左右摆动幅度（像素）
PERIOD = 2.4    # 摆动周期（秒）
LEAD = 0.8      # 台词前静音
TAIL = 0.8      # 台词后余韵

def wav_seconds(path):
    return max(0.0, (os.path.getsize(path) - 44) / (16000 * 2))

# ---------- 1) TTS 配音（wav 用英文名，避开中文路径坑） ----------
audio_files = []
for i, ln in enumerate(LINES, 1):
    wav = os.path.join(HERE, f'demo_tts_{i}.wav')
    ps = (
        'Add-Type -AssemblyName System.Speech\n'
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n'
        f'try {{ $s.SelectVoice("Microsoft {ln["voice"]} Desktop") }} catch {{ }}\n'
        f'$s.Rate = {ln["rate"]}\n'
        f'$s.SetOutputToWaveFile("{wav}", (New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)))\n'
        f'$s.Speak(@"\n{ln["text"]}\n"@)\n'
        '$s.Dispose()\n'
    )
    psf = os.path.join(HERE, f'_tts_{i}.ps1')
    io.open(psf, 'w', encoding='utf-8-sig').write(ps)
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psf], check=True)
    os.remove(psf)
    dur = wav_seconds(wav)
    if dur <= 0:
        raise SystemExit(f'配音{i}失败（0 秒），检查 TTS')
    audio_files.append((wav, dur))
    print(f'配音{i}: {dur:.1f}s')

# ---------- 2) 逐段合成 ----------
clips = []
BG = os.path.join(HERE, '小样_背景.png')
PROP = os.path.join(HERE, '小样_贴纸.png')
for i, (wav, dur) in enumerate(audio_files, 1):
    total = round(dur + LEAD + TAIL, 2)
    text = LINES[i-1]['text']
    os.makedirs(r'C:/Temp', exist_ok=True)
    subfile = f'C:/Temp/demo_sub{i}.txt'

    io.open(subfile, 'w', encoding='utf-8-sig').write(text)
    clip = os.path.join(HERE, f'demo_seg{i}.mp4')
    font = 'C\\:/Windows/Fonts/msyhbd.ttc'
    vf = (
        "[1:v]scale=560:-1,format=rgba,"
        "rotate='0.045*sin(2*PI/2.4*t)':c=black@0:ow=rotw(iw):oh=roth(ih)[prop];"
        f"[0:v][prop]overlay=x='(W-w)/2+{SWING}*sin(2*PI/{PERIOD}*t)':y='H-h-60':shortest=1[v];"
        f"[v]drawtext=fontfile='{font}':textfile='{subfile.replace(chr(58), chr(92)+chr(58))}':"
        "fontsize=54:fontcolor=white:borderw=5:bordercolor=0x3F3A34:"
        f"x=(w-text_w)/2:y=h-200:enable='between(t,0.3,{total-0.2})'[out]"
    )
    subprocess.run([FF, '-y',
        '-loop', '1', '-i', BG,
        '-loop', '1', '-i', PROP,
        '-i', wav,
        '-filter_complex', vf,
        '-map', '[out]', '-map', '2:a',
        '-t', str(total), '-r', '30',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast',
        '-c:a', 'aac', '-b:a', '128k',
        clip], check=True)
    clips.append(clip)
    print(f'合成段{i}: {total}s')

# ---------- 3) 拼接 ----------
lst = os.path.join(HERE, 'demo_list.txt')
with io.open(lst, 'w', encoding='utf-8') as f:
    for c in clips:
        f.write("file '" + c.replace('\\', '/') + "'\n")
out = os.path.join(HERE, '小样_贴图视频.mp4')
subprocess.run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', lst,
                '-c', 'copy', out], check=True)
for c in clips:
    os.remove(c)
print('完成:', out)
