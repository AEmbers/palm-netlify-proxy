/**
 * db.js - SQLite 数据库初始化与操作
 *
 * 表结构：
 * - users: 用户账号
 * - user_progress: 课程掌握度数据
 * - user_quiz_results: 测验成绩记录
 * - user_dimension_scores: 维度得分缓存
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'learning-hub.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

/* ========== 建表 ========== */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT,
    password    TEXT NOT NULL,
    display_name TEXT,
    avatar      TEXT DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login  DATETIME
  );

  CREATE TABLE IF NOT EXISTS user_progress (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    course_id   TEXT NOT NULL,
    lesson_title TEXT,
    kp_id       TEXT,
    mastery     INTEGER DEFAULT 0,
    reviewed_count INTEGER DEFAULT 0,
    last_reviewed DATETIME,
    next_review  DATETIME,
    UNIQUE(user_id, course_id, kp_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_quiz_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    course_id   TEXT NOT NULL,
    quiz_id     TEXT,
    score       INTEGER,
    total       INTEGER,
    answers      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id     INTEGER PRIMARY KEY,
    theme       TEXT DEFAULT 'fresh-gradient',
    radar_dimension_count INTEGER DEFAULT 7,
    auto_play   INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

/* ========== 用户操作 ========== */
const UserOps = {
  create(username, hashedPassword, email, displayName) {
    const stmt = db.prepare(
      `INSERT INTO users (username, password, email, display_name) VALUES (?, ?, ?, ?)`
    );
    const info = stmt.run(username, hashedPassword, email || null, displayName || username);
    return this.getById(info.lastInsertRowid);
  },

  getByUsername(username) {
    return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
  },

  getById(id) {
    return db.prepare(`SELECT id, username, email, display_name, avatar, created_at, last_login FROM users WHERE id = ?`).get(id);
  },

  updateLastLogin(id) {
    db.prepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  },

  updateProfile(id, { display_name, email, avatar }) {
    const sets = [];
    const vals = [];
    if (display_name !== undefined) { sets.push('display_name = ?'); vals.push(display_name); }
    if (email !== undefined) { sets.push('email = ?'); vals.push(email); }
    if (avatar !== undefined) { sets.push('avatar = ?'); vals.push(avatar); }
    if (sets.length === 0) return;
    vals.push(id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
};

/* ========== 进度操作 ========== */
const ProgressOps = {
  /** 获取用户所有课程的掌握度 */
  getAll(userId) {
    return db.prepare(
      `SELECT course_id, lesson_title, kp_id, mastery, reviewed_count, last_reviewed, next_review
       FROM user_progress WHERE user_id = ?`
    ).all(userId);
  },

  /** 按课程获取掌握度 */
  getByCourse(userId, courseId) {
    return db.prepare(
      `SELECT * FROM user_progress WHERE user_id = ? AND course_id = ?`
    ).all(userId, courseId);
  },

  /** 批量 upsert 掌握度 */
  upsertBatch(userId, items) {
    const stmt = db.prepare(
      `INSERT INTO user_progress (user_id, course_id, lesson_title, kp_id, mastery, reviewed_count, last_reviewed, next_review)
       VALUES (@user_id, @course_id, @lesson_title, @kp_id, @mastery, @reviewed_count, @last_reviewed, @next_review)
       ON CONFLICT(user_id, course_id, kp_id)
       DO UPDATE SET mastery=@mastery, reviewed_count=@reviewed_count, last_reviewed=@last_reviewed, next_review=@next_review`
    );
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        stmt.run({ user_id: userId, ...r });
      }
    });
    tx(items);
  },

  /** 获取课程级别进度汇总 */
  getCourseSummary(userId) {
    return db.prepare(
      `SELECT course_id,
              COUNT(*) as total_kp,
              SUM(CASE WHEN mastery >= 80 THEN 1 ELSE 0 END) as mastered_kp,
              AVG(mastery) as avg_mastery
       FROM user_progress WHERE user_id = ?
       GROUP BY course_id`
    ).all(userId);
  }
};

/* ========== 测验结果操作 ========== */
const QuizOps = {
  save(userId, data) {
    const stmt = db.prepare(
      `INSERT INTO user_quiz_results (user_id, course_id, quiz_id, score, total, answers)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    return stmt.run(userId, data.course_id, data.quiz_id, data.score, data.total, JSON.stringify(data.answers || {}));
  },

  getAll(userId) {
    return db.prepare(
      `SELECT * FROM user_quiz_results WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId);
  },

  getByCourse(userId, courseId) {
    return db.prepare(
      `SELECT * FROM user_quiz_results WHERE user_id = ? AND course_id = ? ORDER BY created_at DESC`
    ).all(userId, courseId);
  },

  getStats(userId) {
    const row = db.prepare(
      `SELECT COUNT(*) as total_quizzes,
              AVG(score * 1.0 / NULLIF(total, 0)) as avg_score_pct,
              MAX(score * 1.0 / NULLIF(total, 0)) as max_score_pct
       FROM user_quiz_results WHERE user_id = ?`
    ).get(userId);
    return row || { total_quizzes: 0, avg_score_pct: 0, max_score_pct: 0 };
  }
};

/* ========== 设置操作 ========== */
const SettingsOps = {
  get(userId) {
    return db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`).get(userId) ||
           { user_id: userId, theme: 'fresh-gradient', radar_dimension_count: 7, auto_play: 0 };
  },

  upsert(userId, settings) {
    db.prepare(
      `INSERT INTO user_settings (user_id, theme, radar_dimension_count, auto_play)
       VALUES (@user_id, @theme, @radar_dimension_count, @auto_play)
       ON CONFLICT(user_id)
       DO UPDATE SET theme=@theme, radar_dimension_count=@radar_dimension_count, auto_play=@auto_play`
    ).run({ user_id: userId, ...settings });
  }
};

module.exports = { db, UserOps, ProgressOps, QuizOps, SettingsOps };
