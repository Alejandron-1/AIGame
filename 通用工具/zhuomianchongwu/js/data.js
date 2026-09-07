/* ============================================================
 * data.js · 默认数据 + localStorage 存储
 * ============================================================
 * 说明：
 *   - 占位原型用 localStorage 持久化，老师关闭浏览器再打开数据仍在
 *   - 真实部署时如需多教师共享，可改写为后端 SQLite（参见技术规范文档）
 *   - 默认数据可在 resetApp() 时恢复
 * ============================================================ */

const STORAGE_KEY = 'classpet.v1';
const LOG_KEY = 'classpet.scorelogs.v1';

/* ---------- 默认学生（6 个示例）---------- */
const DEFAULT_STUDENTS = [
  { student_id: 'S001', name: '张小明', gender: '男', class_name: '三年二班', score: 0 },
  { student_id: 'S002', name: '李思思', gender: '女', class_name: '三年二班', score: 0 },
  { student_id: 'S003', name: '王浩然', gender: '男', class_name: '三年二班', score: 8 },
  { student_id: 'S004', name: '赵雨欣', gender: '女', class_name: '三年二班', score: 0 },
  { student_id: 'S005', name: '陈子轩', gender: '男', class_name: '三年二班', score: 25 },
  { student_id: 'S006', name: '刘梓涵', gender: '女', class_name: '三年二班', score: 3 },
  { student_id: 'S007', name: '黄一鸣', gender: '男', class_name: '三年二班', score: 0 },
  { student_id: 'S008', name: '周诗琪', gender: '女', class_name: '三年二班', score: 12 },
];

/* ---------- 默认题库（示例 6 道）---------- */
const DEFAULT_QUESTIONS = [
  {
    id: 1,
    question_text: '下列哪个是哺乳动物？',
    options: ['青蛙', '海豚', '鳄鱼', '蜥蜴'],
    correct_answer: 'B',
    question_type: 'single_choice',
  },
  {
    id: 2,
    question_text: '太阳从东方升起。',
    options: ['正确', '错误'],
    correct_answer: 'A',
    question_type: 'judge',
  },
  {
    id: 3,
    question_text: '2 × 8 = ?',
    options: ['14', '16', '18', '20'],
    correct_answer: 'B',
    question_type: 'single_choice',
  },
  {
    id: 4,
    question_text: '"床前明月光"是李白写的。',
    options: ['正确', '错误'],
    correct_answer: 'A',
    question_type: 'judge',
  },
  {
    id: 5,
    question_text: '中国的首都是？',
    options: ['上海', '广州', '北京', '深圳'],
    correct_answer: 'C',
    question_type: 'single_choice',
  },
  {
    id: 6,
    question_text: '彩虹有 7 种颜色。',
    options: ['正确', '错误'],
    correct_answer: 'A',
    question_type: 'judge',
  },
];

/* ---------- 加分操作流水（用于撤销）---------- */
/* 每条记录：{ id, studentId, delta, time } */

const DataStore = {
  /* ---------- 读取 ---------- */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this._bootstrap();
      const data = JSON.parse(raw);
      // 兼容字段补全
      data.students = (data.students || []).map((s, i) => ({
        id: s.id || (i + 1),
        student_id: s.student_id || '',
        name: s.name || '未命名',
        gender: s.gender || '',
        class_name: s.class_name || '三年二班',
        score: s.score || 0,
        pet_id: s.pet_id || 'default',
      }));
      data.questions = data.questions || DEFAULT_QUESTIONS;
      data.className = data.className || '三年二班';
      return data;
    } catch (e) {
      console.warn('[data] 读取失败，使用默认数据', e);
      return this._bootstrap();
    }
  },

  loadLogs() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    } catch { return []; }
  },

  /* ---------- 保存 ---------- */
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      students: state.students,
      questions: state.questions,
      className: state.className,
    }));
  },

  saveLogs(logs) {
    // 只保留最近 100 条，避免无限增长
    localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-100)));
  },

  /* ---------- 重置为默认 ---------- */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOG_KEY);
    return this._bootstrap();
  },

  /* ---------- 内部：首次初始化 ---------- */
  _bootstrap() {
    const data = {
      students: DEFAULT_STUDENTS.map((s, i) => ({
        id: i + 1,
        ...s,
        pet_id: 'default',
      })),
      questions: DEFAULT_QUESTIONS,
      className: '三年二班',
    };
    this.save(data);
    return data;
  },
};

window.DataStore = DataStore;
