/* ============================================================
 * routes/themes.js · 主题包上传与列表
 * ============================================================
 * 上传 ZIP：
 *   - 自动剥离多余的父级文件夹
 *   - 校验是否包含 pet_level1 ~ pet_level10 资源（图标/idle/active 至少有图标）
 *   - 解压到 uploads/themes/<name>/
 * ============================================================ */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const UPLOADS = path.resolve(process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads'));
const THEMES_DIR = path.join(UPLOADS, 'themes');
if (!fs.existsSync(THEMES_DIR)) fs.mkdirSync(THEMES_DIR, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/* GET /api/themes  主题列表 */
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, name, background_url, pet_config, config, is_active, created_at FROM themes ORDER BY id DESC').all();
  // 解析 config JSON
  const data = rows.map(function (r) {
    var cfg = {};
    try { cfg = JSON.parse(r.config || '{}'); } catch (_) {}
    return {
      id: r.id, name: r.name, background_url: r.background_url,
      pet_config: r.pet_config, config: cfg, is_active: r.is_active, created_at: r.created_at
    };
  });
  res.json({ success: true, data: data });
});

/* POST /api/themes/upload  上传 ZIP
 * form-data: file=<zip>, name=<theme-name>
 */
router.post('/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '请上传 ZIP 文件' });
  const themeName = (req.body.name || 'theme_' + Date.now()).trim().replace(/[^\w\u4e00-\u9fa5-]/g, '_');
  const targetDir = path.join(THEMES_DIR, themeName);

  let zip;
  try { zip = new AdmZip(req.file.buffer); }
  catch { return res.status(400).json({ success: false, message: '无效的 ZIP 文件' }); }

  // 找出 zip 内共同父级，剥离
  const entries = zip.getEntries().filter(e => !e.isDirectory);
  if (entries.length === 0) return res.status(400).json({ success: false, message: 'ZIP 内无文件' });

  // 校验：至少要包含 pet_level1 ~ pet_level10 的图标
  const levelFiles = {}; // level -> [filenames]
  for (let i = 1; i <= 10; i++) levelFiles[i] = [];
  for (const e of entries) {
    const base = path.basename(e.entryName).toLowerCase();
    for (let i = 1; i <= 10; i++) {
      if (base.includes(`pet_level${i}`) || base.includes(`pet_lv${i}`)) {
        levelFiles[i].push(e.entryName);
      }
    }
  }
  const missing = [];
  for (let i = 1; i <= 10; i++) if (levelFiles[i].length === 0) missing.push(i);
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `缺少等级资源：pet_level${missing.join(', pet_level')}`,
      missing_levels: missing,
    });
  }

  // 解压
  if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const e of entries) {
    // 剥离共同父级
    let rel = e.entryName;
    const commonPrefix = findCommonPrefix(entries.map(x => x.entryName));
    if (commonPrefix) rel = rel.slice(commonPrefix.length);
    const dest = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, e.getData());
  }

  // 写库（默认非激活）
  const petConfig = {};
  for (let i = 1; i <= 10; i++) {
    petConfig[i] = levelFiles[i].map(f => {
      let rel = f;
      const commonPrefix = findCommonPrefix(entries.map(x => x.entryName));
      if (commonPrefix) rel = rel.slice(commonPrefix.length);
      return `/uploads/themes/${themeName}/${rel.split(path.sep).join('/')}`;
    });
  }
  db.prepare(
    `INSERT INTO themes (name, background_url, pet_config, is_active) VALUES (?, ?, ?, 0)`
  ).run(themeName, null, JSON.stringify(petConfig));

  res.json({
    success: true,
    message: `主题「${themeName}」上传成功，共 ${entries.length} 个文件`,
    name: themeName,
    file_count: entries.length,
  });
});

/* DELETE /api/themes/batch 批量删除
 * body: { ids: [1, 2, 3] }
 * 同时删除服务器上的主题文件夹
 */
router.delete('/batch', authRequired, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ success: false, message: '请提供要删除的主题 ID' });
  // 先查所有要删除的主题名称，用于删文件夹
  const rows = db.prepare(`SELECT id, name FROM themes WHERE id IN (${ids.map(() => '?').join(', ')})`).all(...ids);
  const tx = db.transaction(() => {
    for (const row of rows) {
      const dir = path.join(THEMES_DIR, row.name);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      db.prepare('DELETE FROM themes WHERE id = ?').run(row.id);
    }
  });
  tx();
  res.json({ success: true, message: `已删除 ${rows.length} 个主题包` });
});

/* POST /api/themes/:id/activate  激活某主题 */
router.post('/:id/activate', authRequired, (req, res) => {
  const id = +req.params.id;
  const tx = db.transaction(() => {
    db.prepare(`UPDATE themes SET is_active = 0`).run();
    db.prepare(`UPDATE themes SET is_active = 1 WHERE id = ?`).run(id);
  });
  tx();
  res.json({ success: true });
});

/* DELETE /api/themes/:id */
router.delete('/:id', authRequired, (req, res) => {
  const id = +req.params.id;
  const row = db.prepare('SELECT name FROM themes WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ success: false, message: '主题不存在' });
  const dir = path.join(THEMES_DIR, row.name);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  db.prepare('DELETE FROM themes WHERE id = ?').run(id);
  res.json({ success: true });
});

/* GET /api/themes/active-config  当前活跃主题的完整配置（供前端课堂端读取） */
router.get('/active-config', (req, res) => {
  const active = db.prepare('SELECT id, name, background_url, pet_config, config FROM themes WHERE is_active = 1 LIMIT 1').get();
  if (!active) {
    return res.json({ success: true, data: null, message: '无活跃主题，使用默认配置' });
  }
  var cfg = {};
  try { cfg = JSON.parse(active.config || '{}'); } catch (_) {}
  res.json({ success: true, data: {
    id: active.id, name: active.name, background_url: active.background_url,
    pet_config: active.pet_config, config: cfg
  }});
});

/* POST /api/themes/create-empty  创建空主题（无 ZIP，纯配置） */
router.post('/create-empty', authRequired, (req, res) => {
  var name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: '主题名称必填' });
  var config = req.body.config || {};
  try {
    var r = db.prepare(
      "INSERT INTO themes (name, background_url, pet_config, config, is_active) VALUES (?, NULL, '{}', ?, 0)"
    ).run(name, JSON.stringify(config));
    res.json({ success: true, id: r.lastInsertRowid, name: name });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: '主题名称已存在' });
    }
    throw e;
  }
});

/* PUT /api/themes/:id/config  保存主题配置
 * body: { config: { background: {...}, pets: {...}, ... } }
 * 部分更新：与现有 config 深度合并
 */
router.put('/:id/config', authRequired, (req, res) => {
  const id = +req.params.id;
  const theme = db.prepare('SELECT id, config FROM themes WHERE id = ?').get(id);
  if (!theme) return res.status(404).json({ success: false, message: '主题不存在' });

  var current = {};
  try { current = JSON.parse(theme.config || '{}'); } catch (_) {}
  var incoming = req.body.config || {};

  // 浅合并各模块
  var merged = {};
  var keys = Object.keys(Object.assign({}, current, incoming));
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (incoming[k] !== undefined) {
      merged[k] = Object.assign({}, current[k] || {}, incoming[k]);
    } else {
      merged[k] = current[k];
    }
  }

  db.prepare('UPDATE themes SET config = ? WHERE id = ?').run(JSON.stringify(merged), id);
  res.json({ success: true, config: merged });
});

/* POST /api/themes/upload-asset  上传单个素材文件（背景图/图标/音效）
 * form-data: file=<file>, type=<background|pet_icon|pet_idle|pet_active|sound|logo>
 * 文件存储到 uploads/themes/<theme-id>/ 目录
 * 自动处理图片自适应：保存原始文件，返回 URL 供前端 CSS object-fit 使用
 */
router.post('/upload-asset', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '请选择文件' });

  var assetType = req.body.type || 'other';
  var themeId = req.body.theme_id || 'shared';

  // 支持的文件类型
  var allowedImages = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
  var allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
  var extMap = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg'
  };

  if (assetType === 'sound' && !allowedAudio.includes(req.file.mimetype)) {
    return res.status(400).json({ success: false, message: '音效仅支持 mp3 / wav / ogg 格式' });
  }
  if (assetType !== 'sound' && !allowedImages.includes(req.file.mimetype)) {
    return res.status(400).json({ success: false, message: '图片仅支持 png / jpg / gif / webp / svg 格式' });
  }

  var ext = extMap[req.file.mimetype] || path.extname(req.file.originalname) || '.bin';
  var filename = assetType + '_' + Date.now() + ext;
  var themeDir = path.join(THEMES_DIR, String(themeId));
  if (!fs.existsSync(themeDir)) fs.mkdirSync(themeDir, { recursive: true });

  var destPath = path.join(themeDir, filename);
  fs.writeFileSync(destPath, req.file.buffer);

  var url = '/uploads/themes/' + themeId + '/' + filename;
  res.json({
    success: true,
    url: url,
    filename: filename,
    size: req.file.size,
    type: req.file.mimetype,
    message: assetType === 'sound' ? '音效上传成功' : '素材上传成功（将自动适配尺寸）'
  });
});

function findCommonPrefix(paths) {
  if (paths.length === 0) return '';
  // 取公共前缀目录（以 / 结尾）
  let prefix = paths[0];
  for (const p of paths) {
    while (p.indexOf(prefix) !== 0) {
      prefix = prefix.slice(0, prefix.lastIndexOf('/'));
      if (!prefix) return '';
    }
  }
  // 确保以 / 结尾
  if (prefix && !prefix.endsWith('/')) prefix = prefix.slice(0, prefix.lastIndexOf('/') + 1);
  return prefix;
}

module.exports = router;
