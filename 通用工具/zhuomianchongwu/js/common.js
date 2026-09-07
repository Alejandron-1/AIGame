/* ============================================================
 * common.js · 课堂宠物系统共享工具模块
 * ============================================================
 * 被 admin.html 和 index.html 共同引用。
 * 职责：HTML 转义、通用 API 封装、token 管理（admin 端）
 * ============================================================ */

(function () {
  'use strict';

  /* ---------- HTML 转义（防 XSS）---------- */
  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* 别名：兼容 app.js 中的 escapeHtml 调用 */
  function escapeHtml(str) { return esc(str); }

  /* ---------- 时间格式化 ---------- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function nowTimeStr() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function nowDateStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ---------- 防抖 ---------- */
  function debounce(fn, delay) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  /* ---------- 通用 toaster（适配不同 DOM 结构）---------- */
  /* 两种用法：
   *   1. Utils.toast(msg, type)     → 查找 #toast（admin 端单元素模式）
   *   2. Utils.toast(msg, type, el) → 查找指定宿主（课堂端多 toast 模式）
   */
  function toast(msg, type, hostSelector) {
    // 先尝试 admin 端模式（单元素 #toast）
    var singleEl = document.getElementById('toast');
    if (singleEl) {
      singleEl.textContent = msg;
      singleEl.className = 'toast show ' + (type || '');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { singleEl.className = 'toast'; }, 2200);
      return;
    }
    // 课堂端模式（多 toast，注入到 #toast-host）
    var host = hostSelector ? document.querySelector(hostSelector) : document.getElementById('toast-host');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' is-' + type : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 300);
    }, 1800);
  }

  /* ---------- 通用 API 封装（admin 端用）---------- */
  var ADMIN_TOKEN_KEY = 'admin_token';
  function adminGetToken() { return sessionStorage.getItem(ADMIN_TOKEN_KEY); }
  function adminSetToken(t) { sessionStorage.setItem(ADMIN_TOKEN_KEY, t); }
  function adminClearToken() { sessionStorage.removeItem(ADMIN_TOKEN_KEY); sessionStorage.removeItem('admin_user'); }

  async function adminApi(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers);
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    var token = adminGetToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res = await fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body });
    var ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      var data = await res.json();
      if (!res.ok && !data.success) throw new Error(data.message || '请求失败');
      return data;
    }
    return res;
  }

  /* ---------- 批量选中管理 ---------- */
  /* 用于管理员端的复选框批量操作 */
  function createSelectionManager(getRowSelector) {
    var selected = new Set();
    var allChecked = false;

    function toggleAll(checked, rowContainerSelector) {
      allChecked = checked;
      selected.clear();
      var rows = document.querySelectorAll(rowContainerSelector + ' ' + (getRowSelector || '.data-table tbody tr'));
      rows.forEach(function (tr) {
        var cb = tr.querySelector('.row-cb');
        if (cb) cb.checked = checked;
        if (checked) selected.add(+tr.dataset.id);
      });
    }

    function toggleOne(id, checked) {
      checked ? selected.add(+id) : selected.delete(+id);
      allChecked = false;
    }

    function getIds() { return Array.from(selected); }
    function clear() { selected.clear(); allChecked = false; }
    function count() { return selected.size; }

    function renderBatchBar(barEl, countEl, btnEl) {
      var cnt = selected.size;
      barEl.style.display = cnt > 0 ? 'flex' : 'none';
      if (countEl) countEl.textContent = cnt;
      if (btnEl) btnEl.disabled = cnt === 0;
    }

    return { toggleAll: toggleAll, toggleOne: toggleOne, getIds: getIds, clear: clear, count: count, renderBatchBar: renderBatchBar, isAllChecked: function () { return allChecked; } };
  }

  /* ---------- 导出 ---------- */
  window.Utils = {
    esc: esc,
    escapeHtml: escapeHtml,
    pad2: pad2,
    nowTimeStr: nowTimeStr,
    nowDateStr: nowDateStr,
    debounce: debounce,
    toast: toast,
    adminGetToken: adminGetToken,
    adminSetToken: adminSetToken,
    adminClearToken: adminClearToken,
    adminApi: adminApi,
    createSelectionManager: createSelectionManager,
  };
})();
