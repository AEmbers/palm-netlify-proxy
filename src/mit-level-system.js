/**
 * MITLevelSystem - MIT 学术水平评级引擎
 * 基于课程难度、含金量、掌握度计算用户的 MIT 学术层级
 * 13 级等级轴：从 MIT 附中初一 到 MIT 正教授
 *
 * 依赖：QuizSystem.MasteryManager, window.__QUIZ_KP_DATA__
 */
(function () {
  'use strict';

  /* ======================================================================
   * 一、MIT 课程难度与含金量数据库
   * 基于实际 MIT 课程编号体系研究：
   * - 14.0x-14.1x: 本科入门/中级
   * - 14.12x-14.13x: 博士核心微观理论序列
   * - 14.15x-14.16x: 研究生高阶专题
   * - 14.3x: 统计/计量
   * - 6.0001/6.0002: 本科入门编程（半学期模块）
   * - 6.3900: 本科 ML 入门
   * - 6.C571: 本科/研究生跨系课
   * 难度 1-10 分，学分反映课程在 MIT 培养方案中的权重
   * ====================================================================== */
  const COURSE_DATABASE = {
    'live-ops-course': {
      name: '直播运营零基础入门课',
      mit_equiv: null, // 非 MIT 课程
      level: 'pre-college',
      difficulty: 1,
      credits: 3,
      category: 'media',
      note: 'B站实操课，不对应 MIT 课程体系'
    },
    'mit-14-01-microeconomics': {
      name: 'MIT 14.01 Principles of Microeconomics',
      mit_equiv: '14.01',
      level: 'ug-freshman', // 大一入门课
      difficulty: 3,
      credits: 12, // MIT full subject = 12 units
      category: 'economics',
      note: '经济系入门第一课，HASS-S/GIR 通识课'
    },
    'mit-python-6': {
      name: 'MIT 6.0001 / 6.0002 Python',
      mit_equiv: '6.100A + 6.100B',
      level: 'ug-freshman',
      difficulty: 2.5,
      credits: 12, // 两个半学期模块合计
      category: 'cs',
      note: 'MIT 最常见编程起点，半学期×2'
    },
    'data-analysis-14.310x': {
      name: 'MIT 14.310x Data Analysis for Social Scientists',
      mit_equiv: '14.310',
      level: 'g-year1', // 研究生入门
      difficulty: 5,
      credits: 12,
      category: 'economics',
      note: 'DEDP MicroMasters 核心课，研究生版有额外作业'
    },
    'micro-theory-14.003x': {
      name: 'MIT 14.003x Microeconomic Theory and Public Policy',
      mit_equiv: '14.003',
      level: 'g-year1',
      difficulty: 5,
      credits: 12,
      category: 'economics',
      note: '14.03(U) 的研究生版本，合班授课，先修 14.01'
    },
    'econometric-14.320': {
      name: 'MIT 14.320 Econometric Data Science',
      mit_equiv: '14.320',
      level: 'g-year1',
      difficulty: 6,
      credits: 12,
      category: 'economics',
      note: '14.32(U) 的研究生版本，诺奖得主 Angrist 主讲'
    },
    'game-theory-14.161': {
      name: 'MIT 14.161 Strategy and Information',
      mit_equiv: '14.161',
      level: 'g-year2', // 研究生高阶
      difficulty: 7,
      credits: 12,
      category: 'economics',
      note: '14.16x 高阶博弈论专题，研究生理论选修'
    },
    'optimization-6.C571': {
      name: 'MIT 6.C571 Optimization for ML',
      mit_equiv: '6.C571',
      level: 'g-year1',
      difficulty: 6,
      credits: 12,
      category: 'cs',
      note: 'Common Ground 跨系课，末位1=研究生级基础课本科变体'
    },
    'machine-learning-6.3900': {
      name: 'MIT 6.3900 Introduction to Machine Learning',
      mit_equiv: '6.3900',
      level: 'ug-junior', // 大三本科
      difficulty: 5,
      credits: 12,
      category: 'cs',
      note: '本科 ML 入门，6.39xx 机器学习子领域起点'
    }
  };

  /* ======================================================================
   * 二、MIT 13 级等级轴
   * 从 MIT 附中初一 到 MIT 正教授
   * 每级有明确的分数阈值和说明
   * ====================================================================== */
  const LEVELS = [
    {
      id: 0, name: 'MIT 附中初一', short: '附中初一',
      min: 0, max: 50, color: '#95a5a6', icon: '🌱',
      desc: '尚未开始大学水平学习，处于预备阶段',
      mit_context: '相当于初中水平，尚未接触 MIT 课程体系'
    },
    {
      id: 1, name: 'MIT 附中初二', short: '附中初二',
      min: 50, max: 120, color: '#7f8c8d', icon: '🌿',
      desc: '开始接触最基础的大学入门概念',
      mit_context: '已完成最简单的入门课（如 6.0001 部分）'
    },
    {
      id: 2, name: 'MIT 附中初三', short: '附中初三',
      min: 120, max: 220, color: '#16a085', icon: '🍃',
      desc: '基本掌握 1-2 门入门课',
      mit_context: '掌握了 14.01 或 6.0001/6.0002 等大一入门课的核心内容'
    },
    {
      id: 3, name: 'MIT 本科大一', short: '大一',
      min: 220, max: 360, color: '#3498db', icon: '🎓',
      desc: '完成大一通识课程，具备基础学科素养',
      mit_context: '完成 GIR 通识课（微积分、物理、编程入门、经济原理等），达到 MIT 大一水平'
    },
    {
      id: 4, name: 'MIT 本科大二', short: '大二',
      min: 360, max: 520, color: '#2980b9', icon: '📘',
      desc: '进入专业核心课，有先修课要求',
      mit_context: '完成 REST 限制性科技选修和中级专业核心课，开始选择专业方向'
    },
    {
      id: 5, name: 'MIT 本科大三', short: '大三',
      min: 520, max: 700, color: '#1abc9c', icon: '📗',
      desc: '专业高阶课程，开始研究性学习',
      mit_context: '完成专业高阶课（如 6.3900 ML）、实验室要求，开始选修方向课'
    },
    {
      id: 6, name: 'MIT 本科大四', short: '大四',
      min: 700, max: 900, color: '#27ae60', icon: '🏆',
      desc: '高阶选修与毕业论文，可旁听研究生课',
      mit_context: '完成高阶选修和毕业论文，具备 MEng 6-P 项目入学水平'
    },
    {
      id: 7, name: 'MIT 研一', short: '研一',
      min: 900, max: 1150, color: '#f39c12', icon: '⚡',
      desc: '博士核心课，严格数学化理论推导',
      mit_context: '修完博士核心课（微观 14.121-124、计量 14.320 等）至少 10 门，B 及以上，通过综合考试'
    },
    {
      id: 8, name: 'MIT 研二', short: '研二',
      min: 1150, max: 1450, color: '#e67e22', icon: '🔬',
      desc: '完成主修领域，撰写研究论文',
      mit_context: '完成两个主修领域（各 2-3 门 B 及以上），撰写并答辩二年级研究论文，开始独立研究'
    },
    {
      id: 9, name: 'MIT 博一', short: '博一',
      min: 1450, max: 1750, color: '#d35400', icon: '🧪',
      desc: '全职博士论文研究，领域研讨会',
      mit_context: '进入博士论文阶段，参加领域 workshop，准备 job market paper'
    },
    {
      id: 10, name: 'MIT 博二', short: '博二',
      min: 1750, max: 2100, color: '#c0392b', icon: '🧠',
      desc: '具备在顶级期刊发表潜力的原创研究能力',
      mit_context: '完成 job market paper，在顶级期刊有发表潜力'
    },
    {
      id: 11, name: 'MIT 博三/博后', short: '博后',
      min: 2100, max: 2500, color: '#8e44ad', icon: '👑',
      desc: '接近终身教职标准，国际领域领导者',
      mit_context: '研究成果确立国内外领域领导者地位，接近 Assistant Professor 水平'
    },
    {
      id: 12, name: 'MIT 正教授', short: '教授',
      min: 2500, max: 9999, color: '#FFD700', icon: '🌟',
      desc: '全球学术金字塔最顶端，终身教职',
      mit_context: 'Full Professor，全球前 1%，被同行权威判定为"第一流的学者"，多人获诺贝尔奖'
    }
  ];

  /* ======================================================================
   * 三、含金量计算引擎
   * 含金量 = 课程难度 × 学分 × 掌握度系数 × 知识点覆盖系数
   * ====================================================================== */
  const Calculator = {
    /**
     * 计算单门课程的含金量
     * @param {string} courseId - 课程 ID
     * @param {number} progress - 掌握进度 (0-100)
     * @param {number} totalKP - 该课程总知识点数
     * @param {number} masteredKP - 已掌握的知识点数
     * @returns {object} { value, max, difficulty, credits, coverage }
     */
    calculateCourseValue(courseId, progress, totalKP, masteredKP) {
      const db = COURSE_DATABASE[courseId];
      if (!db) return { value: 0, max: 0, difficulty: 0, credits: 0, coverage: 0 };

      const difficulty = db.difficulty;
      const credits = db.credits;
      const masteryRatio = progress / 100; // 0-1
      const coverageRatio = totalKP > 0 ? masteredKP / totalKP : 0;

      // 基础含金量 = 难度 × 学分 × 10
      // 满分情况下：难度 5 × 学分 12 × 10 = 600 含金量
      const maxValue = difficulty * credits * 10;

      // 实际含金量 = 满分含金量 × 掌握度 × 覆盖系数
      // 覆盖系数：如果只学了一半知识点，含金量打折
      const value = Math.round(maxValue * masteryRatio * (0.5 + 0.5 * coverageRatio));

      return {
        value: value,
        max: maxValue,
        difficulty: difficulty,
        credits: credits,
        coverage: Math.round(coverageRatio * 100),
        mastery: Math.round(masteryRatio * 100),
        course: db
      };
    },

    /**
     * 计算所有课程的总含金量
     * @param {array} courses - 课程列表（含 progress 和 kp 数据）
     * @returns {object} { total, max, courses: [], level, nextLevel, progressToNext }
     */
    calculateTotal(courses) {
      let totalValue = 0;
      let totalMax = 0;
      const courseValues = [];

      for (const course of courses) {
        const db = COURSE_DATABASE[course.id];
        if (!db) continue;

        const progress = course.progress || 0;
        const totalKP = course.total_kp || (course.knowledge_points ? course.knowledge_points.length : 0);
        const masteredKP = course.mastered_kp || 0;

        const cv = this.calculateCourseValue(course.id, progress, totalKP, masteredKP);
        totalValue += cv.value;
        totalMax += cv.max;
        courseValues.push({
          id: course.id,
          name: db.name,
          ...cv
        });
      }

      // 确定等级
      let currentLevel = LEVELS[0];
      let nextLevel = LEVELS[1];
      for (let i = 0; i < LEVELS.length; i++) {
        if (totalValue >= LEVELS[i].min) {
          currentLevel = LEVELS[i];
          nextLevel = LEVELS[i + 1] || LEVELS[LEVELS.length - 1];
        }
      }

      // 计算到下一级的进度
      const levelRange = nextLevel.max - currentLevel.min;
      const levelProgress = levelRange > 0
        ? Math.min(100, Math.round(((totalValue - currentLevel.min) / levelRange) * 100))
        : 100;

      // 计算在整体等级轴上的位置
      const overallMax = LEVELS[LEVELS.length - 1].min;
      const overallProgress = Math.min(100, Math.round((totalValue / overallMax) * 100));

      // 计算所有课程上限在等级轴上的位置
      const maxLevelProgress = Math.min(100, Math.round((totalMax / overallMax) * 100));

      // 所有课程满分的等级
      let maxCourseLevel = LEVELS[0];
      for (let i = 0; i < LEVELS.length; i++) {
        if (totalMax >= LEVELS[i].min) maxCourseLevel = LEVELS[i];
      }

      return {
        total: totalValue,
        max: totalMax,
        courses: courseValues.sort((a, b) => b.value - a.value),
        currentLevel: currentLevel,
        nextLevel: nextLevel,
        levelProgress: levelProgress,
        overallProgress: overallProgress,
        maxCourseLevel: maxCourseLevel,
        maxLevelProgress: maxLevelProgress,
        levelValue: totalValue,
        levelMin: currentLevel.min,
        levelMax: nextLevel.max,
        allLevels: LEVELS
      };
    },

    /**
     * 获取课程在等级轴上的贡献位置
     */
    getCourseLevelContribution(courseId, progress, totalKP, masteredKP) {
      const cv = this.calculateCourseValue(courseId, progress, totalKP, masteredKP);
      let level = LEVELS[0];
      for (let i = 0; i < LEVELS.length; i++) {
        if (cv.value >= LEVELS[i].min) level = LEVELS[i];
      }
      return { ...cv, level };
    }
  };

  /* ======================================================================
   * 四、UI 渲染器
   * ====================================================================== */
  const UI = {
    _container: null,
    _mode: 'current', // 'current' | 'overall' | 'max'

    /**
     * 创建 MIT 水平面板
     */
    render(container, calcResult) {
      if (!container) return;
      this._container = container;

      const r = calcResult;
      const cur = r.currentLevel;
      const next = r.nextLevel;

      container.innerHTML = `
        <div class="mit-panel" style="
          background:linear-gradient(135deg,rgba(255,255,255,0.7) 0%,rgba(240,243,247,0.5) 100%);
          backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
          border:1px solid rgba(255,255,255,0.6);
          border-radius:24px;padding:32px;margin:0 auto 32px;max-width:920px;
          box-shadow:0 8px 32px -12px rgba(0,0,0,0.12);
          position:relative;overflow:hidden;
        ">
          <!-- 装饰背景 -->
          <div style="position:absolute;top:-50px;right:-50px;width:200px;height:200px;
               border-radius:50%;background:radial-gradient(circle,${cur.color}22 0%,transparent 70%);
               pointer-events:none;"></div>

          <!-- 标题 -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="font-size:28px;">${cur.icon}</div>
            <div>
              <div style="font-size:11px;color:#5a6578;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
                MIT Academic Standing
              </div>
              <div style="font-size:22px;font-weight:800;color:${cur.color};">
                ${cur.name}
              </div>
            </div>
            <div style="margin-left:auto;text-align:right;">
              <div style="font-size:32px;font-weight:900;color:${cur.color};line-height:1;">
                ${r.total}
              </div>
              <div style="font-size:11px;color:#5a6578;">含金量总值</div>
            </div>
          </div>

          <!-- 等级描述 -->
          <div style="background:rgba(255,255,255,0.5);border-radius:12px;padding:14px 18px;
               margin-bottom:20px;border-left:4px solid ${cur.color};">
            <div style="font-size:13px;color:#1a202c;font-weight:600;margin-bottom:4px;">
              ${cur.desc}
            </div>
            <div style="font-size:12px;color:#5a6578;line-height:1.6;">
              ${cur.mit_context}
            </div>
          </div>

          <!-- 进度条切换 -->
          ${this._renderProgressBars(r)}

          <!-- 等级轴 -->
          ${this._renderLevelAxis(r)}

          <!-- 课程含金量明细 -->
          ${this._renderCourseBreakdown(r)}

          <!-- 速度评价 -->
          ${this._renderSpeedRating(r)}
        </div>
      `;
    },

    _renderProgressBars(r) {
      const cur = r.currentLevel;
      const next = r.nextLevel;

      // 进度条数据
      const bars = [
        {
          id: 'current',
          label: '当前等级 → 下一等级',
          sub: `${cur.short} → ${next.short}`,
          percent: r.levelProgress,
          value: r.total,
          range: `${cur.min} → ${next.min}`,
          color: cur.color,
          desc: `还差 ${Math.max(0, next.min - r.total)} 含金量到达 ${next.short}`
        },
        {
          id: 'overall',
          label: '在 MIT 等级轴上的位置',
          sub: `附中初一 → 正教授`,
          percent: r.overallProgress,
          value: r.total,
          range: `0 → 2500+`,
          color: '#2b4f81',
          desc: `你目前位于整个 MIT 学术等级轴的 ${r.overallProgress}% 处`
        },
        {
          id: 'max',
          label: '所有课程含金量上限',
          sub: `当前课程库可达：${r.maxCourseLevel.short}`,
          percent: r.maxLevelProgress,
          value: r.max,
          range: `0 → 2500+`,
          color: '#7c3aed',
          desc: `如果你完全掌握所有已添加课程，将达到 ${r.maxCourseLevel.name} 水平 (${r.max} 含金量)`
        }
      ];

      const activeBar = bars.find(b => b.id === this._mode) || bars[0];

      let html = `
        <div style="margin-bottom:20px;">
          <!-- 切换按钮 -->
          <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      `;

      for (const bar of bars) {
        const isActive = bar.id === this._mode;
        html += `
          <button onclick="MITLevelSystem.setMode('${bar.id}')" style="
            padding:8px 16px;border-radius:10px;font-size:12px;font-weight:600;
            border:1px solid ${isActive ? bar.color : 'rgba(200,208,220,0.6)'};
            background:${isActive ? bar.color : 'rgba(255,255,255,0.5)'};
            color:${isActive ? '#fff' : '#5a6578'};
            cursor:pointer;transition:all .2s;
          ">${bar.label}</button>
        `;
      }

      html += `
          </div>
          <!-- 进度条 -->
          <div style="background:rgba(255,255,255,0.5);border-radius:14px;padding:18px 20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="font-size:13px;font-weight:700;color:#1a202c;">${activeBar.sub}</div>
              <div style="font-size:20px;font-weight:900;color:${activeBar.color};">${activeBar.percent}%</div>
            </div>
            <div style="position:relative;height:14px;background:#e8edf4;border-radius:7px;overflow:hidden;">
              <div style="position:absolute;left:0;top:0;height:100%;width:${activeBar.percent}%;
                   background:linear-gradient(90deg,${activeBar.color}aa,${activeBar.color});
                   border-radius:7px;transition:width .6s cubic-bezier(.4,0,.2,1);">
                <div style="position:absolute;right:0;top:0;bottom:0;width:20px;
                     background:linear-gradient(90deg,transparent,rgba(255,255,255,0.4));
                     animation:mit-shimmer 2s infinite;"></div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;">
              <div style="font-size:11px;color:#5a6578;">${activeBar.range}</div>
              <div style="font-size:11px;color:#5a6578;">当前：${activeBar.value}</div>
            </div>
            <div style="font-size:12px;color:#5a6578;margin-top:8px;line-height:1.5;">
              ${activeBar.desc}
            </div>
          </div>
        </div>
      `;

      return html;
    },

    _renderLevelAxis(r) {
      let html = `
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;color:#5a6578;margin-bottom:10px;letter-spacing:0.5px;">
            📊 MIT 等级轴
          </div>
          <div style="position:relative;height:44px;">
            <div style="position:absolute;left:0;right:0;top:18px;height:4px;
                 background:linear-gradient(90deg,
                   #95a5a6 0%,#7f8c8d 8%,#16a085 16%,#3498db 24%,#2980b9 33%,
                   #1abc9c 42%,#27ae60 50%,#f39c12 58%,#e67e22 67%,#d35400 75%,
                   #c0392b 83%,#8e44ad 92%,#FFD700 100%);
                 border-radius:2px;"></div>
      `;

      // 当前位置标记
      const posPercent = r.overallProgress;
      html += `
            <div style="position:absolute;left:${posPercent}%;top:4px;transform:translateX(-50%);
                 transition:left .6s cubic-bezier(.4,0,.2,1);">
              <div style="width:14px;height:14px;border-radius:50%;background:${r.currentLevel.color};
                   border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
              </div>
              <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);
                   white-space:nowrap;font-size:10px;font-weight:700;color:${r.currentLevel.color};
                   background:rgba(255,255,255,0.9);padding:2px 8px;border-radius:6px;margin-top:4px;">
                ${r.currentLevel.short}
              </div>
            </div>
      `;

      // 所有课程上限标记
      const maxPercent = r.maxLevelProgress;
      if (maxPercent > posPercent) {
        html += `
            <div style="position:absolute;left:${maxPercent}%;top:4px;transform:translateX(-50%);">
              <div style="width:10px;height:10px;border-radius:50%;background:#7c3aed;
                   border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.2);opacity:0.6;">
              </div>
              <div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);
                   white-space:nowrap;font-size:9px;font-weight:600;color:#7c3aed;
                   opacity:0.7;margin-top:2px;">课程上限</div>
            </div>
        `;
      }

      html += `
          </div>
          <!-- 等级标签 -->
          <div style="display:flex;justify-content:space-between;margin-top:28px;font-size:9px;color:#5a6578;">
            <span>附中</span><span>大一</span><span>大三</span><span>研一</span><span>博一</span><span>教授</span>
          </div>
        </div>
      `;

      return html;
    },

    _renderCourseBreakdown(r) {
      let html = `
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;color:#5a6578;margin-bottom:10px;letter-spacing:0.5px;">
            📚 课程含金量明细
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
      `;

      for (const c of r.courses) {
        const percent = c.max > 0 ? Math.round((c.value / c.max) * 100) : 0;
        const diffBars = '★'.repeat(Math.round(c.difficulty / 2)) + '☆'.repeat(5 - Math.round(c.difficulty / 2));

        html += `
          <div style="background:rgba(255,255,255,0.4);border-radius:10px;padding:12px 16px;
               display:flex;align-items:center;gap:12px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:600;color:#1a202c;margin-bottom:4px;
                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${c.course ? c.course.name : c.name}
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span style="font-size:10px;color:#5a6578;">${diffBars}</span>
                <span style="font-size:10px;color:#5a6578;">难度 ${c.difficulty}/10</span>
                <span style="font-size:10px;color:#5a6578;">学分 ${c.credits}</span>
                <span style="font-size:10px;color:#5a6578;">掌握 ${c.mastery}%</span>
              </div>
            </div>
            <div style="width:120px;">
              <div style="height:6px;background:#e8edf4;border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${percent}%;background:${c.course ? c.course.category === 'cs' ? '#7c3aed' : c.course.category === 'economics' ? '#2b4f81' : '#e85d3a' : '#7f8c8d'};border-radius:3px;transition:width .4s;"></div>
              </div>
              <div style="font-size:10px;color:#5a6578;margin-top:3px;text-align:right;">
                ${c.value} / ${c.max}
              </div>
            </div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;

      return html;
    },

    _renderSpeedRating(r) {
      // 计算速度评价
      const totalCoursesWithProgress = r.courses.filter(c => c.mastery > 0).length;
      const avgMastery = totalCoursesWithProgress > 0
        ? r.courses.reduce((sum, c) => sum + c.mastery, 0) / totalCoursesWithProgress
        : 0;

      // 速度 = 含金量 / 课程数（平均每门课的含金量贡献）
      const avgValuePerCourse = r.courses.length > 0 ? r.total / r.courses.length : 0;

      // 速度评级
      let speedRating, speedColor, speedDesc;
      if (avgValuePerCourse >= 400 && avgMastery >= 80) {
        speedRating = 'S+ 降维打击';
        speedColor = '#FF4500';
        speedDesc = '学习速度极快，几乎过目不忘，远超常人';
      } else if (avgValuePerCourse >= 300 && avgMastery >= 70) {
        speedRating = 'S 顶级天才';
        speedColor = '#FF6347';
        speedDesc = '学习效率极高，掌握速度远超 MIT 平均水平';
      } else if (avgValuePerCourse >= 200 && avgMastery >= 55) {
        speedRating = 'A 卓越';
        speedColor = '#f39c12';
        speedDesc = '高效学习者，比大部分 MIT 学生学得更快';
      } else if (avgValuePerCourse >= 120 && avgMastery >= 40) {
        speedRating = 'B 优秀';
        speedColor = '#27ae60';
        speedDesc = '稳健进步，学习节奏与 MIT 优秀本科生相当';
      } else if (avgValuePerCourse >= 60 && avgMastery >= 20) {
        speedRating = 'C 中等';
        speedColor = '#3498db';
        speedDesc = '学习速度正常，与 MIT 普通本科生相当';
      } else if (avgValuePerCourse > 0) {
        speedRating = 'D 起步';
        speedColor = '#95a5a6';
        speedDesc = '刚开始学习，继续努力就能看到加速进步';
      } else {
        speedRating = '— 未开始';
        speedColor = '#bdc3c7';
        speedDesc = '尚未开始测验，完成第一次测验后可见速度评价';
      }

      return `
        <div style="background:rgba(255,255,255,0.4);border-radius:14px;padding:16px 20px;
             display:flex;align-items:center;gap:16px;">
          <div style="font-size:28px;">⚡</div>
          <div style="flex:1;">
            <div style="font-size:11px;color:#5a6578;font-weight:600;letter-spacing:0.5px;margin-bottom:2px;">
              学习速度评价
            </div>
            <div style="font-size:16px;font-weight:800;color:${speedColor};">${speedRating}</div>
            <div style="font-size:11px;color:#5a6578;margin-top:2px;">${speedDesc}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:900;color:${speedColor};">${Math.round(avgValuePerCourse)}</div>
            <div style="font-size:10px;color:#5a6578;">平均含金量/课</div>
          </div>
        </div>
      `;
    },

    setMode(mode) {
      this._mode = mode;
      // Re-render with current data
      if (this._currentResult) {
        this.render(this._container, this._currentResult);
      }
    }
  };

  /* ======================================================================
   * 五、主控制器
   * ====================================================================== */
  const Controller = {
    _interval: null,

    /**
     * 从 QuizSystem 获取课程掌握度数据
     */
    getCourseData() {
      const kpData = window.__QUIZ_KP_DATA__ || [];
      const results = [];

      for (const course of kpData) {
        const MasteryManager = window.QuizSystem ? window.QuizSystem.MasteryManager : null;
        if (!MasteryManager) continue;

        let totalKP = 0;
        let masteredKP = 0;

        for (const lesson of (course.lessons || [])) {
          const kps = lesson.knowledge_points || [];
          totalKP += kps.length;

          if (MasteryManager.getCourseProgress) {
            // Use the existing method to get lesson progress
            const lessonProgress = MasteryManager.getLessonProgress(course.id, lesson.title, kps);
            const lessonMastered = Math.round((lessonProgress / 100) * 5 * kps.length / 5);
            masteredKP += lessonMastered;
          }
        }

        const progress = MasteryManager.getCourseProgress
          ? MasteryManager.getCourseProgress(course.id, course.lessons || [])
          : 0;

        results.push({
          id: course.id,
          title: course.title,
          total_kp: totalKP,
          mastered_kp: masteredKP,
          progress: progress,
          lessons: course.lessons || []
        });
      }

      return results;
    },

    /**
     * 计算并渲染
     */
    update() {
      const courses = this.getCourseData();
      const result = Calculator.calculateTotal(courses);
      UI._currentResult = result;

      const container = document.getElementById('mit-level-panel');
      if (container) {
        UI.render(container, result);
      }

      return result;
    },

    /**
     * 初始化 - 在首页插入 MIT 水平面板
     */
    init() {
      // 等待 QuizSystem 初始化
      if (!window.QuizSystem || !window.QuizSystem.MasteryManager) {
        setTimeout(() => this.init(), 1000);
        return;
      }

      // 在首页 hero 之后插入面板
      const homePage = document.getElementById('home-page');
      if (!homePage) return;

      // 检查是否已存在
      if (document.getElementById('mit-level-panel')) return;

      // 创建容器
      const panel = document.createElement('div');
      panel.id = 'mit-level-panel';
      panel.style.cssText = 'padding:0 24px;max-width:920px;margin:0 auto;';

      // 插入到首页搜索栏之前
      const searchBar = homePage.querySelector('.search-bar');
      if (searchBar) {
        homePage.insertBefore(panel, searchBar);
      } else {
        homePage.appendChild(panel);
      }

      // 初始渲染
      this.update();

      // 添加 CSS 动画
      if (!document.getElementById('mit-level-styles')) {
        const style = document.createElement('style');
        style.id = 'mit-level-styles';
        style.textContent = `
          @keyframes mit-shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @media (max-width: 600px) {
            .mit-panel { padding: 20px 16px !important; border-radius: 16px !important; }
          }
        `;
        document.head.appendChild(style);
      }

      // 定期更新（当测验完成后数据会变）
      this._interval = setInterval(() => this.update(), 5000);
    }
  };

  /* ======================================================================
   * 六、暴露接口
   * ====================================================================== */
  window.MITLevelSystem = {
    Calculator,
    UI,
    Controller,
    LEVELS,
    COURSE_DATABASE,
    setMode: (mode) => UI.setMode(mode),
    update: () => Controller.update(),
    init: () => Controller.init()
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => Controller.init(), 1000);
    });
  } else {
    setTimeout(() => Controller.init(), 1000);
  }

  // 监听页面切换
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (document.getElementById('home-page') &&
          !document.getElementById('mit-level-panel') &&
          window.QuizSystem) {
        Controller.init();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
