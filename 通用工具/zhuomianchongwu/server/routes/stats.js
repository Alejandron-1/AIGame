/* ============================================================
 * routes/stats.js · 仪表盘统计（仅管理员）
 * ============================================================ */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminRequired } = require('../middleware/auth');

router.use(adminRequired);

/* GET /api/stats  仪表盘汇总 */
router.get('/', (req, res) => {
  const students = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
  const questions = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
  const teachers = db.prepare("SELECT COUNT(*) as c FROM teachers").get().c;
  const activeTeachers = db.prepare("SELECT COUNT(*) as c FROM teachers WHERE is_active=1").get().c;

  // 班级分布（按 class_id join classes，兼容无班级学生）
  const classes = db.prepare(
    `SELECT COALESCE(c.name, '未分班') AS class_name, COUNT(*) as count
     FROM students s
     LEFT JOIN classes c ON s.class_id = c.id
     GROUP BY COALESCE(c.name, '未分班')
     ORDER BY count DESC`
  ).all();

  // 今日加分次数与总分
  const today = db.prepare(
    `SELECT COUNT(*) as times, COALESCE(SUM(delta),0) as total
     FROM score_logs WHERE date(created_at) = date('now','localtime')`
  ).get();

  // 近 7 天加分趋势
  const trend = db.prepare(
    `SELECT date(created_at) as day, COUNT(*) as times, COALESCE(SUM(delta),0) as total
     FROM score_logs
     WHERE created_at >= datetime('now','localtime','-6 days','start of day')
     GROUP BY date(created_at) ORDER BY day ASC`
  ).all();

  // 宠物等级分布
  const levelDist = db.prepare(
    `SELECT pet_level, COUNT(*) as count FROM students GROUP BY pet_level ORDER BY pet_level ASC`
  ).all();

  // 学科分布
  const subjectDist = db.prepare(
    `SELECT subject, COUNT(*) as count FROM questions WHERE subject IS NOT NULL GROUP BY subject ORDER BY count DESC`
  ).all();

  // 加分最多的前 5 名学生
  const topStudents = db.prepare(
    `SELECT s.student_id, s.name, COALESCE(c.name, s.class_name, '未分班') AS class_name, s.score, s.pet_level
     FROM students s
     LEFT JOIN classes c ON s.class_id = c.id
     ORDER BY s.score DESC LIMIT 5`
  ).all();

  res.json({
    success: true,
    data: {
      counts: { students, questions, teachers, activeTeachers, classes: classes.length },
      classes,
      today: { times: today.times || 0, total: today.total || 0 },
      trend,
      levelDist,
      subjectDist,
      topStudents,
    },
  });
});

module.exports = router;
