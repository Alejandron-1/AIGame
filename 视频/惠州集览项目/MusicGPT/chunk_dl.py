# -*- coding: utf-8 -*-
"""多线程分块下载：逐块校验大小、拒绝HTML错误页，支持断点续传已下载块"""
import os
import sys
import threading
import urllib.request
import queue
import time

TARGET_URLS = [
    'https://gh-proxy.com/https://github.com/gabotechs/MusicGPT/releases/download/v0.3.28/musicgpt-x86_64-pc-windows-msvc.exe',
    'https://github.com/gabotechs/MusicGPT/releases/download/v0.3.28/musicgpt-x86_64-pc-windows-msvc.exe',
]
TOTAL = 12611918
CHUNK = 512 * 1024
NCHUNK = (TOTAL + CHUNK - 1) // CHUNK
OUT = r'C:\Users\aa109\Desktop\AIGame\视频制作\MusicGPT\musicgpt.exe'
DONE_MARK = OUT + '.done'

done = set()
if os.path.exists(DONE_MARK):
    done = set(int(x) for x in open(DONE_MARK).read().split() if x)
else:
    # 首次：清掉旧坏文件
    if os.path.exists(OUT):
        os.remove(OUT)
    open(OUT, 'wb').close()
    open(DONE_MARK, 'w').close()

# 预分配
with open(OUT, 'r+b') as f:
    f.truncate(TOTAL)

lock = threading.Lock()
q = queue.Queue()
for i in range(NCHUNK):
    if i not in done:
        q.put(i)

progress = {'bytes': len(done) * CHUNK, 'fail': 0}

def worker(wid):
    while True:
        try:
            idx = q.get_nowait()
        except queue.Empty:
            return
        lo = idx * CHUNK
        hi = min(TOTAL, lo + CHUNK) - 1
        want = hi - lo + 1
        got = None
        for attempt in range(8):
            url = TARGET_URLS[attempt % len(TARGET_URLS)]
            try:
                req = urllib.request.Request(url, headers={'Range': 'bytes=%d-%d' % (lo, hi)})
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                if len(data) == want and not data[:5].lower().startswith(b'<html'):
                    got = data
                    break
            except Exception:
                pass
            time.sleep(1 + attempt)
        if got is None:
            with lock:
                progress['fail'] += 1
            q.put(idx)   # 以后再试
            time.sleep(3)
            continue
        with lock:
            with open(OUT, 'r+b') as f:
                f.seek(lo)
                f.write(got)
            done.add(idx)
            with open(DONE_MARK, 'a') as mf:
                mf.write('%d ' % idx)
            progress['bytes'] += want
            print('%d/%d chunks, %.1f MB' % (len(done), NCHUNK, progress['bytes'] / 1048576.0), flush=True)

threads = [threading.Thread(target=worker, args=(i,), daemon=True) for i in range(6)]
for t in threads:
    t.start()
for t in threads:
    t.join()
# 漏网之鱼再扫一遍
missing = [i for i in range(NCHUNK) if i not in done]
print('missing:', missing[:10], 'total missing', len(missing))
if not missing:
    with open(DONE_MARK, 'w') as f:
        f.write(' '.join(str(i) for i in range(NCHUNK)))
    print('ALL_DONE')
