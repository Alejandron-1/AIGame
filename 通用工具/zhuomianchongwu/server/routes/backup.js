/* ============================================================
 * routes/backup.js · 数据备份
 * ============================================================
 * GET /api/backup  下载 SQLite 文件 + uploads 目录打包的 ZIP
 * POST /api/backup/restore  上传 ZIP 恢复（同结构）
 * ============================================================ */

const express = require('express');
const router = express.Router();
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const multer = require('multer');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'classpet.db');
const UPLOADS = path.resolve(process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

/* GET /api/backup  下载备份 ZIP */
router.get('/', (req, res) => {
  const zip = new AdmZip();
  // 数据库文件
  if (fs.existsSync(DB_PATH)) zip.addLocalFile(DB_PATH, 'data');
  // WAL/SHM 文件也带上（如果存在）
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) zip.addLocalFile(p, 'data');
  }
  // uploads 目录
  if (fs.existsSync(UPLOADS)) {
    zip.addLocalFolder(UPLOADS, 'uploads');
  }
  const buf = zip.toBuffer();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="classpet-backup-${Date.now()}.zip"`);
  res.send(buf);
});

/* POST /api/backup/restore  上传备份 ZIP 恢复 */
router.post('/restore', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '请上传 ZIP 备份文件' });
  let zip;
  try { zip = new AdmZip(req.file.buffer); }
  catch { return res.status(400).json({ success: false, message: '无效的 ZIP 文件' }); }

  // 简单校验：必须包含 data/classpet.db
  const entries = zip.getEntries();
  const hasDb = entries.some(e => e.entryName.includes('classpet.db'));
  if (!hasDb) return res.status(400).json({ success: false, message: 'ZIP 中未找到 classpet.db' });

  // 关闭当前 db 连接
  // 注意：node:sqlite 的 DatabaseSync 无 close() 方法，直接用 process.exit 重启即可
  try { if (typeof db.close === 'function') db.close(); } catch (_) { /* node:sqlite 无 close */ }

  // 写出文件
  for (const e of entries) {
    if (e.isDirectory) continue;
    let rel = e.entryName;
    // 去除可能的前缀
    if (rel.startsWith('data/')) {
      const dest = path.join(path.dirname(DB_PATH), path.basename(rel));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, e.getData());
    } else if (rel.startsWith('uploads/')) {
      const dest = path.join(UPLOADS, rel.slice('uploads/'.length));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, e.getData());
    }
  }

  res.json({ success: true, message: '恢复完成，请重启服务' });
  // 进程退出让 pm2/手动重启
  setTimeout(() => process.exit(0), 500);
});

module.exports = router;
