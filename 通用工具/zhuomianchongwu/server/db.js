/* ============================================================
 * db.js · SQLite 数据库初始化（Node 22 内置 node:sqlite）
 * ============================================================
 * 不用 better-sqlite3（避免原生编译依赖），改用 Node 22 内置的
 * node:sqlite 模块。启动时需要加 --experimental-sqlite 标志。
 *
 * API 与 better-sqlite3 基本一致：
 *   db.exec(sql)
 *   db.prepare(sql).run(...params)  → { changes, lastInsertRowid }
 *   db.prepare(sql).get(...params)  → 行对象 / undefined
 *   db.prepare(sql).all(...params)  → 行数组
 *
 * 差异：无 db.transaction() 和 db.pragma()，这里补齐包装器。
 * ============================================================ */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'classpet.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/* ---------- transaction 包装器（对齐 better-sqlite3 用法）---------- */
db.transaction = function (fn) {
  return function (...args) {
    db.exec('BEGIN');
    try {
      const r = fn(...args);
      db.exec('COMMIT');
      return r;
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw e;
    }
  };
};

/* ---------- 建表 ---------- */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT UNIQUE NOT NULL,
      grade       TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id    TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      gender        TEXT,
      class_id      INTEGER,
      class_name    TEXT DEFAULT '三年二班',
      score         INTEGER NOT NULL DEFAULT 0,
      pet_id        TEXT DEFAULT 'default',
      pet_level     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
    CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
    -- idx_students_class_id 在 migrate() 里建（老库 ALTER 完才有这列）

    CREATE TABLE IF NOT EXISTS pet_configs (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id              TEXT NOT NULL DEFAULT 'default',
      level               INTEGER NOT NULL,
      icon_url            TEXT,
      idle_gif_url        TEXT,
      active_gif_url      TEXT,
      upgrade_audio_url   TEXT,
      max_level_audio_url TEXT,
      score_threshold     INTEGER NOT NULL,
      UNIQUE(pet_id, level)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      question_text   TEXT NOT NULL,
      options         TEXT,
      correct_answer  TEXT NOT NULL,
      question_type   TEXT NOT NULL,
      subject         TEXT,
      difficulty      INTEGER DEFAULT 1,
      knowledge       TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);

    CREATE TABLE IF NOT EXISTS score_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL,
      delta       INTEGER NOT NULL,
      reason      TEXT,
      operator    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_logs_student ON score_logs(student_id);
    CREATE INDEX IF NOT EXISTS idx_logs_time ON score_logs(created_at);

    CREATE TABLE IF NOT EXISTS teachers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name  TEXT,
      role          TEXT NOT NULL DEFAULT 'teacher',
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS themes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      background_url TEXT,
      pet_config     TEXT,
      is_active      INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
}

/* ---------- 升级阈值表（与前端 pets.js 保持一致）---------- */
const LEVEL_THRESHOLDS = [0, 5, 12, 22, 35, 55, 80, 115, 160, 220, 300];

function levelFromScore(score) {
  let lv = 1;
  for (let i = 1; i <= 10; i++) if (score >= LEVEL_THRESHOLDS[i]) lv = i;
  return lv;
}

/* ---------- seed 默认数据 ---------- */
function seedIfEmpty() {
  // 先确保有一个默认班级
  let defaultClass = db.prepare("SELECT id FROM classes WHERE name = '三年二班'").get();
  if (!defaultClass) {
    const r = db.prepare("INSERT INTO classes (name, grade) VALUES (?, ?)").run('三年二班', '三年级');
    defaultClass = { id: r.lastInsertRowid };
  }
  const defaultClassId = defaultClass.id;

  const count = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
  if (count === 0) {
    const students = [
      { sid: 'S001', name: '张小明', gender: '男', score: 0 },
      { sid: 'S002', name: '李思思', gender: '女', score: 0 },
      { sid: 'S003', name: '王浩然', gender: '男', score: 8 },
      { sid: 'S004', name: '赵雨欣', gender: '女', score: 0 },
      { sid: 'S005', name: '陈子轩', gender: '男', score: 25 },
      { sid: 'S006', name: '刘梓涵', gender: '女', score: 3 },
      { sid: 'S007', name: '黄一鸣', gender: '男', score: 0 },
      { sid: 'S008', name: '周诗琪', gender: '女', score: 12 },
    ];
    const ins = db.prepare(`
      INSERT INTO students (student_id, name, gender, class_id, class_name, score, pet_level)
      VALUES (?, ?, ?, ?, '三年二班', ?, 1)
    `);
    const updateLevel = db.prepare(`UPDATE students SET pet_level = ? WHERE id = ?`);
    const tx = db.transaction((rows) => {
      for (const s of rows) {
        const r = ins.run(s.sid, s.name, s.gender, defaultClassId, s.score);
        updateLevel.run(levelFromScore(s.score), Number(r.lastInsertRowid));
      }
    });
    tx(students);
  }

  const qCount = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
  if (qCount === 0) {
    const questions = [
      ['下列哪个是哺乳动物？', JSON.stringify(['青蛙','海豚','鳄鱼','蜥蜴']), 'B', 'single_choice', '科学', 1, '生物'],
      ['太阳从东方升起。', JSON.stringify(['正确','错误']), 'A', 'judge', '科学', 1, '自然'],
      ['2 × 8 = ?', JSON.stringify(['14','16','18','20']), 'B', 'single_choice', '数学', 1, '乘法'],
      ['"床前明月光"是李白写的。', JSON.stringify(['正确','错误']), 'A', 'judge', '语文', 1, '古诗'],
      ['中国的首都是？', JSON.stringify(['上海','广州','北京','深圳']), 'C', 'single_choice', '常识', 1, '地理'],
      ['彩虹有 7 种颜色。', JSON.stringify(['正确','错误']), 'A', 'judge', '科学', 1, '自然'],
    ];
    const ins = db.prepare(`
      INSERT INTO questions (question_text, options, correct_answer, question_type, subject, difficulty, knowledge)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((rows) => { for (const q of rows) ins.run(...q); });
    tx(questions);
  }

  const pcCount = db.prepare(`SELECT COUNT(*) as c FROM pet_configs WHERE pet_id='default'`).get().c;
  if (pcCount === 0) {
    const ins = db.prepare(`
      INSERT INTO pet_configs (pet_id, level, score_threshold) VALUES ('default', ?, ?)
    `);
    const tx = db.transaction(() => {
      for (let i = 1; i <= 10; i++) ins.run(i, LEVEL_THRESHOLDS[i]);
    });
    tx();
  }

  const tCount = db.prepare('SELECT COUNT(*) as c FROM teachers').get().c;
  if (tCount === 0) {
    const pwd = process.env.TEACHER_PASSWORD || 'classpet123';
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin123';
    const insT = db.prepare(
      `INSERT INTO teachers (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)`
    );
    insT.run('teacher', hashPassword(pwd), '老师', 'teacher');
    insT.run('admin', hashPassword(adminPwd), '管理员', 'admin');
  }

  // 确保至少有一个默认主题
  const thCount = db.prepare('SELECT COUNT(*) as c FROM themes').get().c;
  if (thCount === 0) {
    var defaultConfig = {
      background: { skyColor: '#cfe8ff', grassColor: '#a8d88f', pattern: 'dots' },
      pets: {},
      sounds: { score1: '', score3: '', score5: '', levelup: '', maxLevel: '' },
      colors: { primary: '#ff8fab', mint: '#7fd8ae', sky: '#8ecae6', sun: '#ffd166', lavender: '#c8b6ff' },
      entry: { logo: '', title: 'CLASS PET', subtitle: '课堂宠物养成系统' },
      fonts: { display: 'ZCOOL KuaiLe', body: 'Noto Sans SC' },
      nameplates: { showStudentId: true, cardRadius: 16 },
      animations: { idleIntensity: 'normal', levelupFx: 'stars' }
    };
    db.prepare(
      "INSERT INTO themes (name, background_url, pet_config, config, is_active) VALUES (?, ?, ?, ?, 1)"
    ).run('默认主题', null, '{}', JSON.stringify(defaultConfig));
  }
}

/* ---------- 安全密码哈希（crypto.scryptSync）---------- */
const crypto = require('crypto');
const SALT_LEN = 16;
const KEY_LEN = 64;

/* 格式：$scrypt$<salt_hex>$<hash_hex>
 * 兼容老 djb2 哈希：不以 $scrypt$ 开头的按旧格式验证 */
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return `$scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  // 兼容老格式（djb2）
  if (!storedHash.startsWith('$scrypt$')) {
    return storedHash === simpleHash(password);
  }
  const parts = storedHash.split('$');
  if (parts.length < 4) return false;
  const salt = parts[2];
  const expected = parts[3];
  try {
    const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* 保留 simpleHash 仅用于兼容老密码验证 */
function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(16);
}

/* ---------- 迁移：老库补 role/is_active 列 + 确保有管理员 ---------- */
function migrate() {
  const cols = db.prepare("PRAGMA table_info(teachers)").all().map(c => c.name);
  if (!cols.includes('role')) {
    db.exec("ALTER TABLE teachers ADD COLUMN role TEXT NOT NULL DEFAULT 'teacher'");
  }
  if (!cols.includes('is_active')) {
    db.exec("ALTER TABLE teachers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
  }
  // 确保至少有一个管理员账号（老库迁移场景）
  const adminCount = db.prepare("SELECT COUNT(*) as c FROM teachers WHERE role='admin'").get().c;
  if (adminCount === 0) {
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin123';
    const existing = db.prepare("SELECT id FROM teachers WHERE username='admin'").get();
    if (existing) {
      db.prepare("UPDATE teachers SET role='admin' WHERE id = ?").run(existing.id);
    } else {
      db.prepare("INSERT INTO teachers (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)")
        .run('admin', hashPassword(adminPwd), '管理员', 'admin');
    }
  }

  // 自动升级老 djb2 密码到 scrypt（透明迁移）
  const oldHashTeachers = db.prepare(
    "SELECT id, password_hash FROM teachers WHERE password_hash NOT LIKE '$scrypt$%'"
  ).all();
  if (oldHashTeachers.length > 0) {
    // 无法从 djb2 反推明文，标记为需要重置
    // 注：djb2 不可逆，首次登录时若密码正确则自动升级（在 verifyPassword 中兼容）
    // 这里仅记录日志
    console.log(`[migrate] 检测到 ${oldHashTeachers.length} 个使用旧哈希的账号，将在首次登录时自动升级`);
  }

  // ---------- 主题表加 config 列 ----------
  const themeCols = db.prepare("PRAGMA table_info(themes)").all().map(function (c) { return c.name; });
  if (!themeCols.includes('config')) {
    db.exec("ALTER TABLE themes ADD COLUMN config TEXT DEFAULT '{}'");
  }

  // ---------- 班级表迁移 ----------
  const stuCols = db.prepare("PRAGMA table_info(students)").all().map(c => c.name);
  if (!stuCols.includes('class_id')) {
    db.exec("ALTER TABLE students ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL");
    db.exec("CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id)");
  }
  // 把现有 class_name 自动建对应 classes 记录并回填 class_id
  const distinctClasses = db.prepare(
    "SELECT DISTINCT class_name FROM students WHERE class_name IS NOT NULL AND class_name != '' AND class_id IS NULL"
  ).all();
  if (distinctClasses.length) {
    const findClass = db.prepare("SELECT id FROM classes WHERE name = ?");
    const insClass = db.prepare("INSERT INTO classes (name, grade) VALUES (?, ?)");
    const updStu = db.prepare("UPDATE students SET class_id = ? WHERE class_name = ? AND class_id IS NULL");
    const tx = db.transaction(() => {
      for (const { class_name } of distinctClasses) {
        let cls = findClass.get(class_name);
        if (!cls) {
          // 从班级名提取年级（如"三年二班" → "三年级"）
          const m = String(class_name).match(/^([一二三四五六]+年级)/);
          const grade = m ? m[1] : null;
          const r = insClass.run(class_name, grade);
          cls = { id: r.lastInsertRowid };
        }
        updStu.run(cls.id, class_name);
      }
    });
    tx();
  }
}

initSchema();
migrate();
seedIfEmpty();

module.exports = db;
module.exports.LEVEL_THRESHOLDS = LEVEL_THRESHOLDS;
module.exports.levelFromScore = levelFromScore;
module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
module.exports.simpleHash = simpleHash; // 仅兼容用
