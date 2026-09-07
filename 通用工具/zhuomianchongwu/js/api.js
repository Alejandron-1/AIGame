/* ============================================================
 * api.js · 前端 API 封装层
 * ============================================================
 * 设计：
 *   - 启动时探测后端是否可用
 *   - 后端可用 → API 模式（数据走 SQLite，多教师可共享）
 *   - 后端不可用 → 自动降级到本地模式（localStorage，单机）
 *   - 老师无感切换
 *
 * 鉴权：
 *   - 登录后 token 存 sessionStorage（关闭标签页失效，安全）
 *   - 写接口自动带 Authorization: Bearer <token>
 *   - 读接口（GET）不带 token 也能用，便于投影时直接打开
 * ============================================================ */

(function () {
  'use strict';

  const API_BASE = ''; // 同源
  const TOKEN_KEY = 'classpet.token';
  const TEACHER_KEY = 'classpet.teacher';
  const MODE_KEY = 'classpet.mode'; // 'api' | 'local'

  /* ---------- token 管理 ---------- */
  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TEACHER_KEY); }
  function getTeacher() {
    try { return JSON.parse(sessionStorage.getItem(TEACHER_KEY) || 'null'); }
    catch { return null; }
  }
  function setTeacher(t) { sessionStorage.setItem(TEACHER_KEY, JSON.stringify(t)); }

  function authHeaders() {
    const t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  /* ---------- 通用 fetch 封装 ---------- */
  async function request(method, url, { body, isForm } = {}) {
    const headers = { ...authHeaders() };
    let payload;
    if (body !== undefined) {
      if (isForm) {
        payload = body; // FormData，不要设 Content-Type
      } else {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
    }
    const resp = await fetch(API_BASE + url, { method, headers, body: payload });
    let data;
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await resp.json();
    else if (ct.includes('application/zip') || ct.includes('octet-stream')) {
      data = await resp.blob();
    } else {
      data = await resp.text();
    }
    if (!resp.ok) {
      const msg = (data && data.message) || ('HTTP ' + resp.status);
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const get  = (url) => request('GET', url);
  const post = (url, body, isForm = false) => request('POST', url, { body, isForm });
  const put  = (url, body) => request('PUT', url, { body });
  const del  = (url) => request('DELETE', url);

  /* ---------- 模式探测 ---------- */
  let _mode = null; // 'api' | 'local'

  async function detectMode() {
    if (_mode) return _mode;
    try {
      const r = await fetch(API_BASE + '/api/health', { method: 'GET' });
      if (r.ok) {
        _mode = 'api';
      } else {
        _mode = 'local';
      }
    } catch {
      _mode = 'local';
    }
    localStorage.setItem(MODE_KEY, _mode);
    return _mode;
  }

  function getMode() { return _mode || localStorage.getItem(MODE_KEY) || 'local'; }

  /* ---------- API 接口（后端模式）---------- */
  const Api = {
    /* 认证 */
    async login(username, password) {
      const r = await post('/api/auth/login', { username, password });
      if (r.success) { setToken(r.token); setTeacher(r.teacher); }
      return r;
    },
    async logout() {
      try { await post('/api/auth/logout'); } catch {}
      clearToken();
    },
    async changePassword(oldPwd, newPwd) {
      return post('/api/auth/change-password', { old_password: oldPwd, new_password: newPwd });
    },
    isLoggedIn() { return !!getToken(); },
    getTeacher() { return getTeacher(); },

    /* 学生 */
    async listStudents(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const r = await get('/api/students' + (qs ? '?' + qs : ''));
      return r.data;
    },
    async addStudent(s) { return post('/api/students', s); },
    async updateStudent(id, s) { return put('/api/students/' + id, s); },
    async deleteStudent(id) { return del('/api/students/' + id); },
    async importStudents(file) {
      const fd = new FormData();
      fd.append('file', file);
      return post('/api/students/import', fd, true);
    },
    async exportStudents() {
      // 触发下载
      const resp = await fetch(API_BASE + '/api/students/export', { headers: authHeaders() });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `students-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },

    /* 题库 */
    async listQuestions(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const r = await get('/api/questions' + (qs ? '?' + qs : ''));
      return r.data;
    },
    async randomQuestion(excludeId) {
      const qs = excludeId ? `?random=1&exclude=${excludeId}` : '?random=1';
      const r = await get('/api/questions' + qs);
      return r.data;
    },
    async addQuestion(q) { return post('/api/questions', q); },
    async updateQuestion(id, q) { return put('/api/questions/' + id, q); },
    async deleteQuestion(id) { return del('/api/questions/' + id); },
    async importQuestions(file) {
      const fd = new FormData();
      fd.append('file', file);
      return post('/api/questions/import', fd, true);
    },

    /* 课堂互动 */
    async addScore(studentId, score, reason = 'normal') {
      return post(`/api/students/${studentId}/add-score`, { score, reason });
    },
    async undoScore(studentId) {
      return post(`/api/students/${studentId}/undo-score`);
    },
    async scoreLogs(studentId) {
      const r = await get(`/api/students/${studentId}/score-logs`);
      return r.data;
    },

    /* 主题 */
    async listThemes() {
      const r = await get('/api/themes');
      return r.data;
    },
    async uploadTheme(file, name) {
      const fd = new FormData();
      fd.append('file', file);
      if (name) fd.append('name', name);
      return post('/api/themes/upload', fd, true);
    },
    async getActiveConfig() {
      const r = await get('/api/themes/active-config');
      return r.data;
    },
    async activateTheme(id) { return post(`/api/themes/${id}/activate`); },
    async deleteTheme(id) { return del(`/api/themes/${id}`); },

    /* 备份 */
    async backup() {
      const resp = await fetch(API_BASE + '/api/backup', { headers: authHeaders() });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `classpet-backup-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };

  /* ---------- 本地模式（降级，复用原 DataStore）---------- */
  const Local = {
    async login(username, password) {
      // 本地模式只校验默认密码
      if (password === (localStorage.getItem('classpet.localpwd') || 'classpet123')) {
        const fake = { token: 'local-' + Date.now(), teacher: { username: username || 'teacher', display_name: '老师（本地）' } };
        setToken(fake.token); setTeacher(fake.teacher);
        return { success: true, ...fake };
      }
      return { success: false, message: '本地模式默认密码 classpet123' };
    },
    async logout() { clearToken(); },
    isLoggedIn() { return !!getToken(); },
    getTeacher() { return getTeacher(); },
  };
  // 本地模式其它方法走 DataStore（已在 data.js 中实现），app.js 兼容调用

  /* ---------- 统一出口 ---------- */
  window.API = {
    detectMode, getMode,
    Api, Local,
    getToken, getTeacher,
    isLoggedIn: () => !!getToken(),
  };
})();
