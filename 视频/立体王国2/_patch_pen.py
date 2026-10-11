# -*- coding: utf-8 -*-
"""翻页笔支持：游戏页可声明 keys(e) 拦截翻页笔按键；猜谜语页接入（揭晓/下一题/重播语音）"""
import io

p = r'C:/Users/aa109/Desktop/AIGame/小学一年级/图形小镇-公开课工具包/课件模板.html'
h = io.open(p, encoding='utf-8').read()
n0 = len(h)

# ① 全局 keydown：当前页声明了 keys(e) 且返回 true → 消费按键，不翻页
old = """addEventListener('keydown', e => {
    if (['ArrowRight','PageDown',' ','Enter'].includes(e.key)) { e.preventDefault(); go(cur+1); }"""
new = """addEventListener('keydown', e => {
    const curSlide = SLIDES[cur];
    if (curSlide && curSlide.keys && curSlide.keys(e)) { e.preventDefault(); return; }   /* 翻页笔优先控制当前游戏 */
    if (['ArrowRight','PageDown',' ','Enter'].includes(e.key)) { e.preventDefault(); go(cur+1); }"""
assert old in h, '①keydown'
h = h.replace(old, new)

# ② 猜谜语：主按钮逻辑抽成 el._primary / el._playAudio，并声明 keys
old = """        setPuzzle();
        abtn.onclick = () => {
            SND.click();
            if (audio) { audio.pause(); }
            audio = new Audio(G2_AUDIO[idx]);
            audio.play();
        };
    }
});"""
new = """        setPuzzle();
        const playRiddle = () => {
            SND.click();
            if (audio) { audio.pause(); }
            audio = new Audio(G2_AUDIO[idx]);
            el._audio = audio;
            audio.play();
        };
        /* 主按钮：未揭晓→开幕公布；已揭晓→下一题（自动朗读新谜语） */
        el._primary = () => {
            const wasRevealed = revealed;
            btn.click();
            if (wasRevealed) playRiddle();   /* 翻到新谜语自动朗读 */
        };
        el._playAudio = playRiddle;
        abtn.onclick = () => playRiddle();
    },
    /* 翻页笔按键桥：PageDown/→/Enter/空格=主按钮；PageUp/←/P=重播谜语 */
    keys(e) {
        const k = e.key;
        if (['PageDown','ArrowRight','Enter',' '].includes(k)) {
            if (this._el && this._el._primary) { this._el._primary(); return true; }
        }
        if (['PageUp','ArrowLeft','p','P'].includes(k)) {
            if (this._el && this._el._playAudio) { this._el._playAudio(); return true; }
        }
        return false;
    }
});"""
assert old in h, '②game2'
h = h.replace(old, new)

io.open(p, 'w', encoding='utf-8').write(h)
print('翻页笔按键桥完成，模板大小', len(h) - n0 + n0)
