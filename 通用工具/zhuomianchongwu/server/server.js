/* ============================================================
 * server.js · 课堂宠物系统后端主入口
 * ============================================================ */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_PATH = path.resolve(process.env.PUBLIC_PATH || path.join(__dirname, '..'));
const UPLOADS = path.resolve(process.env.UPLOADS_PATH || path.join(__dirname, 'uploads'));

// 确保上传目录存在
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

// 启动数据库初始化（require 即触发建表与 seed）
require('./db');

/* ---------- 中间件 ---------- */
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 静态资源：uploads 目录（主题包图片可直接访问）
app.use('/uploads', express.static(UPLOADS, {
  maxAge: '30d',
  immutable: true,
}));

/* ---------- API 路由 ---------- */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/students', require('./routes/students'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/students', require('./routes/score')); // score 路由挂到 /api/students/:id/* 下
app.use('/api/themes', require('./routes/themes'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/stats', require('./routes/stats'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, time: new Date().toISOString(), uptime: process.uptime() });
});

/* ---------- 静态资源（前端）---------- */
app.use(express.static(PUBLIC_PATH, {
  // 给 css/js 强缓存 1 天，HTML 不缓存
  setHeaders: (res, filePath) => {
    if (/\.(css|js|svg|png|jpg|gif|mp3)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA fallback：未命中的路由返回对应 HTML
app.get('*', (req, res) => {
  const pathMap = {
    '/admin':   'admin.html',
    '/display': 'display.html',
    '/display.html': 'display.html',
  };
  for (const [route, file] of Object.entries(pathMap)) {
    if (req.path === route || req.path === route + '/') {
      const filePath = path.join(PUBLIC_PATH, file);
      if (fs.existsSync(filePath)) return res.sendFile(filePath);
    }
  }
  res.sendFile(path.join(PUBLIC_PATH, 'index.html'));
});

/* ---------- 全局错误处理 ---------- */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
});

/* ---------- 启动 ---------- */
app.listen(PORT, () => {
  console.log(`\n  🐾  ClassPet server running at http://localhost:${PORT}`);
  console.log(`      Public:  ${PUBLIC_PATH}`);
  console.log(`      Uploads: ${UPLOADS}`);
  console.log(`      Default teacher password: ${process.env.TEACHER_PASSWORD || 'classpet123'}\n`);
});
