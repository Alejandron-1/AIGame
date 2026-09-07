/* ============================================================
 * display.js · 课堂展示屏逻辑
 * 功能：轮询同步教师端操作、渲染宠物、升级动画、飘分
 * ============================================================ */

(function () {
  'use strict';

  /* ---------- 配置 ---------- */
  const POLL_INTERVAL = 2500;         // 轮询间隔（毫秒）
  const API_BASE     = '';             // 同源部署，空字符串

  /* ---------- 状态 ---------- */
  let state = {
    currentStudentId: null,            // 当前展示的学生 ID
    lastScore: null,                   // 上次分数（用于检测变化）
    lastLevel: null,                   // 上次等级
    students: [],                      // 全班学生列表
    themeConfig: null,                 // 当前主题配置 { petImages, ... }
    pollTimer: null,                   // 轮询定时器
    isLevelupPlaying: false,           // 升级动画是否进行中
  };

  /* ---------- DOM 引用 ---------- */
  const $ = (sel) => document.querySelector(sel);
  const dom = {
    petImageWrap:      $('#pet-image-wrap'),
    petPlaceholder:    $('#pet-placeholder'),
    petLevelLabel:     $('#pet-level-label'),
    petNameText:       $('#pet-name-text'),
    studentName:       $('#student-name'),
    scoreNum:          $('#score-num'),
    progressFill:      $('#progress-fill'),
    progressText:      $('#progress-text'),
    nameplate:         $('#nameplate'),
    classPreview:      $('#class-preview'),
    levelupFx:         $('#levelup-fx'),
    levelupStage:      $('#levelup-pet-stage'),
    levelupLevel:      $('#levelup-new-level'),
    levelupName:       $('#levelup-pet-name'),
    levelupParticles:  $('#levelup-particles'),
    floatLayer:        $('#float-score-layer'),
    syncStatus:        $('#sync-status'),
    sparkleLayer:      $('#sparkle-layer'),
  };

  /* ---------- 工具函数 ---------- */
  const LEVEL_THRESHOLDS = [0, 5, 12, 22, 35, 55, 80, 115, 160, 220, 300];

  function getLevelFromScore(score) {
    let lv = 1;
    for (let i = 1; i <= 10; i++) {
      if (score >= LEVEL_THRESHOLDS[i]) lv = i;
    }
    return lv;
  }

  function getNextThreshold(level) {
    return level >= 10 ? null : LEVEL_THRESHOLDS[level + 1];
  }

  function getProgress(score, level) {
    const currentThreshold = LEVEL_THRESHOLDS[level] || 0;
    const nextThreshold = getNextThreshold(level);
    if (!nextThreshold) return { percent: 100, current: 0, needed: 0 };
    const progress = score - currentThreshold;
    const total = nextThreshold - currentThreshold;
    return {
      percent: Math.min(100, Math.round((progress / total) * 100)),
      current: progress,
      needed: total,
    };
  }

  /* ---------- 获取主题宠物图片 URL ---------- */
  function getPetImageUrl(level) {
    // 返回该等级对应的宠物图片 URL（优先精灵大图）
    if (!state.themeConfig) return null;
    const images = state.themeConfig.petImages;
    if (!images) return null;
    // 精确匹配
    if (images[level] && images[level].length > 0) return images[level][0];
    // 降级：找最接近的已有等级
    let closest = 1;
    for (let i = 1; i <= level; i++) {
      if (images[i] && images[i].length > 0) closest = i;
    }
    return images[closest] ? images[closest][0] : null;
  }

  /* ---------- 渲染宠物图片 ---------- */
  function renderPetImage(level) {
    const imgUrl = getPetImageUrl(level);

    // 移除旧图片
    const oldImg = dom.petImageWrap.querySelector('img');
    if (oldImg) oldImg.remove();

    if (!imgUrl) {
      dom.petPlaceholder.classList.remove('is-hidden');
      return;
    }

    dom.petPlaceholder.classList.add('is-hidden');

    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = `宠物 LV.${level}`;
    img.draggable = false;
    img.style.opacity = '0';
    img.style.transform = 'scale(0.8)';
    img.onload = () => {
      requestAnimationFrame(() => {
        img.style.transition = 'opacity 0.5s, transform 0.5s cubic-bezier(.34,1.56,.64,1)';
        img.style.opacity = '1';
        img.style.transform = 'scale(1)';
      });
    };
    dom.petImageWrap.appendChild(img);
  }

  /* ---------- 渲染学生信息 ---------- */
  function renderStudent(student) {
    if (!student) return;
    const level = getLevelFromScore(student.score);
    const prog  = getProgress(student.score, level);

    dom.studentName.textContent = student.name;
    dom.petNameText.textContent = student.name;
    dom.petLevelLabel.textContent = `LV.${level}`;

    // 分数动画
    const scoreEl = dom.scoreNum;
    scoreEl.textContent = student.score;
    scoreEl.classList.remove('is-bump');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('is-bump');

    // 进度条
    dom.progressFill.style.width = prog.percent + '%';
    dom.progressText.textContent = prog.needed > 0
      ? `距下一级：${prog.current} / ${prog.needed}`
      : '已满级！♛';

    renderPetImage(level);

    // 更新底部预览高亮
    updatePreviewActive(student.id);
  }

  /* ---------- 飘分效果 ---------- */
  function showFloatScore(delta) {
    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = `+${delta}`;
    el.style.left = `${25 + Math.random() * 50}%`;
    el.style.top  = `${45 + Math.random() * 25}%`;
    dom.floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  /* ---------- Web Audio API 升级音效 ---------- */
  function playLevelupSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;

      // 欢快上升音阶
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.5);
      });

      // 最后加一个闪亮的高音
      const sparkle = ctx.createOscillator();
      const sparkleGain = ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.value = 1567.98; // G6
      sparkleGain.gain.setValueAtTime(0.12, now + 0.6);
      sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      sparkle.connect(sparkleGain);
      sparkleGain.connect(ctx.destination);
      sparkle.start(now + 0.6);
      sparkle.stop(now + 1.2);
    } catch (_) {}
  }

  /* ---------- 升级全屏特效 ---------- */
  function playLevelupAnimation(student, newLevel) {
    state.isLevelupPlaying = true;
    const imgUrl = getPetImageUrl(newLevel);

    // 设置升级展示图
    dom.levelupStage.innerHTML = '';
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = `LV.${newLevel}`;
      dom.levelupStage.appendChild(img);
    }

    dom.levelupLevel.textContent = `LV.${newLevel}`;
    // 从主题配置取等级名称
    let levelName = '';
    if (state.themeConfig && state.themeConfig.levelNames) {
      levelName = state.themeConfig.levelNames[newLevel] || '';
    }
    dom.levelupName.textContent = levelName
      ? `${student.name} → ${levelName}！`
      : `${student.name} 升级了！`;

    // 粒子
    dom.levelupParticles.innerHTML = '';
    const colors = ['#ff8fab', '#ffd166', '#7fd8ae', '#8ecae6', '#c8b6ff', '#ff6b6b', '#ffd93d'];
    for (let i = 0; i < 36; i++) {
      const el = document.createElement('div');
      el.className = 'levelup-particle';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      const angle = (Math.PI * 2 * i) / 36;
      const dist  = 80 + Math.random() * 220;
      const x     = Math.cos(angle) * dist;
      const y     = Math.sin(angle) * dist;
      el.animate([
        { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
        { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0)`, opacity: 0 }
      ], { duration: 1000 + Math.random() * 800, easing: 'ease-out', fill: 'forwards' });
      dom.levelupParticles.appendChild(el);
    }

    // 显示
    dom.levelupFx.classList.remove('is-hidden');

    // 播放音效
    playLevelupSound();

    // 3.5 秒后关闭
    setTimeout(() => {
      dom.levelupFx.classList.add('is-hidden');
      state.isLevelupPlaying = false;
      renderPetImage(newLevel);
      const container = document.querySelector('.pet-container');
      container.classList.add('is-upgrading');
      setTimeout(() => container.classList.remove('is-upgrading'), 1000);
    }, 3500);
  }

  /* ---------- 底部全班预览 ---------- */
  function renderClassPreview(students) {
    dom.classPreview.innerHTML = '';
    students.forEach(stu => {
      const level = getLevelFromScore(stu.score);
      const imgUrl = getPetImageUrl(level);

      const item = document.createElement('div');
      item.className = 'preview-item' + (stu.id === state.currentStudentId ? ' is-active' : '');
      item.dataset.studentId = stu.id;

      let avatarHtml = '🐾';
      if (imgUrl) {
        avatarHtml = `<img src="${imgUrl}" alt="${Utils.esc(stu.name)}" />`;
      }
      item.innerHTML = `
        <div class="preview-avatar">${avatarHtml}</div>
        <div class="preview-name">${Utils.esc(stu.name)}</div>
        <div class="preview-level">LV.${level}</div>
      `;
      item.addEventListener('click', () => {
        state.currentStudentId = stu.id;
        const s = state.students.find(s => s.id === stu.id);
        if (s) renderStudent(s);
      });
      dom.classPreview.appendChild(item);
    });
  }

  function updatePreviewActive(studentId) {
    dom.classPreview.querySelectorAll('.preview-item').forEach(el => {
      el.classList.toggle('is-active', +el.dataset.studentId === studentId);
    });
  }

  /* ---------- 星星装饰 ---------- */
  function initSparkles() {
    const colors = ['', 'coral', 'mint', 'sky', 'lavender'];
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle' + (colors[i % colors.length] ? ' ' + colors[i % colors.length] : '');
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDelay    = (Math.random() * 6) + 's';
      s.style.animationDuration  = (4 + Math.random() * 5) + 's';
      s.style.width  = (4 + Math.random() * 10) + 'px';
      s.style.height = s.style.width;
      dom.sparkleLayer.appendChild(s);
    }
  }

  /* ============================================================
     数据加载 & 轮询
     ============================================================ */

  async function loadThemeConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/themes/active-config`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;
      const cfg = data.data;
      // 解析 pet_config（可能是 JSON 字符串或已解析对象）
      let petImages = null;
      if (cfg.pet_config) {
        try {
          petImages = typeof cfg.pet_config === 'string'
            ? JSON.parse(cfg.pet_config) : cfg.pet_config;
        } catch (_) { petImages = null; }
      }
      // 解析等级名称
      let levelNames = {};
      if (cfg.config && cfg.config.pets && cfg.config.pets.levelNames) {
        levelNames = cfg.config.pets.levelNames;
      }
      state.themeConfig = { petImages, levelNames };
    } catch (_) {}
  }

  async function loadStudents() {
    try {
      const res = await fetch(`${API_BASE}/api/students`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      state.students = data.data || [];

      if (!state.currentStudentId && state.students.length > 0) {
        state.currentStudentId = state.students[0].id;
      }

      renderClassPreview(state.students);

      const current = state.students.find(s => s.id === state.currentStudentId);
      if (current) renderStudent(current);

      dom.syncStatus.textContent = '● 已同步';
      dom.syncStatus.classList.remove('is-error');
    } catch (_) {
      dom.syncStatus.textContent = '● 断开';
      dom.syncStatus.classList.add('is-error');
    }
  }

  async function poll() {
    if (!state.currentStudentId) return;

    try {
      const res = await fetch(`${API_BASE}/api/students/${state.currentStudentId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const student = data.data;
      const newLevel = getLevelFromScore(student.score);

      if (state.lastScore !== null && student.score > state.lastScore) {
        showFloatScore(student.score - state.lastScore);
      }

      if (state.lastLevel !== null && newLevel > state.lastLevel && !state.isLevelupPlaying) {
        playLevelupAnimation(student, newLevel);
      }

      state.lastScore = student.score;
      state.lastLevel = newLevel;

      renderStudent(student);

      // 同步更新全班列表
      const idx = state.students.findIndex(s => s.id === student.id);
      if (idx >= 0) state.students[idx] = student;
      renderClassPreview(state.students);

      dom.syncStatus.textContent = '● 已同步';
      dom.syncStatus.classList.remove('is-error');
    } catch (_) {
      dom.syncStatus.textContent = '● 重试中';
      dom.syncStatus.classList.add('is-error');
    }
  }

  async function fullRefresh() {
    await Promise.all([loadStudents(), loadThemeConfig()]);
  }

  /* ============================================================
     初始化
     ============================================================ */
  async function init() {
    initSparkles();
    await loadThemeConfig();
    await loadStudents();

    const current = state.students.find(s => s.id === state.currentStudentId);
    if (current) {
      state.lastScore = current.score;
      state.lastLevel = getLevelFromScore(current.score);
    }

    state.pollTimer = setInterval(poll, POLL_INTERVAL);
    setInterval(fullRefresh, 30000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) poll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
