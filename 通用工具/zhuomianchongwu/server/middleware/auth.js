/* ============================================================
 * middleware/auth.js · 简单 token 鉴权
 * ============================================================
 * 单机教师场景：登录后返回一个 base64 token，前端存 sessionStorage
 * 写接口（POST）需要 token；读接口（GET）不强制
 *
 * token -> { username, role, ts }  映射（进程内，重启失效，单机可接受）
 * ============================================================ */

const db = require('../db');
const { simpleHash } = db;

/* 临时 token 池：token -> { username, role, ts } */
const tokens = new Map();

function makeToken(username, role) {
  const raw = `${username}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const t = Buffer.from(raw).toString('base64').replace(/=/g, '');
  tokens.set(t, { username, role: role || 'teacher', ts: Date.now() });
  return t;
}

function resolveToken(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return tokens.get(m[1]) || null;
}

function authRequired(req, res, next) {
  const info = resolveToken(req);
  if (!info) {
    return res.status(401).json({ success: false, message: '未登录或登录已失效' });
  }
  req.user = info; // { username, role, ts }
  next();
}

/* 仅管理员可访问 */
function adminRequired(req, res, next) {
  const info = resolveToken(req);
  if (!info) {
    return res.status(401).json({ success: false, message: '未登录或登录已失效' });
  }
  if (info.role !== 'admin') {
    return res.status(403).json({ success: false, message: '需要管理员权限' });
  }
  req.user = info;
  next();
}

/* 仅写接口需要鉴权，读接口可选鉴权（便于投影时直接打开） */
function authOptional(req, res, next) {
  const info = resolveToken(req);
  if (info) req.user = info;
  next();
}

function revokeToken(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) tokens.delete(m[1]);
}

module.exports = { makeToken, tokens, authRequired, adminRequired, authOptional, revokeToken };
