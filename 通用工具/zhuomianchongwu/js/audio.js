/* ============================================================
 * audio.js · Web Audio 合成音效
 * ============================================================
 * 设计说明：
 *   - 占位阶段不依赖任何外部 mp3，全部用 Web Audio API 合成
 *   - 老师后续若想替换为真实音效，只需把对应方法内的合成代码
 *     换成 new Audio('/sounds/xxx.mp3').play() 即可
 *   - 浏览器音频策略要求首次用户交互后才能播放，所以提供 unlock()
 * ============================================================ */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._unlocked = false;
  }

  /** 初始化 AudioContext（必须在用户点击后调用） */
  unlock() {
    if (this._unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4; // 总音量 40%
      this.master.connect(this.ctx.destination);
      // 播放一个极轻的空音来真正解锁
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master);
      src.start(0);
      this._unlocked = true;
    } catch (e) {
      console.warn('[audio] 解锁失败', e);
    }
  }

  /** 当前是否已解锁 */
  get unlocked() { return this._unlocked; }

  /* ---------- 基础合成单元 ---------- */

  /** 单音 osc → gain → master，自动停止 */
  _tone({ freq, type = 'square', dur = 0.15, gain = 0.3, delay = 0, glide = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 噪声脉冲（用于铃声） */
  _noise({ dur = 0.2, gain = 0.2, delay = 0, filterFreq = 2000 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---------- 业务音效 ---------- */

  /** 升级音效（LV1-9 通用上升音阶；LV10 走 maxLevel） */
  playUpgrade(level) {
    if (!this._unlocked) return;
    if (level >= 10) { this.playMaxLevel(); return; }
    // 8-bit 上升音阶：C5 → E5 → G5 → C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      this._tone({ freq: f, type: 'square', dur: 0.14, gain: 0.28, delay: i * 0.10 });
    });
    // 顶部点缀一个高音
    this._tone({ freq: 1568, type: 'triangle', dur: 0.20, gain: 0.18, delay: 0.42 });
  }

  /** 满级专属华丽音效（和弦 + 上行琶音 + 钟铃） */
  playMaxLevel() {
    if (!this._unlocked) return;
    // 上行琶音 C-E-G-C-E-G-C
    const arp = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1568, 2093];
    arp.forEach((f, i) => {
      this._tone({ freq: f, type: 'triangle', dur: 0.18, gain: 0.22, delay: i * 0.08 });
    });
    // 三和弦垫底
    [523.25, 659.25, 783.99].forEach(f => {
      this._tone({ freq: f, type: 'sawtooth', dur: 0.6, gain: 0.10, delay: 0.56 });
    });
    // 钟铃（高频脉冲）
    this._tone({ freq: 2637, type: 'sine', dur: 0.5, gain: 0.18, delay: 0.56 });
    this._tone({ freq: 3136, type: 'sine', dur: 0.5, gain: 0.14, delay: 0.62 });
  }

  /** 抢答倒计时滴答声（每秒一次） */
  playTick() {
    if (!this._unlocked) return;
    this._tone({ freq: 880, type: 'square', dur: 0.06, gain: 0.25 });
    this._tone({ freq: 440, type: 'square', dur: 0.06, gain: 0.15, delay: 0.02 });
  }

  /** 抢答结束铃声 */
  playBell() {
    if (!this._unlocked) return;
    // 双音铃声 + 噪声
    this._tone({ freq: 1175, type: 'triangle', dur: 0.35, gain: 0.30 });
    this._tone({ freq: 1568, type: 'triangle', dur: 0.35, gain: 0.22, delay: 0.05 });
    this._noise({ dur: 0.15, gain: 0.10, delay: 0.0, filterFreq: 3000 });
  }

  /** 按钮按下小反馈音 */
  playClick() {
    if (!this._unlocked) return;
    this._tone({ freq: 660, type: 'square', dur: 0.04, gain: 0.15 });
  }

  /** 加分成功 */
  playScore() {
    if (!this._unlocked) return;
    this._tone({ freq: 784, type: 'square', dur: 0.08, gain: 0.20 });
    this._tone({ freq: 1046.5, type: 'square', dur: 0.10, gain: 0.20, delay: 0.06 });
  }

  /** 撤销 */
  playUndo() {
    if (!this._unlocked) return;
    this._tone({ freq: 440, type: 'square', dur: 0.08, gain: 0.20 });
    this._tone({ freq: 330, type: 'square', dur: 0.10, gain: 0.18, delay: 0.06 });
  }
}

window.audioMgr = new AudioManager();
