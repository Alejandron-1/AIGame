/* ============================================================
 * app.js · 课堂宠物主逻辑
 * ============================================================
 * 数据流：
 *   API.detectMode() → api / local
 *     api   → 所有数据走后端 SQLite，加分/撤销/抽题调 fetch
 *     local → 走 localStorage 降级（后端没启动时）
 *
 * 鉴权：
 *   - API 模式下，首次「进入课堂」时若未登录则弹登录框
 *   - token 存 sessionStorage，关闭标签页失效
 *   - 读接口不需要 token（投影时直接打开）
 * ============================================================ */

(function () {
  'use strict';

  /* ---------- 状态 ---------- */
  const state = {
    mode: 'api',           // 'api' | 'local'
    students: [],
    questions: [],
    className: '三年二班',
    currentStudentId: null,
    appMode: 'standby',    // standby | normal | quiz
    currentQuestion: null,
    countdown: { timer: null, remaining: 15, total: 15, running: false },
    logs: [],
    filterKeyword: '',
  };

  /* ---------- DOM 引用 ---------- */
  const $ = (sel) => document.querySelector(sel);
  const dom = {
    entryOverlay: $('#entry-overlay'),
    enterBtn: $('#enter-btn'),
    levelupOverlay: $('#levelup-overlay'),
    levelupName: $('#levelup-target'),
    levelupLevel: $('#levelup-level'),
    levelupStage: $('#levelup-stage'),
    statClass: $('#stat-class'),
    statCount: $('#stat-count'),
    statMode: $('#stat-mode'),
    statModeBadge: null, // 初始化时填充
    btnReset: $('#btn-reset'),
    btnDisplay: $('#btn-display'),
    searchInput: $('#search-input'),
    studentList: $('#student-list'),
    studentEmpty: $('#student-empty'),
    stageName: $('#stage-name'),
    stageScore: $('#stage-score'),
    stageLevel: $('#stage-level'),
    stageProgressFill: $('#stage-progress-fill'),
    stageProgressText: $('#stage-progress-text'),
    petHost: $('#pet-host'),
    petNameplate: $('#pet-nameplate'),
    stage: $('.stage'),
    modeCards: document.querySelectorAll('.mode-card'),
    questionCard: $('#question-card'),
    btnNextQuestion: $('#btn-next-question'),
    countdownNum: $('#countdown-num'),
    countdownRing: $('#countdown-ring'),
    cdProgress: $('#cd-progress'),
    btnQuizStart: $('#btn-quiz-start'),
    btnQuizStop: $('#btn-quiz-stop'),
    btnAdd1: $('#btn-add-1'),
    btnAdd3: $('#btn-add-3'),
    btnAdd5: $('#btn-add-5'),
    btnUndo: $('#btn-undo'),
    toastHost: $('#toast-host'),
  };

  /* ---------- 登录弹窗（API 模式用）---------- */
  function ensureLoginDialog() {
    let dlg = $('#login-dialog');
    if (dlg) return dlg;
    dlg = document.createElement('div');
    dlg.id = 'login-dialog';
    dlg.className = 'overlay';
    dlg.innerHTML = `
      <div class="overlay-card" style="max-width:380px">
        <div class="brand" style="font-size:28px">教师登录</div>
        <p class="overlay-sub" style="font-size:15px;margin-bottom:24px">默认账号 teacher / classpet123</p>
        <input id="login-username" class="search-input" style="margin-bottom:12px;padding:14px 18px;text-align:center" placeholder="账号" value="teacher" />
        <input id="login-password" class="search-input" type="password" style="margin-bottom:20px;padding:14px 18px;text-align:center" placeholder="密码" value="classpet123" />
        <div id="login-error" style="color:var(--tomato-d);font-size:13px;min-height:18px;margin-bottom:12px"></div>
        <div style="display:flex;gap:12px;justify-content:center">
          <button id="login-cancel" class="btn btn-ghost">取消</button>
          <button id="login-submit" class="btn btn-primary btn-xl" style="padding:14px 28px;font-size:16px">登录</button>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);
    return dlg;
  }

  async function showLoginDialog() {
    const dlg = ensureLoginDialog();
    dlg.classList.add('is-visible');
    return new Promise((resolve) => {
      const submit = $('#login-submit');
      const cancel = $('#login-cancel');
      const err = $('#login-error');
      const cleanup = () => {
        dlg.classList.remove('is-visible');
        submit.onclick = null; cancel.onclick = null;
      };
      submit.onclick = async () => {
        err.textContent = '';
        const u = $('#login-username').value.trim();
        const p = $('#login-password').value;
        try {
          const r = state.mode === 'api'
            ? await API.Api.login(u, p)
            : await API.Local.login(u, p);
          if (r.success) { cleanup(); resolve(true); }
          else { err.textContent = r.message || '登录失败'; }
        } catch (e) { err.textContent = e.message; }
      };
      cancel.onclick = () => { cleanup(); resolve(false); };
      $('#login-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') submit.click();
      });
    });
  }

  /* ---------- 工具（委托给 common.js）---------- */
  function toast(msg, kind) { Utils.toast(msg, kind || '', '#toast-host'); }
  function pad2(n) { return Utils.pad2(n); }
  function nowStr() { return Utils.nowTimeStr(); }
  function findStudent(id) { return state.students.find(s => s.id === id); }
  function escapeHtml(s) { return Utils.escapeHtml(s); }

  /* ---------- 渲染：学生列表 ---------- */
  function renderStudentList() {
    const kw = state.filterKeyword.trim().toLowerCase();
    const list = state.students.filter(s => !kw || s.name.toLowerCase().includes(kw) || String(s.student_id).toLowerCase().includes(kw));
    dom.studentList.innerHTML = '';
    if (list.length === 0) { dom.studentEmpty.classList.remove('is-hidden'); return; }
    dom.studentEmpty.classList.add('is-hidden');
    list.forEach(s => {
      const level = PetSprites.levelFromScore(s.score);
      const item = document.createElement('div');
      item.className = 'student-item' + (s.id === state.currentStudentId ? ' is-active' : '');
      item.role = 'listitem';
      item.dataset.id = s.id;
      item.innerHTML = `
        <div class="stu-pet-icon">${PetSprites.icon(level)}<span class="lv-badge">L${level}</span></div>
        <div class="stu-info">
          <div class="stu-name">${escapeHtml(s.name)}</div>
          <div class="stu-id">${escapeHtml(s.student_id || '')}</div>
        </div>
        <div class="stu-score">${s.score}</div>`;
      item.addEventListener('click', () => selectStudent(s.id));
      dom.studentList.appendChild(item);
    });
  }

  /* ---------- 渲染：舞台 ---------- */
  function renderStage() {
    const s = findStudent(state.currentStudentId);
    if (!s) {
      dom.stageName.textContent = '—'; dom.stageScore.textContent = '0';
      dom.stageLevel.textContent = 'LV.1';
      dom.stageProgressFill.style.width = '0%';
      dom.stageProgressText.textContent = '0 / 5';
      dom.petHost.innerHTML = '';
      dom.petNameplate.textContent = '未选择学生';
      setQuickScoreEnabled(false);
      return;
    }
    const level = PetSprites.levelFromScore(s.score);
    const next = PetSprites.nextThreshold(level);
    const cur = PetSprites.LEVEL_THRESHOLDS[level];
    const progress = next ? Math.min(100, Math.round((s.score - cur) / (next - cur) * 100)) : 100;
    dom.stageName.textContent = s.name;
    dom.stageScore.textContent = s.score;
    dom.stageLevel.textContent = 'LV.' + level;
    dom.stageProgressFill.style.width = progress + '%';
    dom.stageProgressText.textContent = next ? `${s.score} / ${next}` : '满级';
    dom.petHost.innerHTML = PetSprites.render(level);
    dom.petNameplate.textContent = `${s.name} · ${PetSprites.name(level)}`;
    setQuickScoreEnabled(true);
  }

  /* ---------- 渲染：顶栏 ---------- */
  function renderTopbar() {
    dom.statClass.textContent = state.className;
    dom.statCount.textContent = state.students.length;
    const modeText = { standby: '待机', normal: '答题', quiz: '抢答' };
    dom.statMode.textContent = modeText[state.appMode] || '待机';
    // 模式标记（API / 本地）
    if (!dom.statModeBadge) {
      const chip = document.createElement('div');
      chip.className = 'stat-chip';
      chip.innerHTML = `<span class="stat-label">数据</span><span id="stat-data-mode" class="stat-value">—</span>`;
      document.querySelector('.topbar-center').appendChild(chip);
      dom.statModeBadge = $('#stat-data-mode');
    }
    dom.statModeBadge.textContent = state.mode === 'api' ? '服务器' : '本地';
  }

  /* ---------- 选中学生 ---------- */
  function selectStudent(id) {
    state.currentStudentId = id;
    audioMgr.playClick();
    renderStudentList();
    renderStage();
  }

  /* ---------- 加分 ---------- */
  async function addScore(delta) {
    const s = findStudent(state.currentStudentId);
    if (!s) return;
    const oldLevel = PetSprites.levelFromScore(s.score);
    try {
      if (state.mode === 'api') {
        const r = await API.Api.addScore(s.id, delta, state.appMode);
        if (!r.success) throw new Error(r.message);
        s.score = r.current_score;
        const newLevel = r.pet_level;
        audioMgr.playScore();
        renderStudentList(); renderStage();
        if (r.leveled_up) triggerLevelUp(s, newLevel);
        else toast(`${s.name} +${delta} → ${s.score}分`, 'success');
      } else {
        // 本地模式
        s.score = Math.max(0, s.score + delta);
        const newLevel = PetSprites.levelFromScore(s.score);
        state.logs.push({ id: Date.now(), studentId: s.id, delta, time: nowStr() });
        DataStore.saveLogs(state.logs); DataStore.save(state);
        audioMgr.playScore();
        renderStudentList(); renderStage();
        if (newLevel > oldLevel) triggerLevelUp(s, newLevel);
        else toast(`${s.name} +${delta} → ${s.score}分`, 'success');
      }
    } catch (e) {
      toast('加分失败：' + e.message, 'error');
    }
  }

  /* ---------- 撤销 ---------- */
  async function undoLastScore() {
    const s = findStudent(state.currentStudentId);
    if (!s) return;
    try {
      if (state.mode === 'api') {
        const r = await API.Api.undoScore(s.id);
        if (!r.success) throw new Error(r.message);
        s.score = r.current_score;
        audioMgr.playUndo();
        renderStudentList(); renderStage();
        toast(`已撤销 ${s.name} 的 ${r.undone_delta} 分`, 'warn');
      } else {
        if (state.logs.length === 0) { toast('没有可撤销的操作', 'warn'); return; }
        const last = state.logs.pop();
        const target = findStudent(last.studentId);
        if (!target) { toast('找不到学生', 'error'); return; }
        target.score = Math.max(0, target.score - last.delta);
        DataStore.saveLogs(state.logs); DataStore.save(state);
        audioMgr.playUndo();
        renderStudentList(); renderStage();
        toast(`已撤销 ${target.name} 的 ${last.delta} 分`, 'warn');
      }
    } catch (e) {
      // 404/400 通常表示没有可撤销的记录
      toast(e.message || '撤销失败', e.status === 400 ? 'warn' : 'error');
    }
  }

  /* ---------- 升级特效 ---------- */
  function triggerLevelUp(student, newLevel) {
    dom.levelupName.textContent = student.name;
    dom.levelupLevel.textContent = 'LV.' + newLevel;
    dom.levelupStage.innerHTML = PetSprites.render(newLevel);
    dom.levelupOverlay.classList.add('is-visible');
    audioMgr.playUpgrade(newLevel);
    dom.petHost.classList.add('is-upgrading');
    setTimeout(() => dom.petHost.classList.remove('is-upgrading'), 600);
    const close = () => {
      dom.levelupOverlay.classList.remove('is-visible');
      dom.levelupOverlay.removeEventListener('click', close);
    };
    dom.levelupOverlay.addEventListener('click', close);
    setTimeout(close, 3000);
  }

  /* ---------- 课堂模式切换 ---------- */
  function setMode(mode) {
    state.appMode = mode;
    dom.modeCards.forEach(c => c.classList.toggle('is-active', c.dataset.mode === mode));
    renderTopbar();
    if (mode !== 'quiz') stopCountdown();
    if (mode === 'standby') {
      state.currentQuestion = null;
      renderQuestion();
      dom.btnNextQuestion.disabled = true;
      dom.btnQuizStart.disabled = true;
    } else {
      if (!state.currentQuestion) pickQuestion();
      dom.btnNextQuestion.disabled = false;
      dom.btnQuizStart.disabled = (mode !== 'quiz');
    }
    dom.btnQuizStop.disabled = true;
    if (mode === 'quiz' && state.countdown.running) dom.stage.classList.add('is-quiz-active');
    else dom.stage.classList.remove('is-quiz-active');
  }

  /* ---------- 抽题 ---------- */
  async function pickQuestion() {
    try {
      if (state.mode === 'api') {
        const q = await API.Api.randomQuestion(state.currentQuestion?.id);
        state.currentQuestion = q ? normalizeQuestion(q) : null;
      } else {
        if (state.questions.length === 0) { state.currentQuestion = null; }
        else {
          let q;
          do { q = state.questions[Math.floor(Math.random() * state.questions.length)]; }
          while (state.questions.length > 1 && q && q.id === state.currentQuestion?.id);
          state.currentQuestion = q;
        }
      }
      renderQuestion();
    } catch (e) {
      toast('抽题失败：' + e.message, 'error');
    }
  }

  /* 后端返回的 options 是 JSON 字符串，前端要转数组 */
  function normalizeQuestion(q) {
    if (!q) return null;
    if (typeof q.options === 'string') {
      try { q.options = JSON.parse(q.options); } catch {}
    }
    return q;
  }

  function renderQuestion() {
    const q = state.currentQuestion;
    if (!q) {
      dom.questionCard.innerHTML = `<div class="question-empty"><div class="empty-pixel sm"></div><p>题库已空</p></div>`;
      return;
    }
    const opts = q.options || [];
    const keys = ['A','B','C','D','E','F'];
    const optionsHtml = opts.map((opt, i) => `
      <div class="q-option" data-key="${keys[i]}">
        <span class="q-option-key">${keys[i]}</span><span>${escapeHtml(opt)}</span>
      </div>`).join('');
    dom.questionCard.innerHTML = `
      <div style="width:100%">
        <div class="q-text">${escapeHtml(q.question_text)}</div>
        <div class="q-options">${optionsHtml}</div>
        <p style="font-size:11px;color:var(--ink-3);margin-top:8px">点击选项揭示正确答案</p>
      </div>`;
    dom.questionCard.querySelectorAll('.q-option').forEach(el => {
      el.addEventListener('click', () => {
        dom.questionCard.querySelectorAll('.q-option').forEach(e => {
          e.classList.toggle('is-correct', e.dataset.key === q.correct_answer);
        });
        audioMgr.playClick();
      });
    });
  }

  /* ---------- 抢答倒计时 ---------- */
  const CD_TOTAL = 15;
  const CD_CIRCUMFERENCE = 2 * Math.PI * 54;

  function startCountdown() {
    if (state.countdown.running) return;
    state.countdown.running = true;
    state.countdown.remaining = CD_TOTAL;
    state.countdown.total = CD_TOTAL;
    dom.btnQuizStart.disabled = true;
    dom.btnQuizStop.disabled = false;
    dom.stage.classList.add('is-quiz-active');
    updateCountdownUI();
    audioMgr.playTick();
    state.countdown.timer = setInterval(() => {
      state.countdown.remaining--;
      updateCountdownUI();
      if (state.countdown.remaining <= 0) finishCountdown(true);
      else audioMgr.playTick();
    }, 1000);
  }
  function stopCountdown() {
    if (state.countdown.timer) { clearInterval(state.countdown.timer); state.countdown.timer = null; }
    state.countdown.running = false;
    dom.btnQuizStart.disabled = (state.appMode !== 'quiz');
    dom.btnQuizStop.disabled = true;
    dom.stage.classList.remove('is-quiz-active');
    dom.countdownRing.classList.remove('is-urgent');
    dom.cdProgress.style.strokeDashoffset = 0;
    dom.countdownNum.textContent = CD_TOTAL;
  }
  function finishCountdown(natural) {
    clearInterval(state.countdown.timer);
    state.countdown.timer = null;
    state.countdown.running = false;
    dom.btnQuizStart.disabled = (state.appMode !== 'quiz');
    dom.btnQuizStop.disabled = true;
    dom.stage.classList.remove('is-quiz-active');
    dom.countdownRing.classList.remove('is-urgent');
    dom.cdProgress.style.strokeDashoffset = 0;
    dom.countdownNum.textContent = CD_TOTAL;
    if (natural) { audioMgr.playBell(); toast('抢答时间到！', 'warn'); }
  }
  function updateCountdownUI() {
    const r = state.countdown.remaining;
    dom.countdownNum.textContent = r;
    const ratio = r / state.countdown.total;
    dom.cdProgress.style.strokeDashoffset = CD_CIRCUMFERENCE * (1 - ratio);
    dom.countdownRing.classList.toggle('is-urgent', r <= 5 && r > 0);
  }

  /* ---------- 启用/禁用加分按钮 ---------- */
  function setQuickScoreEnabled(enabled) {
    dom.btnAdd1.disabled = !enabled;
    dom.btnAdd3.disabled = !enabled;
    dom.btnAdd5.disabled = !enabled;
  }

  /* ---------- 重置 ---------- */
  async function resetApp() {
    if (state.mode === 'api') {
      toast('服务器模式下请用 Excel 导入清空重置', 'warn');
      return;
    }
    if (!confirm('确定要重置为默认示例数据吗？')) return;
    const fresh = DataStore.reset();
    state.students = fresh.students;
    state.questions = fresh.questions;
    state.className = fresh.className;
    state.currentStudentId = null;
    state.logs = [];
    setMode('standby');
    renderAll();
    toast('已重置为默认示例数据', 'success');
  }

  /* ---------- 渲染全部 ---------- */
  function renderAll() {
    renderTopbar();
    renderStudentList();
    renderStage();
    renderQuestion();
  }

  /* ---------- 加载数据 ---------- */
  async function loadData() {
    if (state.mode === 'api') {
      try {
        const students = await API.Api.listStudents();
        state.students = students || [];
        // 班级取第一个学生的
        if (state.students[0]) state.className = state.students[0].class_name || '三年二班';
      } catch (e) {
        toast('加载学生失败：' + e.message, 'error');
        state.students = [];
      }
    } else {
      const data = DataStore.load();
      state.students = data.students;
      state.questions = data.questions;
      state.className = data.className;
      state.logs = DataStore.loadLogs();
    }
  }

  /* ---------- 绑定事件 ---------- */
  function bindEvents() {
    dom.enterBtn.addEventListener('click', async () => {
      audioMgr.unlock();
      // API 模式需要登录；本地模式可选登录
      if (!API.isLoggedIn()) {
        const ok = await showLoginDialog();
        if (!ok) return; // 取消登录则不进入
      }
      dom.entryOverlay.classList.remove('is-visible');
      if (state.students.length > 0 && !state.currentStudentId) {
        selectStudent(state.students[0].id);
      }
    });

    dom.btnReset.addEventListener('click', resetApp);

    // 打开展示屏（新窗口，用于教室投屏）
    dom.btnDisplay.addEventListener('click', () => {
      const url = window.location.origin + '/display.html';
      const w = window.open(url, 'classpet-display', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
      if (w) {
        toast('已打开展示屏，请将窗口拖到投影仪上全屏', 'success');
      } else {
        toast('请允许弹出窗口，或手动访问：' + url, 'warn');
      }
    });

    dom.searchInput.addEventListener('input', e => {
      state.filterKeyword = e.target.value;
      renderStudentList();
    });

    dom.modeCards.forEach(c => c.addEventListener('click', () => setMode(c.dataset.mode)));

    dom.btnNextQuestion.addEventListener('click', () => { audioMgr.playClick(); pickQuestion(); });
    dom.btnQuizStart.addEventListener('click', startCountdown);
    dom.btnQuizStop.addEventListener('click', () => { stopCountdown(); toast('已手动停止抢答', ''); });

    dom.btnAdd1.addEventListener('click', () => addScore(1));
    dom.btnAdd3.addEventListener('click', () => addScore(3));
    dom.btnAdd5.addEventListener('click', () => addScore(5));
    dom.btnUndo.addEventListener('click', undoLastScore);

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === '1') addScore(1);
      else if (e.key === '3') addScore(3);
      else if (e.key === '5') addScore(5);
      else if (e.key.toLowerCase() === 'u') undoLastScore();
      else if (e.key.toLowerCase() === 'n') { if (!dom.btnNextQuestion.disabled) pickQuestion(); }
      else if (e.key === ' ') {
        e.preventDefault();
        if (state.appMode === 'quiz') state.countdown.running ? stopCountdown() : startCountdown();
      }
    });
  }

  /* ---------- 加载主题配置 ---------- */
  async function loadTheme() {
    if (state.mode !== 'api') return;
    try {
      const cfg = await API.Api.getActiveConfig();
      if (!cfg) return;
      // 解析 pet_config JSON 字符串
      var petImages = null;
      if (cfg.pet_config) {
        try { petImages = typeof cfg.pet_config === 'string'
          ? JSON.parse(cfg.pet_config) : cfg.pet_config; }
        catch (_) {}
      }
      if (petImages) {
        PetSprites.setPetImages(petImages);
      }
      // 等级名称
      var levelNames = null;
      if (cfg.config && cfg.config.pets && cfg.config.pets.levelNames) {
        levelNames = cfg.config.pets.levelNames;
      }
      if (levelNames) {
        PetSprites.setLevelNames(levelNames);
      }
      // 背景图
      if (cfg.background_url) {
        try {
          var stageEl = document.querySelector('.stage');
          if (stageEl) {
            stageEl.style.backgroundImage = 'url(' + cfg.background_url + ')';
            stageEl.style.backgroundSize = 'cover';
            stageEl.style.backgroundPosition = 'center';
            stageEl.classList.add('has-theme-bg');
          }
        } catch(_) {}
      }
      console.log('[Theme] 已加载活跃主题:', cfg.name,
        petImages ? '(' + Object.keys(petImages).length + ' 级宠物图)' : '');
    } catch (e) {
      console.warn('[Theme] 加载失败:', e.message);
    }
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    bindEvents();
    // 探测模式
    state.mode = await API.detectMode();
    renderTopbar();
    await loadData();
    await loadTheme();  // 加载主题配置
    renderAll();
    if (state.students.length > 0) {
      state.currentStudentId = state.students[0].id;
      renderStudentList();
      renderStage();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
