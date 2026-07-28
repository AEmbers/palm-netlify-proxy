/**
 * auth.js - 前端用户认证与数据同步模块
 *
 * 功能：
 * 1. 登录/注册界面（全屏覆盖层）
 * 2. 自动登录（页面加载时检查 token）
 * 3. 学习进度双向同步（localStorage ↔ 后端）
 * 4. 测验结果同步到后端
 * 5. 用户信息管理
 *
 * 用法：
 *   在 index.html 中 <script src="quiz-system.js"> 之前加载本文件
 *   AuthSystem.init() 会自动检查登录状态
 *
 * API：
 *   AuthSystem.getCurrentUser()  - 获取当前用户
 *   AuthSystem.isLoggedIn()      - 是否已登录
 *   AuthSystem.logout()          - 登出
 *   AuthSystem.saveProgress()     - 保存进度到后端
 *   AuthSystem.saveQuizResult()  - 保存测验结果到后端
 */
(function () {
  'use strict';

  const API_BASE = '';  // 同源，无需跨域
  const SYNC_INTERVAL = 30000; // 30秒自动同步一次
  const LS_KEY = 'lh_auth_user'; // localStorage 存储用户信息

  let currentUser = null;
  let syncTimer = null;
  let pendingProgress = [];

  /* ======================================================================
   * 一、登录/注册 UI
   * ====================================================================== */
  const UI = {
    overlay: null,

    create() {
      if (document.getElementById('auth-overlay')) return;
      const overlay = document.createElement('div');
      overlay.id = 'auth-overlay';
      overlay.innerHTML = this._getHTML();
      document.body.appendChild(overlay);
      this.overlay = overlay;

      // 注入样式
      this._injectStyles();

      // 绑定事件
      this._bindEvents();
    },

    show() {
      this.create();
      this.overlay.classList.add('auth-visible');
      document.body.style.overflow = 'hidden';
    },

    hide() {
      if (this.overlay) {
        this.overlay.classList.remove('auth-visible');
        document.body.style.overflow = '';
      }
    },

    _getHTML() {
      return `
        <div class="auth-card">
          <div class="auth-logo">
            <span class="auth-logo-icon">🎓</span>
            <h1>个人学习中心</h1>
            <p>登录以同步你的学习进度</p>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">登录</button>
            <button class="auth-tab" data-tab="register">注册</button>
          </div>

          <!-- 登录表单 -->
          <form class="auth-form" id="auth-form-login">
            <div class="auth-field">
              <label>用户名</label>
              <input type="text" id="login-username" placeholder="输入用户名" autocomplete="username" required>
            </div>
            <div class="auth-field">
              <label>密码</label>
              <div class="auth-pwd-wrap">
                <input type="password" id="login-password" placeholder="输入密码" autocomplete="current-password" required>
                <button type="button" class="auth-pwd-toggle" data-target="login-password">👁</button>
              </div>
            </div>
            <label class="auth-remember">
              <input type="checkbox" id="login-remember" checked>
              <span>记住密码（30天内自动登录）</span>
            </label>
            <div class="auth-error" id="login-error"></div>
            <button type="submit" class="auth-submit">登 录</button>
          </form>

          <!-- 注册表单 -->
          <form class="auth-form" id="auth-form-register" style="display:none">
            <div class="auth-field">
              <label>用户名</label>
              <input type="text" id="reg-username" placeholder="2-20 个字符" autocomplete="username" required>
            </div>
            <div class="auth-field">
              <label>密码</label>
              <div class="auth-pwd-wrap">
                <input type="password" id="reg-password" placeholder="至少 6 位" autocomplete="new-password" required>
                <button type="button" class="auth-pwd-toggle" data-target="reg-password">👁</button>
              </div>
            </div>
            <div class="auth-field">
              <label>邮箱（选填）</label>
              <input type="email" id="reg-email" placeholder="用于找回密码" autocomplete="email">
            </div>
            <div class="auth-error" id="reg-error"></div>
            <button type="submit" class="auth-submit">注 册</button>
          </form>

          <div class="auth-footer">
            <span class="auth-guest-hint">首次使用请先注册，数据将安全保存</span>
          </div>
        </div>
      `;
    },

    _injectStyles() {
      if (document.getElementById('auth-styles')) return;
      const style = document.createElement('style');
      style.id = 'auth-styles';
      style.textContent = `
        #auth-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
          display: flex; align-items: center; justify-content: center;
          z-index: 99999;
          opacity: 0; pointer-events: none;
          transition: opacity 0.4s ease;
        }
        #auth-overlay.auth-visible {
          opacity: 1; pointer-events: auto;
        }
        .auth-card {
          width: 380px; max-width: 90vw;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 36px 32px 28px;
          box-shadow: 0 24px 80px -16px rgba(0,0,0,0.3);
          transform: translateY(20px) scale(0.95);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        #auth-overlay.auth-visible .auth-card {
          transform: translateY(0) scale(1);
        }
        .auth-logo {
          text-align: center; margin-bottom: 24px;
        }
        .auth-logo-icon {
          font-size: 40px;
          display: block; margin-bottom: 8px;
        }
        .auth-logo h1 {
          font-size: 22px; font-weight: 800;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .auth-logo p {
          font-size: 13px; color: #8e99a8; margin-top: 4px;
        }
        .auth-tabs {
          display: flex; gap: 4px;
          background: rgba(0,0,0,0.04);
          border-radius: 12px; padding: 4px;
          margin-bottom: 20px;
        }
        .auth-tab {
          flex: 1; padding: 10px;
          border: none; border-radius: 8px;
          background: transparent;
          font-size: 14px; font-weight: 600;
          color: #8e99a8;
          cursor: pointer;
          transition: all 0.2s;
        }
        .auth-tab.active {
          background: #fff;
          color: #667eea;
          box-shadow: 0 2px 8px -2px rgba(0,0,0,0.1);
        }
        .auth-form {
          display: flex; flex-direction: column; gap: 14px;
        }
        .auth-field {
          display: flex; flex-direction: column; gap: 6px;
        }
        .auth-field label {
          font-size: 12px; font-weight: 700;
          color: #5a6578;
          letter-spacing: 0.5px;
        }
        .auth-field input {
          padding: 12px 14px;
          border: 2px solid #e8eaed;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: #fff;
        }
        .auth-field input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
        }
        .auth-pwd-wrap {
          position: relative;
        }
        .auth-pwd-wrap input {
          width: 100%; padding-right: 42px;
          box-sizing: border-box;
        }
        .auth-pwd-toggle {
          position: absolute; right: 8px; top: 50%;
          transform: translateY(-50%);
          border: none; background: none;
          font-size: 18px; cursor: pointer;
          padding: 4px 8px;
          opacity: 0.5;
          transition: opacity 0.2s;
        }
        .auth-pwd-toggle:hover { opacity: 1; }
        .auth-remember {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: #5a6578;
          cursor: pointer;
        }
        .auth-remember input {
          width: 16px; height: 16px;
          accent-color: #667eea;
        }
        .auth-error {
          font-size: 13px; color: #e74c3c;
          min-height: 18px;
          text-align: center;
        }
        .auth-submit {
          padding: 14px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          letter-spacing: 2px;
        }
        .auth-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px -4px rgba(102,126,234,0.5);
        }
        .auth-submit:active {
          transform: translateY(0);
        }
        .auth-footer {
          margin-top: 20px; text-align: center;
        }
        .auth-guest-hint {
          font-size: 11px; color: #b0b8c4;
        }
        @media (max-width: 420px) {
          .auth-card { padding: 28px 20px 20px; border-radius: 20px; }
          .auth-logo h1 { font-size: 20px; }
        }
      `;
      document.head.appendChild(style);
    },

    _bindEvents() {
      // Tab 切换
      this.overlay.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this.overlay.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const target = tab.dataset.tab;
          this.overlay.querySelector('#auth-form-login').style.display = target === 'login' ? '' : 'none';
          this.overlay.querySelector('#auth-form-register').style.display = target === 'register' ? '' : 'none';
          // 清除错误
          this.overlay.querySelector('#login-error').textContent = '';
          this.overlay.querySelector('#reg-error').textContent = '';
        });
      });

      // 密码可见切换
      this.overlay.querySelectorAll('.auth-pwd-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = this.overlay.querySelector('#' + btn.dataset.target);
          input.type = input.type === 'password' ? 'text' : 'password';
        });
      });

      // 登录提交
      this.overlay.querySelector('#auth-form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = this.overlay.querySelector('#login-username').value.trim();
        const password = this.overlay.querySelector('#login-password').value;
        const remember = this.overlay.querySelector('#login-remember').checked;
        const errEl = this.overlay.querySelector('#login-error');
        errEl.textContent = '';

        const btn = e.target.querySelector('.auth-submit');
        btn.disabled = true;
        btn.textContent = '登录中...';

        try {
          await AuthSystem.login(username, password, remember);
          this.hide();
        } catch (err) {
          errEl.textContent = err.message || '登录失败';
        } finally {
          btn.disabled = false;
          btn.textContent = '登 录';
        }
      });

      // 注册提交
      this.overlay.querySelector('#auth-form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = this.overlay.querySelector('#reg-username').value.trim();
        const password = this.overlay.querySelector('#reg-password').value;
        const email = this.overlay.querySelector('#reg-email').value.trim();
        const errEl = this.overlay.querySelector('#reg-error');
        errEl.textContent = '';

        const btn = e.target.querySelector('.auth-submit');
        btn.disabled = true;
        btn.textContent = '注册中...';

        try {
          await AuthSystem.register(username, password, email);
          this.hide();
        } catch (err) {
          errEl.textContent = err.message || '注册失败';
        } finally {
          btn.disabled = false;
          btn.textContent = '注 册';
        }
      });
    }
  };

  /* ======================================================================
   * 二、用户栏（已登录后的右上角用户信息）
   * ====================================================================== */
  const UserBar = {
    bar: null,

    create() {
      if (this.bar) return;
      const bar = document.createElement('div');
      bar.className = 'user-bar';
      bar.innerHTML = `
        <span class="user-avatar">${currentUser.display_name ? currentUser.display_name[0].toUpperCase() : 'U'}</span>
        <span class="user-name">${currentUser.display_name || currentUser.username}</span>
        <button class="user-logout-btn" title="退出登录">退出</button>
      `;
      document.body.appendChild(bar);
      this.bar = bar;

      bar.querySelector('.user-logout-btn').addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
          AuthSystem.logout();
        }
      });

      this._injectStyles();
    },

    update(user) {
      currentUser = user;
      if (this.bar) {
        this.bar.querySelector('.user-name').textContent = user.display_name || user.username;
        this.bar.querySelector('.user-avatar').textContent = user.display_name ? user.display_name[0].toUpperCase() : 'U';
      }
    },

    _injectStyles() {
      if (document.getElementById('user-bar-styles')) return;
      const style = document.createElement('style');
      style.id = 'user-bar-styles';
      style.textContent = `
        .user-bar {
          position: fixed; top: 16px; right: 16px;
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(12px);
          border-radius: 24px;
          box-shadow: 0 2px 12px -4px rgba(0,0,0,0.1);
          z-index: 9999;
          font-size: 13px;
        }
        .user-avatar {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
          font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .user-name {
          font-weight: 600; color: #1a202c;
          max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .user-logout-btn {
          padding: 4px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
          font-size: 12px; font-weight: 600;
          color: #e74c3c;
          cursor: pointer;
          transition: all 0.2s;
        }
        .user-logout-btn:hover {
          background: #fef2f2;
          border-color: #fecaca;
        }
        @media (max-width: 480px) {
          .user-bar { top: 8px; right: 8px; padding: 6px 8px; }
          .user-name { max-width: 80px; }
        }
      `;
      document.head.appendChild(style);
    }
  };

  /* ======================================================================
   * 三、数据同步模块
   * ====================================================================== */
  const Sync = {
    /**
     * 从后端加载用户进度到 localStorage
     */
    async loadProgress() {
      try {
        const resp = await fetch(API_BASE + '/api/progress');
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.progress && data.progress.length > 0) {
          // 将后端进度数据写入 localStorage，供 QuizSystem 使用
          const masteryData = {};
          for (const p of data.progress) {
            const key = p.course_id + '::' + p.kp_id;
            masteryData[key] = {
              mastery: p.mastery,
              reviewedCount: p.reviewed_count,
              lastReviewed: p.last_reviewed,
              nextReview: p.next_review
            };
          }
          localStorage.setItem('lh_mastery_sync', JSON.stringify(masteryData));

          // 通知 QuizSystem 重新加载
          if (window.QuizSystem && window.QuizSystem.MasteryManager) {
            const MM = window.QuizSystem.MasteryManager;
            if (MM.loadFromSync) {
              MM.loadFromSync(masteryData);
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] 加载进度失败:', err.message);
      }
    },

    /**
     * 收集当前 localStorage 中的进度数据
     */
    collectProgress() {
      const items = [];
      try {
        const raw = localStorage.getItem('quiz_mastery_data');
        if (!raw) return items;
        const data = JSON.parse(raw);
        for (const course of (data.courses || [])) {
          for (const lesson of (course.lessons || [])) {
            for (const kp of (lesson.knowledge_points || [])) {
              const kpId = kp.id || kp.title;
              const mastery = this._getMastery(course.id, lesson.title, kpId);
              if (mastery > 0) {
                items.push({
                  course_id: course.id,
                  lesson_title: lesson.title,
                  kp_id: kpId,
                  mastery: mastery.level || 0,
                  reviewed_count: mastery.reviewedCount || 0,
                  last_reviewed: mastery.lastReviewed || null,
                  next_review: mastery.nextReview || null
                });
              }
            }
          }
        }
      } catch (e) {
        // localStorage 数据格式可能不同，尝试从 __QUIZ_KP_DATA__ 获取
        const kpData = window.__QUIZ_KP_DATA__ || [];
        for (const course of kpData) {
          for (const lesson of (course.lessons || [])) {
            for (const kp of (lesson.knowledge_points || [])) {
              const kpId = kp.id || kp.title;
              if (window.QuizSystem && window.QuizSystem.MasteryManager) {
                const MM = window.QuizSystem.MasteryManager;
                const mastery = MM.getKPMastery ? MM.getKPMastery(course.id, lesson.title, kpId) : 0;
                if (mastery > 0) {
                  items.push({
                    course_id: course.id,
                    lesson_title: lesson.title,
                    kp_id: kpId,
                    mastery: mastery,
                    reviewed_count: 0,
                    last_reviewed: new Date().toISOString(),
                    next_review: null
                  });
                }
              }
            }
          }
        }
      }
      return items;
    },

    _getMastery(courseId, lessonTitle, kpId) {
      // 尝试从 QuizSystem 获取掌握度
      if (window.QuizSystem && window.QuizSystem.MasteryManager) {
        const MM = window.QuizSystem.MasteryManager;
        if (MM.getKPMastery) {
          return MM.getKPMastery(courseId, lessonTitle, kpId);
        }
      }
      return 0;
    },

    /**
     * 将进度保存到后端
     */
    async saveProgress() {
      if (!currentUser) return;
      const items = this.collectProgress();
      if (items.length === 0) return;

      try {
        await fetch(API_BASE + '/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
      } catch (err) {
        console.warn('[Auth] 保存进度失败:', err.message);
      }
    },

    /**
     * 保存测验结果到后端
     */
    async saveQuizResult(courseId, quizId, score, total, answers) {
      if (!currentUser) return;
      try {
        await fetch(API_BASE + '/api/quiz-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course_id: courseId,
            quiz_id: quizId,
            score: score,
            total: total,
            answers: answers || {}
          })
        });
      } catch (err) {
        console.warn('[Auth] 保存测验结果失败:', err.message);
      }
    },

    /**
     * 启动定时同步
     */
    startAutoSync() {
      if (syncTimer) clearInterval(syncTimer);
      syncTimer = setInterval(() => {
        this.saveProgress();
      }, SYNC_INTERVAL);

      // 页面关闭前同步
      window.addEventListener('beforeunload', () => {
        this.saveProgress();
      });

      // 可见性变化时同步
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.saveProgress();
        }
      });
    },

    stopAutoSync() {
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
    }
  };

  /* ======================================================================
   * 四、主控制器
   * ====================================================================== */
  const AuthSystem = {
    /**
     * 初始化 - 页面加载时调用
     */
    async init() {
      // 检查是否已有登录 token
      try {
        const resp = await fetch(API_BASE + '/api/auth/me');
        if (resp.ok) {
          const data = await resp.json();
          if (data.user) {
            this._onLoginSuccess(data.user);
            return;
          }
        }
      } catch (e) {
        // 网络错误，可能是后端未启动
      }

      // 未登录，显示登录界面
      UI.show();
    },

    /**
     * 登录
     */
    async login(username, password, rememberMe) {
      const resp = await fetch(API_BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || '登录失败');
      }
      this._onLoginSuccess(data.user);

      // 如果记住密码，保存用户名到 localStorage
      if (rememberMe) {
        localStorage.setItem(LS_KEY, JSON.stringify({ username }));
      } else {
        localStorage.removeItem(LS_KEY);
      }
    },

    /**
     * 注册
     */
    async register(username, password, email) {
      const resp = await fetch(API_BASE + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || '注册失败');
      }
      this._onLoginSuccess(data.user);
      localStorage.setItem(LS_KEY, JSON.stringify({ username }));
    },

    /**
     * 登出
     */
    async logout() {
      try {
        await fetch(API_BASE + '/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      Sync.saveProgress(); // 登出前保存
      Sync.stopAutoSync();
      currentUser = null;
      localStorage.removeItem(LS_KEY);
      location.reload();
    },

    /**
     * 登录成功后的处理
     */
    async _onLoginSuccess(user) {
      currentUser = user;
      UserBar.create();
      UserBar.update(user);

      // 预填用户名（如果之前保存过）
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const loginInput = document.getElementById('login-username');
          if (loginInput && parsed.username) {
            loginInput.value = parsed.username;
          }
        } catch(e) {}
      }

      // 加载后端进度
      await Sync.loadProgress();

      // 启动自动同步
      Sync.startAutoSync();

      // 通知其他模块用户已登录
      window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));

      console.log('[Auth] 登录成功:', user.username);
    },

    /* ========== 公开 API ========== */
    getCurrentUser() { return currentUser; },
    isLoggedIn() { return !!currentUser; },
    saveProgress() { return Sync.saveProgress(); },
    saveQuizResult(courseId, quizId, score, total, answers) {
      return Sync.saveQuizResult(courseId, quizId, score, total, answers);
    }
  };

  /* ========== 自动初始化 ========== */
  window.AuthSystem = AuthSystem;

  // 等 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => AuthSystem.init(), 100);
    });
  } else {
    setTimeout(() => AuthSystem.init(), 100);
  }
})();
