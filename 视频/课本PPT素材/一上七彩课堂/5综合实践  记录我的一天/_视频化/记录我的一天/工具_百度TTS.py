# -*- coding: utf-8 -*-
"""百度翻译公开 TTS（fanyi.baidu.com/gettts），音色自然；源自 Downloads/tts/gen.py 的成熟写法
用法：from 工具_百度TTS import baidu_tts;  baidu_tts('台词', r'路径.mp3', spd=6)"""
import urllib.request
import urllib.parse
import http.cookiejar
import time
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

_opener = None

def _get_opener():
    global _opener
    if _opener is None:
        cj = http.cookiejar.CookieJar()
        _opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        _opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]
        try:
            _opener.open('https://fanyi.baidu.com', timeout=10)
        except Exception:
            pass
        time.sleep(1)
    return _opener

def baidu_tts(text, out_path, spd=6):
    """生成中文语音 mp3；失败抛异常。spd: 1~15，6 略快、清晰（历史验证好听）"""
    op = _get_opener()
    url = ('https://fanyi.baidu.com/gettts?lan=zh&text=' + urllib.parse.quote(text)
           + '&spd=%d&source=web' % spd)
    last = ''
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={
                'Referer': 'https://fanyi.baidu.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
            d = op.open(req, timeout=15).read()
            if len(d) > 500:
                with open(out_path, 'wb') as f:
                    f.write(d)
                return len(d)
            last = '响应过小(%d B)' % len(d)
        except Exception as e:
            last = str(e)[:80]
        time.sleep(3 + attempt * 4)
    raise RuntimeError('百度TTS失败: %s' % last)
