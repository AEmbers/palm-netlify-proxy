/**
 * QuizSystem - 知识点自适应测验系统
 * 纯 JavaScript 实现，无外部依赖
 * 基于 SM-2 间隔重复改良版算法
 * 自动注入到学习中心页面
 */
(function () {
  'use strict';

  /* ======================================================================
   * 一、全局配置与常量
   * ====================================================================== */
  const CONFIG = {
    // 测验模式配置
    LESSON_QUIZ: {
      totalQuestions: 50,
      single: 30,
      multiple: 10,
      truefalse: 10,
      pointsPerQ: 2,
      maxScore: 100,
    },
    COURSE_FINAL: {
      totalQuestions: 100,
      single: 60,
      multiple: 20,
      truefalse: 20,
      pointsPerQ: 2,
      maxScore: 200,
      displayMax: 100, // 折算为 100 分制
    },
    // 自适应出题比例
    VERIFY_RATIO: 0.8,   // 80% 验证已掌握
    NEW_RATIO: 0.2,      // 20% 推新/弱项
    // 间隔（毫秒）指数增长：1天→3天→7天→21天→60天
    INTERVALS: [
      0,                         // level 0
      1 * 24 * 60 * 60 * 1000,   // level 1: 1天
      3 * 24 * 60 * 60 * 1000,   // level 2: 3天
      7 * 24 * 60 * 60 * 1000,   // level 3: 7天
      21 * 24 * 60 * 60 * 1000,  // level 4: 21天
      60 * 24 * 60 * 60 * 1000,  // level 5: 60天
    ],
    // 题目变形数量范围
    MIN_VARIANTS: 3,
    MAX_VARIANTS: 5,
    // 评级阈值
    GRADES: [
      { id: 'S+', name: '降维打击', minAttempts: 1, minScore: 95, minAcc: 98, color: '#FF4500', icon: '👑' },
      { id: 'S',  name: '顶级天才', minAttempts: 2, minScore: 95, minAcc: 95, color: '#FF6347', icon: '⭐' },
      { id: 'A',  name: '卓越',     minAttempts: 3, minScore: 90, minAcc: 88, color: '#9370DB', icon: '🏆' },
      { id: 'B',  name: '优秀',     minAttempts: 5, minScore: 85, minAcc: 80, color: '#4169E1', icon: '🎖' },
      { id: 'C',  name: '中等',     minAttempts: 8, minScore: 80, minAcc: 70, color: '#32CD32', icon: '📗' },
      { id: 'D',  name: '待加强',   minAttempts: 10, minScore: 70, minAcc: 60, color: '#FFA500', icon: '📖' },
      { id: 'F',  name: '需重塑基础', minAttempts: 10, minScore: 0, minAcc: 0, color: '#FF4500', icon: '🔄' },
    ],
    // localStorage 前缀
    STORAGE_PREFIX: 'quiz_',
    // 完美掌握条件
    PERFECT_MASTER: { progressFull: true, consecutivePerfect: 5 },
  };

  /* ======================================================================
   * 二、工具函数
   * ====================================================================== */
  const Utils = {
    hash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      }
      return Math.abs(h);
    },
    seededRandom(seed) {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      return function () {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    },
    shuffle(arr, rng) {
      const a = arr.slice();
      const r = rng || Math.random;
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    pick(arr, rng) {
      return arr[Math.floor((rng || Math.random)() * arr.length)];
    },
    pickN(arr, n, rng) {
      return this.shuffle(arr, rng).slice(0, n);
    },
    clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    },
    formatDate(ts) {
      const d = new Date(ts);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
    now() {
      return Date.now();
    },
    // 从知识点文本中移除末尾的 tag_label（如"概念"、"策略"等）
    stripTagLabel(text) {
      const labels = ['概念', '策略', '数据', '模型', '公式', '定理', '政策', '算法', '语法', '编程模式', '示例', '操作'];
      for (const lbl of labels) {
        if (text.endsWith(lbl)) return text.slice(0, -lbl.length);
      }
      return text;
    },
  };

  /* ======================================================================
   * 三、题库生成引擎
   * ====================================================================== */
  const QuestionGenerator = {
    /**
     * 为一个知识点生成多个变形题目
     */
    generateVariants(kp, courseId, lessonId) {
      const variants = [];
      const baseText = Utils.stripTagLabel(kp.text);
      const seed = Utils.hash(baseText);
      const rng = Utils.seededRandom(seed);
      const numVariants = CONFIG.MIN_VARIANTS +
        Math.floor(rng() * (CONFIG.MAX_VARIANTS - CONFIG.MIN_VARIANTS + 1));

      // 生成单选题变形
      for (let i = 0; i < numVariants; i++) {
        variants.push(this._generateSingleChoice(kp, courseId, lessonId, baseText, i, rng));
      }
      return variants;
    },

    _generateSingleChoice(kp, courseId, lessonId, baseText, variantIdx, rng) {
      const qId = `q_${Utils.hash(baseText)}_${variantIdx}`;
      const methods = [
        () => this._variant_forwardDef(baseText, kp),
        () => this._variant_reverseChoice(baseText, kp),
        () => this._variant_wrongStatement(baseText, kp),
        () => this._variant_sceneApply(baseText, kp),
        () => this._variant_keywordReplace(baseText, kp),
      ];
      const methodIdx = variantIdx % methods.length;
      const result = methods[methodIdx]();

      return {
        id: qId,
        course_id: courseId,
        lesson_id: lessonId,
        kp_text: baseText,
        type: 'single',
        question: result.question,
        options: result.options,
        correct_answers: result.correct,
        explanation: baseText,
        difficulty: this._estimateDifficulty(kp, variantIdx),
        variant_idx: variantIdx,
      };
    },

    // 变形1：正向定义 - "以下哪个是正确的描述？"
    _variant_forwardDef(text, kp) {
      const wrongOpts = this._generateWrongOptions(text, kp, 3);
      const allOpts = Utils.shuffle([
        { text: text, correct: true },
        ...wrongOpts.map(t => ({ text: t, correct: false })),
      ]);
      return {
        question: `关于以上知识点，以下哪个描述是正确的？`,
        options: allOpts.map(o => o.text),
        correct: [allOpts.findIndex(o => o.correct)],
      };
    },

    // 变形2：反向选择 - "以下哪个是错误的？"
    _variant_reverseChoice(text, kp) {
      const wrongOpts = this._generateWrongOptions(text, kp, 3);
      const allOpts = Utils.shuffle([
        { text: text, correct: true },
        ...wrongOpts.map(t => ({ text: t, correct: false })),
      ]);
      return {
        question: `以下哪个描述是错误的？`,
        options: allOpts.map(o => o.text),
        correct: allOpts.map((o, i) => o.correct ? -1 : i).filter(i => i >= 0),
      };
    },

    // 变形3："以下哪个不属于...？"
    _variant_wrongStatement(text, kp) {
      const wrongOpts = this._generateWrongOptions(text, kp, 3);
      const allOpts = Utils.shuffle([
        { text: text, correct: true },
        ...wrongOpts.map(t => ({ text: t, correct: false })),
      ]);
      return {
        question: `关于该知识领域，以下哪项表述与其他三项不同？`,
        options: allOpts.map(o => o.text),
        correct: [allOpts.findIndex(o => o.correct)],
      };
    },

    // 变形4：场景应用题
    _variant_sceneApply(text, kp) {
      const wrongOpts = this._generateWrongOptions(text, kp, 3);
      const allOpts = Utils.shuffle([
        { text: text, correct: true },
        ...wrongOpts.map(t => ({ text: t, correct: false })),
      ]);
      const scenes = [
        '在实际工作中，',
        '根据以上理论知识，',
        '结合课程所学，',
        '从专业角度来看，',
      ];
      const scene = scenes[Math.abs(Utils.hash(text + 'scene')) % scenes.length];
      return {
        question: `${scene}以下哪个说法是正确的？`,
        options: allOpts.map(o => o.text),
        correct: [allOpts.findIndex(o => o.correct)],
      };
    },

    // 变形5：关键词替换变形
    _variant_keywordReplace(text, kp) {
      const wrongOpts = this._generateWrongOptions(text, kp, 3);
      const allOpts = Utils.shuffle([
        { text: text, correct: true },
        ...wrongOpts.map(t => ({ text: t, correct: false })),
      ]);
      const asks = [
        '以下关于该知识点的理解，哪一项最准确？',
        '根据所学内容，以下哪项叙述最为贴切？',
        '在该知识点中，下列哪个说法最能反映核心要点？',
      ];
      return {
        question: asks[Math.abs(Utils.hash(text + 'ask')) % asks.length],
        options: allOpts.map(o => o.text),
        correct: [allOpts.findIndex(o => o.correct)],
      };
    },

    /**
     * 生成干扰项（错误选项）
     * 通过修改原文关键词来生成
     */
    _generateWrongOptions(text, kp, count) {
      const wrongs = [];
      const wrongTemplates = [
        () => this._wrongByNegation(text),
        () => this._wrongBySwap(text),
        () => this._wrongByExtreme(text),
        () => this._wrongByPartial(text),
        () => this._wrongByContradiction(text),
      ];
      // 用确定性随机确保同一知识点始终生成相同干扰项
      const rng = Utils.seededRandom(Utils.hash(text) + 999);
      for (let i = 0; i < count; i++) {
        const methodIdx = Math.floor(rng() * wrongTemplates.length);
        let wrong = wrongTemplates[methodIdx]();
        // 确保不与原文重复
        let tries = 0;
        while (wrong === text && tries < 5) {
          const mi = Math.floor(rng() * wrongTemplates.length);
          wrong = wrongTemplates[mi]();
          tries++;
        }
        wrongs.push(wrong);
      }
      return wrongs;
    },

    // 否定变形：是→否，能→不能
    _wrongByNegation(text) {
      const negations = [
        ['是', '不是'], ['能', '不能'], ['会', '不会'], ['需要', '不需要'],
        ['必须', '不必'], ['应该', '不应该'], ['可以', '不可以'], ['重要', '不重要'],
        ['提高', '降低'], ['增加', '减少'], ['包含', '不包含'],
        ['约', '不超过'], ['主要', '次要'], ['核心', '辅助'],
        ['正', '负'], ['正相关', '负相关'],
      ];
      let result = text;
      for (const [a, b] of negations) {
        if (text.includes(a) && Math.abs(Utils.hash(text + a)) % 3 === 0) {
          result = text.replace(a, b);
          break;
        }
      }
      if (result === text) {
        result = '与原文相反：' + text.slice(0, Math.max(10, text.length - 10)) + '（说法有误）';
      }
      return result;
    },

    // 交换关键词
    _wrongBySwap(text) {
      const numbers = text.match(/\d+/g);
      if (numbers && numbers.length >= 1) {
        const num = parseInt(numbers[0]);
        return text.replace(numbers[0], String(num + Math.abs(Utils.hash(text + numbers[0])) % 5 + 1));
      }
      return text + '，这一点需要特别注意（此处说法不准确）';
    },

    // 极端化变形
    _wrongByExtreme(text) {
      const extremes = [
        ['约', ''], ['大部分', '全部'], ['一些', '所有'],
        ['可能', '一定'], ['通常', '总是'],
      ];
      let result = text;
      for (const [a, b] of extremes) {
        if (text.includes(a)) {
          result = text.replace(a, b);
          break;
        }
      }
      if (result === text) {
        result = text + '，且没有任何例外情况';
      }
      return result;
    },

    // 局部截断变形
    _wrongByPartial(text) {
      if (text.length > 20) {
        return text.slice(0, Math.floor(text.length * 0.6)) + '，其余部分不再适用';
      }
      return '根据错误理解：' + text;
    },

    // 矛盾变形
    _wrongByContradiction(text) {
      const contradictions = [
        '恰恰相反的是，', '实际上并非如此，', '与实际情况相反，',
      ];
      const prefix = contradictions[Math.abs(Utils.hash(text + 'contra')) % contradictions.length];
      if (text.length > 15) {
        return prefix + text.slice(0, text.length - 5) + '是不正确的';
      }
      return prefix + text;
    },

    /**
     * 从同一课程/章节中选多个知识点生成多选题
     */
    generateMultipleChoice(relatedKPs, courseId, lessonId) {
      if (relatedKPs.length < 2) return null;
      const correctCount = Utils.clamp(Math.floor(relatedKPs.length / 2) + 1, 2, 4);
      const shuffled = Utils.shuffle(relatedKPs);
      const correct = shuffled.slice(0, correctCount);
      const incorrect = shuffled.slice(correctCount, correctCount + 2);

      const correctTexts = correct.map(kp => Utils.stripTagLabel(kp.text));
      const incorrectTexts = incorrect.map(kp => {
        return this._wrongByNegation(Utils.stripTagLabel(kp.text));
      });

      const allOpts = Utils.shuffle([
        ...correctTexts.map(t => ({ text: t, correct: true })),
        ...incorrectTexts.map(t => ({ text: t, correct: false })),
      ]);

      return {
        id: `mq_${Utils.hash(correctTexts.join('|'))}`,
        course_id: courseId,
        lesson_id: lessonId,
        kp_text: correctTexts.join('；'),
        type: 'multiple',
        question: '以下哪些描述是正确的？（多选）',
        options: allOpts.map(o => o.text),
        correct_answers: allOpts.map((o, i) => o.correct ? i : -1).filter(i => i >= 0),
        explanation: correctTexts.join('\n'),
        difficulty: 3,
      };
    },

    /**
     * 从知识点生成判断题
     */
    generateTrueFalse(kp, courseId, lessonId, variantIdx) {
      const baseText = Utils.stripTagLabel(kp.text);
      const isCorrect = (variantIdx % 2 === 0);
      let statement, answer;

      if (isCorrect) {
        statement = baseText + '。';
        answer = [0];
      } else {
        statement = this._makeFalseStatement(baseText);
        answer = [1];
      }

      return {
        id: `tf_${Utils.hash(baseText)}_${variantIdx}`,
        course_id: courseId,
        lesson_id: lessonId,
        kp_text: baseText,
        type: 'truefalse',
        question: `判断以下说法是否正确：${statement}`,
        options: ['正确', '错误'],
        correct_answers: answer,
        explanation: isCorrect ? `该说法正确。${baseText}` : `该说法错误。正确表述应为：${baseText}`,
        difficulty: 2,
        variant_idx: variantIdx,
      };
    },

    _makeFalseStatement(text) {
      const modifications = [
        () => this._wrongByNegation(text),
        () => this._wrongBySwap(text),
        () => this._wrongByExtreme(text),
      ];
      const idx = Math.abs(Utils.hash(text + 'false')) % modifications.length;
      return modifications[idx]();
    },

    _estimateDifficulty(kp, variantIdx) {
      // 基于知识点类型和变形索引估算难度
      const tagDiffMap = {
        concept: 1, strategy: 2, data: 1, model: 3,
        formula: 4, theorem: 3, policy: 2, algorithm: 4,
        syntax: 2, pattern: 3, example: 1, op: 1,
      };
      const base = tagDiffMap[kp.tag] || 2;
      return Utils.clamp(base + Math.floor(variantIdx / 2), 1, 5);
    },

    /**
     * 为一门课的所有课时生成完整题库（带缓存）
     */
    _bankCache: {},

    generateCourseBank(course) {
      if (this._bankCache[course.id]) return this._bankCache[course.id];

      const bank = { courseId: course.id, lessons: {} };
      let totalQ = 0;

      for (const lesson of course.lessons) {
        const lessonBank = { single: [], multiple: [], truefalse: [] };
        const kps = lesson.knowledge_points;

        for (let ki = 0; ki < kps.length; ki++) {
          const kp = kps[ki];
          // 单选题变形（占 80%）
          const variants = this.generateVariants(kp, course.id, lesson.title);
          lessonBank.single.push(...variants);

          // 判断题：每个知识点生成 2 个变形（正确/错误各一）
          lessonBank.truefalse.push(
            this.generateTrueFalse(kp, course.id, lesson.title, 0),
            this.generateTrueFalse(kp, course.id, lesson.title, 1),
          );
        }

        // 多选题：从同课时随机组合，确保每课时至少 10 题
        const multipleTarget = Math.max(10, Math.ceil(kps.length / 2));
        for (let i = 0; i < multipleTarget; i++) {
          const subsetSize = Utils.clamp(3 + (i % 3), 3, Math.min(6, kps.length));
          const subset = Utils.pickN(kps, subsetSize);
          const mq = this.generateMultipleChoice(subset, course.id, lesson.title);
          if (mq) lessonBank.multiple.push(mq);
        }

        bank.lessons[lesson.title] = lessonBank;
        totalQ += lessonBank.single.length + lessonBank.multiple.length + lessonBank.truefalse.length;
      }

      bank.totalQuestions = totalQ;
      this._bankCache[course.id] = bank;
      return bank;
    },
  };

  /* ======================================================================
   * 四、掌握度状态管理（SM-2 改良版）
   * ====================================================================== */
  const MasteryManager = {
    // key: `${courseId}_${lessonId}` -> mastery states
    _cache: {},

    _makeKey(courseId, lessonId) {
      return `${courseId}___${lessonId}`;
    },

    _storageKey(courseId, lessonId) {
      return `${CONFIG.STORAGE_PREFIX}${courseId}_${lessonId}_state`;
    },

    load(courseId, lessonId) {
      const key = this._makeKey(courseId, lessonId);
      if (this._cache[key]) return this._cache[key];

      try {
        const raw = localStorage.getItem(this._storageKey(courseId, lessonId));
        if (raw) {
          this._cache[key] = JSON.parse(raw);
        } else {
          this._cache[key] = {};
        }
      } catch (e) {
        this._cache[key] = {};
      }
      return this._cache[key];
    },

    save(courseId, lessonId) {
      const key = this._makeKey(courseId, lessonId);
      try {
        localStorage.setItem(
          this._storageKey(courseId, lessonId),
          JSON.stringify(this._cache[key])
        );
      } catch (e) {
        console.warn('QuizSystem: 存储空间不足，请清理 localStorage');
      }
    },

    getKP(courseId, lessonId, kpText) {
      const state = this.load(courseId, lessonId);
      const kpKey = this._kpKey(kpText);
      if (!state[kpKey]) {
        state[kpKey] = {
          level: 0,
          consecutive_correct: 0,
          last_review: 0,
          next_review: 0,
          history: [],
          forgotten: false,
        };
      }
      return state[kpKey];
    },

    _kpKey(text) {
      return 'kp_' + Utils.hash(text);
    },

    /**
     * 更新知识点掌握度（SM-2 改良版）
     */
    updateKP(courseId, lessonId, kpText, isCorrect, isNew) {
      const kp = this.getKP(courseId, lessonId, kpText);
      const now = Utils.now();

      kp.history.push({
        date: now,
        correct: isCorrect,
        was_new: isNew,
      });

      // 只保留最近 50 条记录
      if (kp.history.length > 50) kp.history = kp.history.slice(-50);

      kp.last_review = now;

      if (isCorrect) {
        kp.consecutive_correct++;
        // 连续 3 次正确 → 升级
        if (kp.consecutive_correct >= 3) {
          kp.level = Math.min(5, kp.level + 1);
          kp.consecutive_correct = 0;
          // 指数间隔
          kp.next_review = now + CONFIG.INTERVALS[Math.min(kp.level, CONFIG.INTERVALS.length - 1)];
        } else {
          kp.next_review = now + CONFIG.INTERVALS[Math.min(kp.level, CONFIG.INTERVALS.length - 1)];
        }
        kp.forgotten = false;
      } else {
        // 做错 → 降级
        kp.level = Math.max(0, kp.level - 2);
        kp.consecutive_correct = 0;
        if (kp.level >= 2 || kp.history.length > 3) {
          kp.forgotten = true;
        }
        // 重新进入高频循环
        kp.next_review = now;
      }

      this.save(courseId, lessonId);
      return kp;
    },

    /**
     * 获取某课时所有知识点的平均掌握度（0-100%）
     */
    getLessonProgress(courseId, lessonId, knowledgePoints) {
      const state = this.load(courseId, lessonId);
      let totalLevel = 0;
      let count = 0;

      for (const kp of knowledgePoints) {
        const kpState = state[this._kpKey(Utils.stripTagLabel(kp.text))];
        totalLevel += kpState ? kpState.level : 0;
        count++;
      }

      return count > 0 ? Math.round((totalLevel / count) * 20) : 0; // 0-5 → 0-100%
    },

    /**
     * 获取某门课程所有知识点的平均掌握度
     */
    getCourseProgress(courseId, lessons) {
      let totalLevel = 0;
      let totalCount = 0;

      for (const lesson of lessons) {
        const state = this.load(courseId, lesson.title);
        for (const kp of lesson.knowledge_points) {
          const kpState = state[this._kpKey(Utils.stripTagLabel(kp.text))];
          totalLevel += kpState ? kpState.level : 0;
          totalCount++;
        }
      }

      return totalCount > 0 ? Math.round((totalLevel / totalCount) * 20) : 0;
    },

    /**
     * 获取需要复习的知识点（next_review <= now）
     */
    getReviewableKPs(courseId, lessonId, knowledgePoints) {
      const now = Utils.now();
      const result = [];
      for (const kp of knowledgePoints) {
        const kpState = this.getKP(courseId, lessonId, Utils.stripTagLabel(kp.text));
        if (kpState.next_review <= now || kpState.level === 0) {
          result.push(kp);
        }
      }
      return result;
    },

    /**
     * 获取已掌握的知识点（level >= 3）
     */
    getMasteredKPs(courseId, lessonId, knowledgePoints) {
      const result = [];
      for (const kp of knowledgePoints) {
        const kpState = this.getKP(courseId, lessonId, Utils.stripTagLabel(kp.text));
        if (kpState.level >= 3) {
          result.push(kp);
        }
      }
      return result;
    },

    /**
     * 获取弱项/遗忘知识点
     */
    getWeakKPs(courseId, lessonId, knowledgePoints) {
      const result = [];
      for (const kp of knowledgePoints) {
        const kpState = this.getKP(courseId, lessonId, Utils.stripTagLabel(kp.text));
        if (kpState.level < 3 || kpState.forgotten) {
          result.push(kp);
        }
      }
      return result;
    },

    /**
     * 获取准确率
     */
    getAccuracy(courseId, lessonId) {
      const state = this.load(courseId, lessonId);
      let total = 0, correct = 0;
      for (const kpKey in state) {
        const kp = state[kpKey];
        if (kp.history && kp.history.length > 0) {
          for (const h of kp.history) {
            total++;
            if (h.correct) correct++;
          }
        }
      }
      return total > 0 ? Math.round((correct / total) * 100) : 0;
    },
  };

  /* ======================================================================
   * 五、自适应出题算法
   * ====================================================================== */
  const QuizEngine = {
    /**
     * 组建一套测验题目
     * @param {Object} course - 课程数据
     * @param {string|null} lessonTitle - 课时标题（null=期末考）
     * @param {string} mode - 'lesson' | 'final'
     */
    buildQuiz(course, lessonTitle, mode) {
      const cfg = mode === 'final' ? CONFIG.COURSE_FINAL : CONFIG.LESSON_QUIZ;
      const questions = [];

      if (mode === 'lesson') {
        const lesson = course.lessons.find(l => l.title === lessonTitle);
        if (!lesson) return questions;
        questions.push(...this._buildLessonQuiz(course, lesson, cfg));
      } else {
        questions.push(...this._buildFinalQuiz(course, cfg));
      }

      return Utils.shuffle(questions);
    },

    _buildLessonQuiz(course, lesson, cfg) {
      const allKPs = lesson.knowledge_points;
      const bank = QuestionGenerator.generateCourseBank(course).lessons[lesson.title];
      if (!bank) return [];

      const questions = [];

      // 单选题池：按掌握度分组
      const singlePool = bank.single || [];
      const verifySingles = [];
      const newSingles = [];

      for (const q of singlePool) {
        const kpState = MasteryManager.getKP(course.id, lesson.title, q.kp_text);
        if (kpState.level >= 3) {
          verifySingles.push(q);
        } else {
          newSingles.push(q);
        }
      }

      const singleCount = cfg.single;
      const verifyCount = Math.floor(singleCount * CONFIG.VERIFY_RATIO);
      const newCount = singleCount - verifyCount;

      // 从验证池中选不重复变形
      let selectedVerify = this._selectNonRepeating(verifySingles, verifyCount);
      // 如果验证池不足，从新题池补充
      if (selectedVerify.length < verifyCount) {
        const shortfall = verifyCount - selectedVerify.length;
        const extra = this._selectNonRepeating(
          newSingles.filter(q => !selectedVerify.includes(q)),
          shortfall
        );
        selectedVerify = selectedVerify.concat(extra);
      }

      let selectedNew = this._selectNonRepeating(
        newSingles.filter(q => !selectedVerify.includes(q)),
        newCount
      );
      // 如果新题池也不足，从验证池剩余中补充
      if (selectedNew.length < newCount) {
        const shortfall = newCount - selectedNew.length;
        const extra = this._selectNonRepeating(
          verifySingles.filter(q => !selectedVerify.includes(q)),
          shortfall
        );
        selectedNew = selectedNew.concat(extra);
      }

      questions.push(...selectedVerify, ...selectedNew);

      // 多选题
      const multiplePool = bank.multiple || [];
      const selectedMultiple = Utils.pickN(multiplePool, Math.min(cfg.multiple, multiplePool.length));
      questions.push(...selectedMultiple);

      // 判断题
      const tfPool = bank.truefalse || [];
      const selectedTF = Utils.pickN(tfPool, Math.min(cfg.truefalse, tfPool.length));
      questions.push(...selectedTF);

      return questions;
    },

    _buildFinalQuiz(course, cfg) {
      const questions = [];
      const allSingle = [];
      const allMultiple = [];
      const allTF = [];

      const fullBank = QuestionGenerator.generateCourseBank(course);
      for (const lesson of course.lessons) {
        const bank = fullBank.lessons[lesson.title];
        if (!bank) continue;

        for (const q of (bank.single || [])) allSingle.push(q);
        for (const q of (bank.multiple || [])) allMultiple.push(q);
        for (const q of (bank.truefalse || [])) allTF.push(q);
      }

      // 单选题 - 80% 验证 / 20% 新
      const verifySingles = allSingle.filter(q => {
        const kp = MasteryManager.getKP(course.id, q.lesson_id, q.kp_text);
        return kp.level >= 3;
      });
      const newSingles = allSingle.filter(q => {
        const kp = MasteryManager.getKP(course.id, q.lesson_id, q.kp_text);
        return kp.level < 3;
      });

      const verifyCount = Math.floor(cfg.single * CONFIG.VERIFY_RATIO);
      let selectedVerify = this._selectNonRepeating(verifySingles, verifyCount);
      if (selectedVerify.length < verifyCount) {
        const shortfall = verifyCount - selectedVerify.length;
        const extra = this._selectNonRepeating(
          newSingles.filter(q => !selectedVerify.includes(q)),
          shortfall
        );
        selectedVerify = selectedVerify.concat(extra);
      }

      let selectedNew = this._selectNonRepeating(
        newSingles.filter(q => !selectedVerify.includes(q)),
        cfg.single - verifyCount
      );
      if (selectedNew.length < (cfg.single - verifyCount)) {
        const shortfall = (cfg.single - verifyCount) - selectedNew.length;
        const extra = this._selectNonRepeating(
          verifySingles.filter(q => !selectedVerify.includes(q)),
          shortfall
        );
        selectedNew = selectedNew.concat(extra);
      }

      questions.push(...selectedVerify, ...selectedNew);
      questions.push(...Utils.pickN(allMultiple, Math.min(cfg.multiple, allMultiple.length)));
      questions.push(...Utils.pickN(allTF, Math.min(cfg.truefalse, allTF.length)));

      return questions;
    },

    /**
     * 选择不连续重复变形的题目
     */
    _selectNonRepeating(pool, count) {
      if (pool.length <= count) return pool.slice();

      // 按 kp_text 分组，每组最多取 1 个不同变形
      const byKP = {};
      for (const q of pool) {
        if (!byKP[q.kp_text]) byKP[q.kp_text] = [];
        byKP[q.kp_text].push(q);
      }

      const selected = [];
      const kpKeys = Object.keys(byKP);
      const shuffled = Utils.shuffle(kpKeys);

      for (const kp of shuffled) {
        if (selected.length >= count) break;
        const variants = byKP[kp];
        // 每组随机选一个变形
        selected.push(Utils.pick(variants));
      }

      // 如果还不够，从剩余中补充
      if (selected.length < count) {
        const remaining = pool.filter(q => !selected.includes(q));
        selected.push(...Utils.pickN(remaining, count - selected.length));
      }

      return selected.slice(0, count);
    },
  };

  /* ======================================================================
   * 六、统计与评分系统
   * ====================================================================== */
  const StatsManager = {
    _storageKey(courseId, lessonId) {
      return `${CONFIG.STORAGE_PREFIX}${courseId}_${lessonId}_stats`;
    },

    _finalStorageKey(courseId) {
      return `${CONFIG.STORAGE_PREFIX}${courseId}_final_stats`;
    },

    load(courseId, lessonId, isFinal) {
      const key = isFinal ? this._finalStorageKey(courseId) : this._storageKey(courseId, lessonId);
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    save(courseId, lessonId, isFinal, stats) {
      const key = isFinal ? this._finalStorageKey(courseId) : this._storageKey(courseId, lessonId);
      try {
        localStorage.setItem(key, JSON.stringify(stats));
      } catch (e) {
        console.warn('QuizSystem: 存储空间不足');
      }
    },

    addScore(courseId, lessonId, isFinal, score, totalMax) {
      const stats = this.load(courseId, lessonId, isFinal);
      stats.push({
        date: Utils.now(),
        score: score,
        max: totalMax,
        displayScore: isFinal ? Math.round((score / totalMax) * 100) : score,
      });
      // 保留最近 100 次
      if (stats.length > 100) stats.splice(0, stats.length - 100);
      this.save(courseId, lessonId, isFinal, stats);
      return stats;
    },

    getStats(stats) {
      if (stats.length === 0) return null;
      const scores = stats.map(s => s.displayScore);
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const max = Math.max(...scores);
      const last5 = scores.slice(-5);
      const last5Avg = Math.round(last5.reduce((a, b) => a + b, 0) / last5.length);
      const last5Max = Math.max(...last5);
      return { avg, max, last5Avg, last5Max, count: stats.length, recent: scores };
    },

    /**
     * 计算评级
     */
    getGrade(stats, accuracy) {
      if (!stats || stats.length === 0) return CONFIG.GRADES[6]; // F
      const scores = stats.map(s => s.displayScore);
      const maxScore = Math.max(...scores);
      const attempts = stats.length;

      // 从高到低检查
      for (const grade of CONFIG.GRADES) {
        if (grade.id === 'F') {
          if (attempts >= grade.minAttempts && maxScore < 70) return grade;
        } else {
          if (attempts >= grade.minAttempts && maxScore >= grade.minScore && accuracy >= grade.minAcc) {
            return grade;
          }
        }
      }
      return CONFIG.GRADES[6]; // F
    },

    /**
     * 检查是否达成"完美掌握"
     */
    isPerfectMaster(progress, stats) {
      if (!progress || progress < 100) return false;
      if (!stats || stats.length < 5) return false;
      const last5 = stats.slice(-5);
      return last5.every(s => s.displayScore === 100);
    },
  };

  /* ======================================================================
   * 七、情绪反馈系统
   * ====================================================================== */
  const EmotionFeedback = {
    encouragement: [
      '没关系，遗忘是正常的，再来一次！',
      '别灰心，每次练习都在帮你巩固记忆。',
      '暂时的退步不代表什么，坚持就是胜利！',
      '记住错误也是一种学习，下次一定会更好。',
      '每个人都会有遗忘的时候，你做得已经很好了。',
      '不要气馁！错误是通向精通的必经之路。',
      '休息一下，再战！你的大脑正在重新整理记忆。',
    ],
    affirmation: [
      '进步了！继续保持！',
      '不错不错，能感觉到你的进步！',
      '这次表现比上次更好，加油！',
      '稳中有升，你正在走上坡路。',
      '你的努力正在看到回报，继续！',
      '看到了吗？坚持练习真的有效果！',
      '每一次进步都值得肯定，干得漂亮！',
    ],
    praise: [
      '完美！你就是天才！',
      '满分！太强了！',
      '完美得分！无可挑剔！',
      '全对！你简直无懈可击！',
      '满分成就达成！太棒了！',
      '100分！你的大脑就是一台精密机器！',
    ],
    consecutivePraise: [
      '连续满分！你已经进入了学霸模式！',
      '又满分了！你是不是偷偷开了外挂？',
      '连续满分达成！你是认真的吗？这也太强了！',
      '连续满分！知识对你来说已经是本能了。',
      '又一次满分！你已经超越了自己！',
    ],

    getFeedback(prevScore, currentScore, consecutivePerfect) {
      if (currentScore >= 100) {
        if (consecutivePerfect > 1) {
          return { type: 'consecutive_perfect', text: Utils.pick(this.consecutivePraise) };
        }
        return { type: 'perfect', text: Utils.pick(this.praise) };
      }
      if (currentScore > prevScore) {
        return { type: 'up', text: Utils.pick(this.affirmation) };
      }
      if (currentScore < prevScore) {
        return { type: 'down', text: Utils.pick(this.encouragement) };
      }
      return { type: 'same', text: '分数持平，稳住！下一次继续加油！' };
    },
  };

  /* ======================================================================
   * 八、Canvas 特效动画系统
   * ====================================================================== */
  const EffectsEngine = {
    _canvas: null,
    _ctx: null,
    _animating: false,
    _particles: [],
    _texts: [],

    init() {
      if (this._canvas) return;
      this._canvas = document.createElement('canvas');
      this._canvas.id = 'quiz-effects-canvas';
      Object.assign(this._canvas.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '99999',
      });
      document.body.appendChild(this._canvas);
      this._ctx = this._canvas.getContext('2d');
      this._resize();
      window.addEventListener('resize', () => this._resize());
    },

    _resize() {
      this._canvas.width = window.innerWidth;
      this._canvas.height = window.innerHeight;
    },

    /**
     * 满分特效：金色粒子爆炸 + PERFECT
     */
    playPerfect() {
      this.init();
      this._createExplosion('#FFD700', '#FFA500', 120);
      this._createText('PERFECT!', 100, '#FFD700');
      this._animate(3000);
    },

    /**
     * 连续5次满分：彩虹粒子 + 烟花 + MASTERED
     */
    playMastered() {
      this.init();
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF', '#FF1493'];
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this._createFirework(Utils.pick(colors));
        }, i * 300);
      }
      this._createExplosionRainbow(200);
      this._createText('MASTERED', 90, '#FFD700');
      this._animate(5000);
    },

    /**
     * 课时满分：蓝色粒子 + 课节名
     */
    playLessonPerfect(lessonTitle) {
      this.init();
      this._createExplosion('#4169E1', '#00BFFF', 80);
      this._createText(lessonTitle, 60, '#4169E1');
      this._animate(3000);
    },

    /**
     * 课程满分（期末考）：全屏粒子雨 + CHAMPION
     */
    playChampion() {
      this.init();
      this._createParticleRain(200, '#FFD700');
      this._createText('CHAMPION', 110, '#FF4500');
      this._animate(5000);
    },

    /**
     * 课程连续5次满分：金色背景闪烁 + 奖杯 + LEGENDARY
     */
    playLegendary() {
      this.init();
      this._createGoldenFlash();
      this._createExplosion('#FFD700', '#FF8C00', 300);
      this._createTrophy();
      this._createText('LEGENDARY', 120, '#FFD700');
      this._animate(6000);
    },

    /**
     * 分数下降：温柔灰色动画
     */
    playComfort() {
      this.init();
      this._createExplosion('#C0C0C0', '#808080', 30);
      this._animate(2000);
    },

    _createExplosion(color1, color2, count) {
      const cx = this._canvas.width / 2;
      const cy = this._canvas.height / 2;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 2 + Math.random() * 6;
        const life = 60 + Math.random() * 60;
        this._particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 4,
          color: Math.random() > 0.5 ? color1 : color2,
          life: life, maxLife: life,
          type: 'circle',
        });
      }
    },

    _createExplosionRainbow(count) {
      const cx = this._canvas.width / 2;
      const cy = this._canvas.height / 2;
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        const life = 80 + Math.random() * 60;
        this._particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size: 3 + Math.random() * 5,
          color: colors[i % colors.length],
          life: life, maxLife: life,
          type: 'circle',
        });
      }
    },

    _createFirework(color) {
      const x = Math.random() * this._canvas.width;
      const y = Math.random() * this._canvas.height * 0.5;
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const speed = 1 + Math.random() * 3;
        const life = 40 + Math.random() * 30;
        this._particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3, color, life, maxLife: life, type: 'circle',
        });
      }
    },

    _createParticleRain(count, color) {
      for (let i = 0; i < count; i++) {
        this._particles.push({
          x: Math.random() * this._canvas.width,
          y: -Math.random() * 100,
          vx: (Math.random() - 0.5) * 2,
          vy: 2 + Math.random() * 4,
          size: 1 + Math.random() * 3,
          color, life: 200, maxLife: 200, type: 'rain',
        });
      }
    },

    _createText(text, fontSize, color) {
      this._texts.push({
        text, fontSize, color,
        x: this._canvas.width / 2,
        y: this._canvas.height / 2,
        opacity: 0, scale: 0.5,
        phase: 'grow', // grow -> hold -> fade
        timer: 0, growTime: 30, holdTime: 60, fadeTime: 40,
      });
    },

    _createTrophy() {
      // 用粒子画一个简化的奖杯形状
      const cx = this._canvas.width / 2;
      const cy = this._canvas.height * 0.3;
      for (let i = 0; i < 60; i++) {
        const angle = Math.PI * (0.2 + Math.random() * 0.6);
        const dist = 20 + Math.random() * 40;
        this._particles.push({
          x: cx + Math.cos(angle) * dist,
          y: cy - Math.sin(angle) * dist,
          vx: 0, vy: 0,
          size: 3 + Math.random() * 3,
          color: '#FFD700',
          life: 120, maxLife: 120,
          type: 'static',
        });
      }
    },

    _createGoldenFlash() {
      this._particles.push({
        x: 0, y: 0,
        vx: 0, vy: 0,
        size: 0, color: '#FFD700',
        life: 30, maxLife: 30,
        type: 'flash',
      });
    },

    _animate(duration) {
      if (this._animating) return;
      this._animating = true;
      const startTime = Utils.now();

      const tick = () => {
        const elapsed = Utils.now() - startTime;
        if (elapsed > duration) {
          this._animating = false;
          this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
          this._particles = [];
          this._texts = [];
          return;
        }

        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        // 绘制粒子
        for (let i = this._particles.length - 1; i >= 0; i--) {
          const p = this._particles[i];
          p.life--;

          if (p.life <= 0) {
            this._particles.splice(i, 1);
            continue;
          }

          const alpha = p.life / p.maxLife;

          if (p.type === 'flash') {
            this._ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
            this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
            continue;
          }

          if (p.type !== 'static') {
            p.x += p.vx;
            p.y += p.vy;
            if (p.type === 'rain') {
              p.vy += 0.05; // gravity
            } else {
              p.vx *= 0.98;
              p.vy *= 0.98;
            }
          }

          this._ctx.beginPath();
          this._ctx.globalAlpha = alpha;
          this._ctx.fillStyle = p.color;
          this._ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          this._ctx.fill();

          // 粒子拖尾
          if (p.type === 'circle' && p.size > 2) {
            this._ctx.beginPath();
            this._ctx.globalAlpha = alpha * 0.3;
            this._ctx.arc(p.x - p.vx, p.y - p.vy, p.size * alpha * 0.6, 0, Math.PI * 2);
            this._ctx.fill();
          }
        }

        // 绘制文字
        this._ctx.globalAlpha = 1;
        for (const t of this._texts) {
          t.timer++;

          if (t.phase === 'grow') {
            t.opacity = Math.min(1, t.opacity + 1 / t.growTime);
            t.scale = Math.min(1.2, t.scale + 0.7 / t.growTime);
            if (t.timer >= t.growTime) { t.phase = 'hold'; t.timer = 0; }
          } else if (t.phase === 'hold') {
            if (t.timer >= t.holdTime) { t.phase = 'fade'; t.timer = 0; }
          } else {
            t.opacity = Math.max(0, t.opacity - 1 / t.fadeTime);
          }

          this._ctx.save();
          this._ctx.globalAlpha = t.opacity;
          this._ctx.font = `bold ${Math.round(t.fontSize * t.scale)}px "Microsoft YaHei", "PingFang SC", sans-serif`;
          this._ctx.textAlign = 'center';
          this._ctx.textBaseline = 'middle';
          // 阴影
          this._ctx.shadowColor = t.color;
          this._ctx.shadowBlur = 20;
          this._ctx.fillStyle = t.color;
          this._ctx.fillText(t.text, t.x, t.y - (1 - t.scale) * 50);
          this._ctx.restore();
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    },
  };

  /* ======================================================================
   * 九、SVG 折线图
   * ====================================================================== */
  const SVGChart = {
    /**
     * 生成分数折线图 SVG
     * @param {Array} scores - [{displayScore, date}]
     * @param {number} width
     * @param {number} height
     */
    render(scores, width, height) {
      if (!scores || scores.length === 0) {
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" 
                 xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#f8f9fa" rx="8"/>
          <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#aaa" 
                font-size="14" font-family="sans-serif">暂无测验记录</text>
        </svg>`;
      }

      const padding = { top: 30, right: 20, bottom: 40, left: 45 };
      const chartW = width - padding.left - padding.right;
      const chartH = height - padding.top - padding.bottom;

      const recentScores = scores.slice(-20);
      const maxS = 100;
      const minS = 0;

      const points = recentScores.map((s, i) => ({
        x: padding.left + (i / (recentScores.length - 1 || 1)) * chartW,
        y: padding.top + chartH - ((s.displayScore - minS) / (maxS - minS)) * chartH,
        score: s.displayScore,
        date: Utils.formatDate(s.date),
      }));

      // 构建折线
      const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
      // 填充区域
      const areaPath = linePath +
        ` L${points[points.length - 1].x},${padding.top + chartH}` +
        ` L${points[0].x},${padding.top + chartH} Z`;

      // Y 轴刻度
      const yTicks = [0, 20, 40, 60, 80, 100];
      const yGridLines = yTicks.map(v => {
        const y = padding.top + chartH - (v / maxS) * chartH;
        return `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" 
                stroke="#eee" stroke-width="1"/>
                <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="#888" 
                      font-size="11" font-family="sans-serif">${v}</text>`;
      }).join('');

      // X 轴标签（最多显示 10 个）
      const xLabels = points.filter((_, i) => points.length <= 10 || i % Math.ceil(points.length / 10) === 0 || i === points.length - 1);
      const xLabelEls = xLabels.map(p =>
        `<text x="${p.x}" y="${padding.top + chartH + 20}" text-anchor="middle" fill="#888" 
               font-size="10" font-family="sans-serif" transform="rotate(-30, ${p.x}, ${padding.top + chartH + 20})">${p.date}</text>`
      ).join('');

      // 数据点
      const dots = points.map(p =>
        `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#4169E1" stroke="#fff" stroke-width="2">
          <title>${p.date}: ${p.score}分</title>
        </circle>`
      ).join('');

      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" 
              xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4169E1" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#4169E1" stop-opacity="0.05"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="#f8f9fa" rx="8"/>
        <!-- 标题 -->
        <text x="${width / 2}" y="20" text-anchor="middle" fill="#333" font-size="13" font-weight="bold" 
              font-family="sans-serif">测验成绩趋势</text>
        <!-- Y轴网格和刻度 -->
        ${yGridLines}
        <!-- X轴标签 -->
        ${xLabelEls}
        <!-- 填充区域 -->
        <path d="${areaPath}" fill="url(#areaGrad)"/>
        <!-- 折线 -->
        <path d="${linePath}" fill="none" stroke="#4169E1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- 数据点 -->
        ${dots}
      </svg>`;
    },
  };

  /* ======================================================================
   * 十、进度条组件
   * ====================================================================== */
  const ProgressBar = {
    render(percent, label, width) {
      const clampedPercent = Utils.clamp(percent, 0, 100);
      const isFull = clampedPercent >= 100;
      const barColor = isFull ? '#4CAF50' :
        clampedPercent >= 60 ? '#2196F3' :
        clampedPercent >= 30 ? '#FF9800' : '#F44336';

      return `<div style="margin: 8px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;color:#666;">${label}</span>
          <span style="font-size:12px;font-weight:bold;color:${barColor};">${clampedPercent}%</span>
        </div>
        <div style="width:${width || '100%'};height:10px;background:#e0e0e0;border-radius:5px;overflow:hidden;">
          <div style="width:${clampedPercent}%;height:100%;background:${barColor};border-radius:5px;transition:width 0.5s ease;"></div>
        </div>
      </div>`;
    },
  };

  /* ======================================================================
   * 十一、评级徽章组件
   * ====================================================================== */
  const GradeBadge = {
    render(grade, isPerfectMaster) {
      if (isPerfectMaster) {
        return `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
          background:linear-gradient(135deg, #FFD700, #FF8C00);border-radius:20px;
          color:#fff;font-weight:bold;font-size:16px;box-shadow:0 2px 8px rgba(255,215,0,0.5);">
          <span style="font-size:20px;">👑</span> 完美掌握
        </div>`;
      }
      if (!grade) return '';
      return `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
        background:${grade.color}22;border:2px solid ${grade.color};border-radius:20px;
        color:${grade.color};font-weight:bold;font-size:15px;">
        <span style="font-size:18px;">${grade.icon}</span> ${grade.id} ${grade.name}
      </div>`;
    },
  };

  /* ======================================================================
   * 十二、CSS 样式注入
   * ====================================================================== */
  const Styles = {
    _injected: false,

    inject() {
      if (this._injected) return;
      this._injected = true;

      const style = document.createElement('style');
      style.textContent = `
        /* 测验系统基础样式 */
        .quiz-btn {
          display: inline-block;
          padding: 10px 24px;
          margin: 12px 6px;
          background: linear-gradient(135deg, #4169E1, #6495ED);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(65,105,225,0.3);
        }
        .quiz-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(65,105,225,0.4); }
        .quiz-btn:active { transform: translateY(0); }
        .quiz-btn.secondary {
          background: linear-gradient(135deg, #6c757d, #adb5bd);
          box-shadow: 0 2px 8px rgba(108,117,125,0.3);
        }
        .quiz-btn.secondary:hover { box-shadow: 0 4px 12px rgba(108,117,125,0.4); }
        .quiz-btn.danger {
          background: linear-gradient(135deg, #dc3545, #e74c3c);
          box-shadow: 0 2px 8px rgba(220,53,69,0.3);
        }

        /* 测验弹窗 */
        .quiz-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.5); z-index: 90000;
          display: flex; align-items: center; justify-content: center;
          animation: quizFadeIn 0.3s ease;
        }
        @keyframes quizFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .quiz-modal {
          background: #fff; border-radius: 16px; width: 92%; max-width: 700px;
          max-height: 90vh; overflow-y: auto; padding: 0;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: quizSlideUp 0.3s ease;
        }
        @keyframes quizSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .quiz-header {
          position: sticky; top: 0; background: #fff;
          padding: 16px 20px; border-bottom: 1px solid #eee;
          display: flex; justify-content: space-between; align-items: center;
          z-index: 10; border-radius: 16px 16px 0 0;
        }
        .quiz-header h2 { margin: 0; font-size: 18px; color: #333; }
        .quiz-close {
          width: 32px; height: 32px; border: none; background: #f5f5f5;
          border-radius: 50%; cursor: pointer; font-size: 18px; color: #666;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .quiz-close:hover { background: #e0e0e0; color: #333; }

        .quiz-body { padding: 20px; }

        /* 题目样式 */
        .quiz-question-num {
          font-size: 13px; color: #999; margin-bottom: 8px;
        }
        .quiz-question-type {
          display: inline-block; padding: 2px 8px; border-radius: 4px;
          font-size: 11px; font-weight: bold; margin-right: 6px;
        }
        .quiz-question-type.single { background: #E3F2FD; color: #1565C0; }
        .quiz-question-type.multiple { background: #E8F5E9; color: #2E7D32; }
        .quiz-question-type.truefalse { background: #FFF3E0; color: #E65100; }
        .quiz-question-text {
          font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 16px;
          font-weight: 500;
        }

        /* 选项 */
        .quiz-options { display: flex; flex-direction: column; gap: 10px; }
        .quiz-option {
          padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px;
          cursor: pointer; transition: all 0.2s ease; font-size: 14px;
          color: #555; line-height: 1.5;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .quiz-option:hover { border-color: #4169E1; background: #F5F8FF; }
        .quiz-option.selected { border-color: #4169E1; background: #E8EEFF; color: #333; }
        .quiz-option.correct { border-color: #4CAF50; background: #E8F5E9; color: #2E7D32; }
        .quiz-option.wrong { border-color: #F44336; background: #FFEBEE; color: #C62828; }
        .quiz-option.disabled { pointer-events: none; opacity: 0.7; }

        .quiz-option-marker {
          min-width: 24px; height: 24px; border-radius: 50%; border: 2px solid #ccc;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: bold; color: #888; flex-shrink: 0;
          transition: all 0.2s;
        }
        .quiz-option.selected .quiz-option-marker {
          background: #4169E1; border-color: #4169E1; color: #fff;
        }
        .quiz-option.correct .quiz-option-marker {
          background: #4CAF50; border-color: #4CAF50; color: #fff;
        }
        .quiz-option.wrong .quiz-option-marker {
          background: #F44336; border-color: #F44336; color: #fff;
        }

        /* 解释区域 */
        .quiz-explanation {
          margin-top: 16px; padding: 14px 16px; border-radius: 8px;
          background: #F5F5F5; font-size: 13px; color: #666; line-height: 1.6;
          border-left: 3px solid #4169E1;
          animation: quizFadeIn 0.3s ease;
        }

        /* 进度指示 */
        .quiz-progress-bar {
          width: 100%; height: 6px; background: #eee; border-radius: 3px;
          overflow: hidden; margin-bottom: 16px;
        }
        .quiz-progress-fill {
          height: 100%; background: linear-gradient(90deg, #4169E1, #6495ED);
          border-radius: 3px; transition: width 0.3s ease;
        }

        /* 分数显示 */
        .quiz-score-display {
          text-align: center; padding: 30px 20px;
        }
        .quiz-score-number {
          font-size: 56px; font-weight: 900; line-height: 1;
          margin-bottom: 8px;
        }
        .quiz-score-label { font-size: 16px; color: #666; }

        /* 情绪反馈 */
        .quiz-emotion {
          text-align: center; padding: 12px 20px; font-size: 18px;
          font-weight: bold; margin: 16px 0; border-radius: 12px;
          animation: quizBounce 0.5s ease;
        }
        @keyframes quizBounce {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }

        /* 统计面板 */
        .quiz-stats-panel {
          padding: 16px 20px; background: #f9fafb; border-radius: 12px;
          margin: 16px 0;
        }
        .quiz-stats-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
        }
        .quiz-stat-item {
          text-align: center; padding: 12px; background: #fff;
          border-radius: 8px; border: 1px solid #eee;
        }
        .quiz-stat-value { font-size: 24px; font-weight: bold; color: #333; }
        .quiz-stat-label { font-size: 12px; color: #888; margin-top: 4px; }

        /* 测验按钮组 */
        .quiz-actions {
          display: flex; gap: 10px; justify-content: center;
          padding: 16px 20px; flex-wrap: wrap;
        }

        /* 课时测验区域 */
        .quiz-lesson-section {
          margin: 20px 0; padding: 20px;
          background: linear-gradient(135deg, #F0F4FF, #E8EEFF);
          border-radius: 12px; border: 1px solid #C5CAE9;
        }
        .quiz-lesson-section h3 {
          margin: 0 0 12px 0; font-size: 16px; color: #333;
        }

        /* 响应式 */
        @media (max-width: 600px) {
          .quiz-modal { width: 96%; max-height: 95vh; border-radius: 12px; }
          .quiz-header { padding: 12px 16px; }
          .quiz-header h2 { font-size: 16px; }
          .quiz-body { padding: 16px; }
          .quiz-question-text { font-size: 15px; }
          .quiz-option { padding: 10px 14px; font-size: 13px; }
          .quiz-stats-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .quiz-score-number { font-size: 48px; }
        }

        @media (max-width: 400px) {
          .quiz-stats-grid { grid-template-columns: 1fr; }
          .quiz-actions { flex-direction: column; align-items: stretch; }
          .quiz-btn { margin: 6px 0; }
        }

        /* 滚动条美化 */
        .quiz-modal::-webkit-scrollbar { width: 6px; }
        .quiz-modal::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        .quiz-modal::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        .quiz-modal::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
      `;
      document.head.appendChild(style);
    },
  };

  /* ======================================================================
   * 十三、UI 渲染器
   * ====================================================================== */
  const UIRenderer = {
    /**
     * 创建测验弹窗 overlay
     */
    createOverlay(contentHTML) {
      const overlay = document.createElement('div');
      overlay.className = 'quiz-overlay';
      overlay.innerHTML = `<div class="quiz-modal">${contentHTML}</div>`;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });
      document.body.appendChild(overlay);
      return overlay;
    },

    /**
     * 渲染测验界面
     */
    renderQuiz(quizState) {
      const q = quizState.currentQuestion;
      const total = quizState.questions.length;
      const current = quizState.currentIndex + 1;
      const progress = Math.round((current / total) * 100);

      const typeLabel = q.type === 'single' ? '单选' :
        q.type === 'multiple' ? '多选' : '判断';

      const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

      let optionsHTML = '';
      q.options.forEach((opt, i) => {
        const isSelected = quizState.selectedAnswers.includes(i);
        let optClass = 'quiz-option';
        if (isSelected) optClass += ' selected';
        if (quizState.answered) {
          const isCorrect = q.correct_answers.includes(i);
          if (isCorrect) optClass += ' correct';
          else if (isSelected) optClass += ' wrong';
          optClass += ' disabled';
        }

        optionsHTML += `<div class="${optClass}" data-idx="${i}">
          <div class="quiz-option-marker">${optionLabels[i] || (i + 1)}</div>
          <div>${opt}</div>
        </div>`;
      });

      return `
        <div class="quiz-header">
          <h2>${quizState.mode === 'final' ? '期末测验' : '课时测验'} - ${quizState.lessonTitle || ''}</h2>
          <button class="quiz-close" data-action="close">✕</button>
        </div>
        <div class="quiz-body">
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width:${progress}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span class="quiz-question-num">第 ${current} / ${total} 题</span>
            ${q.type === 'multiple' ? '<span style="font-size:12px;color:#2E7D32;font-weight:bold;">（多选题，可选多个）</span>' : ''}
          </div>
          <div>
            <span class="quiz-question-type ${q.type}">${typeLabel}</span>
            <span style="font-size:11px;color:#999;">难度 ${'★'.repeat(q.difficulty)}${'☆'.repeat(5 - q.difficulty)}</span>
          </div>
          <div class="quiz-question-text">${q.question}</div>
          <div class="quiz-options" data-question-idx="${quizState.currentIndex}">${optionsHTML}</div>
          ${quizState.answered ? `<div class="quiz-explanation">解析：${q.explanation}</div>` : ''}
          <div class="quiz-actions">
            ${!quizState.answered ? `<button class="quiz-btn" data-action="submit">确认答案</button>` : ''}
            ${quizState.answered && current < total ?
          `<button class="quiz-btn" data-action="next">下一题 →</button>` :
          quizState.answered ? `<button class="quiz-btn" data-action="finish">查看结果</button>` : ''}
            ${quizState.answered && current >= total ? `<button class="quiz-btn secondary" data-action="finish">查看结果</button>` : ''}
          </div>
        </div>
      `;
    },

    /**
     * 渲染结果页面
     */
    renderResult(result) {
      const { score, maxScore, displayScore, mode, courseId, lessonTitle, prevScore, consecutivePerfect, stats, grade, accuracy, progress, isPerfectMaster, isFinal } = result;
      const feedback = EmotionFeedback.getFeedback(prevScore, displayScore, consecutivePerfect);

      const emotionBg = feedback.type === 'perfect' || feedback.type === 'consecutive_perfect' ? '#FFF8E1' :
        feedback.type === 'up' ? '#E8F5E9' :
        feedback.type === 'down' ? '#F5F5F5' : '#F3E5F5';
      const emotionColor = feedback.type === 'perfect' || feedback.type === 'consecutive_perfect' ? '#FF8F00' :
        feedback.type === 'up' ? '#2E7D32' :
        feedback.type === 'down' ? '#757575' : '#7B1FA2';

      const scoreColor = displayScore >= 90 ? '#4CAF50' :
        displayScore >= 80 ? '#4169E1' :
        displayScore >= 60 ? '#FF9800' : '#F44336';

      const chartHTML = SVGChart.render(stats, 600, 200);
      const statsData = StatsManager.getStats(stats);
      const gradeHTML = GradeBadge.render(grade, isPerfectMaster);

      return `
        <div class="quiz-header">
          <h2>测验结果</h2>
          <button class="quiz-close" data-action="close">✕</button>
        </div>
        <div class="quiz-body">
          <!-- 分数 -->
          <div class="quiz-score-display">
            <div class="quiz-score-number" style="color:${scoreColor};">${displayScore}</div>
            <div class="quiz-score-label">得分（满分 ${mode === 'final' ? 100 : 100} 分）</div>
            ${gradeHTML}
          </div>

          <!-- 情绪反馈 -->
          <div class="quiz-emotion" style="background:${emotionBg};color:${emotionColor};">
            ${feedback.text}
          </div>

          <!-- 统计数据 -->
          ${statsData ? `
            <div class="quiz-stats-panel">
              <div class="quiz-stats-grid">
                <div class="quiz-stat-item">
                  <div class="quiz-stat-value">${statsData.avg}</div>
                  <div class="quiz-stat-label">平均分</div>
                </div>
                <div class="quiz-stat-item">
                  <div class="quiz-stat-value">${statsData.max}</div>
                  <div class="quiz-stat-label">最高分</div>
                </div>
                <div class="quiz-stat-item">
                  <div class="quiz-stat-value">${statsData.last5Avg}</div>
                  <div class="quiz-stat-label">近5次平均</div>
                </div>
                <div class="quiz-stat-item">
                  <div class="quiz-stat-value">${statsData.last5Max}</div>
                  <div class="quiz-stat-label">近5次最高</div>
                </div>
                <div class="quiz-stat-item">
                  <div class="quiz-stat-value">${statsData.count}</div>
                  <div class="quiz-stat-label">测验次数</div>
                </div>
                <div class="quiz-stat-item">
                  <div class="quiz-stat-value">${accuracy}%</div>
                  <div class="quiz-stat-label">总准确率</div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- 折线图 -->
          <div style="margin:16px 0;">
            ${chartHTML}
          </div>

          <!-- 进度条 -->
          <div style="margin:16px 0;">
            ${ProgressBar.render(progress, isFinal ? '课程掌握进度' : '课时掌握进度', '100%')}
          </div>

          <!-- 操作按钮 -->
          <div class="quiz-actions">
            <button class="quiz-btn" data-action="retry">再测一次</button>
            <button class="quiz-btn secondary" data-action="close">关闭</button>
          </div>
        </div>
      `;
    },

    /**
     * 渲染课时测验区块（注入到页面中）
     */
    renderLessonSection(course, lesson) {
      const progress = MasteryManager.getLessonProgress(course.id, lesson.title, lesson.knowledge_points);
      const stats = StatsManager.load(course.id, lesson.title, false);
      const statsData = StatsManager.getStats(stats);
      const accuracy = MasteryManager.getAccuracy(course.id, lesson.title);
      const grade = StatsManager.getGrade(stats, accuracy);
      const isPerfectMaster = StatsManager.isPerfectMaster(progress, stats);

      return `
        <div class="quiz-lesson-section" data-course-id="${course.id}" data-lesson-title="${lesson.title}">
          <h3>📝 知识测验 - ${lesson.title}</h3>
          <p style="font-size:13px;color:#666;margin:0 0 8px 0;">
            共 ${lesson.knowledge_points.length} 个知识点 | 已生成题库
          </p>
          ${ProgressBar.render(progress, '掌握进度', '100%')}
          <div style="margin:8px 0;">
            ${GradeBadge.render(grade, isPerfectMaster)}
          </div>
          ${statsData ? `
            <div style="font-size:12px;color:#888;margin:4px 0;">
              平均分: ${statsData.avg} | 最高分: ${statsData.max} | 测验次数: ${statsData.count} | 准确率: ${accuracy}%
            </div>
          ` : ''}
          <div>
            <button class="quiz-btn" data-action="start-lesson-quiz">开始测验（50题）</button>
            <button class="quiz-btn secondary" data-action="reset-lesson-progress">重置进度</button>
          </div>
        </div>
      `;
    },

    /**
     * 渲染课程期末考区块
     */
    renderCourseFinalSection(course) {
      const progress = MasteryManager.getCourseProgress(course.id, course.lessons);
      const stats = StatsManager.load(course.id, null, true);
      const statsData = StatsManager.getStats(stats);
      const isPerfectMaster = StatsManager.isPerfectMaster(progress, stats);

      return `
        <div class="quiz-lesson-section" style="background:linear-gradient(135deg, #FFF3E0, #FFE0B2);border-color:#FFCC80;"
             data-course-id="${course.id}" data-is-final="true">
          <h3>🎓 课程期末考 - ${course.title}</h3>
          <p style="font-size:13px;color:#666;margin:0 0 8px 0;">
            共 ${course.total_kp} 个知识点 | 100 题 | 折算 100 分制
          </p>
          ${ProgressBar.render(progress, '课程掌握进度', '100%')}
          ${isPerfectMaster ? '<div style="margin:8px 0;">👑 完美掌握！</div>' : ''}
          ${statsData ? `
            <div style="font-size:12px;color:#888;margin:4px 0;">
              平均分: ${statsData.avg} | 最高分: ${statsData.max} | 考试次数: ${statsData.count}
            </div>
          ` : ''}
          <div>
            <button class="quiz-btn" data-action="start-final-quiz">开始期末考（100题）</button>
          </div>
        </div>
      `;
    },
  };

  /* ======================================================================
   * 十四、测验控制器
   * ====================================================================== */
  const QuizController = {
    _activeQuiz: null,
    _overlay: null,
    _courseData: null,

    /**
     * 启动课时测验
     */
    startLessonQuiz(courseId, lessonTitle) {
      const course = this._findCourse(courseId);
      if (!course) return;
      const lesson = course.lessons.find(l => l.title === lessonTitle);
      if (!lesson) return;

      const questions = QuizEngine.buildQuiz(course, lessonTitle, 'lesson');
      if (questions.length === 0) {
        alert('题库为空，无法开始测验。');
        return;
      }

      this._activeQuiz = {
        course, lessonTitle,
        mode: 'lesson',
        isFinal: false,
        questions,
        currentIndex: 0,
        currentQuestion: questions[0],
        selectedAnswers: [],
        answered: false,
        score: 0,
        correctCount: 0,
        answerRecord: [],
      };

      this._showQuizUI();
    },

    /**
     * 启动期末考
     */
    startFinalQuiz(courseId) {
      const course = this._findCourse(courseId);
      if (!course) return;

      const questions = QuizEngine.buildQuiz(course, null, 'final');
      if (questions.length === 0) {
        alert('题库为空，无法开始期末考。');
        return;
      }

      this._activeQuiz = {
        course, lessonTitle: '期末考',
        mode: 'final',
        isFinal: true,
        questions,
        currentIndex: 0,
        currentQuestion: questions[0],
        selectedAnswers: [],
        answered: false,
        score: 0,
        correctCount: 0,
        answerRecord: [],
      };

      this._showQuizUI();
    },

    /**
     * 显示测验 UI
     */
    _showQuizUI() {
      const html = UIRenderer.renderQuiz(this._activeQuiz);
      this._overlay = UIRenderer.createOverlay(html);
      this._bindQuizEvents();
    },

    /**
     * 绑定测验内事件
     */
    _bindQuizEvents() {
      const modal = this._overlay.querySelector('.quiz-modal');

      // 关闭按钮
      modal.querySelector('[data-action="close"]').addEventListener('click', () => {
        this._endQuiz(false);
      });

      // 选项点击
      modal.querySelector('.quiz-options').addEventListener('click', (e) => {
        const optEl = e.target.closest('.quiz-option');
        if (!optEl || this._activeQuiz.answered) return;
        const idx = parseInt(optEl.dataset.idx);
        this._toggleOption(idx);
        this._refreshQuizUI();
      });

      // 提交答案
      const submitBtn = modal.querySelector('[data-action="submit"]');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          this._submitAnswer();
          this._refreshQuizUI();
        });
      }

      // 下一题
      const nextBtn = modal.querySelector('[data-action="next"]');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          this._nextQuestion();
          this._refreshQuizUI();
        });
      }

      // 完成
      const finishBtn = modal.querySelector('[data-action="finish"]');
      if (finishBtn) {
        finishBtn.addEventListener('click', () => {
          this._finishQuiz();
        });
      }
    },

    _toggleOption(idx) {
      const quiz = this._activeQuiz;
      if (quiz.currentQuestion.type === 'multiple') {
        // 多选：切换选中
        const pos = quiz.selectedAnswers.indexOf(idx);
        if (pos >= 0) quiz.selectedAnswers.splice(pos, 1);
        else quiz.selectedAnswers.push(idx);
      } else {
        // 单选/判断：只能选一个
        quiz.selectedAnswers = [idx];
      }
    },

    _submitAnswer() {
      const quiz = this._activeQuiz;
      if (quiz.selectedAnswers.length === 0) return;
      quiz.answered = true;

      const q = quiz.currentQuestion;
      const isCorrect = this._checkAnswer(q, quiz.selectedAnswers);

      if (isCorrect) {
        quiz.correctCount++;
        quiz.score += (quiz.isFinal ? CONFIG.COURSE_FINAL : CONFIG.LESSON_QUIZ).pointsPerQ;
      }

      // 更新掌握度
      const isNew = !MasteryManager.getKP(quiz.course.id, q.lesson_id, q.kp_text).history ||
        MasteryManager.getKP(quiz.course.id, q.lesson_id, q.kp_text).history.length === 0;
      MasteryManager.updateKP(quiz.course.id, q.lesson_id, q.kp_text, isCorrect, isNew);

      quiz.answerRecord.push({
        question: q,
        selected: quiz.selectedAnswers.slice(),
        correct: isCorrect,
      });
    },

    _checkAnswer(question, selected) {
      const sorted1 = selected.slice().sort();
      const sorted2 = question.correct_answers.slice().sort();
      if (sorted1.length !== sorted2.length) return false;
      return sorted1.every((v, i) => v === sorted2[i]);
    },

    _nextQuestion() {
      const quiz = this._activeQuiz;
      quiz.currentIndex++;
      quiz.currentQuestion = quiz.questions[quiz.currentIndex];
      quiz.selectedAnswers = [];
      quiz.answered = false;
    },

    _finishQuiz() {
      const quiz = this._activeQuiz;
      const cfg = quiz.isFinal ? CONFIG.COURSE_FINAL : CONFIG.LESSON_QUIZ;
      const displayScore = quiz.isFinal ? Math.round((quiz.score / cfg.maxScore) * 100) : quiz.score;

      // 保存分数
      const stats = StatsManager.addScore(quiz.course.id, quiz.lessonTitle, quiz.isFinal, quiz.score, cfg.maxScore);
      const prevStats = stats.slice(0, -1);
      const prevScore = prevStats.length > 0 ? prevStats[prevStats.length - 1].displayScore : 0;

      // 计算连续满分
      let consecutivePerfect = 0;
      for (let i = stats.length - 1; i >= 0; i--) {
        if (stats[i].displayScore >= 100) consecutivePerfect++;
        else break;
      }

      const accuracy = MasteryManager.getAccuracy(quiz.course.id, quiz.lessonTitle);
      const grade = StatsManager.getGrade(stats, accuracy);
      const progress = quiz.isFinal ?
        MasteryManager.getCourseProgress(quiz.course.id, quiz.course.lessons) :
        MasteryManager.getLessonProgress(quiz.course.id, quiz.lessonTitle, quiz._lessonKnowledgePoints || []);
      const isPerfectMaster = StatsManager.isPerfectMaster(progress, stats);

      // 渲染结果
      const resultHTML = UIRenderer.renderResult({
        score: quiz.score, maxScore: cfg.maxScore, displayScore,
        mode: quiz.mode, courseId: quiz.course.id, lessonTitle: quiz.lessonTitle,
        prevScore, consecutivePerfect, stats, grade, accuracy, progress,
        isPerfectMaster, isFinal: quiz.isFinal,
      });

      this._overlay.innerHTML = `<div class="quiz-modal">${resultHTML}</div>`;
      this._bindResultEvents();

      // 播放特效
      if (displayScore >= 100) {
        if (quiz.isFinal) {
          if (consecutivePerfect >= 5) EffectsEngine.playLegendary();
          else EffectsEngine.playChampion();
        } else {
          if (consecutivePerfect >= 5) EffectsEngine.playMastered();
          else EffectsEngine.playPerfect();
        }
      } else if (displayScore < prevScore) {
        EffectsEngine.playComfort();
      }
    },

    _bindResultEvents() {
      const modal = this._overlay.querySelector('.quiz-modal');

      modal.querySelector('[data-action="close"]').addEventListener('click', () => {
        this._endQuiz(true);
      });

      const retryBtn = modal.querySelector('[data-action="retry"]');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this._overlay.remove();
          if (this._activeQuiz.isFinal) {
            this.startFinalQuiz(this._activeQuiz.course.id);
          } else {
            this.startLessonQuiz(this._activeQuiz.course.id, this._activeQuiz.lessonTitle);
          }
        });
      }
    },

    _refreshQuizUI() {
      const modal = this._overlay.querySelector('.quiz-modal');
      const html = UIRenderer.renderQuiz(this._activeQuiz);
      modal.innerHTML = html;
      this._bindQuizEvents();
    },

    _endQuiz(completed) {
      if (this._overlay) {
        this._overlay.remove();
        this._overlay = null;
      }
      if (completed) {
        this._activeQuiz = null;
        this.refreshAllSections();
      } else {
        this._activeQuiz = null;
      }
    },

    _findCourse(courseId) {
      if (!this._courseData) return null;
      return this._courseData.find(c => c.id === courseId);
    },

    /**
     * 重置课时进度
     */
    resetLessonProgress(courseId, lessonTitle) {
      if (!confirm('确定要重置该课时的所有测验进度吗？此操作不可撤销。')) return;
      const key = MasteryManager._storageKey(courseId, lessonTitle);
      localStorage.removeItem(key);
      // 也清除统计
      localStorage.removeItem(`${CONFIG.STORAGE_PREFIX}${courseId}_${lessonTitle}_stats`);
      this.refreshAllSections();
    },

    /**
     * 刷新所有注入的测验区块
     */
    refreshAllSections() {
      document.querySelectorAll('.quiz-lesson-section').forEach(el => el.remove());
      this.injectUI();
    },
  };

  /* ======================================================================
   * 十五、初始化与注入
   * ====================================================================== */
  const QuizInitializer = {
    _kpData: null,

    /**
     * 加载知识点数据
     */
    async loadData() {
      if (this._kpData) return this._kpData;

      try {
        // 尝试从同一目录加载 JSON
        const basePath = document.currentScript ?
          document.currentScript.src.replace(/[^/]*$/, '') : '/';

        const resp = await fetch(basePath + 'quiz_kp_data.json');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        this._kpData = await resp.json();
        return this._kpData;
      } catch (e) {
        console.warn('QuizSystem: 无法加载 quiz_kp_data.json，尝试备用路径...', e.message);
        try {
          const resp = await fetch('/quiz_kp_data.json');
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          this._kpData = await resp.json();
          return this._kpData;
        } catch (e2) {
          console.error('QuizSystem: 无法加载知识点数据文件。请确保 quiz_kp_data.json 与 quiz-system.js 在同一目录。');
          return null;
        }
      }
    },

    /**
     * 注入 UI 到页面
     */
    async inject() {
      Styles.inject();

      const data = await this.loadData();
      if (!data) {
        console.error('QuizSystem: 数据加载失败');
        return;
      }

      QuizController._courseData = data;

      // 为页面中的每节课注入测验区域
      // 策略：根据数据中的课程和课时，在页面合适位置插入
      this._injectByDataStructure(data);
    },

    /**
     * 基于数据结构智能注入
     */
    _injectByDataStructure(data) {
      // 方式1：查找与课时标题匹配的 DOM 元素
      for (const course of data) {
        for (const lesson of course.lessons) {
          this._injectForLesson(course, lesson);
        }
        // 注入课程期末考
        this._injectFinalSection(course);
      }
    },

    _injectForLesson(course, lesson) {
      // 查找包含课时标题的元素
      const titleSelectors = [
        `h1:contains("${lesson.title}")`,
        `h2:contains("${lesson.title}")`,
        `h3:contains("${lesson.title}")`,
        `[data-lesson="${lesson.title}"]`,
      ];

      let targetEl = null;
      for (const sel of titleSelectors) {
        try {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            targetEl = els[0];
            break;
          }
        } catch (e) { /* contains not supported as CSS selector */ }
      }

      // fallback：遍历所有标题查找匹配
      if (!targetEl) {
        const allHeadings = document.querySelectorAll('h1, h2, h3, h4');
        for (const h of allHeadings) {
          if (h.textContent.includes(lesson.title)) {
            targetEl = h;
            break;
          }
        }
      }

      // fallback：查找匹配课程标题的容器
      if (!targetEl) {
        const containers = document.querySelectorAll('[class*="lesson"], [class*="chapter"], [class*="section"]');
        for (const c of containers) {
          if (c.textContent.includes(lesson.title)) {
            targetEl = c;
            break;
          }
        }
      }

      if (targetEl) {
        // 在标题后插入测验区域
        const section = document.createElement('div');
        section.innerHTML = UIRenderer.renderLessonSection(course, lesson);
        const quizSection = section.firstElementChild;

        // 插入位置：找到包含该标题的最外层容器，在其末尾追加
        let container = targetEl.parentElement;
        // 向上查找直到找到合适的容器
        let depth = 0;
        while (container && depth < 10) {
          if (container.parentElement && container.parentElement.contains(targetEl)) {
            // 检查容器是否只包含这一个课时
            container = container.parentElement;
            depth++;
          } else {
            break;
          }
        }

        // 在目标元素后面的同级位置或父容器末尾插入
        if (targetEl.nextElementSibling) {
          targetEl.parentElement.insertBefore(quizSection, targetEl.nextElementSibling);
        } else {
          targetEl.parentElement.appendChild(quizSection);
        }
      }
    },

    _injectFinalSection(course) {
      // 在课程标题容器末尾追加期末考入口
      const courseTitle = course.title;
      const allHeadings = document.querySelectorAll('h1, h2');
      let targetEl = null;
      for (const h of allHeadings) {
        if (h.textContent.includes(courseTitle.split('完整')[0].split('知识点')[0])) {
          targetEl = h;
          break;
        }
      }

      if (targetEl) {
        const section = document.createElement('div');
        section.innerHTML = UIRenderer.renderCourseFinalSection(course);
        const quizSection = section.firstElementChild;
        const parent = targetEl.parentElement;
        if (parent) {
          parent.appendChild(quizSection);
        }
      }
    },
  };

  /* ======================================================================
   * 十六、全局事件委托
   * ====================================================================== */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const section = btn.closest('.quiz-lesson-section');
    if (!section && !QuizController._activeQuiz) return;

    switch (action) {
      case 'start-lesson-quiz': {
        const courseId = section.dataset.courseId;
        const lessonTitle = section.dataset.lessonTitle;
        if (courseId && lessonTitle) {
          QuizController.startLessonQuiz(courseId, lessonTitle);
        }
        break;
      }
      case 'start-final-quiz': {
        const courseId = section.dataset.courseId;
        if (courseId) {
          QuizController.startFinalQuiz(courseId);
        }
        break;
      }
      case 'reset-lesson-progress': {
        const courseId = section.dataset.courseId;
        const lessonTitle = section.dataset.lessonTitle;
        if (courseId && lessonTitle) {
          QuizController.resetLessonProgress(courseId, lessonTitle);
        }
        break;
      }
    }
  });

  /* ======================================================================
   * 十七、自执行初始化
   * ====================================================================== */
  // 等待 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => QuizInitializer.inject(), 500);
    });
  } else {
    setTimeout(() => QuizInitializer.inject(), 500);
  }

  // 同时监听页面内容变化（SPA 场景）
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.quiz-lesson-section') && QuizInitializer._kpData) {
        QuizInitializer.inject();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // 暴露全局接口（便于调试）
  window.QuizSystem = {
    QuizInitializer,
    QuizController,
    QuizEngine,
    MasteryManager,
    QuestionGenerator,
    StatsManager,
    EmotionFeedback,
    EffectsEngine,
    SVGChart,
    ProgressBar,
    GradeBadge,
    UIRenderer,
    Utils,
    CONFIG,
  };

})();
