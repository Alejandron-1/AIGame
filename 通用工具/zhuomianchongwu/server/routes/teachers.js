/* ============================================================
 * routes/teachers.js · 教师账号管理（仅管理员）
 * ============================================================
 * GET    /api/teachers            列表
 * POST   /api/teachers            新增
 * PUT    /api/teachers/:id        修改（display_name/role/is_active）
 * DELETE /api/teachers/:id        删除（禁止删自己/最后一个管理员）
 * POST   /api/teachers/:id/reset-password  重置密码
 * ============================================================ */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword } = db;
const { adminRequired } = require('../middleware/auth');

router.use(adminRequired);

/* GET /api/teachers */
router.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT id, username, display_name, role, is_active, created_at FROM teachers ORDER BY id ASC`
  ).all();
  res.json({ success: true, data: rows });
});

/* POST /api/teachers  body: { username, password, display_name, role } */
router.post('/', (req, res) => {
  const { username, password, display_name, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '账号和密码必填' });
  }
  if (role && !['admin', 'teacher'].includes(role)) {
    return res.status(400).json({ success: false, message: 'role 只能是 admin 或 teacher' });
  }
  try {
    const r = db.prepare(
      `INSERT INTO teachers (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)`
    ).run(username, hashPassword(password), display_name || username, role || 'teacher');
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: '账号已存在' });
    }
    throw e;
  }
});

/* PUT /api/teachers/:id  body: { display_name?, role?, is_active? } */
router.put('/:id', (req, res) => {
  const id = +req.params.id;
  const { display_name, role, is_active } = req.body || {};
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ success: false, message: '账号不存在' });

  if (role && !['admin', 'teacher'].includes(role)) {
    return res.status(400).json({ success: false, message: 'role 只能是 admin 或 teacher' });
  }
  // 防止把最后一个管理员降级或停用
  if ((role === 'teacher' || is_active === 0) && target.role === 'admin') {
    const adminCount = db.prepare(`SELECT COUNT(*) as c FROM teachers WHERE role='admin' AND is_active=1`).get().c;
    if (adminCount <= 1) {
      return res.status(400).json({ success: false, message: '至少保留一个启用的管理员' });
    }
  }
  db.prepare(
    `UPDATE teachers SET
       display_name = COALESCE(?, display_name),
       role = COALESCE(?, role),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`
  ).run(display_name || null, role || null, (is_active === 0 || is_active === 1) ? is_active : null, id);
  res.json({ success: true });
});

/* DELETE /api/teachers/batch 批量删除
 * body: { ids: [1, 2, 3] }
 * 禁止删除自己；禁止删除最后一个启用的管理员
 */
router.delete('/batch', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ success: false, message: '请提供要删除的教师 ID' });
  // 禁止删除自己
  if (ids.includes(req.user.id)) {
    return res.status(400).json({ success: false, message: '不能删除当前登录账号' });
  }
  // 检查是否试图删除最后一个启用管理员
  const targetAdmins = ids.filter(id => {
    const t = db.prepare('SELECT role, is_active FROM teachers WHERE id = ?').get(id);
    return t && t.role === 'admin' && t.is_active;
  });
  if (targetAdmins.length > 0) {
    const adminCount = db.prepare(`SELECT COUNT(*) as c FROM teachers WHERE role='admin' AND is_active=1`).get().c;
    if (adminCount <= targetAdmins.length) {
      return res.status(400).json({ success: false, message: '至少保留一个启用的管理员，无法删除' });
    }
  }
  const placeholders = ids.map(() => '?').join(', ');
  db.prepare(`DELETE FROM teachers WHERE id IN (${placeholders})`).run(...ids);
  res.json({ success: true, message: `已删除 ${ids.length} 个教师账号` });
});

/* DELETE /api/teachers/:id */
router.delete('/:id', (req, res) => {
  const id = +req.params.id;
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ success: false, message: '账号不存在' });
  if (target.username === req.user.username) {
    return res.status(400).json({ success: false, message: '不能删除当前登录账号' });
  }
  if (target.role === 'admin') {
    const adminCount = db.prepare(`SELECT COUNT(*) as c FROM teachers WHERE role='admin' AND is_active=1`).get().c;
    if (adminCount <= 1) {
      return res.status(400).json({ success: false, message: '至少保留一个管理员，无法删除' });
    }
  }
  db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
  res.json({ success: true });
});

/* POST /api/teachers/:id/reset-password  body: { new_password } */
router.post('/:id/reset-password', (req, res) => {
  const id = +req.params.id;
  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ success: false, message: '新密码至少 4 位' });
  }
  const target = db.prepare('SELECT id FROM teachers WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ success: false, message: '账号不存在' });
  db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), id);
  res.json({ success: true, message: '密码已重置' });
});

module.exports = router;
