#!/usr/bin/env node
/* ============================================================
 * setup-fire-theme.js · 创建"洛克王国火系"主题
 * 使用方式：node setup-fire-theme.js
 * ============================================================
 * 火系进化链 10 级映射：
 *   L1-L2  火花（精灵+头像）
 *   L3-L4  焰火（精灵+头像）
 *   L5-L6  火神（精灵+头像）
 *   L7     喵喵（火灵兽·融合形态）
 *   L8     喵呜（焰灵兽·进阶融合）
 *   L9     魔力喵（神火灵兽·完美融合）
 *   L10    烈火战神（究极形态）
 * ============================================================ */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, 'data', 'classpet.db'));
const db = new DatabaseSync(DB_PATH);

// pet_config 映射：等级 → [图片URL]
const petConfig = {
  "1":  ["/uploads/themes/pets/01_火花_精灵.png"],
  "2":  ["/uploads/themes/pets/01_火花_头像.png"],
  "3":  ["/uploads/themes/pets/02_焰火_精灵.png"],
  "4":  ["/uploads/themes/pets/02_焰火_头像.png"],
  "5":  ["/uploads/themes/pets/03_火神_精灵.png"],
  "6":  ["/uploads/themes/pets/03_火神_头像.png"],
  "7":  ["/uploads/themes/pets/05_喵喵_精灵.png"],
  "8":  ["/uploads/themes/pets/06_喵呜_精灵.png"],
  "9":  ["/uploads/themes/pets/07_魔力喵_精灵.png"],
  "10": ["/uploads/themes/pets/04_烈火战神_头像.png"]
};

// 每级名称
const levelNames = {
  "1":  "初生火花",
  "2":  "探索火花",
  "3":  "进化焰火",
  "4":  "炽热焰火",
  "5":  "觉醒火神",
  "6":  "进阶火神",
  "7":  "火灵兽",
  "8":  "焰灵兽",
  "9":  "神火灵兽",
  "10": "终极烈火战神"
};

// 背景图（用火神精灵图）
const backgroundUrl = "/uploads/themes/pets/03_火神_精灵.png";

// 完整 config
const config = {
  background: {
    skyColor: '#1a0a00',
    grassColor: '#2d1810',
    pattern: 'dots'
  },
  pets: {
    levelNames: levelNames
  },
  sounds: {},
  colors: {
    primary: '#ff4444',
    mint: '#ff8c00',
    sky: '#2d1810',
    sun: '#ff6600',
    lavender: '#ffd700'
  },
  entry: {
    logo: '',
    title: 'ROCKINGDOM PETS',
    subtitle: '洛克王国·火系进化'
  },
  fonts: {
    display: 'ZCOOL KuaiLe',
    body: 'Noto Sans SC'
  },
  nameplates: {
    showStudentId: true,
    cardRadius: 16
  },
  animations: {
    idleIntensity: 'normal',
    levelupFx: 'flame'
  }
};

// ====== 开始操作 ======

try {
  // 1. 检查是否已存在同名主题
  const existing = db.prepare("SELECT id FROM themes WHERE name = ?").get('洛克王国火系');
  if (existing) {
    // 存在则更新
    db.prepare(`UPDATE themes SET background_url = ?, pet_config = ?, config = ? WHERE id = ?`)
      .run(backgroundUrl, JSON.stringify(petConfig), JSON.stringify(config), existing.id);
    console.log(`[UPDATE] 主题「洛克王国火系」(id=${existing.id}) 已更新`);
  } else {
    // 新建
    const r = db.prepare(
      `INSERT INTO themes (name, background_url, pet_config, config, is_active) VALUES (?, ?, ?, ?, 0)`
    ).run('洛克王国火系', backgroundUrl, JSON.stringify(petConfig), JSON.stringify(config));
    console.log(`[INSERT] 主题「洛克王国火系」(id=${r.lastInsertRowid}) 已创建`);
  }

  // 2. 激活主题（其他全部取消激活）
  const tx = (function () {
    db.exec('BEGIN');
    try {
      db.prepare(`UPDATE themes SET is_active = 0`).run();
      db.prepare(`UPDATE themes SET is_active = 1 WHERE name = '洛克王国火系'`).run();
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw e;
    }
  })();
  console.log(`[ACTIVATE] 已激活「洛克王国火系」为主题`);

  // 3. 验证
  const active = db.prepare("SELECT id, name, pet_config FROM themes WHERE is_active = 1").get();
  if (active) {
    const pc = JSON.parse(active.pet_config);
    console.log(`\n验证通过！活跃主题: ${active.name}`);
    console.log(`pet_config 等级数: ${Object.keys(pc).length}`);
    for (let i = 1; i <= 10; i++) {
      if (pc[i]) {
        console.log(`  LV.${i}: ${pc[i][0]}`);
      } else {
        console.log(`  LV.${i}: 缺失！`);
      }
    }
  }

  // 4. 检查图片文件是否存在
  console.log(`\n图片文件检查:`);
  const petsDir = path.resolve(__dirname, 'uploads', 'themes', 'pets');
  let allOk = true;
  for (let i = 1; i <= 10; i++) {
    const url = petConfig[String(i)][0];
    const filename = path.basename(url);
    const filePath = path.join(petsDir, filename);
    if (fs.existsSync(filePath)) {
      const size = (fs.statSync(filePath).size / 1024).toFixed(1);
      console.log(`  [OK] LV.${i}: ${filename} (${size} KB)`);
    } else {
      console.log(`  [MISS] LV.${i}: ${filename}`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log(`\n全部就绪！重启服务器后即可使用新主题。`);
  } else {
    console.log(`\n部分图片缺失，请检查 uploads/themes/pets/ 目录。`);
  }

} catch (e) {
  console.error('错误:', e.message);
  process.exit(1);
}
