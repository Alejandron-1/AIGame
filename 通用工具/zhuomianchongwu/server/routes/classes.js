/* ============================================================
 * routes/classes.js · 班级管理（仅管理员写操作）
 * ============================================================
 * GET    /api/classes           列表（带学生数统计）
 * POST   /api/classes           新增（name, grade）
 * PUT    /api/classes/:id       修改（name, grade, is_active, sort_order）
 * DELETE /api/classes/:id       删除（学生 class_id 置 NULL，class_name 保留）
 * GET    /api/classes/:id/students  该班学生列表
 * ============================================================ */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

/* GET /api/classes  列表（含学生数） */
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.grade, c.is_active, c.sort_order, c.created_at,
           (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count
    FROM classes c
    ORDER BY c.sort_order ASC, c.id ASC
  `).all();
  res.json({ success: true, data: rows });
});

/* POST /api/classes  新增 */
router.post('/', adminRequired, (req, res) => {
  const { name, grade } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: '班级名称必填' });
  }
  try {
    const r = db.prepare("INSERT INTO classes (name, grade) VALUES (?, ?)")
      .run(name.trim(), grade || null);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: '班级名称已存在' });
    }
    throw e;
  }
});

/* PUT /api/classes/:id */
router.put('/:id', adminRequired, (req, res) => {
  const id = +req.params.id;
  const { name, grade, is_active, sort_order } = req.body || {};
  const target = db.prepare("SELECT id FROM classes WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ success: false, message: '班级不存在' });

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ success: false, message: '班级名称不能为空' });
  }
  try {
    db.prepare(`
      UPDATE classes SET
        name       = COALESCE(?, name),
        grade      = COALESCE(?, grade),
        is_active  = COALESCE(?, is_active),
        sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      name !== undefined ? String(name).trim() : null,
      grade !== undefined ? grade : null,
      (is_active === 0 || is_active === 1) ? is_active : null,
      (sort_order !== undefined && sort_order !== null) ? +sort_order : null,
      id
    );
    // 同步更新学生的 class_name（保持两份字段一致，兼容旧前端）
    if (name !== undefined) {
      db.prepare("UPDATE students SET class_name = ?, updated_at = datetime('now','localtime') WHERE class_id = ?")
        .run(String(name).trim(), id);
    }
    res.json({ success: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: '班级名称已存在' });
    }
    throw e;
  }
});

/* DELETE /api/classes/batch 批量删除
 * body: { ids: [1, 2, 3] }
 * 这些班级的学生 class_id 全部置 NULL（变成未分班）
 */
router.delete('/batch', adminRequired, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ success: false, message: '请提供要删除的班级 ID' });
  const placeholders = ids.map(() => '?').join(', ');
  const studentCount = db.prepare(`SELECT COUNT(*) as c FROM students WHERE class_id IN (${placeholders})`).get(...ids).c;
  const tx = db.transaction(() => {
    db.prepare(`UPDATE students SET class_id = NULL, updated_at = datetime('now','localtime') WHERE class_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM classes WHERE id IN (${placeholders})`).run(...ids);
  });
  tx();
  res.json({ success: true, message: `已删除 ${ids.length} 个班级，${studentCount} 名学生变为未分班` });
});

/* DELETE /api/classes/:id
 * 学生不删，class_id 置 NULL（学生变成"未分班"）
 */
router.delete('/:id', adminRequired, (req, res) => {
  const id = +req.params.id;
  const target = db.prepare("SELECT id FROM classes WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ success: false, message: '班级不存在' });

  const studentCount = db.prepare("SELECT COUNT(*) as c FROM students WHERE class_id = ?").get(id).c;
  const tx = db.transaction(() => {
    db.prepare("UPDATE students SET class_id = NULL, updated_at = datetime('now','localtime') WHERE class_id = ?").run(id);
    db.prepare("DELETE FROM classes WHERE id = ?").run(id);
  });
  tx();
  res.json({ success: true, message: `已删除班级，${studentCount} 名学生变为未分班` });
});

/* GET /api/classes/:id/students  班级下学生 */
router.get('/:id/students', (req, res) => {
  const id = +req.params.id;
  const rows = db.prepare(`
    SELECT id, student_id, name, gender, class_id, class_name, score, pet_id, pet_level, created_at, updated_at
    FROM students WHERE class_id = ?
    ORDER BY student_id ASC
  `).all(id);
  res.json({ success: true, data: rows });
});

module.exports = router;
