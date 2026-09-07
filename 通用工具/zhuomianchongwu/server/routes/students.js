/* ============================================================
 * routes/students.js · 学生管理
 * ============================================================
 * GET    /api/students          列表（支持 class_name/keyword/分页）
 * POST   /api/students/import   Excel 导入
 * POST   /api/students          新增单个
 * PUT    /api/students/:id      修改
 * DELETE /api/students/:id      删除
 * ============================================================ */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* GET /api/students
 * query: class_name, class_id, keyword, unassigned(1), page, page_size
 */
router.get('/', (req, res) => {
  const { class_name, class_id, keyword, unassigned, page = 1, page_size = 200 } = req.query;
  const where = [];
  const params = [];
  if (class_name) { where.push('class_name = ?'); params.push(class_name); }
  if (class_id) { where.push('class_id = ?'); params.push(+class_id); }
  if (unassigned === '1' || unassigned === 'true') { where.push('class_id IS NULL'); }
  if (keyword) {
    where.push('(name LIKE ? OR student_id LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) as c FROM students ${whereSql}`).get(...params).c;
  const offset = (Math.max(1, +page) - 1) * +page_size;
  const rows = db.prepare(
    `SELECT id, student_id, name, gender, class_id, class_name, score, pet_id, pet_level, created_at, updated_at
     FROM students ${whereSql}
     ORDER BY student_id ASC
     LIMIT ? OFFSET ?`
  ).all(...params, +page_size, offset);

  res.json({ success: true, total, page: +page, page_size: +page_size, data: rows });
});

/* POST /api/students  新增单个
 * body: { student_id, name, gender, class_id?, class_name? }
 * 若给 class_id 则用之；否则用 class_name（找不到对应班级就只填 class_name）
 */
router.post('/', authRequired, (req, res) => {
  const { student_id, name, gender, class_id, class_name } = req.body || {};
  if (!student_id || !name) return res.status(400).json({ success: false, message: '学号和姓名必填' });
  let cid = null;
  let cname = class_name || '三年二班';
  if (class_id) {
    const cls = db.prepare('SELECT id, name FROM classes WHERE id = ?').get(+class_id);
    if (cls) { cid = cls.id; cname = cls.name; }
  } else if (class_name) {
    const cls = db.prepare('SELECT id, name FROM classes WHERE name = ?').get(class_name);
    if (cls) { cid = cls.id; cname = cls.name; }
  }
  try {
    const r = db.prepare(
      `INSERT INTO students (student_id, name, gender, class_id, class_name) VALUES (?, ?, ?, ?, ?)`
    ).run(student_id, name, gender || null, cid, cname);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: '学号已存在' });
    }
    throw e;
  }
});

/* PUT /api/students/:id */
router.put('/:id', authRequired, (req, res) => {
  const id = +req.params.id;
  const { name, gender, class_id, class_name, student_id } = req.body || {};
  const exists = db.prepare('SELECT id FROM students WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ success: false, message: '学生不存在' });

  // 计算新的 class_id 和 class_name
  let newCid = null;
  let newCname = null;
  if (class_id !== undefined) {
    if (class_id === null) {
      newCid = null; // 移出班级
    } else {
      const cls = db.prepare('SELECT id, name FROM classes WHERE id = ?').get(+class_id);
      if (cls) { newCid = cls.id; newCname = cls.name; }
    }
  }
  if (class_name !== undefined && class_name !== null && !newCname) {
    // 没指定 class_id 但指定了 class_name，尝试关联
    const cls = db.prepare('SELECT id, name FROM classes WHERE name = ?').get(class_name);
    if (cls) { newCid = cls.id; newCname = cls.name; }
    else { newCname = class_name; }
  }

  db.prepare(
    `UPDATE students SET
       name = COALESCE(?, name),
       gender = COALESCE(?, gender),
       class_id = CASE WHEN ? = 1 THEN ? ELSE class_id END,
       class_name = COALESCE(?, class_name),
       student_id = COALESCE(?, student_id),
       updated_at = datetime('now','localtime')
     WHERE id = ?`
  ).run(
    name || null,
    gender || null,
    class_id !== undefined ? 1 : 0,
    newCid,
    newCname,
    student_id || null,
    id
  );
  res.json({ success: true });
});

/* DELETE /api/students/batch 批量删除
 * body: { ids: [1, 2, 3] }
 * 同时删除这些学生的加分流水
 */
router.delete('/batch', authRequired, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ success: false, message: '请提供要删除的学生 ID' });
  const placeholders = ids.map(() => '?').join(', ');
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM score_logs WHERE student_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM students WHERE id IN (${placeholders})`).run(...ids);
  });
  tx();
  res.json({ success: true, message: `已删除 ${ids.length} 名学生及其加分记录` });
});

/* DELETE /api/students/:id */
router.delete('/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM score_logs WHERE student_id = ?').run(+req.params.id);
  db.prepare('DELETE FROM students WHERE id = ?').run(+req.params.id);
  res.json({ success: true });
});

/* POST /api/students/import  Excel 导入
 * Excel 列：学号 / 姓名 / 性别 / 班级（顺序可乱，按表头识别）
 * 可选 query: class_id=xxx → 全部学生强制归入该班级（忽略 Excel 中的班级列）
 * 行为：upsert —— 学号已存在则更新姓名/性别/班级，否则新增
 */
router.post('/import', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '请上传 Excel 文件' });
  // 可选：指定导入到某个班级
  let forceClass = null;
  if (req.query.class_id) {
    forceClass = db.prepare('SELECT id, name FROM classes WHERE id = ?').get(+req.query.class_id);
    if (!forceClass) return res.status(400).json({ success: false, message: '指定的班级不存在' });
  }
  const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return res.status(400).json({ success: false, message: 'Excel 无有效工作表' });
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  // 表头别名映射
  const findCol = (row, keys) => {
    for (const k of Object.keys(row)) {
      const low = k.trim().toLowerCase();
      if (keys.some(t => low.includes(t))) return row[k];
    }
    return '';
  };

  const resolveClass = (rawName) => {
    if (forceClass) return { id: forceClass.id, name: forceClass.name };
    const name = String(rawName || '').trim();
    if (!name) return { id: null, name: '三年二班' };
    const cls = db.prepare('SELECT id, name FROM classes WHERE name = ?').get(name);
    return cls ? { id: cls.id, name: cls.name } : { id: null, name };
  };

  let inserted = 0, updated = 0, skipped = 0;
  const findExisting = db.prepare('SELECT id FROM students WHERE student_id = ?');
  const insert = db.prepare(
    `INSERT INTO students (student_id, name, gender, class_id, class_name) VALUES (?, ?, ?, ?, ?)`
  );
  const update = db.prepare(
    `UPDATE students SET name=?, gender=?, class_id=?, class_name=?, updated_at=datetime('now','localtime') WHERE id=?`
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const sid = String(findCol(row, ['学号','student','id']) || '').trim();
      const name = String(findCol(row, ['姓名','name']) || '').trim();
      if (!sid || !name) { skipped++; continue; }
      const gender = String(findCol(row, ['性别','gender']) || '').trim() || null;
      const cls = resolveClass(findCol(row, ['班级','class']));
      const exist = findExisting.get(sid);
      if (exist) { update.run(name, gender, cls.id, cls.name, exist.id); updated++; }
      else { insert.run(sid, name, gender, cls.id, cls.name); inserted++; }
    }
  });
  tx();

  res.json({
    success: true,
    message: `导入完成：新增 ${inserted}，更新 ${updated}，跳过 ${skipped}` + (forceClass ? `（已归入「${forceClass.name}」）` : ''),
    inserted, updated, skipped,
  });
});

/* GET /api/students/export  导出当前学生为 Excel（备份用）
 * 可选 query: class_id=xxx → 只导出该班级
 */
router.get('/export', (req, res) => {
  const where = [];
  const params = [];
  if (req.query.class_id) { where.push('class_id = ?'); params.push(+req.query.class_id); }
  if (req.query.unassigned === '1') { where.push('class_id IS NULL'); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(
    `SELECT student_id, name, gender, class_name, score FROM students ${whereSql} ORDER BY student_id`
  ).all(...params);
  const ws = xlsx.utils.json_to_sheet(rows.map(r => ({
    '学号': r.student_id, '姓名': r.name, '性别': r.gender, '班级': r.class_name, '分数': r.score,
  })));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'students');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="students-${Date.now()}.xlsx"`);
  res.send(buf);
});

module.exports = router;
