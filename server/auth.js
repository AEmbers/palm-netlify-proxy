/**
 * auth.js - JWT 认证中间件
 *
 * 功能：
 * 1. 注册：用户名+密码 → bcrypt 哈希存储 → 返回 JWT
 * 2. 登录：验证密码 → 返回 JWT（支持 rememberMe 30天 vs 1天）
 * 3. 中间件：验证 JWT，注入 req.user
 * 4. 登出：清除 cookie
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserOps } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'learning-hub-secret-key-2026';
const COOKIE_NAME = 'lh_token';

/* ========== 工具函数 ========== */
function generateToken(user, rememberMe) {
  const expiresIn = rememberMe ? '30d' : '1d';
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn }
  );
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    avatar: user.avatar,
    created_at: user.created_at,
    last_login: user.last_login
  };
}

/* ========== 路由处理函数 ========== */

/** POST /api/auth/register */
function handleRegister(req, res) {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需 2-20 个字符' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }

  const existing = UserOps.getByUsername(username);
  if (existing) {
    return res.status(409).json({ error: '该用户名已被注册' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const user = UserOps.create(username, hashed, email);
  UserOps.updateLastLogin(user.id);

  const token = generateToken(user, true); // 注册后默认记住
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
    sameSite: 'lax',
    path: '/'
  });

  res.json({ user: sanitizeUser(user), token });
}

/** POST /api/auth/login */
function handleLogin(req, res) {
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = UserOps.getByUsername(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  UserOps.updateLastLogin(user.id);
  const token = generateToken(user, rememberMe);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    path: '/'
  });

  res.json({ user: sanitizeUser(user), token });
}

/** POST /api/auth/logout */
function handleLogout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
}

/** GET /api/auth/me */
function handleMe(req, res) {
  res.json({ user: sanitizeUser(req.user) });
}

/** PUT /api/auth/profile */
function handleUpdateProfile(req, res) {
  const { display_name, email, avatar } = req.body;
  UserOps.updateProfile(req.user.id, { display_name, email, avatar });
  const updated = UserOps.getById(req.user.id);
  res.json({ user: sanitizeUser(updated) });
}

/* ========== JWT 验证中间件 ========== */
function authMiddleware(req, res, next) {
  // 优先从 cookie 读取
  let token = req.cookies && req.cookies[COOKIE_NAME];

  // 其次从 Authorization header 读取
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: '未登录', code: 'NO_TOKEN' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = UserOps.getById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: '用户不存在', code: 'USER_NOT_FOUND' });
    }
    req.user = user;
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return res.status(401).json({ error: '登录已过期，请重新登录', code });
  }
}

/** 可选认证中间件 - 不强制登录，但如果有 token 则解析用户 */
function optionalAuth(req, res, next) {
  let token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = UserOps.getById(decoded.id);
    } catch (e) {
      // token 无效也不阻止，只是不设置 user
    }
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  authMiddleware,
  optionalAuth,
  handleRegister,
  handleLogin,
  handleLogout,
  handleMe,
  handleUpdateProfile,
  sanitizeUser
};
