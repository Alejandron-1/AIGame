/* ============================================================
 * routes/score.js · 课堂互动 / 加分 / 撤销
 * ============================================================
 * 修复点：
 *   - 撤销接口不再无脑减 1 分，而是基于 score_logs 最近一条回滚
 *   - 加分/撤销都用事务保证一致：写流水 + 更新学生
 *   - 加分自动检测并返回 pet_level 是否升级
 * ============================================================ */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { levelFromScore } = db;
const { authRequired } = require('../middleware/auth');

/* POST /api/students/:id/add-score
 * body: { score, reason }
 * response: { success, current_score, pet_level, leveled_up }
 */
router.post('/:id/add-score', authRequired, (req, res) => {
  const id = +req.params.id;
  const { score: delta, reason = 'add' } = req.body || {};
  if (!Number.isFinite(+delta) || +delta === 0) {
    return res.status(400).json({ success: false, message: 'score 必须为非零数字' });
  }
  const student = db.prepare('SELECT id, score FROM students WHERE id = ?').get(id);
  if (!student) return res.status(404).json({ success: false, message: '学生不存在' });

  const oldLevel = levelFromScore(student.score);
  const newScore = Math.max(0, student.score + +delta); // 防负数
  const newLevel = levelFromScore(newScore);

  const tx = db.transaction(() => {
    db.prepare(`UPDATE students SET score = ?, pet_level = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(newScore, newLevel, id);
    db.prepare(`INSERT INTO score_logs (student_id, delta, reason, operator) VALUES (?, ?, ?, ?)`)
      .run(id, +delta, reason, req.teacher || 'unknown');
  });
  tx();

  res.json({
    success: true,
    current_score: newScore,
    pet_level: newLevel,
    leveled_up: newLevel > oldLevel,
  });
});

/* POST /api/students/:id/undo-score
 * 修复原规范缺陷：撤销最近一次加分，按流水回滚
 * response: { success, current_score, undone_delta, undone_log_id }
 */
router.post('/:id/undo-score', authRequired, (req, res) => {
  const id = +req.params.id;
  const student = db.prepare('SELECT id, score FROM students WHERE id = ?').get(id);
  if (!student) return res.status(404).json({ success: false, message: '学生不存在' });

  const lastLog = db.prepare(
    `SELECT * FROM score_logs WHERE student_id = ? ORDER BY id DESC LIMIT 1`
  ).get(id);
  if (!lastLog) {
    return res.status(400).json({ success: false, message: '没有可撤销的加分记录' });
  }

  const oldLevel = levelFromScore(student.score);
  const newScore = Math.max(0, student.score - lastLog.delta);
  const newLevel = levelFromScore(newScore);

  const tx = db.transaction(() => {
    db.prepare(`UPDATE students SET score = ?, pet_level = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(newScore, newLevel, id);
    // 删除该流水（也可改为标记 is_undone，这里简化处理）
    db.prepare(`DELETE FROM score_logs WHERE id = ?`).run(lastLog.id);
  });
  tx();

  res.json({
    success: true,
    current_score: newScore,
    pet_level: newLevel,
    leveled_down: newLevel < oldLevel,
    undone_delta: lastLog.delta,
    undone_log_id: lastLog.id,
  });
});

/* GET /api/students/:id/score-logs  查看某学生加分流水 */
router.get('/:id/score-logs', (req, res) => {
  const id = +req.params.id;
  const limit = Math.min(100, +req.query.limit || 20);
  const rows = db.prepare(
    `SELECT id, delta, reason, operator, created_at FROM score_logs WHERE student_id = ? ORDER BY id DESC LIMIT ?`
  ).all(id, limit);
  res.json({ success: true, data: rows });
});

module.exports = router;
