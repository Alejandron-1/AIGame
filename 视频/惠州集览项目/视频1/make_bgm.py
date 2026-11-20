# -*- coding: utf-8 -*-
"""合成轻快的音乐盒风格 BGM：C 五声音阶旋律 + 柔和弦垫，92BPM，约21秒"""
import numpy as np
import wave

SR = 44100
BPM = 92.0
BEAT = 60.0 / BPM            # 0.652s
N_BARS = 8
TOTAL = N_BARS * 4 * BEAT    # ~20.9s
N = int(TOTAL * SR)
M = N + 2 * SR   # 尾部余韵缓冲
mix = np.zeros(M)

NOTE = {'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
        'G4': 392.00, 'A4': 440.00, 'C5': 523.25,
        'A2': 110.00, 'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61,
        'G2': 98.00, 'G3': 196.00, 'A3': 220.00}

def add_note(t0, dur, freq, vol):
    """音乐盒音色：正弦+泛音，快起音、指数衰减"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(t / 0.006, 1.0) * np.exp(-t * 2.0)
    # 尾音自然收掉，避免爆音
    rel = int(0.02 * SR)
    if n > rel:
        env[-rel:] *= np.linspace(1, 0, rel)
    w = (np.sin(2*np.pi*freq*t) + 0.35*np.sin(2*np.pi*2*freq*t)
         + 0.12*np.sin(2*np.pi*3*freq*t) + 0.05*np.sin(2*np.pi*4*freq*t))
    i0 = int(t0 * SR)
    mix[i0:i0+n] += vol * env * w

# 旋律：温柔可唱，全五声音阶
melody = [
    # (小节, 每音为 (拍位, 时值拍数, 音名, 力度))
    [(0,1,'E4',.9),(1,1,'G4',.8),(2,1,'A4',.9),(3,1,'G4',.7)],
    [(0,1,'E4',.8),(1,1,'D4',.7),(2,2,'C4',.85)],
    [(0,1,'D4',.8),(1,1,'E4',.8),(2,1,'G4',.9),(3,1,'E4',.7)],
    [(0,3,'D4',.85)],
    [(0,1,'E4',.9),(1,1,'G4',.8),(2,1,'A4',.9),(3,1,'C5',.95)],
    [(0,1,'A4',.85),(1,1,'G4',.8),(2,2,'E4',.8)],
    [(0,1,'G4',.9),(1,1,'E4',.8),(2,1,'D4',.75),(3,1,'E4',.8)],
    [(0,3.5,'C4',.95)],
]
for bar, notes in enumerate(melody):
    for beat0, lenb, name, vol in notes:
        t0 = (bar * 4 + beat0) * BEAT
        dur = lenb * BEAT * 0.92 if lenb < 3 else lenb * BEAT
        add_note(t0, dur + 1.2, NOTE[name], 0.30 * vol)  # +1.2s 让余韵自然衰减

# 和弦垫：C G Am F / C G F C，柔和高音区三和弦
chords = [('C3','G3','E4'), ('G2','D3','B3'), ('A2','E3','C4'), ('F3','A3','C4'),
          ('C3','G3','E4'), ('G2','D3','B3'), ('F3','A3','C4'), ('C3','G3','E4')]
for bar, ch in enumerate(chords):
    t0 = bar * 4 * BEAT
    dur = 4 * BEAT
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(t/0.4, 1.0) * np.minimum((dur - t)/0.5, 1.0).clip(0, 1)
    for name in ch:
        f = NOTE[name]
        w = np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*2*f*t)
        i0 = int(t0 * SR)
        mix[i0:i0+n] += 0.055 * env * w

# 轻回声（八分音符延迟），让声音更空灵
d = int(BEAT/2 * SR)
echo = np.zeros(M)
echo[d:] = mix[:M-d] * 0.28
mix = mix + echo

# 立体声：右声道延迟 0.6ms 做轻微展开
Npad = M  # 已含余韵缓冲
h = int(0.0006 * SR)
L = mix.copy()
R = np.zeros(M)
R[h:] = mix[:M-h]
peak = max(np.abs(L).max(), np.abs(R).max())
L *= 0.5 / peak; R *= 0.5 / peak

data = np.empty(Npad * 2, dtype=np.int16)
data[0::2] = (L * 32767).astype(np.int16)
data[1::2] = (R * 32767).astype(np.int16)
out = r'C:\Users\aa109\Desktop\AIGame\视频制作\视频1\_work\bgm.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print('bgm.wav ok, %.1fs' % (Npad / SR))
