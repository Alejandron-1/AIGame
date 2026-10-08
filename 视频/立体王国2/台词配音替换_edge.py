#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台词配音替换（Edge TTS 神经语音版）：微软 Edge 在线神经语音，音质远超 Windows TTS。
魔法师 = zh-CN-YunjianNeural（男声，放慢 8%）；四位客人将来用 Yunxia(卡通男童)/Xiaoyi(卡通女声)。
产出（C:/Users/aa109/Desktop/视频1/）：
  场景一二_魔法师台词_AI配音版.mp4
  场景三四_魔法师台词_AI配音版.mp4
"""
import os, subprocess, sys, io, wave

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(HERE, '..', 'ffmpeg.exe')
OUTDIR = r'C:/Users/aa109/Desktop/视频1'
VOICE_WIZARD = 'zh-CN-YunjianNeural'
RATE_WIZARD = '-8%'          # 爷爷感

JOBS = [
    {
        "video": r'C:/Users/aa109/Downloads/魔法师完整台词-第1段(1-3句)_1008_202542.mp4',
        "out":   os.path.join(OUTDIR, '场景一二_魔法师台词_AI配音版.mp4'),
        "dur":   12.10,
        "lines": [
            (0.15, "我准备了好多有趣的魔法给大家看呢。"),
            (3.10, "咦，我那顶心爱的，施法必需的彩色魔法帽呢？"),
            (8.90, "没有帽子，我的新魔法可没法表演给你们看了。"),
        ],
    },
    {
        "video": r'C:/Users/aa109/Downloads/魔法师完整台词-第2段(4-6句+客人登场)_1008_202545.mp4',
        "out":   os.path.join(OUTDIR, '场景三四_魔法师台词_AI配音版.mp4'),
        "dur":   13.09,
        "lines": [
            (0.15, "哦，想起来了。"),
            (1.90, "今天下午，有四位形状客人来过这里。"),
            (5.75, "我的魔法帽肯定是被他们其中的一个偷走了。"),
            (8.90, "你们能叫出他们的名字吗？"),
        ],
    },
]

def edge_tts(text, mp3, voice, rate):
    subprocess.run([sys.executable, '-m', 'edge_tts',
        f'--rate={rate}', '--voice', voice, '--text', text,
        '--write-media', mp3], check=True, capture_output=True)

def wav_seconds(path):
    with wave.open(path, 'rb') as w:
        return w.getnframes() / w.getframerate()

def mp3_to_wav(mp3, wav):
    subprocess.run([FF, '-y', '-i', mp3, '-ar', '16000', '-ac', '1', wav],
                   check=True, capture_output=True)

def build_track(total, pieces, path):
    SR = 16000
    n = int(total * SR)
    buf = bytearray(n * 2)
    for start, wav in pieces:
        with wave.open(wav, 'rb') as w:
            data = w.readframes(w.getnframes())
        off = int(start * SR) * 2
        m = min(len(data), len(buf) - off)
        for i in range(0, m, 2):
            a = int.from_bytes(buf[off+i:off+i+2], 'little', signed=True)
            b = int.from_bytes(data[i:i+2], 'little', signed=True)
            v = max(-32768, min(32767, a + b))
            buf[off+i:off+i+2] = v.to_bytes(2, 'little', signed=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(buf))

for job in JOBS:
    print('====', os.path.basename(job['out']))
    pieces = []
    for i, (start, text) in enumerate(job['lines'], 1):
        limit = (job['lines'][i][0] - 0.15) if i < len(job['lines']) else job['dur']
        slot = max(0.8, limit - start) + 0.3
        mp3 = f'C:/Temp/dub_{os.getpid()}_{i}.mp3'
        wav = mp3.replace('.mp3', '.wav')
        rate_pct = -8
        while True:
            edge_tts(text, mp3, VOICE_WIZARD, f'{rate_pct:+d}%')
            mp3_to_wav(mp3, wav)
            os.remove(mp3)
            dur = wav_seconds(wav)
            if dur <= slot or rate_pct >= 12:
                break
            rate_pct += 6
        print(f'  句{i}: 配音{dur:.2f}s（槽位{slot:.2f}s，rate {rate_pct}%） {text[:16]}…')
        pieces.append((start, wav))
    track = f'C:/Temp/dub_track_{os.getpid()}.wav'
    build_track(job['dur'], pieces, track)
    for _, wav in pieces:
        os.remove(wav)
    subprocess.run([FF, '-y', '-i', job['video'], '-i', track,
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
        job['out']], check=True)
    os.remove(track)
    print('  输出:', job['out'])
print('全部完成')
