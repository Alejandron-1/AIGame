/* ============================================================
 * admin.js · 管理员端逻辑
 * 依赖 common.js（提供 Utils.esc, Utils.toast, Utils.adminApi 等）
 * ============================================================ */

/* 别名：简化调用 */
var esc = Utils.esc;
var toast = Utils.toast;
var api = Utils.adminApi;
var getToken = Utils.adminGetToken;
var adminClearAuth = function () { Utils.adminClearToken(); sessionStorage.removeItem(USER_KEY); };

/* 移除 admin.js 内联的 esc / toast / api / getToken / setToken / clearAuth 定义，
 * 全部委托给 common.js 中的 Utils 工具 */

/* ---------- admin 端特有的工具 ---------- */
const USER_KEY = 'admin_user';
function getUser() { try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; } }
function setTokenAndUser(t, user) { Utils.adminSetToken(t); sessionStorage.setItem(USER_KEY, JSON.stringify(user)); }

/* ---------- 模态框 ---------- */
function openModal({ title, bodyHTML, footHTML, onMount }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-mask" id="modal-mask">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="modal-close" id="modal-close">×</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; };
  document.getElementById('modal-mask').addEventListener('click', close);
  document.getElementById('modal-close').addEventListener('click', close);
  if (onMount) onMount(document, close);
  return close;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function confirmModal(msg, onOk) {
  openModal({
    title: '确认操作',
    bodyHTML: `<p style="font-size:14px;line-height:1.7">${msg}</p>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="confirm-ok">确定</button>`,
    onMount: (_, close) => {
      document.getElementById('confirm-ok').onclick = () => { close(); onOk(); };
    }
  });
}

/* ============================================================
 * 登录
 * ============================================================ */
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!username || !password) return toast('请输入账号和密码', 'error');
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (data.role !== 'admin') {
      return toast('该账号不是管理员，无法登录管理端', 'error');
    }
    setTokenAndUser(data.token, data.teacher);
    showApp();
    toast('登录成功', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  adminClearAuth();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-overlay').classList.remove('hidden');
});

function showApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const u = getUser();
  document.getElementById('user-badge').textContent = `👤 ${u.display_name || u.username}（管理员）`;
  switchView('dashboard');
}

/* ============================================================
 * 路由
 * ============================================================ */
const VIEW_TITLES = {
  dashboard: '仪表盘', classes: '班级管理', questions: '题库管理',
  teachers: '教师管理', themes: '主题管理', backup: '数据备份',
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const view = item.dataset.view;
    switchView(view);
  });
});

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('is-active', n.dataset.view === view));
  document.getElementById('view-title').textContent = VIEW_TITLES[view] || '';
  const render = VIEWS[view];
  if (!render) {
    console.error('[admin] 未知视图:', view);
    return;
  }
  try {
    render();
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="empty"><div class="empty-icon">❌</div><p>页面加载失败</p><p class="muted">${Utils.esc(err.message)}</p></div>`;
    console.error('[admin] 视图渲染错误:', err);
  }
}

const VIEWS = {};

/* ============================================================
 * 仪表盘
 * ============================================================ */
VIEWS.dashboard = async function () {
  const el = document.getElementById('content');
  el.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div><p>加载中…</p></div>`;
  try {
    const { data } = await api('/api/stats');
    const c = data.counts;
    const maxLevel = Math.max(1, ...data.levelDist.map(x => x.count));
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card c-primary"><div class="stat-icon">👧</div><div class="stat-value">${c.students}</div><div class="stat-label">学生总数</div></div>
        <div class="stat-card c-mint"><div class="stat-icon">📝</div><div class="stat-value">${c.questions}</div><div class="stat-label">题库数量</div></div>
        <div class="stat-card c-sky"><div class="stat-icon">🏫</div><div class="stat-value">${c.classes}</div><div class="stat-label">班级数量</div></div>
        <div class="stat-card c-sun"><div class="stat-icon">👤</div><div class="stat-value">${c.activeTeachers}</div><div class="stat-label">启用教师</div></div>
      </div>
      <div class="flex" style="flex-wrap:wrap">
        <div class="card" style="flex:1;min-width:300px">
          <div class="card-title">🏫 班级分布</div>
          <div class="distribution">
            ${data.classes.length ? data.classes.map(cl => {
              const max = Math.max(1, ...data.classes.map(x => x.count));
              return `<div class="dist-row"><div class="dist-label">${esc(cl.class_name)}</div>
                <div class="dist-bar"><div class="dist-fill" style="width:${(cl.count/max*100).toFixed(0)}%;background:var(--sky)"></div></div>
                <div class="dist-num">${cl.count}</div></div>`;
            }).join('') : '<div class="muted">暂无班级</div>'}
          </div>
        </div>
        <div class="card" style="flex:1;min-width:300px">
          <div class="card-title">🐾 宠物等级分布</div>
          <div class="distribution">
            ${data.levelDist.length ? data.levelDist.map(lv => `
              <div class="dist-row"><div class="dist-label">LV.${lv.pet_level}</div>
              <div class="dist-bar"><div class="dist-fill" style="width:${(lv.count/maxLevel*100).toFixed(0)}%;background:var(--grape)"></div></div>
              <div class="dist-num">${lv.count}</div></div>`).join('') : '<div class="muted">暂无数据</div>'}
          </div>
        </div>
      </div>
      <div class="flex" style="flex-wrap:wrap">
        <div class="card" style="flex:1;min-width:300px">
          <div class="card-title">📈 近 7 天加分趋势</div>
          ${data.trend.length ? `<div class="distribution">${data.trend.map(t => {
            const maxT = Math.max(1, ...data.trend.map(x => x.times));
            return `<div class="dist-row"><div class="dist-label">${t.day.slice(5)}</div>
              <div class="dist-bar"><div class="dist-fill" style="width:${(t.times/maxT*100).toFixed(0)}%;background:var(--mint)"></div></div>
              <div class="dist-num">${t.times}</div></div>`;
          }).join('')}</div>` : '<div class="muted">近 7 天暂无加分记录</div>'}
          <p class="info-line" style="margin-top:12px">今日加分 <b>${data.today.times}</b> 次，合计 <b>${data.today.total}</b> 分</p>
        </div>
        <div class="card" style="flex:1;min-width:300px">
          <div class="card-title">🏆 积分榜 Top 5</div>
          ${data.topStudents.length ? `<table class="data-table"><tbody>
            ${data.topStudents.map((s, i) => `<tr>
              <td><span class="badge ${['badge-sun','badge-gray','badge-sun','badge-gray','badge-gray'][i]}">${i+1}</span></td>
              <td><b>${esc(s.name)}</b></td><td class="muted">${esc(s.class_name)}</td>
              <td><span class="badge badge-grape">LV.${s.pet_level}</span></td>
              <td class="mono"><b>${s.score}</b></td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="muted">暂无学生</div>'}
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">😵</div><p>${esc(err.message)}</p></div>`;
  }
};

/* ============================================================
 * 班级管理（含学生管理 —— 学生从属于班级）
 * 布局：左侧班级列表，右侧选中班级的学生列表
 * ============================================================ */
let classState = { selectedId: null, keyword: '', classSelection: Utils.createSelectionManager() };
let questionSel = Utils.createSelectionManager();
let teacherSel = Utils.createSelectionManager();

VIEWS.classes = async function () {
  var el = document.getElementById('content');
  el.innerHTML = `
    <div class="class-layout">
      <!-- 左：班级列表 -->
      <div class="class-side card">
        <div class="class-side-head">
          <h3>🏫 班级</h3>
          <div class="flex gap-sm">
            <button class="btn btn-primary btn-sm" id="cls-add">＋ 新建</button>
          </div>
        </div>
        <!-- 班级批量操作栏 -->
        <div class="batch-bar" id="cls-batch-bar" style="display:none">
          <span>已选 <span class="batch-count" id="cls-batch-count">0</span> 个班级</span>
          <button class="btn btn-danger btn-xs" id="cls-batch-del-btn">🗑 批量删除</button>
        </div>
        <div class="class-list" id="cls-list"></div>
      </div>
      <!-- 右：学生列表 -->
      <div class="class-main">
        <div class="toolbar">
          <div id="cls-title" class="cls-title">请选择左侧班级</div>
          <input class="search-box" id="stu-search" placeholder="搜索学号 / 姓名…" ${classState.selectedId?'':'disabled'}>
          <button class="btn btn-primary" id="stu-add" disabled>＋ 新增学生</button>
          <button class="btn btn-mint" id="stu-import" disabled>📥 导入到本班</button>
          <button class="btn btn-ghost" id="stu-export" disabled>⬇ 导出</button>
        </div>
        <!-- 学生批量操作栏 -->
        <div class="batch-bar" id="stu-batch-bar" style="display:none">
          <span>已选 <span class="batch-count" id="stu-batch-count">0</span> 名学生</span>
          <button class="btn btn-danger btn-xs" id="stu-batch-del-btn">🗑 批量删除</button>
        </div>
        <div class="card">
          <div class="table-wrap"><table class="data-table">
            <thead><tr>
              <th class="th-cb"><input type="checkbox" class="cb-head" id="stu-cb-all"></th>
              <th>学号</th><th>姓名</th><th>性别</th><th>分数</th><th>等级</th><th>操作</th>
            </tr></thead>
            <tbody id="stu-body"><tr><td colspan="7" class="empty">请先选择一个班级</td></tr></tbody>
          </table></div>
        </div>
      </div>
    </div>`;
  document.getElementById('cls-add').onclick = () => classForm();
  // 班级批量删除
  document.getElementById('cls-batch-del-btn').onclick = () => batchDeleteClasses();
  // 学生复选框全选
  document.getElementById('stu-cb-all').addEventListener('change', function () {
    classState.classSelection.toggleAll(this.checked, '.data-table tbody');
    var bar = document.getElementById('stu-batch-bar');
    var cnt = document.getElementById('stu-batch-count');
    var btn = document.getElementById('stu-batch-del-btn');
    classState.classSelection.renderBatchBar(bar, cnt, btn);
  });
  // 学生批量删除
  document.getElementById('stu-batch-del-btn').onclick = () => batchDeleteStudents();
  document.getElementById('stu-search').addEventListener('input', e => { classState.keyword = e.target.value; renderClassStudents(); });
  document.getElementById('stu-add').onclick = () => studentForm(null, classState.selectedId);
  document.getElementById('stu-import').onclick = () => studentImport(classState.selectedId);
  document.getElementById('stu-export').onclick = () => {
    if (classState.selectedId) window.location.href = '/api/students/export?class_id=' + classState.selectedId;
  };
  await renderClassList();
  // 自动选中第一个班级（或恢复上次选中）
  if (classState.selectedId) {
    const exists = await checkClassExists(classState.selectedId);
    if (!exists) classState.selectedId = null;
  }
  if (!classState.selectedId) {
    const { data } = await api('/api/classes');
    if (data.length) classState.selectedId = data[0].id;
  }
  if (classState.selectedId) selectClass(classState.selectedId);
};

async function renderClassList() {
  const list = document.getElementById('cls-list');
  if (!list) return;
  list.innerHTML = `<div class="empty" style="padding:20px"><div class="empty-icon">⏳</div>加载中…</div>`;
  try {
    const { data } = await api('/api/classes');
    if (!data.length) {
      list.innerHTML = `<div class="empty" style="padding:24px 12px"><div class="empty-icon">🏫</div><p style="font-size:13px;margin-top:8px">暂无班级</p><p class="muted" style="font-size:12px;margin-top:4px">点击「新建」添加</p></div>`;
      return;
    }
    list.innerHTML = data.map(c => `
      <div class="class-item ${classState.selectedId===c.id?'is-active':''} ${c.is_active?'':'is-inactive'}" data-id="${c.id}">
        <input type="checkbox" class="cb class-item-cb" data-id="${c.id}" onchange="
          var sel = classState.classSelection;
          sel.toggleOne(${c.id}, this.checked);
          sel.renderBatchBar(document.getElementById('cls-batch-bar'), document.getElementById('cls-batch-count'), document.getElementById('cls-batch-del-btn'));
        " onclick="event.stopPropagation()">
        <div class="class-item-main" onclick="selectClass(${c.id})">
          <div class="class-item-name">${esc(c.name)} ${c.is_active?'':'<span class="badge badge-gray" style="font-size:10px">停用</span>'}</div>
          <div class="class-item-meta">${c.grade?esc(c.grade)+' · ':''}<b>${c.student_count}</b> 人</div>
        </div>
        <div class="class-item-actions">
          <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();classForm(${c.id})">编辑</button>
          <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();delClass(${c.id},'${esc(c.name)}',${c.student_count})">删</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}
window.renderClassList = renderClassList;

async function checkClassExists(id) {
  try { const { data } = await api('/api/classes'); return data.some(c => c.id === id); }
  catch { return false; }
}

async function selectClass(id) {
  classState.selectedId = id;
  // 高亮左侧
  document.querySelectorAll('.class-item').forEach(el => el.classList.toggle('is-active', +el.dataset.id === id));
  // 启用右侧按钮
  ['stu-add','stu-import','stu-export','stu-search'].forEach(tid => {
    const e = document.getElementById(tid); if (e) e.disabled = false;
  });
  // 标题
  try {
    const { data } = await api('/api/classes');
    const c = data.find(x => x.id === id);
    if (c) document.getElementById('cls-title').innerHTML = `${esc(c.name)} ${c.grade?'<span class="muted">· '+esc(c.grade)+'</span>':''} <span class="badge badge-mint">${c.student_count} 人</span>`;
  } catch {}
  renderClassStudents();
}
window.selectClass = selectClass;

async function renderClassStudents() {
  const body = document.getElementById('stu-body');
  if (!body || !classState.selectedId) return;
  body.innerHTML = `<tr><td colspan="7" class="empty">加载中…</td></tr>`;
  try {
    const q = new URLSearchParams({ page_size: '9999', class_id: classState.selectedId });
    if (classState.keyword) q.set('keyword', classState.keyword);
    const { data } = await api('/api/students?' + q);
    if (!data.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty"><div class="empty-icon">📭</div>该班级暂无学生<br><span class="muted" style="font-size:12px">点击「新增学生」或「导入到本班」</span></td></tr>`;
      return;
    }
    body.innerHTML = data.map(s => `<tr data-id="${s.id}">
      <td class="td-cb"><input type="checkbox" class="row-cb" data-id="${s.id}" onchange="
        classState.classSelection.toggleOne(${s.id}, this.checked);
        classState.classSelection.renderBatchBar(document.getElementById('stu-batch-bar'), document.getElementById('stu-batch-count'), document.getElementById('stu-batch-del-btn'));
      "></td>
      <td class="mono">${esc(s.student_id)}</td>
      <td><b>${esc(s.name)}</b></td>
      <td>${s.gender ? `<span class="badge ${s.gender==='男'?'badge-sky':'badge-primary'}">${esc(s.gender)}</span>` : '<span class="muted">-</span>'}</td>
      <td class="mono">${s.score}</td>
      <td><span class="badge badge-grape">LV.${s.pet_level}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-xs" onclick="studentForm(${s.id},${classState.selectedId})">编辑</button>
        <button class="btn btn-ghost btn-xs" onclick="moveStudent(${s.id})">换班</button>
        <button class="btn btn-danger btn-xs" onclick="delStudent(${s.id},'${esc(s.name)}')">删除</button>
      </div></td>
    </tr>`).join('');
  } catch (err) { body.innerHTML = `<tr><td colspan="7" class="empty">${esc(err.message)}</td></tr>`; }
}
window.renderClassStudents = renderClassStudents;

function classForm(id) {
  const isEdit = !!id;
  openModal({
    title: isEdit ? '编辑班级' : '新建班级',
    bodyHTML: `
      <label class="field"><span class="field-label">班级名称 *</span><input id="cf-name" placeholder="如 三年二班"></label>
      <label class="field"><span class="field-label">年级</span><input id="cf-grade" placeholder="如 三年级"></label>
      ${isEdit?'<label class="field"><span class="field-label">排序</span><input id="cf-sort" type="number" placeholder="数字越小越靠前"></label>':''}
      ${isEdit?'<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input id="cf-active" type="checkbox" style="width:auto"><span class="field-label" style="margin:0">启用</span></label>':''}`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="cf-save">保存</button>`,
    onMount: async (_, close) => {
      if (isEdit) {
        try {
          const { data } = await api('/api/classes');
          const c = data.find(x => x.id === id);
          if (c) {
            document.getElementById('cf-name').value = c.name;
            document.getElementById('cf-grade').value = c.grade || '';
            if (document.getElementById('cf-sort')) document.getElementById('cf-sort').value = c.sort_order;
            if (document.getElementById('cf-active')) document.getElementById('cf-active').checked = !!c.is_active;
          }
        } catch {}
      }
      document.getElementById('cf-save').onclick = async () => {
        const body = {
          name: document.getElementById('cf-name').value.trim(),
          grade: document.getElementById('cf-grade').value.trim() || null,
        };
        if (!body.name) return toast('班级名称必填', 'error');
        try {
          if (isEdit) {
            const sortEl = document.getElementById('cf-sort');
            const actEl = document.getElementById('cf-active');
            if (sortEl) body.sort_order = +sortEl.value;
            if (actEl) body.is_active = actEl.checked ? 1 : 0;
            await api('/api/classes/' + id, { method: 'PUT', body: JSON.stringify(body) });
          } else {
            await api('/api/classes', { method: 'POST', body: JSON.stringify(body) });
          }
          close(); toast('保存成功', 'success');
          await renderClassList();
          if (!isEdit) {
            const { data } = await api('/api/classes');
            if (data.length) selectClass(data[data.length-1].id);
          } else if (classState.selectedId === id) {
            selectClass(id); // 刷新标题
          }
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.classForm = classForm;

function delClass(id, name, stuCount) {
  const msg = stuCount > 0
    ? `确定删除班级「${name}」吗？<br><br>该班有 <b style="color:var(--danger)">${stuCount}</b> 名学生，删除后这些学生将变为<b>未分班</b>状态（不会被删除），需要重新分配班级。`
    : `确定删除空班级「${name}」吗？`;
  confirmModal(msg, async () => {
    try {
      const r = await api('/api/classes/' + id, { method: 'DELETE' });
      toast(r.message, 'success');
      if (classState.selectedId === id) classState.selectedId = null;
      await renderClassList();
      const { data } = await api('/api/classes');
      if (data.length) selectClass(data[0].id);
      else {
        document.getElementById('cls-title').textContent = '请选择左侧班级';
        ['stu-add','stu-import','stu-export','stu-search'].forEach(t => { const e = document.getElementById(t); if (e) e.disabled = true; });
        document.getElementById('stu-body').innerHTML = `<tr><td colspan="7" class="empty">请先选择一个班级</td></tr>`;
      }
    } catch (e) { toast(e.message, 'error'); }
  });
}
window.delClass = delClass;

/* 批量删除班级 */
async function batchDeleteClasses() {
  var ids = classState.classSelection.getIds();
  if (!ids.length) return;
  confirmModal(`确定删除选中的 <b>${ids.length}</b> 个班级吗？<br><br>这些班级的学生将变为<b>未分班</b>状态（不会被删除）。`, async () => {
    try {
      var r = await api('/api/classes/batch', { method: 'DELETE', body: JSON.stringify({ ids: ids }) });
      toast(r.message, 'success');
      classState.classSelection.clear();
      if (ids.includes(classState.selectedId)) classState.selectedId = null;
      await renderClassList();
      if (classState.selectedId) selectClass(classState.selectedId);
      else {
        document.getElementById('cls-title').textContent = '请选择左侧班级';
        ['stu-add','stu-import','stu-export','stu-search'].forEach(function (t) { var e = document.getElementById(t); if (e) e.disabled = true; });
        document.getElementById('stu-body').innerHTML = '<tr><td colspan="7" class="empty">请先选择一个班级</td></tr>';
      }
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* 批量删除学生 */
async function batchDeleteStudents() {
  var ids = classState.classSelection.getIds();
  if (!ids.length) return;
  confirmModal(`确定删除选中的 <b>${ids.length}</b> 名学生吗？<br><br>该学生的加分记录也会一并删除。`, async () => {
    try {
      var r = await api('/api/students/batch', { method: 'DELETE', body: JSON.stringify({ ids: ids }) });
      toast(r.message, 'success');
      classState.classSelection.clear();
      document.getElementById('stu-batch-bar').style.display = 'none';
      document.getElementById('stu-cb-all').checked = false;
      await renderClassList();
      renderClassStudents();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function studentForm(id, classId) {
  const isEdit = !!id;
  const cid = classId || classState.selectedId;
  openModal({
    title: isEdit ? '编辑学生' : '新增学生',
    bodyHTML: `
      <label class="field"><span class="field-label">学号 *</span><input id="f-sid" placeholder="如 S001"></label>
      <label class="field"><span class="field-label">姓名 *</span><input id="f-name" placeholder="学生姓名"></label>
      <div class="flex">
        <label class="field" style="flex:1"><span class="field-label">性别</span>
          <select id="f-gender"><option value="">未填</option><option value="男">男</option><option value="女">女</option></select></label>
        <label class="field" style="flex:1"><span class="field-label">所属班级</span>
          <select id="f-class"><option value="">未分班</option></select></label>
      </div>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="f-save">保存</button>`,
    onMount: async (_, close) => {
      // 加载班级下拉
      try {
        const { data: classes } = await api('/api/classes');
        const sel = document.getElementById('f-class');
        classes.forEach(c => {
          const o = document.createElement('option');
          o.value = c.id; o.textContent = c.name + (c.grade ? '（'+c.grade+'）' : '');
          sel.appendChild(o);
        });
      } catch {}
      if (isEdit) {
        try {
          const q = new URLSearchParams({ page_size: '9999', class_id: cid });
          const { data } = await api('/api/students?' + q);
          const s = data.find(x => x.id === id);
          if (s) {
            document.getElementById('f-sid').value = s.student_id;
            document.getElementById('f-name').value = s.name;
            document.getElementById('f-gender').value = s.gender || '';
            if (s.class_id) document.getElementById('f-class').value = s.class_id;
          }
        } catch {}
      } else if (cid) {
        document.getElementById('f-class').value = cid;
      }
      document.getElementById('f-save').onclick = async () => {
        const body = {
          student_id: document.getElementById('f-sid').value.trim(),
          name: document.getElementById('f-name').value.trim(),
          gender: document.getElementById('f-gender').value,
          class_id: document.getElementById('f-class').value ? +document.getElementById('f-class').value : null,
        };
        if (!body.student_id || !body.name) return toast('学号和姓名必填', 'error');
        try {
          if (isEdit) await api('/api/students/' + id, { method: 'PUT', body: JSON.stringify(body) });
          else await api('/api/students', { method: 'POST', body: JSON.stringify(body) });
          close(); toast('保存成功', 'success');
          await renderClassList(); // 学生数可能变化
          renderClassStudents();
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.studentForm = studentForm;

function moveStudent(id) {
  openModal({
    title: '给学生换班',
    bodyHTML: `<label class="field"><span class="field-label">选择目标班级</span><select id="mv-class"></select></label>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="mv-ok">确定</button>`,
    onMount: async (_, close) => {
      try {
        const { data } = await api('/api/classes');
        const sel = document.getElementById('mv-class');
        data.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
      } catch {}
      document.getElementById('mv-ok').onclick = async () => {
        const newCid = +document.getElementById('mv-class').value;
        if (!newCid) return toast('请选班级', 'error');
        try {
          await api('/api/students/' + id, { method: 'PUT', body: JSON.stringify({ class_id: newCid }) });
          close(); toast('已换班', 'success');
          await renderClassList(); renderClassStudents();
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.moveStudent = moveStudent;

function delStudent(id, name) {
  confirmModal(`确定删除学生「${name}」吗？该学生的加分流水也会一并删除。`, async () => {
    try { await api('/api/students/' + id, { method: 'DELETE' }); toast('已删除', 'success'); await renderClassList(); renderClassStudents(); }
    catch (e) { toast(e.message, 'error'); }
  });
}
window.delStudent = delStudent;

function studentImport(classId) {
  const cid = classId || classState.selectedId;
  openModal({
    title: '📥 Excel 导入学生' + (cid ? '（导入到当前班级）' : ''),
    bodyHTML: `
      <p class="info-line">Excel 第一行需为表头，支持列：<b>学号 / 姓名 / 性别 / 班级</b>（顺序可乱）。${cid?'<b style="color:var(--primary)">已指定导入到当前班级，Excel 中的班级列会被忽略。</b>':'学号已存在则更新，否则新增。'}</p>
      <div class="upload-area" id="drop-zone">
        <div class="upload-icon">📄</div>
        <p>点击选择或拖入 .xlsx / .xls 文件</p>
        <input type="file" id="file-input" accept=".xlsx,.xls" hidden>
      </div>
      <p id="file-name" class="muted" style="font-size:13px"></p>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-mint" id="do-import" disabled>开始导入</button>`,
    onMount: (_, close) => {
      const zone = document.getElementById('drop-zone');
      const input = document.getElementById('file-input');
      let file = null;
      zone.onclick = () => input.click();
      input.onchange = e => { if (e.target.files[0]) setFile(e.target.files[0]); };
      zone.ondragover = e => { e.preventDefault(); zone.classList.add('drag'); };
      zone.ondragleave = () => zone.classList.remove('drag');
      zone.ondrop = e => { e.preventDefault(); zone.classList.remove('drag'); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); };
      function setFile(f) { file = f; document.getElementById('file-name').textContent = '已选择：' + f.name; document.getElementById('do-import').disabled = false; }
      document.getElementById('do-import').onclick = async () => {
        if (!file) return;
        const fd = new FormData(); fd.append('file', file);
        const url = '/api/students/import' + (cid ? '?class_id=' + cid : '');
        try {
          document.getElementById('do-import').disabled = true;
          const r = await api(url, { method: 'POST', body: fd });
          toast(r.message, 'success'); close();
          await renderClassList(); renderClassStudents();
        } catch (e) { toast(e.message, 'error'); document.getElementById('do-import').disabled = false; }
      };
    }
  });
}
window.studentImport = studentImport;

/* ============================================================
 * 题库管理
 * ============================================================ */
let qFilter = { keyword: '', subject: '', type: '' };

VIEWS.questions = async function () {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="toolbar">
      <input class="search-box" id="q-search" placeholder="搜索题目…" value="${esc(qFilter.keyword)}">
      <select class="select-pill" id="q-subject"><option value="">全部学科</option></select>
      <select class="select-pill" id="q-type">
        <option value="">全部类型</option><option value="single_choice">单选题</option><option value="judge">判断题</option>
      </select>
      <button class="btn btn-primary" id="q-add">＋ 新增题目</button>
      <button class="btn btn-mint" id="q-import">📥 Excel 导入</button>
    </div>
    <div class="batch-bar" id="q-batch-bar" style="display:none">
      <span>已选 <span class="batch-count" id="q-batch-count">0</span> 道题目</span>
      <button class="btn btn-danger btn-xs" id="q-batch-del-btn">🗑 批量删除</button>
    </div>
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th class="th-cb"><input type="checkbox" class="cb-head" id="q-cb-all"></th><th>题目</th><th>类型</th><th>学科</th><th>难度</th><th>答案</th><th>操作</th></tr></thead>
      <tbody id="q-body"></tbody>
    </table></div></div>`;
  document.getElementById('q-search').addEventListener('input', e => { qFilter.keyword = e.target.value; renderQuestions(); });
  document.getElementById('q-type').addEventListener('change', e => { qFilter.type = e.target.value; renderQuestions(); });
  const subSel = document.getElementById('q-subject');
  try {
    const { data } = await api('/api/questions?page_size=9999');
    const subs = [...new Set(data.map(q => q.subject).filter(Boolean))];
    subs.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; if (s === qFilter.subject) o.selected = true; subSel.appendChild(o); });
  } catch {}
  subSel.addEventListener('change', e => { qFilter.subject = e.target.value; renderQuestions(); });
  document.getElementById('q-add').onclick = () => questionForm();
  document.getElementById('q-import').onclick = questionImport;
  // 题库复选框全选
  document.getElementById('q-cb-all').addEventListener('change', function () {
    questionSel.toggleAll(this.checked, '.data-table tbody');
    questionSel.renderBatchBar(document.getElementById('q-batch-bar'), document.getElementById('q-batch-count'), document.getElementById('q-batch-del-btn'));
  });
  // 题库批量删除
  document.getElementById('q-batch-del-btn').onclick = () => batchDeleteQuestions();
  renderQuestions();
};

async function renderQuestions() {
  const body = document.getElementById('q-body');
  if (!body) return;
  body.innerHTML = `<tr><td colspan="7" class="empty">加载中…</td></tr>`;
  try {
    const q = new URLSearchParams({ page_size: '9999' });
    if (qFilter.keyword) q.set('keyword', qFilter.keyword);
    if (qFilter.subject) q.set('subject', qFilter.subject);
    if (qFilter.type) q.set('type', qFilter.type);
    const { data } = await api('/api/questions?' + q);
    if (!data.length) { body.innerHTML = `<tr><td colspan="7" class="empty"><div class="empty-icon">📭</div>暂无题目</td></tr>`; return; }
    body.innerHTML = data.map(qq => `<tr data-id="${qq.id}">
      <td class="td-cb"><input type="checkbox" class="row-cb" data-id="${qq.id}" onchange="
        questionSel.toggleOne(${qq.id}, this.checked);
        questionSel.renderBatchBar(document.getElementById('q-batch-bar'), document.getElementById('q-batch-count'), document.getElementById('q-batch-del-btn'));
      "></td>
      <td style="max-width:380px">${esc(qq.question_text)} ${qq.knowledge?`<span class="badge badge-gray">${esc(qq.knowledge)}</span>`:''}</td>
      <td>${qq.question_type==='judge'?'<span class="badge badge-sun">判断</span>':'<span class="badge badge-sky">单选</span>'}</td>
      <td>${qq.subject?`<span class="badge badge-mint">${esc(qq.subject)}</span>`:'<span class="muted">-</span>'}</td>
      <td>${'★'.repeat(qq.difficulty||1)}</td>
      <td class="mono"><b>${esc(qq.correct_answer)}</b></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-xs" onclick="questionForm(${qq.id})">编辑</button>
        <button class="btn btn-danger btn-xs" onclick="delQuestion(${qq.id})">删除</button>
      </div></td>
    </tr>`).join('');
  } catch (err) { body.innerHTML = `<tr><td colspan="7" class="empty">${esc(err.message)}</td></tr>`; }
}
window.renderQuestions = renderQuestions;

function questionForm(id) {
  const isEdit = !!id;
  openModal({
    title: isEdit ? '编辑题目' : '新增题目',
    bodyHTML: `
      <label class="field"><span class="field-label">题目 *</span><textarea id="qf-text" placeholder="输入题干"></textarea></label>
      <div class="flex">
        <label class="field" style="flex:1"><span class="field-label">类型</span>
          <select id="qf-type"><option value="single_choice">单选题</option><option value="judge">判断题</option></select></label>
        <label class="field" style="flex:1"><span class="field-label">学科</span><input id="qf-subject" placeholder="如 数学"></label>
      </div>
      <div class="flex">
        <label class="field" style="flex:1"><span class="field-label">难度</span>
          <select id="qf-diff"><option value="1">★ 简单</option><option value="2">★★ 中等</option><option value="3">★★★ 困难</option></select></label>
        <label class="field" style="flex:1"><span class="field-label">知识点</span><input id="qf-know" placeholder="如 乘法"></label>
      </div>
      <div class="flex-col">
        <span class="field-label">选项（判断题只需填 A、B）</span>
        <div class="flex gap-sm"><span class="badge badge-sky" style="height:36px;display:flex;align-items:center">A</span><input id="qf-a" placeholder="选项 A"></div>
        <div class="flex gap-sm"><span class="badge badge-sky" style="height:36px;display:flex;align-items:center">B</span><input id="qf-b" placeholder="选项 B"></div>
        <div class="flex gap-sm"><span class="badge badge-sky" style="height:36px;display:flex;align-items:center">C</span><input id="qf-c" placeholder="选项 C（判断题留空）"></div>
        <div class="flex gap-sm"><span class="badge badge-sky" style="height:36px;display:flex;align-items:center">D</span><input id="qf-d" placeholder="选项 D（判断题留空）"></div>
      </div>
      <label class="field"><span class="field-label">正确答案 *（填 A / B / C / D）</span><input id="qf-ans" placeholder="如 B" maxlength="1"></label>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="qf-save">保存</button>`,
    onMount: async (_, close) => {
      if (isEdit) {
        try {
          const { data } = await api('/api/questions?page_size=9999');
          const qq = data.find(x => x.id === id);
          if (qq) {
            document.getElementById('qf-text').value = qq.question_text;
            document.getElementById('qf-type').value = qq.question_type;
            document.getElementById('qf-subject').value = qq.subject || '';
            document.getElementById('qf-diff').value = qq.difficulty || 1;
            document.getElementById('qf-know').value = qq.knowledge || '';
            document.getElementById('qf-ans').value = qq.correct_answer;
            const opts = JSON.parse(qq.options || '[]');
            ['a','b','c','d'].forEach((k,i) => { if (opts[i]) document.getElementById('qf-'+k).value = opts[i]; });
          }
        } catch {}
      }
      document.getElementById('qf-save').onclick = async () => {
        const opts = ['a','b','c','d'].map(k => document.getElementById('qf-'+k).value.trim()).filter(Boolean);
        const body = {
          question_text: document.getElementById('qf-text').value.trim(),
          question_type: document.getElementById('qf-type').value,
          subject: document.getElementById('qf-subject').value.trim(),
          difficulty: +document.getElementById('qf-diff').value,
          knowledge: document.getElementById('qf-know').value.trim(),
          correct_answer: document.getElementById('qf-ans').value.trim().toUpperCase(),
          options: opts,
        };
        if (!body.question_text || !body.correct_answer) return toast('题目和答案必填', 'error');
        try {
          if (isEdit) await api('/api/questions/' + id, { method: 'PUT', body: JSON.stringify(body) });
          else await api('/api/questions', { method: 'POST', body: JSON.stringify(body) });
          close(); toast('保存成功', 'success'); renderQuestions();
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.questionForm = questionForm;

function delQuestion(id) {
  confirmModal('确定删除这道题目吗？', async () => {
    try { await api('/api/questions/' + id, { method: 'DELETE' }); toast('已删除', 'success'); renderQuestions(); }
    catch (e) { toast(e.message, 'error'); }
  });
}
window.delQuestion = delQuestion;

async function batchDeleteQuestions() {
  var ids = questionSel.getIds();
  if (!ids.length) return;
  confirmModal(`确定删除选中的 <b>${ids.length}</b> 道题目吗？`, async () => {
    try {
      var r = await api('/api/questions/batch', { method: 'DELETE', body: JSON.stringify({ ids: ids }) });
      toast(r.message, 'success');
      questionSel.clear();
      document.getElementById('q-batch-bar').style.display = 'none';
      document.getElementById('q-cb-all').checked = false;
      renderQuestions();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function questionImport() {
  openModal({
    title: '📥 Excel 导入题库',
    bodyHTML: `
      <p class="info-line">表头列：<b>题目 / 选项A / 选项B / 选项C / 选项D / 正确答案 / 类型 / 学科 / 难度 / 知识点</b>。判断题只填 A、B 两列。</p>
      <div class="upload-area" id="qdrop"><div class="upload-icon">📄</div><p>点击选择或拖入 .xlsx / .xls</p><input type="file" id="qfile" accept=".xlsx,.xls" hidden></div>
      <p id="qfname" class="muted" style="font-size:13px"></p>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-mint" id="qdo" disabled>开始导入</button>`,
    onMount: (_, close) => {
      const zone = document.getElementById('qdrop'); const input = document.getElementById('qfile'); let file = null;
      zone.onclick = () => input.click();
      input.onchange = e => { if (e.target.files[0]) setF(e.target.files[0]); };
      zone.ondragover = e => { e.preventDefault(); zone.classList.add('drag'); };
      zone.ondragleave = () => zone.classList.remove('drag');
      zone.ondrop = e => { e.preventDefault(); zone.classList.remove('drag'); if (e.dataTransfer.files[0]) setF(e.dataTransfer.files[0]); };
      function setF(f) { file = f; document.getElementById('qfname').textContent = '已选择：' + f.name; document.getElementById('qdo').disabled = false; }
      document.getElementById('qdo').onclick = async () => {
        const fd = new FormData(); fd.append('file', file);
        try { document.getElementById('qdo').disabled = true; const r = await api('/api/questions/import', { method: 'POST', body: fd }); toast(r.message, 'success'); close(); renderQuestions(); }
        catch (e) { toast(e.message, 'error'); document.getElementById('qdo').disabled = false; }
      };
    }
  });
}
window.questionImport = questionImport;

/* ============================================================
 * 教师管理
 * ============================================================ */
VIEWS.teachers = async function () {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="toolbar">
      <p class="muted">管理可登录本系统的教师账号。管理员可登录本端，普通教师仅可登录课堂端。</p>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="t-add">＋ 新增教师</button>
    </div>
    <div class="batch-bar" id="t-batch-bar" style="display:none">
      <span>已选 <span class="batch-count" id="t-batch-count">0</span> 个账号</span>
      <button class="btn btn-danger btn-xs" id="t-batch-del-btn">🗑 批量删除</button>
    </div>
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th class="th-cb"><input type="checkbox" class="cb-head" id="t-cb-all"></th><th>账号</th><th>显示名</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody id="t-body"></tbody>
    </table></div></div>`;
  document.getElementById('t-add').onclick = () => teacherForm();
  // 教师复选框全选
  document.getElementById('t-cb-all').addEventListener('change', function () {
    teacherSel.toggleAll(this.checked, '.data-table tbody');
    teacherSel.renderBatchBar(document.getElementById('t-batch-bar'), document.getElementById('t-batch-count'), document.getElementById('t-batch-del-btn'));
  });
  // 教师批量删除
  document.getElementById('t-batch-del-btn').onclick = () => batchDeleteTeachers();
  renderTeachers();
};

async function renderTeachers() {
  const body = document.getElementById('t-body');
  if (!body) return;
  body.innerHTML = `<tr><td colspan="7" class="empty">加载中…</td></tr>`;
  try {
    const { data } = await api('/api/teachers');
    if (!data.length) { body.innerHTML = `<tr><td colspan="7" class="empty">暂无教师</td></tr>`; return; }
    const me = getUser();
    body.innerHTML = data.map(t => `<tr data-id="${t.id}">
      <td class="td-cb"><input type="checkbox" class="row-cb" data-id="${t.id}" onchange="
        teacherSel.toggleOne(${t.id}, this.checked);
        teacherSel.renderBatchBar(document.getElementById('t-batch-bar'), document.getElementById('t-batch-count'), document.getElementById('t-batch-del-btn'));
      " ${t.username===me.username?'disabled title="不能选自己"':''}></td>
      <td class="mono"><b>${esc(t.username)}</b>${t.username===me.username?' <span class="muted">(你)</span>':''}</td>
      <td>${esc(t.display_name)}</td>
      <td>${t.role==='admin'?'<span class="badge badge-grape">管理员</span>':'<span class="badge badge-sky">教师</span>'}</td>
      <td>${t.is_active?'<span class="badge badge-mint">启用</span>':'<span class="badge badge-danger">停用</span>'}</td>
      <td class="muted">${esc(t.created_at)}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-xs" onclick="teacherForm(${t.id})">编辑</button>
        <button class="btn btn-ghost btn-xs" onclick="resetPwd(${t.id},'${esc(t.username)}')">重置密码</button>
        <button class="btn btn-ghost btn-xs" onclick="toggleTeacher(${t.id},${t.is_active?0:1})">${t.is_active?'停用':'启用'}</button>
        <button class="btn btn-danger btn-xs" onclick="delTeacher(${t.id},'${esc(t.username)}')">删除</button>
      </div></td>
    </tr>`).join('');
  } catch (err) { body.innerHTML = `<tr><td colspan="7" class="empty">${esc(err.message)}</td></tr>`; }
}
window.renderTeachers = renderTeachers;

function teacherForm(id) {
  const isEdit = !!id;
  openModal({
    title: isEdit ? '编辑教师' : '新增教师',
    bodyHTML: `
      ${isEdit?'':'<label class="field"><span class="field-label">账号 *</span><input id="tf-user" placeholder="登录账号"></label>'}
      ${isEdit?'':'<label class="field"><span class="field-label">初始密码 *</span><input id="tf-pass" type="password" placeholder="至少 4 位"></label>'}
      <label class="field"><span class="field-label">显示名</span><input id="tf-name" placeholder="如 王老师"></label>
      <label class="field"><span class="field-label">角色</span>
        <select id="tf-role"><option value="teacher">教师（仅课堂端）</option><option value="admin">管理员（可登录管理端）</option></select></label>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="tf-save">保存</button>`,
    onMount: async (_, close) => {
      if (isEdit) {
        try {
          const { data } = await api('/api/teachers');
          const t = data.find(x => x.id === id);
          if (t) { document.getElementById('tf-name').value = t.display_name||''; document.getElementById('tf-role').value = t.role; }
        } catch {}
      }
      document.getElementById('tf-save').onclick = async () => {
        const body = {
          display_name: document.getElementById('tf-name').value.trim(),
          role: document.getElementById('tf-role').value,
        };
        try {
          if (isEdit) {
            await api('/api/teachers/' + id, { method: 'PUT', body: JSON.stringify(body) });
          } else {
            body.username = document.getElementById('tf-user').value.trim();
            body.password = document.getElementById('tf-pass').value;
            if (!body.username || !body.password) return toast('账号和密码必填', 'error');
            await api('/api/teachers', { method: 'POST', body: JSON.stringify(body) });
          }
          close(); toast('保存成功', 'success'); renderTeachers();
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.teacherForm = teacherForm;

function resetPwd(id, username) {
  openModal({
    title: '重置密码 · ' + username,
    bodyHTML: `<label class="field"><span class="field-label">新密码（至少 4 位）</span><input id="rp-pass" type="password"></label>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="rp-ok">重置</button>`,
    onMount: (_, close) => {
      document.getElementById('rp-ok').onclick = async () => {
        const pwd = document.getElementById('rp-pass').value;
        if (!pwd || pwd.length < 4) return toast('密码至少 4 位', 'error');
        try { await api('/api/teachers/' + id + '/reset-password', { method: 'POST', body: JSON.stringify({ new_password: pwd }) }); close(); toast('密码已重置', 'success'); }
        catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.resetPwd = resetPwd;

async function toggleTeacher(id, is_active) {
  try { await api('/api/teachers/' + id, { method: 'PUT', body: JSON.stringify({ is_active }) }); toast(is_active ? '已启用' : '已停用', 'success'); renderTeachers(); }
  catch (e) { toast(e.message, 'error'); }
}
window.toggleTeacher = toggleTeacher;

function delTeacher(id, username) {
  confirmModal(`确定删除教师账号「${username}」吗？`, async () => {
    try { await api('/api/teachers/' + id, { method: 'DELETE' }); toast('已删除', 'success'); renderTeachers(); }
    catch (e) { toast(e.message, 'error'); }
  });
}
window.delTeacher = delTeacher;

async function batchDeleteTeachers() {
  var ids = teacherSel.getIds();
  if (!ids.length) return;
  confirmModal(`确定删除选中的 <b>${ids.length}</b> 个教师账号吗？`, async () => {
    try {
      var r = await api('/api/teachers/batch', { method: 'DELETE', body: JSON.stringify({ ids: ids }) });
      toast(r.message, 'success');
      teacherSel.clear();
      document.getElementById('t-batch-bar').style.display = 'none';
      document.getElementById('t-cb-all').checked = false;
      renderTeachers();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ============================================================
 * 主题管理
 * ============================================================ */
VIEWS.themes = async function () {
  var el = document.getElementById('content');
  el.innerHTML = `
    <!-- 主题选择器 -->
    <div class="theme-selector">
      <select id="theme-select" style="width:auto;min-width:240px"></select>
      <button class="btn btn-primary" id="th-upload">⬆ 上传主题包</button>
      <button class="btn btn-mint" id="th-new">＋ 新建主题</button>
    </div>
    <!-- 提示 -->
    <p class="muted" style="font-size:13px;margin-bottom:16px">点击卡片可设置对应模块。主题包包含10级宠物素材，上传后会自动出现在「宠物」卡片中。</p>
    <!-- 卡片网格 -->
    <div class="theme-cards" id="theme-cards"></div>`;

  document.getElementById('th-upload').onclick = themeUpload;
  document.getElementById('th-new').onclick = newThemeForm;
  document.getElementById('theme-select').addEventListener('change', function () {
    currentThemeId = +this.value || null;
    renderThemeCards();
  });
  await loadThemeList();
  renderThemeCards();
};

/* ---------- 主题全局状态 ---------- */
var currentThemeId = null;
var currentThemeConfig = {};
var themesList = [];

async function loadThemeList() {
  try {
    var resp = await api('/api/themes');
    themesList = resp.data || [];
  } catch (e) { themesList = []; }
  var sel = document.getElementById('theme-select');
  if (!sel) return;
  sel.innerHTML = themesList.map(function (t) {
    return '<option value="' + t.id + '"' + (t.is_active ? ' selected' : '') + '>' +
      esc(t.name) + (t.is_active ? ' ✓ 使用中' : '') + '</option>';
  }).join('');
  if (!themesList.length) sel.innerHTML = '<option value="">暂无主题</option>';
  if (!currentThemeId && themesList.length) {
    var active = themesList.find(function (t) { return t.is_active; });
    currentThemeId = active ? active.id : themesList[0].id;
    sel.value = currentThemeId;
  }
}

function getCurrentTheme() {
  return themesList.find(function (t) { return t.id === currentThemeId; }) || null;
}

/* ---------- 渲染 8 张设置卡片 ---------- */
function renderThemeCards() {
  var container = document.getElementById('theme-cards');
  if (!container) return;
  var theme = getCurrentTheme();
  if (!theme) {
    container.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🎨</div><p>请先新建或上传一个主题</p></div>';
    return;
  }
  currentThemeConfig = theme.config || {};

  var cards = [
    { id: 'background', icon: '🖼', bg: 'bg-sky',   title: '舞台背景',   hint: '设置天空颜色、草地样式和底纹图案。<b>建议图片尺寸 1920×1080</b>，支持 png/jpg/webp。上传后将自适应铺满舞台。',     badge: statusHint('background') },
    { id: 'pets',       icon: '🐾', bg: 'bg-pink',  title: '宠物形象',   hint: '为 1~10 级宠物设置待机（idle）和活跃（active）形象。<b>建议 GIF 尺寸 360×360</b>，支持透明背景。上传后将自动缩放居中显示。', badge: statusHint('pets') },
    { id: 'sounds',     icon: '🔊', bg: 'bg-grape', title: '音效反馈',   hint: '设置加分（+1/+3/+5）、升级、满级等音效。<b>仅支持 mp3 / wav / ogg</b>，建议文件小于 2MB。',                    badge: statusHint('sounds') },
    { id: 'colors',     icon: '🎨', bg: 'bg-mint',  title: '配色方案',   hint: '调整主色调、加分按钮色、等级徽章色等全局色彩。<b>建议主色使用柔和暖色调</b>，适合小学生视觉感受。',            badge: colorBadge() },
    { id: 'entry',      icon: '🏠', bg: 'bg-sun',   title: '入口页面',   hint: '自定义课堂入口的 Logo 图标和标题文字。<b>建议 Logo 尺寸 200×200</b>，png 透明背景最佳。',                     badge: statusHint('entry') },
    { id: 'fonts',      icon: '🔤', bg: 'bg-mint',  title: '字体风格',   hint: '选择标题和正文的字体风格。<b>标题建议用卡通体</b>吸引注意力，正文使用易读的常规字体。',                        badge: fontBadge() },
    { id: 'nameplates', icon: '🏷', bg: 'bg-sky',   title: '名牌样式',   hint: '调整学生卡片圆角、是否显示学号等细节。<b>大圆角更柔和</b>，适合低龄学生。',                                       badge: nameplateBadge() },
    { id: 'animations', icon: '✨', bg: 'bg-sun',   title: '动画特效',   hint: '控制宠物浮动强度、升级特效类型、抢答闪烁等动画。<b>建议保持「标准」强度</b>，避免过度分散注意力。',              badge: animBadge() },
  ];

  container.innerHTML = cards.map(function (c) {
    return '<div class="theme-card" onclick="openThemePanel(\'' + c.id + '\')">' +
      '<div class="flex" style="align-items:center;gap:12px">' +
        '<div class="theme-card-icon ' + c.bg + '">' + c.icon + '</div>' +
        '<div>' +
          '<div class="theme-card-title">' + c.title + '</div>' +
          '<div class="theme-card-status">' + c.badge + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="theme-card-hint">' + c.hint + '</div>' +
      '<div class="theme-card-foot">' +
        '<span style="font-size:12px;color:var(--text-light)">点击设置 →</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* 状态提示文字 */
function statusHint(key) {
  var cfg = currentThemeConfig[key] || {};
  var count = Object.keys(cfg).filter(function (k) { return cfg[k]; }).length;
  return count > 0 ? '已设置 ' + count + ' 项' : '未设置';
}
function colorBadge() {
  var c = currentThemeConfig.colors || {};
  return c.primary ? '当前: ' + c.primary : '默认配色';
}
function fontBadge() {
  var f = currentThemeConfig.fonts || {};
  return f.display || f.body ? (f.display || f.body) : '默认字体';
}
function nameplateBadge() {
  var n = currentThemeConfig.nameplates || {};
  return '圆角 ' + (n.cardRadius || 16) + 'px';
}
function animBadge() {
  var a = currentThemeConfig.animations || {};
  return '强度: ' + (a.idleIntensity || 'normal');
}

/* ============================================================
 * 各模块设置面板
 * ============================================================ */
function openThemePanel(moduleId) {
  var panels = {
    background: renderBgPanel,
    pets: renderPetPanel,
    sounds: renderSoundPanel,
    colors: renderColorPanel,
    entry: renderEntryPanel,
    fonts: renderFontPanel,
    nameplates: renderNameplatePanel,
    animations: renderAnimPanel,
  };
  var titles = {
    background: '🖼 舞台背景', pets: '🐾 宠物形象', sounds: '🔊 音效反馈',
    colors: '🎨 配色方案', entry: '🏠 入口页面', fonts: '🔤 字体风格',
    nameplates: '🏷 名牌样式', animations: '✨ 动画特效',
  };
  var panelFn = panels[moduleId];
  if (!panelFn) return;
  openModal({
    title: titles[moduleId],
    bodyHTML: '<div id="theme-panel-content" class="theme-panel">加载中…</div>',
    footHTML: '<button class="btn btn-ghost" onclick="closeModal()">关闭</button><button class="btn btn-primary" id="theme-panel-save">保存设置</button>',
    onMount: function (_, close) {
      panelFn(document.getElementById('theme-panel-content'));
      document.getElementById('theme-panel-save').onclick = async function () {
        try {
          await api('/api/themes/' + currentThemeId + '/config', {
            method: 'PUT',
            body: JSON.stringify({ config: currentThemeConfig })
          });
          toast('设置已保存', 'success');
          close();
          renderThemeCards();
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.openThemePanel = openThemePanel;

/* ---------- 背景设置面板 ---------- */
function renderBgPanel(container) {
  var cfg = currentThemeConfig.background || {};
  container.innerHTML =
    '<div class="theme-panel-section">' +
      '<h4>天空颜色</h4>' +
      '<div class="color-preset-row">' +
        '<span class="field-label">颜色</span>' +
        '<input type="color" value="' + (cfg.skyColor || '#cfe8ff') + '" onchange="currentThemeConfig.background=currentThemeConfig.background||{};currentThemeConfig.background.skyColor=this.value" style="width:60px;height:36px;border:none;cursor:pointer">' +
        '<span style="font-size:12px;color:var(--text-light)">' + (cfg.skyColor || '#cfe8ff') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="theme-panel-section">' +
      '<h4>草地颜色</h4>' +
      '<div class="color-preset-row">' +
        '<span class="field-label">颜色</span>' +
        '<input type="color" value="' + (cfg.grassColor || '#a8d88f') + '" onchange="currentThemeConfig.background=currentThemeConfig.background||{};currentThemeConfig.background.grassColor=this.value" style="width:60px;height:36px;border:none;cursor:pointer">' +
        '<span style="font-size:12px;color:var(--text-light)">' + (cfg.grassColor || '#a8d88f') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="theme-panel-section">' +
      '<h4>底纹图案</h4>' +
      '<div class="color-presets">' +
        ['dots','cross','stars','none'].map(function (p) {
          return '<div class="color-preset' + ((cfg.pattern || 'dots') === p ? ' is-active' : '') + '" style="background:#fff;display:flex;align-items:center;justify-content:center;font-size:14px" onclick="currentThemeConfig.background=currentThemeConfig.background||{};currentThemeConfig.background.pattern=\'' + p + '\';this.parentElement.querySelectorAll(\'.color-preset\').forEach(function(x){x.classList.remove(\'is-active\')});this.classList.add(\'is-active\')" title="' + p + '">' + ({ dots:'●', cross:'✚', stars:'★', none:'○' }[p]) + '</div>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<div class="theme-panel-section">' +
      '<h4>自定义背景图 <span style="font-size:11px;color:var(--text-light);font-weight:400">（可选，将覆盖颜色设置）</span></h4>' +
      '<p class="asset-upload-hint">📌 <b>建议尺寸 1920×1080</b>，支持 png / jpg / webp。<br>上传后自动根据舞台容器自适应缩放，确保完整显示。</p>' +
      assetPreviewHtml(cfg.customBg || '', 'preview-background-customBg') +
      '<div class="asset-actions">' +
        '<button class="btn btn-ghost btn-xs" onclick="uploadAsset(\'background\',\'customBg\',\'image\')">选择图片</button>' +
        (cfg.customBg ? '<button class="btn btn-danger btn-xs" onclick="currentThemeConfig.background.customBg=\'\';updateAssetPreview(\'background\',\'customBg\',\'\')">移除</button>' : '') +
      '</div>' +
    '</div>';
}

/* ---------- 宠物面板 ---------- */
function renderPetPanel(container) {
  var cfg = currentThemeConfig.pets || {};
  var html = '<p class="asset-upload-hint">📌 <b>建议 GIF 尺寸 360×360</b>，支持透明背景。<br>每个等级可单独设置待机（idle）和活跃（active）形象。<br>上传后自动缩放居中，无需手动裁切。<b>已折叠 LV.6-10 减少滚动</b>。</p>';
  for (var i = 1; i <= 10; i++) {
    var idleKey = 'lv' + i + '_idle';
    var activeKey = 'lv' + i + '_active';
    var rowStyle = i > 5 ? ' style="display:none"' : '';
    html +=
      '<div class="theme-panel-section pet-level-row" data-level="' + i + '"' + rowStyle + '>' +
        '<h4>LV.' + i + ' 宠物</h4>' +
        '<div style="display:flex;gap:12px">' +
          '<div style="flex:1"><span style="font-size:12px;color:var(--text-light)">待机 (Idle)</span>' +
            assetPreviewHtml(cfg[idleKey] || '', 'preview-pets-' + idleKey) +
            '<button class="btn btn-ghost btn-xs" style="margin-top:6px" onclick="uploadAsset(\'pets\',\'' + idleKey + '\',\'image\')">上传</button>' +
          '</div>' +
          '<div style="flex:1"><span style="font-size:12px;color:var(--text-light)">活跃 (Active)</span>' +
            assetPreviewHtml(cfg[activeKey] || '', 'preview-pets-' + activeKey) +
            '<button class="btn btn-ghost btn-xs" style="margin-top:6px" onclick="uploadAsset(\'pets\',\'' + activeKey + '\',\'image\')">上传</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  // 折叠切换按钮
  html += '<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" id="pet-toggle-btn" onclick="var rows=document.querySelectorAll(\'.pet-level-row\');var hidden=rows[5]&&rows[5].style.display===\'none\';rows.forEach(function(r,i){if(i>=5)r.style.display=hidden?\'\':\'none\'});this.textContent=hidden?\'▲ 收起 LV.6-10\':\'▼ 展开 LV.6-10\';var modal=this.closest(\'.modal\');if(modal)modal.scrollTop=modal.scrollHeight">▼ 展开 LV.6-10</button>';
  container.innerHTML = html;
}

/* ---------- 音效面板 ---------- */
function renderSoundPanel(container) {
  var cfg = currentThemeConfig.sounds || {};
  var sounds = [
    { key: 'score1', label: '＋1 加分' },
    { key: 'score3', label: '＋3 加分' },
    { key: 'score5', label: '＋5 加分' },
    { key: 'levelup', label: '升级音效' },
    { key: 'maxLevel', label: '满级音效' },
  ];
  container.innerHTML =
    '<p class="asset-upload-hint">📌 <b>仅支持 mp3 / wav / ogg</b>，建议每个文件小于 2MB。<br>短促轻快的音效效果最佳，避免过长。</p>' +
    sounds.map(function (s) {
      return '<div class="audio-preview-row">' +
        '<span class="field-label">' + s.label + '</span>' +
        '<span id="audio-' + s.key + '" style="flex:1">' +
          (cfg[s.key] ? '<audio controls src="' + esc(cfg[s.key]) + '" style="width:100%;height:32px"></audio>' : '<span style="font-size:12px;color:var(--text-light)">未设置</span>') +
        '</span>' +
        '<button class="btn btn-ghost btn-xs" onclick="uploadAsset(\'sounds\',\'' + s.key + '\',\'sound\')">上传</button>' +
        (cfg[s.key] ? '<button class="btn btn-danger btn-xs" onclick="currentThemeConfig.sounds.' + s.key + '=\'\';updateAssetPreview(\'sounds\',\'' + s.key + '\',\'\')">清除</button>' : '') +
      '</div>';
    }).join('');
}

/* ---------- 配色面板 ---------- */
function renderColorPanel(container) {
  var cfg = currentThemeConfig.colors || {};
  var colors = [
    { key: 'primary', label: '主色调', def: '#ff8fab' },
    { key: 'mint', label: '薄荷绿', def: '#7fd8ae' },
    { key: 'sky', label: '天空蓝', def: '#8ecae6' },
    { key: 'sun', label: '暖阳黄', def: '#ffd166' },
    { key: 'lavender', label: '薰衣草紫', def: '#c8b6ff' },
  ];
  container.innerHTML = colors.map(function (c) {
    var val = cfg[c.key] || c.def;
    return '<div class="theme-panel-section">' +
      '<div class="color-preset-row">' +
        '<span class="field-label">' + c.label + '</span>' +
        '<input type="color" value="' + val + '" onchange="currentThemeConfig.colors=currentThemeConfig.colors||{};currentThemeConfig.colors.\'' + c.key + '\'=this.value;this.nextElementSibling.textContent=this.value;this.nextElementSibling.style.background=this.value" style="width:48px;height:36px;border:none;cursor:pointer;border-radius:var(--radius-xs)">' +
        '<span style="font-size:12px;color:var(--text-light);background:' + val + ';color:#fff;padding:2px 8px;border-radius:999px;font-family:monospace">' + val + '</span>' +
      '</div></div>';
  }).join('');
}

/* ---------- 入口页面板 ---------- */
function renderEntryPanel(container) {
  var cfg = currentThemeConfig.entry || {};
  container.innerHTML =
    '<div class="theme-panel-section">' +
      '<h4>Logo 图标</h4>' +
      '<p class="asset-upload-hint">📌 <b>建议尺寸 200×200</b>，png 透明背景最佳。<br>上传后自动缩放居中显示。</p>' +
      assetPreviewHtml(cfg.logo || '', 'preview-entry-logo') +
      '<div class="asset-actions">' +
        '<button class="btn btn-ghost btn-xs" onclick="uploadAsset(\'entry\',\'logo\',\'image\')">选择 Logo</button>' +
        (cfg.logo ? '<button class="btn btn-danger btn-xs" onclick="currentThemeConfig.entry.logo=\'\';updateAssetPreview(\'entry\',\'logo\',\'\')">移除</button>' : '') +
      '</div>' +
    '</div>' +
    '<div class="theme-panel-section">' +
      '<h4>标题文字</h4>' +
      '<label class="field"><span class="field-label">主标题</span><input value="' + esc(cfg.title || 'CLASS PET') + '" onchange="currentThemeConfig.entry=currentThemeConfig.entry||{};currentThemeConfig.entry.title=this.value"></label>' +
      '<label class="field" style="margin-top:10px"><span class="field-label">副标题</span><input value="' + esc(cfg.subtitle || '课堂宠物养成系统') + '" onchange="currentThemeConfig.entry=currentThemeConfig.entry||{};currentThemeConfig.entry.subtitle=this.value"></label>' +
    '</div>';
}

/* ---------- 字体面板 ---------- */
function renderFontPanel(container) {
  var cfg = currentThemeConfig.fonts || {};
  var fonts = [
    { key: 'display', label: '标题字体', options: ['ZCOOL KuaiLe', 'Fredoka', 'Noto Sans SC', 'Ma Shan Zheng', 'Zhi Mang Xing'] },
    { key: 'body',    label: '正文字体', options: ['Noto Sans SC', 'Fredoka', 'system-ui', 'PingFang SC'] },
  ];
  container.innerHTML = fonts.map(function (f) {
    var val = cfg[f.key] || f.options[0];
    return '<div class="theme-panel-section">' +
      '<h4>' + f.label + '</h4>' +
      '<select style="width:100%" onchange="currentThemeConfig.fonts=currentThemeConfig.fonts||{};currentThemeConfig.fonts.\'' + f.key + '\'=this.value">' +
        f.options.map(function (o) {
          return '<option value="' + o + '"' + (val === o ? ' selected' : '') + '>' + o + '</option>';
        }).join('') +
      '</select>' +
      '<p style="font-family:\'' + val + '\',sans-serif;font-size:22px;margin-top:10px;color:var(--text)">预览效果 Preview 123</p>' +
    '</div>';
  }).join('');
}

/* ---------- 名牌面板 ---------- */
function renderNameplatePanel(container) {
  var cfg = currentThemeConfig.nameplates || {};
  container.innerHTML =
    '<div class="theme-panel-section">' +
      '<h4>学生卡片圆角</h4>' +
      '<input type="range" min="0" max="32" value="' + (cfg.cardRadius || 16) + '" style="width:100%" oninput="currentThemeConfig.nameplates=currentThemeConfig.nameplates||{};currentThemeConfig.nameplates.cardRadius=+this.value;document.getElementById(\'np-preview\').style.borderRadius=this.value+\'px\'">' +
      '<div id="np-preview" style="background:var(--primary-soft);padding:16px;margin-top:10px;border-radius:' + (cfg.cardRadius || 16) + 'px;text-align:center;font-size:14px">学生卡片预览</div>' +
    '</div>' +
    '<div class="theme-panel-section">' +
      '<h4>显示学号</h4>' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
        '<input type="checkbox" ' + (cfg.showStudentId !== false ? 'checked' : '') + ' onchange="currentThemeConfig.nameplates=currentThemeConfig.nameplates||{};currentThemeConfig.nameplates.showStudentId=this.checked">' +
        '<span>在学生卡片上显示学号</span>' +
      '</label>' +
    '</div>';
}

/* ---------- 动画面板 ---------- */
function renderAnimPanel(container) {
  var cfg = currentThemeConfig.animations || {};
  container.innerHTML =
    '<div class="theme-panel-section">' +
      '<h4>宠物浮动强度</h4>' +
      '<select style="width:100%" onchange="currentThemeConfig.animations=currentThemeConfig.animations||{};currentThemeConfig.animations.idleIntensity=this.value">' +
        ['light','normal','active'].map(function (v) {
          var labels = { light: '轻微（几乎不动）', normal: '标准（上下浮动）', active: '活泼（大幅跳跃）' };
          return '<option value="' + v + '"' + ((cfg.idleIntensity || 'normal') === v ? ' selected' : '') + '>' + labels[v] + '</option>';
        }).join('') +
      '</select>' +
    '</div>' +
    '<div class="theme-panel-section">' +
      '<h4>升级特效</h4>' +
      '<div class="color-presets">' +
        ['stars','fireworks','rainbow','none'].map(function (fx) {
          var labels = { stars: '★ 星星', fireworks: '🎆 烟花', rainbow: '🌈 彩虹', none: '○ 无' };
          return '<div class="color-preset' + ((cfg.levelupFx || 'stars') === fx ? ' is-active' : '') + '" style="width:auto;padding:6px 12px;font-size:13px;border-radius:999px" onclick="currentThemeConfig.animations=currentThemeConfig.animations||{};currentThemeConfig.animations.levelupFx=\'' + fx + '\';this.parentElement.querySelectorAll(\'.color-preset\').forEach(function(x){x.classList.remove(\'is-active\')});this.classList.add(\'is-active\')">' + labels[fx] + '</div>';
        }).join('') +
      '</div>' +
    '</div>';
}

/* ---------- 素材上传 helper ---------- */
function uploadAsset(module, key, fileType) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = fileType === 'sound' ? 'audio/mpeg,audio/wav,audio/ogg' : 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
  input.onchange = async function () {
    var file = input.files[0];
    if (!file) return;
    // 客户端预检查
    if (fileType === 'sound' && file.size > 5 * 1024 * 1024) {
      toast('音效文件建议小于 5MB', 'error'); return;
    }
    if (fileType === 'image' && file.size > 20 * 1024 * 1024) {
      toast('图片文件建议小于 20MB', 'error'); return;
    }
    var fd = new FormData();
    fd.append('file', file);
    fd.append('type', module === 'sounds' ? 'sound' : (module + '_' + key));
    fd.append('theme_id', currentThemeId);
    try {
      var r = await api('/api/themes/upload-asset', { method: 'POST', body: fd });
      // 写入当前配置
      if (!currentThemeConfig[module]) currentThemeConfig[module] = {};
      currentThemeConfig[module][key] = r.url;
      toast(r.message, 'success');
      // 局部更新预览，不重渲染整个面板（避免宠物面板 20 个节点全部重建）
      updateAssetPreview(module, key, r.url);
    } catch (e) { toast(e.message, 'error'); }
  };
  input.click();
}

/* 局部更新单个素材预览区域 */
function updateAssetPreview(module, key, url) {
  var previewId = 'preview-' + module + '-' + key;
  var preview = document.getElementById(previewId);
  if (preview) {
    preview.innerHTML = assetPreviewInner(url);
  }
  // 如果是音效，更新 audio 标签
  if (module === 'sounds') {
    var audioContainer = document.getElementById('audio-' + key);
    if (audioContainer) {
      audioContainer.innerHTML = '<audio controls src="' + esc(url) + '" style="flex:1;height:32px"></audio>';
      // 移除旧音频节点避免内存泄漏
      var oldAudio = audioContainer.querySelector('audio');
      if (oldAudio) oldAudio.load();
    }
  }
}

function assetPreviewInner(url) {
  if (!url) return '<div class="preview-placeholder">🖼</div>';
  // 添加 decoding="async" 减少主线程阻塞
  return '<img src="' + esc(url) + '" alt="预览" decoding="async" loading="lazy" style="object-fit:contain;width:100%;max-height:180px" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div class=preview-placeholder>⚠ 加载失败</div>\'">' +
    '<span class="preview-dim">已上传 · 自动适配</span>';
}
window.uploadAsset = uploadAsset;
window.updateAssetPreview = updateAssetPreview;

function assetPreviewHtml(url, id) {
  return '<div class="asset-preview" id="' + (id || '') + '">' + assetPreviewInner(url) + '</div>';
}

function newThemeForm() {
  openModal({
    title: '＋ 新建主题',
    bodyHTML:
      '<label class="field"><span class="field-label">主题名称</span><input id="nt-name" placeholder="如 海洋世界"></label>' +
      '<p class="muted" style="font-size:12px;margin-top:8px">新建后可在各卡片中配置背景、宠物、音效等。</p>',
    footHTML: '<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="nt-do">创建</button>',
    onMount: function (_, close) {
      document.getElementById('nt-do').onclick = async function () {
        var name = document.getElementById('nt-name').value.trim();
        if (!name) return toast('请输入主题名称', 'error');
        try {
          var fd = new FormData();
          // 创建一个最小 ZIP（仅占位），或直接调用创建接口
          // 由于现有 API 只有 upload（ZIP），这里用另一种方式：直接以空主题写入
          // 复用 upload 但不上传文件 → 调用 POST /api/themes（需要新增路由）
          // 方案：直接用 config 写入一个新主题
          var defaultCfg = { background:{skyColor:'#cfe8ff',grassColor:'#a8d88f',pattern:'dots'},pets:{},sounds:{},colors:{primary:'#ff8fab',mint:'#7fd8ae',sky:'#8ecae6',sun:'#ffd166',lavender:'#c8b6ff'},entry:{logo:'',title:'CLASS PET',subtitle:'课堂宠物养成系统'},fonts:{display:'ZCOOL KuaiLe',body:'Noto Sans SC'},nameplates:{showStudentId:true,cardRadius:16},animations:{idleIntensity:'normal',levelupFx:'stars'} };
          var r = await api('/api/themes/create-empty', {
            method: 'POST',
            body: JSON.stringify({ name: name, config: defaultCfg })
          });
          toast('主题「' + name + '」已创建', 'success');
          close();
          await loadThemeList();
          currentThemeId = r.id;
          document.getElementById('theme-select').value = r.id;
          renderThemeCards();
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  });
}
window.newThemeForm = newThemeForm;

/* ---------- 旧的上传 ZIP 功能（保留给宠物素材包）---------- */
/* 上传主题 ZIP 包 */
function themeUpload() {
  openModal({
    title: '⬆ 上传主题 ZIP 包（宠物素材）',
    bodyHTML: `
      <p class="asset-upload-hint" style="margin-bottom:12px">📌 ZIP 内需包含 <b>pet_level1 ~ pet_level10</b> 的图标文件。<br>支持 png / gif / svg，上传后将自动出现在「宠物形象」卡片中。</p>
      <label class="field"><span class="field-label">主题名称</span><input id="th-name" placeholder="如 像素恐龙"></label>
      <div class="upload-area" id="thdrop"><div class="upload-icon">📦</div><p>点击选择或拖入 .zip</p><input type="file" id="thfile" accept=".zip" hidden></div>
      <p id="thfname" class="muted" style="font-size:13px"></p>`,
    footHTML: '<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="thdo" disabled>上传</button>',
    onMount: function (_, close) {
      var zone = document.getElementById('thdrop'); var input = document.getElementById('thfile'); var file = null;
      zone.onclick = function () { input.click(); };
      input.onchange = function (e) { if (e.target.files[0]) setF(e.target.files[0]); };
      zone.ondragover = function (e) { e.preventDefault(); zone.classList.add('drag'); };
      zone.ondragleave = function () { zone.classList.remove('drag'); };
      zone.ondrop = function (e) { e.preventDefault(); zone.classList.remove('drag'); if (e.dataTransfer.files[0]) setF(e.dataTransfer.files[0]); };
      function setF(f) { file = f; document.getElementById('thfname').textContent = '已选择：' + f.name; document.getElementById('thdo').disabled = false; }
      document.getElementById('thdo').onclick = async function () {
        var name = document.getElementById('th-name').value.trim();
        var fd = new FormData(); fd.append('file', file); fd.append('name', name || 'theme_' + Date.now());
        try { document.getElementById('thdo').disabled = true; var r = await api('/api/themes/upload', { method: 'POST', body: fd }); toast(r.message, 'success'); close(); await loadThemeList(); renderThemeCards(); }
        catch (e) { toast(e.message, 'error'); document.getElementById('thdo').disabled = false; }
      };
    }
  });
}

/* 激活主题 */
async function activateTheme(id) {
  try { await api('/api/themes/' + id + '/activate', { method: 'POST' }); toast('已激活', 'success'); await loadThemeList(); renderThemeCards(); }
  catch (e) { toast(e.message, 'error'); }
}

/* 删除主题 */
function delTheme(id, name) {
  confirmModal('确定删除主题「' + name + '」吗？主题文件也会被清除。', async function () {
    try { await api('/api/themes/' + id, { method: 'DELETE' }); toast('已删除', 'success'); await loadThemeList(); currentThemeId = null; renderThemeCards(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

window.themeUpload = themeUpload;
window.activateTheme = activateTheme;
window.delTheme = delTheme;
window.renderThemes = loadThemeList;

/* ============================================================
 * 数据备份
 * ============================================================ */
VIEWS.backup = function () {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="card">
      <div class="card-title">💾 数据备份</div>
      <p class="info-line">备份包含完整数据库（学生/题库/教师/流水）及已上传的主题资源文件，打包为 ZIP 下载。</p>
      <button class="btn btn-primary" id="bk-down" style="margin-top:8px">⬇ 下载备份</button>
    </div>
    <div class="card">
      <div class="card-title">♻ 数据恢复</div>
      <p class="info-line">上传备份 ZIP 恢复数据。<b style="color:var(--danger)">注意：恢复会覆盖当前所有数据，且服务将自动重启。</b></p>
      <div class="upload-area" id="bkdrop" style="margin-top:12px"><div class="upload-icon">📁</div><p>点击选择或拖入备份 .zip</p><input type="file" id="bkfile" accept=".zip" hidden></div>
      <p id="bkfname" class="muted" style="font-size:13px;margin-top:8px"></p>
      <button class="btn btn-danger" id="bkdo" disabled style="margin-top:12px">开始恢复</button>
    </div>`;
  document.getElementById('bk-down').onclick = () => { window.location.href = '/api/backup'; };
  const zone = document.getElementById('bkdrop'); const input = document.getElementById('bkfile'); let file = null;
  zone.onclick = () => input.click();
  input.onchange = e => { if (e.target.files[0]) setF(e.target.files[0]); };
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('drag'); };
  zone.ondragleave = () => zone.classList.remove('drag');
  zone.ondrop = e => { e.preventDefault(); zone.classList.remove('drag'); if (e.dataTransfer.files[0]) setF(e.dataTransfer.files[0]); };
  function setF(f) { file = f; document.getElementById('bkfname').textContent = '已选择：' + f.name; document.getElementById('bkdo').disabled = false; }
  document.getElementById('bkdo').onclick = () => {
    confirmModal('⚠ 恢复将覆盖当前所有数据，且服务会自动重启。确定继续吗？', async () => {
      const fd = new FormData(); fd.append('file', file);
      try { toast('恢复中…'); const r = await api('/api/backup/restore', { method: 'POST', body: fd }); toast(r.message || '恢复完成，即将重启', 'success'); setTimeout(() => location.reload(), 2000); }
      catch (e) { toast(e.message, 'error'); }
    });
  };
};

/* ============================================================
 * 初始化
 * ============================================================ */
(async function init() {
  const token = getToken();
  if (token) {
    // 校验 token 是否仍有效
    try {
      const { data } = await api('/api/auth/me');
      if (data && data.role === 'admin') { showApp(); return; }
    } catch {}
    adminClearAuth();
  }
  document.getElementById('login-overlay').classList.remove('hidden');
})();
