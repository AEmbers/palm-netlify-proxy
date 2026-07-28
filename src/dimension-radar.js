/**
 * DimensionRadar - 7 维知识维度雷达图系统
 *
 * 功能：
 * 1. 基于课程掌握度计算 7 个知识维度得分
 * 2. Canvas 渲染交互式雷达图（支持 Retina/动画）
 * 3. 长板/短板课程推荐逻辑
 *
 * 维度划分：
 * - 经济学理论 (14.01, 14.003x)
 * - 数据与计量 (14.310x, 14.320)
 * - 计算机编程 (6.0001/6.0002)
 * - 机器学习   (6.3900, 6.C571)
 * - 策略与博弈 (14.161)
 * - 新媒体运营 (直播运营课)
 * - 学习速度   (元能力，基于全部课程)
 *
 * 依赖：QuizSystem.MasteryManager, window.__QUIZ_KP_DATA__
 * 可扩展：支持 5-8 维，新增课程只需更新 DIMENSIONS 映射
 */
(function () {
  'use strict';

  /* ======================================================================
   * 一、7 维知识维度定义
   * 每个维度映射到一组课程，计算时取这些课程的平均掌握度
   * futureCourses 列出该维度的进阶课程（用于推荐）
   * ====================================================================== */
  const DIMENSIONS = [
    {
      id: 'econ-theory',
      name: '经济学理论',
      short: '经济理论',
      color: '#2b4f81',
      icon: '\u{1F4CA}',
      courses: ['mit-14-01-microeconomics', 'micro-theory-14.003x'],
      desc: '微观经济学、市场机制、经济推理能力',
      futureCourses: [
        { name: 'MIT 14.121 微观理论 I', level: '研究生', difficulty: 8, note: '博士核心课，严格数学推导' },
        { name: 'MIT 14.122 微观理论 II', level: '研究生', difficulty: 8, note: '机制设计与信息经济学' },
        { name: 'MIT 14.13 全球贫困经济学', level: '本科', difficulty: 4, note: '发展经济学应用' }
      ]
    },
    {
      id: 'data-metrics',
      name: '数据与计量',
      short: '数据计量',
      color: '#3498db',
      icon: '\u{1F4C8}',
      courses: ['data-analysis-14.310x', 'econometric-14.320'],
      desc: '数据分析、统计方法、因果推断',
      futureCourses: [
        { name: 'MIT 14.381 统计推断', level: '研究生', difficulty: 7, note: '概率论与统计理论基础' },
        { name: 'MIT 14.387 计量经济学 II', level: '研究生', difficulty: 7, note: '时间序列与面板数据' }
      ]
    },
    {
      id: 'programming',
      name: '计算机编程',
      short: '编程',
      color: '#7c3aed',
      icon: '\u{1F4BB}',
      courses: ['mit-python-6'],
      desc: 'Python 编程、算法思维、数据结构',
      futureCourses: [
        { name: 'MIT 6.006 算法导论', level: '本科', difficulty: 6, note: '核心算法与数据结构' },
        { name: 'MIT 6.102 软件构造', level: '本科', difficulty: 5, note: '软件工程实践' },
        { name: 'MIT 6.100A Python 进阶', level: '本科', difficulty: 3, note: '更深入的 Python 应用' }
      ]
    },
    {
      id: 'ml-ai',
      name: '机器学习',
      short: '机器学习',
      color: '#9b59b6',
      icon: '\u{1F916}',
      courses: ['machine-learning-6.3900', 'optimization-6.C571'],
      desc: 'ML 算法、深度学习、优化方法',
      futureCourses: [
        { name: 'MIT 6.5940 深度学习', level: '研究生', difficulty: 8, note: '神经网络与深度学习' },
        { name: 'MIT 6.7900 机器学习理论', level: '研究生', difficulty: 8, note: '理论 ML 基础' },
        { name: 'MIT 6.867 深度学习专题', level: '研究生', difficulty: 9, note: '前沿深度学习研究' }
      ]
    },
    {
      id: 'strategy',
      name: '策略与博弈',
      short: '策略博弈',
      color: '#e67e22',
      icon: '\u265F\uFE0F',
      courses: ['game-theory-14.161'],
      desc: '博弈论、策略决策、信息经济学',
      futureCourses: [
        { name: 'MIT 14.12 博弈论入门', level: '本科', difficulty: 4, note: '博弈论基础，先修 14.01' },
        { name: 'MIT 14.163 机制设计', level: '研究生', difficulty: 8, note: '高级机制设计与拍卖理论' }
      ]
    },
    {
      id: 'media-ops',
      name: '新媒体运营',
      short: '新媒体',
      color: '#e85d3a',
      icon: '\u{1F4F1}',
      courses: ['live-ops-course'],
      desc: '直播运营、内容策略、平台实操',
      futureCourses: [
        { name: '内容营销策略', level: '实操', difficulty: 2, note: '跨平台内容策略与品牌建设' },
        { name: '短视频运营实战', level: '实操', difficulty: 2, note: '抖音/快手短视频运营' },
        { name: '私域流量运营', level: '实操', difficulty: 3, note: '社群运营与用户留存' }
      ]
    },
    {
      id: 'velocity',
      name: '学习速度',
      short: '学习速度',
      color: '#27ae60',
      icon: '\u26A1',
      courses: [],
      desc: '学习效率、知识吸收速度、复习节奏',
      futureCourses: [
        { name: 'Learning How to Learn (Coursera)', level: '通识', difficulty: 1, note: '学习科学基础，掌握高效学习法' },
        { name: 'MIT 0.1x 电子商务导论', level: '本科', difficulty: 2, note: '快速建立跨学科知识框架' },
        { name: 'MIT RES.18-009 预备微积分', level: '预科', difficulty: 2, note: '加速数学基础，提升推理速度' }
      ]
    }
  ];

  /* ======================================================================
   * 二、维度得分计算
   * ====================================================================== */
  const Calculator = {

    /**
     * 从 QuizSystem 获取所有课程的掌握度数据
     */
    getCourseData() {
      const kpData = window.__QUIZ_KP_DATA__ || [];
      const MM = window.QuizSystem ? window.QuizSystem.MasteryManager : null;
      const results = [];

      for (const course of kpData) {
        const progress = MM && MM.getCourseProgress
          ? MM.getCourseProgress(course.id, course.lessons || [])
          : 0;

        let totalKP = 0;
        let masteredKP = 0;
        for (const lesson of (course.lessons || [])) {
          const kps = lesson.knowledge_points || [];
          totalKP += kps.length;
          if (MM && MM.getLessonProgress) {
            const lp = MM.getLessonProgress(course.id, lesson.title, kps);
            masteredKP += Math.round((lp / 100) * kps.length);
          }
        }

        results.push({
          id: course.id,
          title: course.title,
          progress: progress,
          total_kp: totalKP,
          mastered_kp: masteredKP
        });
      }

      return results;
    },

    /**
     * 计算 7 个维度的得分（0-100）
     */
    calculateScores() {
      const courseData = this.getCourseData();
      const MM = window.QuizSystem ? window.QuizSystem.MasteryManager : null;
      const scores = [];

      for (const dim of DIMENSIONS) {
        let score = 0;

        if (dim.id === 'velocity') {
          /* 学习速度维度：综合指标
           * - 各课程平均掌握度 × 60%
           * - 已开始课程数量占比 × 20%
           * - 测验平均分 × 20%（如有）
           */
          const allProgress = courseData.map(c => c.progress);
          const avgProgress = allProgress.length > 0
            ? allProgress.reduce((a, b) => a + b, 0) / allProgress.length
            : 0;

          const startedCount = courseData.filter(c => c.progress > 0).length;
          const startRatio = courseData.length > 0
            ? startedCount / courseData.length
            : 0;

          // 尝试获取测验平均分
          let avgQuiz = 60; // 默认值
          if (MM && MM.getStats) {
            const stats = MM.getStats();
            if (stats && stats.avgScore) avgQuiz = stats.avgScore;
          }

          score = Math.round(avgProgress * 0.6 + startRatio * 100 * 0.2 + avgQuiz * 0.2);
        } else {
          /* 学科维度：取相关课程的平均掌握度 */
          let totalProgress = 0;
          let courseCount = 0;

          for (const courseId of dim.courses) {
            const course = courseData.find(c => c.id === courseId);
            if (course) {
              totalProgress += course.progress;
              courseCount++;
            }
          }

          score = courseCount > 0 ? Math.round(totalProgress / courseCount) : 0;
        }

        scores.push({
          ...dim,
          score: Math.min(100, Math.max(0, score))
        });
      }

      return scores;
    },

    /**
     * 找出最强和最弱维度
     */
    findExtremes(scores) {
      const sorted = [...scores].sort((a, b) => b.score - a.score);
      return {
        strongest: sorted[0],
        weakest: sorted[sorted.length - 1],
        sorted: sorted
      };
    }
  };

  /* ======================================================================
   * 三、Canvas 雷达图渲染器
   * 支持 Retina 屏幕、入场动画、悬停高亮
   * ====================================================================== */
  const Renderer = {
    _canvas: null,
    _ctx: null,
    _scores: null,
    _animProgress: 0,
    _hoverIndex: -1,
    _rafId: null,

    /**
     * 初始化 Canvas
     */
    init(canvas) {
      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');
      this._setupRetina();
      return this;
    },

    /**
     * Retina 屏幕适配
     */
    _setupRetina() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this._canvas.getBoundingClientRect();
      // Use parent container width if canvas hasn't been sized yet
      let rawWidth = rect.width;
      if (rawWidth < 100 && this._canvas.parentElement) {
        rawWidth = this._canvas.parentElement.getBoundingClientRect().width;
      }
      const cssSize = Math.min(Math.max(rawWidth || 460, 380), 500);
      this._canvas.width = cssSize * dpr;
      this._canvas.height = cssSize * dpr;
      this._canvas.style.width = cssSize + 'px';
      this._canvas.style.height = cssSize + 'px';
      this._ctx.scale(dpr, dpr);
      this._cssSize = cssSize;
    },

    /**
     * 计算维度顶点坐标
     */
    _getVertices(scores, animProgress) {
      const n = scores.length;
      const cx = this._cssSize / 2;
      const cy = this._cssSize / 2;
      const maxR = this._cssSize * 0.32;
      const labelR = maxR + 26;

      return scores.map((s, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / n);
        const r = maxR * (s.score / 100) * animProgress;
        return {
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          gridX: cx + maxR * Math.cos(angle),
          gridY: cy + maxR * Math.sin(angle),
          labelX: cx + labelR * Math.cos(angle),
          labelY: cy + labelR * Math.sin(angle),
          angle: angle,
          score: s.score
        };
      });
    },

    /**
     * 绘制网格（同心多边形）
     */
    _drawGrid(n) {
      const ctx = this._ctx;
      const cx = this._cssSize / 2;
      const cy = this._cssSize / 2;
      const maxR = this._cssSize * 0.32;

      for (let ring = 5; ring >= 1; ring--) {
        const r = maxR * ring / 5;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI / n);
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = ring === 5 ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.05)';
        ctx.lineWidth = ring === 5 ? 1.2 : 1;
        ctx.stroke();

        // 环线标签
        if (ring < 5 && ring > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.font = '9px -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(ring * 20 + '', cx + 3, cy - r + 3);
        }
      }
    },

    /**
     * 绘制轴线
     */
    _drawAxes(vertices) {
      const ctx = this._ctx;
      const cx = this._cssSize / 2;
      const cy = this._cssSize / 2;

      for (const v of vertices) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(v.gridX, v.gridY);
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },

    /**
     * 绘制数据多边形
     */
    _drawDataPolygon(vertices, scores) {
      const ctx = this._ctx;
      const cx = this._cssSize / 2;
      const cy = this._cssSize / 2;
      const maxR = this._cssSize * 0.32;

      // 渐变填充
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      gradient.addColorStop(0, 'rgba(43, 79, 129, 0.35)');
      gradient.addColorStop(0.6, 'rgba(124, 58, 237, 0.2)');
      gradient.addColorStop(1, 'rgba(232, 93, 58, 0.1)');

      ctx.beginPath();
      for (let i = 0; i < vertices.length; i++) {
        if (i === 0) ctx.moveTo(vertices[i].x, vertices[i].y);
        else ctx.lineTo(vertices[i].x, vertices[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = '#2b4f81';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    },

    /**
     * 绘制顶点圆点
     */
    _drawVertices(vertices, scores) {
      const ctx = this._ctx;

      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        const isHover = i === this._hoverIndex;
        const r = isHover ? 7 : 5;

        ctx.beginPath();
        ctx.arc(v.x, v.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = scores[i].color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isHover) {
          // 悬停光环
          ctx.beginPath();
          ctx.arc(v.x, v.y, r + 4, 0, 2 * Math.PI);
          ctx.strokeStyle = scores[i].color + '40';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    },

    /**
     * 绘制标签
     */
    _drawLabels(vertices, scores) {
      const ctx = this._ctx;
      const cx = this._cssSize / 2;

      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        const s = scores[i];
        const isLeft = v.labelX < cx - 20;
        const isRight = v.labelX > cx + 20;
        const align = isLeft ? 'right' : (isRight ? 'left' : 'center');

        ctx.textAlign = align;
        ctx.textBaseline = 'middle';

        // 维度名称
        ctx.fillStyle = s.color;
        ctx.font = 'bold 12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(s.name, v.labelX, v.labelY - 7);

        // 分数
        ctx.fillStyle = '#5a6578';
        ctx.font = '600 11px -apple-system, sans-serif';
        ctx.fillText(s.score + ' 分', v.labelX, v.labelY + 8);
      }
    },

    /**
     * 完整渲染
     */
    render(scores, animProgress) {
      if (!this._canvas || !this._ctx) return;
      if (animProgress === undefined) animProgress = 1;

      const ctx = this._ctx;
      this._scores = scores;
      this._animProgress = animProgress;

      ctx.clearRect(0, 0, this._cssSize, this._cssSize);

      const vertices = this._getVertices(scores, animProgress);

      this._drawGrid(scores.length);
      this._drawAxes(vertices);
      this._drawDataPolygon(vertices, scores);
      this._drawVertices(vertices, scores);
      this._drawLabels(vertices, scores);
    },

    /**
     * 入场动画
     */
    animate(scores) {
      this._scores = scores;
      let progress = 0;
      const duration = 800;
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        progress = Math.min(1, elapsed / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        this.render(scores, eased);

        if (progress < 1) {
          this._rafId = requestAnimationFrame(step);
        }
      };

      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = requestAnimationFrame(step);
    },

    /**
     * 设置悬停
     */
    setHover(index) {
      if (index !== this._hoverIndex) {
        this._hoverIndex = index;
        if (this._scores) {
          this.render(this._scores, this._animProgress || 1);
        }
      }
    }
  };

  /* ======================================================================
   * 四、课程推荐引擎
   * ====================================================================== */
  const Recommender = {

    /**
     * 生成推荐内容
     * @param {string} type - 'strength' 或 'weakness'
     * @param {array} scores - 维度得分
     * @returns {object} { dimension, title, courses, futureCourses, tip }
     */
    recommend(type, scores) {
      const extremes = Calculator.findExtremes(scores);
      const dim = type === 'strength' ? extremes.strongest : extremes.weakest;
      const courseData = Calculator.getCourseData();

      // 获取该维度已学课程的状态
      const courseStatus = [];
      for (const courseId of dim.courses) {
        const course = courseData.find(c => c.id === courseId);
        if (course) {
          let status = 'not-started';
          let statusLabel = '未开始';
          if (course.progress >= 80) { status = 'mastered'; statusLabel = '已掌握'; }
          else if (course.progress > 0) { status = 'learning'; statusLabel = '学习中'; }

          courseStatus.push({
            ...course,
            status,
            statusLabel,
            progress: course.progress
          });
        }
      }

      // 推荐逻辑
      let recommendations = [];
      let tip = '';

      if (type === 'strength') {
        // 长板推荐
        const notStarted = courseStatus.filter(c => c.status === 'not-started');
        const learning = courseStatus.filter(c => c.status === 'learning');

        // 1. 未开始的同维度课程
        for (const c of notStarted) {
          recommendations.push({
            type: 'existing',
            name: c.title,
            level: '现有课程',
            note: '该维度中尚未开始，立即开始学习',
            priority: 'high',
            progress: c.progress
          });
        }

        // 2. 学习中的课程，鼓励完成
        for (const c of learning) {
          recommendations.push({
            type: 'existing',
            name: c.title,
            level: '继续学习',
            note: '已完成 ' + c.progress + '%，继续推进以达到掌握',
            priority: 'medium',
            progress: c.progress
          });
        }

        // 3. 进阶课程（从 futureCourses 取前3个）
        for (const fc of dim.futureCourses.slice(0, 3)) {
          recommendations.push({
            type: 'future',
            name: fc.name,
            level: fc.level,
            note: fc.note,
            priority: 'future',
            difficulty: fc.difficulty
          });
        }

        tip = '继续在 ' + dim.name + ' 维度深耕，将优势做到极致。' +
              (notStarted.length > 0 ? '先完成该维度未学的课程，再挑战进阶内容。' : '所有现有课程已开始，建议添加进阶课程。');

      } else {
        // 短板推荐
        const notStarted = courseStatus.filter(c => c.status === 'not-started');
        const learning = courseStatus.filter(c => c.status === 'learning');
        const mastered = courseStatus.filter(c => c.status === 'mastered');

        // 1. 未开始的同维度课程（最优先）
        for (const c of notStarted) {
          recommendations.push({
            type: 'existing',
            name: c.title,
            level: '入门推荐',
            note: '该维度最薄弱，从这门课开始建立基础',
            priority: 'high',
            progress: c.progress
          });
        }

        // 2. 学习中但掌握度低的课程
        for (const c of learning) {
          recommendations.push({
            type: 'existing',
            name: c.title,
            level: '重点攻克',
            note: '仅完成 ' + c.progress + '%，建议集中精力突破',
            priority: 'high',
            progress: c.progress
          });
        }

        // 3. 如果该维度完全没有课程，推荐入门级 futureCourses
        if (courseStatus.length === 0 && dim.futureCourses.length > 0) {
          // 按 difficulty 升序排列，取最简单的
          const sorted = [...dim.futureCourses].sort((a, b) => a.difficulty - b.difficulty);
          for (const fc of sorted.slice(0, 2)) {
            recommendations.push({
              type: 'future',
              name: fc.name,
              level: fc.level,
              note: fc.note + '（该维度暂无课程，建议添加此入门课）',
              priority: 'high',
              difficulty: fc.difficulty
            });
          }
        }

        tip = '优先攻克 ' + dim.name + ' 维度的基础内容，快速拉起短板。' +
              (notStarted.length > 0 ? '从入门课开始，循序渐进。' :
               learning.length > 0 ? '集中精力完成正在学的课程。' :
               '该维度暂无课程，建议添加入门级课程。');
      }

      return {
        dimension: dim,
        title: type === 'strength'
          ? '最强维度：' + dim.name + '（' + dim.score + ' 分）'
          : '最弱维度：' + dim.name + '（' + dim.score + ' 分）',
        type: type,
        courses: courseStatus,
        recommendations: recommendations,
        tip: tip
      };
    },

    /**
     * 生成推荐 HTML
     */
    renderHTML(result) {
      const dim = result.dimension;
      const isStrength = result.type === 'strength';

      let html = '<div class="radar-recommend-card ' + (isStrength ? 'strength' : 'weakness') + '">';
      html += '<div class="rec-header">';
      html += '<span class="rec-icon">' + dim.icon + '</span>';
      html += '<div class="rec-title-area">';
      html += '<h4>' + result.title + '</h4>';
      html += '<p>' + dim.desc + '</p>';
      html += '</div>';
      html += '</div>';

      // 当前维度课程状态
      if (result.courses.length > 0) {
        html += '<div class="rec-section">';
        html += '<h5>该维度已有课程</h5>';
        for (const c of result.courses) {
          const statusClass = c.status === 'mastered' ? 'mastered' : (c.status === 'learning' ? 'learning' : 'not-started');
          html += '<div class="rec-course-item">';
          html += '<span class="rec-course-name">' + c.title + '</span>';
          html += '<span class="rec-course-status ' + statusClass + '">' + c.statusLabel + ' ' + c.progress + '%</span>';
          html += '</div>';
        }
        html += '</div>';
      }

      // 推荐列表
      if (result.recommendations.length > 0) {
        html += '<div class="rec-section">';
        html += '<h5>' + (isStrength ? '推荐继续深耕' : '推荐补齐短板') + '</h5>';
        for (const r of result.recommendations) {
          const typeIcon = r.type === 'existing' ? '\u{1F4DA}' : '\u{1F50C}';
          const priorityClass = r.priority === 'high' ? 'priority-high' : (r.priority === 'future' ? 'priority-future' : 'priority-medium');
          html += '<div class="rec-item ' + priorityClass + '">';
          html += '<span class="rec-item-icon">' + typeIcon + '</span>';
          html += '<div class="rec-item-body">';
          html += '<span class="rec-item-name">' + r.name + '</span>';
          html += '<span class="rec-item-level">' + r.level + '</span>';
          html += '<p class="rec-item-note">' + r.note + '</p>';
          html += '</div>';
          html += '</div>';
        }
        html += '</div>';
      }

      // 提示
      html += '<div class="rec-tip">' + result.tip + '</div>';
      html += '</div>';

      return html;
    }
  };

  /* ======================================================================
   * 五、控制器
   * ====================================================================== */
  const Controller = {
    _renderer: null,
    _scores: null,
    _interval: null,

    /**
     * 初始化 - 在首页插入雷达图面板
     */
    init() {
      if (!window.QuizSystem || !window.QuizSystem.MasteryManager) {
        setTimeout(() => this.init(), 1000);
        return;
      }

      const homePage = document.getElementById('home-page');
      if (!homePage) return;
      if (document.getElementById('dimension-radar-section')) return;

      // 创建面板 HTML
      const panel = document.createElement('section');
      panel.id = 'dimension-radar-section';
      panel.className = 'dimension-radar-section';
      panel.innerHTML = this._getPanelHTML();

      // 插入到知识图谱概览之后、搜索栏之前
      const searchBar = homePage.querySelector('.search-bar');
      const knowledgeViz = homePage.querySelector('.knowledge-viz');
      // Note: .search-bar and .knowledge-viz are inside .wrap, not direct children of #home-page
      // Use parentNode.insertBefore to insert into the correct parent
      if (knowledgeViz && knowledgeViz.parentNode) {
        knowledgeViz.parentNode.insertBefore(panel, knowledgeViz.nextSibling);
      } else if (searchBar && searchBar.parentNode) {
        searchBar.parentNode.insertBefore(panel, searchBar);
      } else {
        homePage.appendChild(panel);
      }

      // 初始化 Canvas 渲染器
      const canvas = document.getElementById('radar-canvas');
      if (canvas) {
        this._renderer = Object.create(Renderer).init(canvas);
      }

      // 绑定事件
      this._bindEvents();

      // 添加样式
      this._injectStyles();

      // 初始计算和渲染
      this.update();

      // 定期更新
      this._interval = setInterval(() => this.update(), 5000);

      // 窗口大小变化时重绘
      window.addEventListener('resize', () => {
        if (this._renderer && this._scores) {
          this._renderer._setupRetina();
          this._renderer.render(this._scores);
        }
      });
    },

    /**
     * 更新数据和渲染
     */
    update() {
      this._scores = Calculator.calculateScores();

      // 渲染雷达图
      if (this._renderer) {
        this._renderer.animate(this._scores);
      }

      // 渲染维度得分列表
      this._renderScoreList();

      // 更新最强/最弱标识
      this._updateBadges();
    },

    /**
     * 渲染维度得分列表
     */
    _renderScoreList() {
      const container = document.getElementById('radar-score-list');
      if (!container || !this._scores) return;

      const extremes = Calculator.findExtremes(this._scores);

      let html = '';
      for (const s of this._scores) {
        const isStrongest = s.id === extremes.strongest.id;
        const isWeakest = s.id === extremes.weakest.id;
        const barWidth = s.score;

        html += '<div class="dim-score-item' + (isStrongest ? ' is-strongest' : '') + (isWeakest ? ' is-weakest' : '') + '">';
        html += '<div class="dim-score-header">';
        html += '<span class="dim-icon" style="color:' + s.color + '">' + s.icon + '</span>';
        html += '<span class="dim-name">' + s.name + '</span>';
        html += '<span class="dim-value" style="color:' + s.color + '">' + s.score + '</span>';
        if (isStrongest) html += '<span class="dim-badge strongest">长板</span>';
        if (isWeakest) html += '<span class="dim-badge weakest">短板</span>';
        html += '</div>';
        html += '<div class="dim-bar-track">';
        html += '<div class="dim-bar-fill" style="width:' + barWidth + '%;background:' + s.color + '"></div>';
        html += '</div>';
        html += '</div>';
      }

      container.innerHTML = html;
    },

    /**
     * 更新最强/最弱徽章
     */
    _updateBadges() {
      if (!this._scores) return;
      const extremes = Calculator.findExtremes(this._scores);

      const strongEl = document.getElementById('radar-strongest');
      const weakEl = document.getElementById('radar-weakest');

      if (strongEl) {
        strongEl.innerHTML = extremes.strongest.icon + ' ' + extremes.strongest.name + ' <b>' + extremes.strongest.score + '</b>';
        strongEl.style.color = extremes.strongest.color;
      }

      if (weakEl) {
        weakEl.innerHTML = extremes.weakest.icon + ' ' + extremes.weakest.name + ' <b>' + extremes.weakest.score + '</b>';
        weakEl.style.color = extremes.weakest.color;
      }
    },

    /**
     * 绑定交互事件
     */
    _bindEvents() {
      // 长板推荐按钮
      const btnStrength = document.getElementById('btn-recommend-strength');
      if (btnStrength) {
        btnStrength.addEventListener('click', () => this._showRecommendation('strength'));
      }

      // 短板推荐按钮
      const btnWeakness = document.getElementById('btn-recommend-weakness');
      if (btnWeakness) {
        btnWeakness.addEventListener('click', () => this._showRecommendation('weakness'));
      }

      // Canvas 悬停
      const canvas = document.getElementById('radar-canvas');
      if (canvas && this._renderer) {
        canvas.addEventListener('mousemove', (e) => {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const cx = this._renderer._cssSize / 2;
          const cy = this._renderer._cssSize / 2;
          const maxR = this._renderer._cssSize * 0.32;

          if (this._scores) {
            const n = this._scores.length;
            let closest = -1;
            let minDist = Infinity;

            for (let i = 0; i < n; i++) {
              const angle = -Math.PI / 2 + (i * 2 * Math.PI / n);
              const r = maxR * (this._scores[i].score / 100);
              const vx = cx + r * Math.cos(angle);
              const vy = cy + r * Math.sin(angle);
              const dist = Math.sqrt((mx - vx) ** 2 + (my - vy) ** 2);
              if (dist < minDist && dist < 20) {
                minDist = dist;
                closest = i;
              }
            }

            this._renderer.setHover(closest);
          }
        });

        canvas.addEventListener('mouseleave', () => {
          this._renderer.setHover(-1);
        });
      }
    },

    /**
     * 显示推荐结果
     */
    _showRecommendation(type) {
      if (!this._scores) return;

      const result = Recommender.recommend(type, this._scores);
      const html = Recommender.renderHTML(result);

      const container = document.getElementById('radar-recommend');
      if (container) {
        container.innerHTML = html;
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },

    /**
     * 面板 HTML
     */
    _getPanelHTML() {
      return `
        <div class="radar-inner">
          <div class="radar-header">
            <h3>\u{1F3AF} 知识维度雷达图</h3>
            <p>基于课程掌握度实时计算 7 个知识维度，可视化你的能力分布</p>
          </div>

          <div class="radar-body">
            <div class="radar-chart-area">
              <canvas id="radar-canvas"></canvas>
            </div>
            <div class="radar-info-area">
              <div class="radar-extremes">
                <div class="extreme-item">
                  <span class="extreme-label">长板</span>
                  <span class="extreme-value" id="radar-strongest">--</span>
                </div>
                <div class="extreme-item">
                  <span class="extreme-label">短板</span>
                  <span class="extreme-value" id="radar-weakest">--</span>
                </div>
              </div>
              <div class="radar-score-list" id="radar-score-list"></div>
            </div>
          </div>

          <div class="radar-actions">
            <button class="radar-btn radar-btn-strength" id="btn-recommend-strength">
              <span class="btn-icon">\u{1F680}</span>
              <span class="btn-text">拉长长板</span>
              <span class="btn-desc">继续深耕最强维度</span>
            </button>
            <button class="radar-btn radar-btn-weakness" id="btn-recommend-weakness">
              <span class="btn-icon">\u{1F4AA}</span>
              <span class="btn-text">补齐短板</span>
              <span class="btn-desc">提升最弱维度</span>
            </button>
          </div>

          <div class="radar-recommend" id="radar-recommend" style="display:none"></div>
        </div>
      `;
    },

    /**
     * 注入 CSS
     */
    _injectStyles() {
      if (document.getElementById('dimension-radar-styles')) return;

      const style = document.createElement('style');
      style.id = 'dimension-radar-styles';
      style.textContent = `
        .dimension-radar-section {
          max-width: 920px;
          margin: 0 auto 32px;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.6);
          border-radius: 20px;
          padding: 28px 32px;
          box-shadow: 0 4px 24px -8px rgba(0,0,0,0.08);
        }
        .radar-header h3 {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .radar-header p {
          font-size: 13px;
          color: #5a6578;
          margin-bottom: 20px;
        }
        .radar-body {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .radar-chart-area {
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        #radar-canvas {
          cursor: pointer;
          display: block;
          max-width: 100%;
        }
        .radar-info-area {
          flex: 1;
          min-width: 240px;
        }
        .radar-extremes {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .extreme-item {
          flex: 1;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.06);
        }
        .extreme-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #95a5a6;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .extreme-value {
          font-size: 14px;
          font-weight: 600;
        }
        .radar-score-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dim-score-item {
          padding: 8px 0;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .dim-score-item:last-child {
          border-bottom: none;
        }
        .dim-score-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .dim-icon {
          font-size: 14px;
        }
        .dim-name {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #1a202c;
        }
        .dim-value {
          font-size: 14px;
          font-weight: 700;
        }
        .dim-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
        }
        .dim-badge.strongest {
          background: #27ae60;
          color: #fff;
        }
        .dim-badge.weakest {
          background: #e74c3c;
          color: #fff;
        }
        .dim-bar-track {
          height: 6px;
          background: rgba(0,0,0,0.06);
          border-radius: 3px;
          overflow: hidden;
        }
        .dim-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.8s ease-out;
        }
        .radar-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        .radar-btn {
          flex: 1;
          min-width: 160px;
          padding: 14px 18px;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: transform 0.2s, box-shadow 0.2s;
          text-align: left;
        }
        .radar-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px -8px rgba(0,0,0,0.2);
        }
        .radar-btn-strength {
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          color: #fff;
        }
        .radar-btn-weakness {
          background: linear-gradient(135deg, #e74c3c, #e85d3a);
          color: #fff;
        }
        .radar-btn .btn-icon {
          font-size: 20px;
        }
        .radar-btn .btn-text {
          font-size: 15px;
          font-weight: 700;
        }
        .radar-btn .btn-desc {
          font-size: 11px;
          opacity: 0.85;
          display: block;
        }
        .radar-recommend {
          margin-top: 20px;
        }
        .radar-recommend-card {
          border-radius: 16px;
          padding: 20px;
          animation: fadeInUp 0.4s ease-out;
        }
        .radar-recommend-card.strength {
          background: linear-gradient(135deg, rgba(39,174,96,0.08), rgba(46,204,113,0.04));
          border: 1px solid rgba(39,174,96,0.2);
        }
        .radar-recommend-card.weakness {
          background: linear-gradient(135deg, rgba(231,76,60,0.08), rgba(232,93,58,0.04));
          border: 1px solid rgba(231,76,60,0.2);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rec-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .rec-icon {
          font-size: 28px;
        }
        .rec-title-area h4 {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 2px;
        }
        .rec-title-area p {
          font-size: 12px;
          color: #5a6578;
        }
        .rec-section {
          margin-bottom: 16px;
        }
        .rec-section h5 {
          font-size: 12px;
          font-weight: 700;
          color: #95a5a6;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .rec-course-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.5);
          margin-bottom: 4px;
        }
        .rec-course-name {
          font-size: 13px;
          font-weight: 600;
        }
        .rec-course-status {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .rec-course-status.mastered {
          background: rgba(39,174,96,0.15);
          color: #27ae60;
        }
        .rec-course-status.learning {
          background: rgba(243,156,18,0.15);
          color: #f39c12;
        }
        .rec-course-status.not-started {
          background: rgba(149,165,166,0.15);
          color: #95a5a6;
        }
        .rec-item {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.5);
          margin-bottom: 6px;
          border-left: 3px solid transparent;
        }
        .rec-item.priority-high {
          border-left-color: #e74c3c;
        }
        .rec-item.priority-medium {
          border-left-color: #f39c12;
        }
        .rec-item.priority-future {
          border-left-color: #3498db;
        }
        .rec-item-icon {
          font-size: 16px;
          flex-shrink: 0;
        }
        .rec-item-body {
          flex: 1;
        }
        .rec-item-name {
          font-size: 13px;
          font-weight: 600;
          display: block;
        }
        .rec-item-level {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 3px;
          background: rgba(0,0,0,0.06);
          color: #5a6578;
          display: inline-block;
          margin-top: 2px;
        }
        .rec-item-note {
          font-size: 11px;
          color: #5a6578;
          margin-top: 4px;
        }
        .rec-tip {
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(0,0,0,0.04);
          font-size: 12px;
          color: #5a6578;
          line-height: 1.6;
        }
        @media (max-width: 768px) {
          .dimension-radar-section {
            padding: 20px 16px;
            border-radius: 16px;
          }
          .radar-body {
            flex-direction: column;
          }
          .radar-chart-area {
            width: 100%;
            display: flex;
            justify-content: center;
          }
          .radar-actions {
            flex-direction: column;
          }
          .radar-btn {
            min-width: 100%;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };

  /* ======================================================================
   * 六、暴露接口
   * ====================================================================== */
  window.DimensionRadar = {
    DIMENSIONS,
    Calculator,
    Renderer,
    Recommender,
    Controller,
    init: () => Controller.init(),
    update: () => Controller.update(),
    getScores: () => Calculator.calculateScores(),
    recommend: (type) => {
      const scores = Calculator.calculateScores();
      return Recommender.recommend(type, scores);
    }
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => Controller.init(), 1500);
    });
  } else {
    setTimeout(() => Controller.init(), 1500);
  }

  // 监听页面切换
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (document.getElementById('home-page') &&
          !document.getElementById('dimension-radar-section') &&
          window.QuizSystem) {
        Controller.init();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
