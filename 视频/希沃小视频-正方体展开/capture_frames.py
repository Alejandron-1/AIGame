#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""逐帧拍摄驱动：subprocess 原生启动 Edge headless，每帧独立配置目录+重试，直到拍满。"""
import os, sys, subprocess, time

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(HERE, 'frames')
TMP = r"C:\Users\aa109\AppData\Local\Temp"
URL = "http://127.0.0.1:8643/render_page.html?frame=%d"
TOTAL = 354
BUDGET = int(sys.argv[1]) if len(sys.argv) > 1 else 520   # 秒，时间预算

def capture(i, tag):
    f = os.path.join(FRAMES, 'frame_%04d.png' % i)
    for attempt in range(4):
        prof = os.path.join(TMP, 'edgep_%s_%d_%d' % (tag, i, attempt))
        cmd = [EDGE, '--headless=new', '--disable-gpu', '--use-angle=swiftshader',
               '--no-first-run', '--no-default-browser-check',
               '--window-size=1920,1080', '--hide-scrollbars',
               '--virtual-time-budget=4000', '--user-data-dir=' + prof,
               '--screenshot=' + f, URL % i]
        try:
            subprocess.run(cmd, capture_output=True, timeout=40)
        except Exception:
            pass
        if os.path.isfile(f) and os.path.getsize(f) > 10000:
            subprocess.run(['cmd', '/c', 'rmdir', '/s', '/q', prof],
                           capture_output=True)
            return True
        subprocess.run(['cmd', '/c', 'rmdir', '/s', '/q', prof],
                       capture_output=True)
        time.sleep(0.5)
    return False

def main():
    os.makedirs(FRAMES, exist_ok=True)
    t0 = time.time()
    done = 0
    missing = [i for i in range(TOTAL)
               if not os.path.isfile(os.path.join(FRAMES, 'frame_%04d.png' % i))]
    print('missing: %d frames' % len(missing), flush=True)
    fail_list = []
    for k, i in enumerate(missing):
        if time.time() - t0 > BUDGET:
            print('budget reached at %d' % i, flush=True)
            break
        ok = capture(i, 'a')
        done += 1 if ok else 0
        if not ok:
            fail_list.append(i)
        if (k+1) % 20 == 0:
            print('progress %d/%d (elapsed %ds)' % (k+1, len(missing), time.time()-t0), flush=True)
    # 对失败帧再补一轮
    if fail_list and time.time() - t0 < BUDGET:
        print('retrying %d failed frames' % len(fail_list), flush=True)
        still = []
        for i in fail_list:
            if time.time() - t0 > BUDGET:
                still.append(i); continue
            if capture(i, 'b'):
                done += 1
            else:
                still.append(i)
        fail_list = still
    total = sum(1 for i in range(TOTAL)
                if os.path.isfile(os.path.join(FRAMES, 'frame_%04d.png' % i)))
    print('RESULT: total=%d/%d, this-run-ok=%d, still-missing=%s'
          % (total, TOTAL, done, fail_list[:20]), flush=True)

if __name__ == '__main__':
    main()
