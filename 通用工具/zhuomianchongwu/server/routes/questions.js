/* ============================================================
 * routes/questions.js · 题库管理
 * ============================================================ */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/* GET /api/questions
 * query: subject, type, difficulty, keyword, page, page_size, random=1
 */
router.get('/', (req, res) => {
  const { subject, type, difficulty, keyword, page = 1, page_size = 100, random } = req.query;
  const where = [];
  const params = [];
  if (subject) { where.push('subject = ?'); params.push(subject); }
  if (type) { where.push('question_type = ?'); params.push(type); }
  if (difficulty) { where.push('difficulty = ?'); params.push(+difficulty); }
  if (keyword) { where.push('question_text LIKE ?'); params.push(`%${keyword}%`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  // random=1 → 抽一题（用于抢答/答题模式）
  if (random === '1' || random === 'true') {
    const excludeId = req.query.exclude ? +req.query.exclude : 0;
    // 拼 WHERE：已有条件 + id 排除
    const conds = [...where];
    const params2 = [...params];
    if (excludeId) { conds.push('id != ?'); params2.push(excludeId); }
    const whereSql2 = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const row = db.prepare(
      `SELECT * FROM questions ${whereSql2} ORDER BY RANDOM() LIMIT 1`
    ).get(...params2);
    return res.json({ success: true, data: row || null });
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM questions ${whereSql}`).get(...params).c;
  const offset = (Math.max(1, +page) - 1) * +page_size;
  const rows = db.prepare(
    `SELECT * FROM questions ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, +page_size, offset);
  res.json({ success: true, total, page: +page, page_size: +page_size, data: rows });
});

/* POST /api/questions */
router.post('/', authRequired, (req, res) => {
  const { question_text, options, correct_answer, question_type, subject, difficulty, knowledge } = req.body || {};
  if (!question_text || !correct_answer || !question_type) {
    return res.status(400).json({ success: false, message: '题目、答案、类型必填' });
  }
  const r = db.prepare(
    `INSERT INTO questions (question_text, options, correct_answer, question_type, subject, difficulty, knowledge)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    question_text,
    Array.isArray(options) ? JSON.stringify(options) : (options || null),
    correct_answer,
    question_type,
    subject || null,
    difficulty || 1,
    knowledge || null
  );
  res.json({ success: true, id: r.lastInsertRowid });
});

/* PUT /api/questions/:id */
router.put('/:id', authRequired, (req, res) => {
  const id = +req.params.id;
  const { question_text, options, correct_answer, question_type, subject, difficulty, knowledge } = req.body || {};
  const exists = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ success: false, message: '题目不存在' });
  db.prepare(
    `UPDATE questions SET
       question_text = COALESCE(?, question_text),
       options = COALESCE(?, options),
       correct_answer = COALESCE(?, correct_answer),
       question_type = COALESCE(?, question_type),
       subject = COALESCE(?, subject),
       difficulty = COALESCE(?, difficulty),
       knowledge = COALESCE(?, knowledge)
     WHERE id = ?`
  ).run(
    question_text || null,
    Array.isArray(options) ? JSON.stringify(options) : (options || null),
    correct_answer || null,
    question_type || null,
    subject || null,
    difficulty || null,
    knowledge || null,
    id
  );
  res.json({ success: true });
});

/* DELETE /api/questions/batch 批量删除
 * body: { ids: [1, 2, 3] }
 */
router.delete('/batch', authRequired, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ success: false, message: '请提供要删除的题目 ID' });
  const placeholders = ids.map(() => '?').join(', ');
  db.prepare(`DELETE FROM questions WHERE id IN (${placeholders})`).run(...ids);
  res.json({ success: true, message: `已删除 ${ids.length} 道题目` });
});

/* DELETE /api/questions/:id */
router.delete('/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(+req.params.id);
  res.json({ success: true });
});

/* POST /api/questions/import  Excel 导入
 * 表头：题目 / 选项A / 选项B / 选项C / 选项D / 正确答案 / 类型 / 学科 / 难度 / 知识点
 * 判断题：只填 选项A=正确 选项B=错误，正确答案填 A 或 B
 */
router.post('/import', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '请上传 Excel 文件' });
  const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return res.status(400).json({ success: false, message: 'Excel 无有效工作表' });
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  const find = (row, keys) => {
    for (const k of Object.keys(row)) {
      const low = k.trim().toLowerCase();
      if (keys.some(t => low.includes(t))) return String(row[k] ?? '').trim();
    }
    return '';
  };

  let inserted = 0, skipped = 0;
  const ins = db.prepare(
    `INSERT INTO questions (question_text, options, correct_answer, question_type, subject, difficulty, knowledge)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const row of rows) {
      const text = find(row, ['题目','题干','question']);
      if (!text) { skipped++; continue; }
      const optA = find(row, ['选项a','a项','a']);
      const optB = find(row, ['选项b','b项','b']);
      const optC = find(row, ['选项c','c项','c']);
      const optD = find(row, ['选项d','d项','d']);
      const opts = [optA, optB, optC, optD].filter(x => x);
      const correct = find(row, ['正确答案','答案','answer']).toUpperCase().slice(0, 1) || 'A';
      const type = find(row, ['类型','type']) || (opts.length === 2 ? 'judge' : 'single_choice');
      const subject = find(row, ['学科','subject']) || null;
      const difficulty = +find(row, ['难度','difficulty']) || 1;
      const knowledge = find(row, ['知识点','knowledge']) || null;
      ins.run(text, JSON.stringify(opts), correct, type, subject, difficulty, knowledge);
      inserted++;
    }
  });
  tx();
  res.json({ success: true, message: `导入完成：新增 ${inserted}，跳过 ${skipped}`, inserted, skipped });
});

module.exports = router;
