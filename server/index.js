/**
 * index.js - Learning Hub 后端服务器
 *
 * 功能：
 * 1. 提供用户注册/登录/认证 API
 * 2. 存储和同步用户学习进度
 * 3. 存储测验成绩
 * 4. 提供静态文件服务（src/ 目录）
 *
 * 启动：node index.js
 * 默认端口：3000（可通过 PORT 环境变量修改）
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { authMiddleware, optionalAuth, handleRegister, handleLogin, handleLogout, handleMe, handleUpdateProfile } = require('./auth');
const { ProgressOps, QuizOps, SettingsOps } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

/* ========== 中间件 ========== */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

/* ========== 静态文件 ========== */
const SRC_DIR = path.join(__dirname, '..', 'src');
app.use(express.static(SRC_DIR));

/* ========== 认证路由 ========== */
app.post('/api/auth/register', handleRegister);
app.post('/api/auth/login', handleLogin);
app.post('/api/auth/logout', handleLogout);
app.get('/api/auth/me', authMiddleware, handleMe);
app.put('/api/auth/profile', authMiddleware, handleUpdateProfile);

/* ========== 学习进度路由 ========== */

/** GET /api/progress - 获取当前用户所有进度 */
app.get('/api/progress', authMiddleware, (req, res) => {
  const progress = ProgressOps.getAll(req.user.id);
  res.json({ progress });
});

/** GET /api/progress/summary - 获取课程级别进度汇总 */
app.get('/api/progress/summary', authMiddleware, (req, res) => {
  const summary = ProgressOps.getCourseSummary(req.user.id);
  res.json({ summary });
});

/** POST /api/progress - 批量保存进度 */
app.post('/api/progress', authMiddleware, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '缺少进度数据' });
  }
  // 限制单次最多 500 条
  const batch = items.slice(0, 500);
  ProgressOps.upsertBatch(req.user.id, batch);
  res.json({ saved: batch.length });
});

/** GET /api/progress/:courseId - 获取指定课程进度 */
app.get('/api/progress/:courseId', authMiddleware, (req, res) => {
  const progress = ProgressOps.getByCourse(req.user.id, req.params.courseId);
  res.json({ progress });
});

/* ========== 测验结果路由 ========== */

/** POST /api/quiz-results - 保存测验结果 */
app.post('/api/quiz-results', authMiddleware, (req, res) => {
  const { course_id, quiz_id, score, total, answers } = req.body;
  if (!course_id || score === undefined) {
    return res.status(400).json({ error: '缺少测验数据' });
  }
  const result = QuizOps.save(req.user.id, { course_id, quiz_id, score, total, answers });
  res.json({ id: result.lastInsertRowid });
});

/** GET /api/quiz-results - 获取所有测验结果 */
app.get('/api/quiz-results', authMiddleware, (req, res) => {
  const results = QuizOps.getAll(req.user.id);
  // 解析 answers JSON
  results.forEach(r => {
    try { r.answers = JSON.parse(r.answers); } catch(e) { r.answers = {}; }
  });
  res.json({ results });
});

/** GET /api/quiz-results/stats - 获取测验统计 */
app.get('/api/quiz-results/stats', authMiddleware, (req, res) => {
  const stats = QuizOps.getStats(req.user.id);
  res.json({ stats });
});

/** GET /api/quiz-results/:courseId - 获取指定课程的测验结果 */
app.get('/api/quiz-results/:courseId', authMiddleware, (req, res) => {
  const results = QuizOps.getByCourse(req.user.id, req.params.courseId);
  results.forEach(r => {
    try { r.answers = JSON.parse(r.answers); } catch(e) { r.answers = {}; }
  });
  res.json({ results });
});

/* ========== 用户设置路由 ========== */

/** GET /api/settings - 获取用户设置 */
app.get('/api/settings', authMiddleware, (req, res) => {
  const settings = SettingsOps.get(req.user.id);
  res.json({ settings });
});

/** PUT /api/settings - 更新用户设置 */
app.put('/api/settings', authMiddleware, (req, res) => {
  const current = SettingsOps.get(req.user.id);
  const settings = {
    theme: req.body.theme || current.theme,
    radar_dimension_count: req.body.radar_dimension_count || current.radar_dimension_count,
    auto_play: req.body.auto_play !== undefined ? req.body.auto_play : current.auto_play
  };
  SettingsOps.upsert(req.user.id, settings);
  res.json({ settings });
});

/* ========== 健康检查 ========== */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/* ========== SPA 回退（所有非 API、非静态请求返回 index.html） ========== */
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(SRC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

/* ========== 错误处理 ========== */
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

/* ========== 启动 ========== */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║  Learning Hub Server is running      ║`);
  console.log(`  ║  http://localhost:${PORT}                ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
  console.log(`  静态文件目录: ${SRC_DIR}`);
  console.log(`  API 路由前缀: /api/`);
  console.log(`  按 Ctrl+C 停止服务器\n`);
});
