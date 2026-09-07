/* ============================================================
 * routes/auth.js · 登录 / 改密码 / 退出
 * ============================================================ */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword, verifyPassword } = db;
const { makeToken, authRequired, revokeToken } = require('../middleware/auth');

/* POST /api/auth/login
 * body: { username, password }
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入账号和密码' });
  }
  const teacher = db.prepare('SELECT * FROM teachers WHERE username = ?').get(username);
  if (!teacher || !verifyPassword(password, teacher.password_hash)) {
    return res.status(401).json({ success: false, message: '账号或密码错误' });
  }
  // 自动升级旧 djb2 密码到 scrypt
  if (!teacher.password_hash.startsWith('$scrypt$')) {
    db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?')
      .run(hashPassword(password), teacher.id);
  }
  if (!teacher.is_active) {
    return res.status(403).json({ success: false, message: '账号已被停用，请联系管理员' });
  }
  const token = makeToken(teacher.username, teacher.role);
  res.json({
    success: true,
    token,
    role: teacher.role,
    teacher: { username: teacher.username, display_name: teacher.display_name, role: teacher.role },
  });
});

/* GET /api/auth/me  当前登录信息（需 token） */
router.get('/me', authRequired, (req, res) => {
  const t = db.prepare('SELECT username, display_name, role, is_active FROM teachers WHERE username = ?').get(req.user.username);
  res.json({ success: true, data: t });
});

/* POST /api/auth/logout  (需 token) */
router.post('/logout', authRequired, (req, res) => {
  revokeToken(req);
  res.json({ success: true });
});

/* POST /api/auth/change-password  (需 token)
 * body: { old_password, new_password }
 */
router.post('/change-password', authRequired, (req, res) => {
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password || new_password.length < 4) {
    return res.status(400).json({ success: false, message: '新密码至少 4 位' });
  }
  const target = db.prepare('SELECT * FROM teachers WHERE username = ?').get(req.user.username);
  if (!target || !verifyPassword(old_password, target.password_hash)) {
    return res.status(401).json({ success: false, message: '旧密码错误' });
  }
  db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), target.id);
  res.json({ success: true, message: '密码已修改' });
});

module.exports = router;
