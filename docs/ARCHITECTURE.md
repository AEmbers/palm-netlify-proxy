# 🏗 架构设计文档

## 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   src/index.html                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │              知识库展示层 (HTML)                   │ │
│  │  首页课程卡片 │ 课程页面 │ 知识点列表 │ 章节目录   │ │
│  └──────────────────────┬──────────────────────────┘ │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │              可视化层 (SVG)                        │ │
│  │  课程规模条形图 │ 章节分布图 │ 分数折线图 │ 等级轴  │ │
│  └──────────────────────┬──────────────────────────┘ │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │           测验系统 (quiz-system.js)              │ │
│  │  题库生成 → 自适应出题 → 答题 → 评分 → 状态更新   │ │
│  └──────────────────────┬──────────────────────────┘ │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │         MIT评级系统 (mit-level-system.js)        │ │
│  │  课程含金量计算 → 等级映射 → 进度条渲染            │ │
│  └──────────────────────┬──────────────────────────┘ │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │           数据层 (localStorage)                   │ │
│  │  quiz_{course}_{lesson}_state │ 掌握度状态        │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 数据流

```
知识点数据 (JSON)
      │
      ▼
QuestionGenerator.generate()  ←── MasteryManager (localStorage)
      │                                    │
      ▼                                    │
QuizEngine.assembleQuiz()                  │
      │                                    │
      ▼                                    │
用户答题 → QuizController.submit()         │
      │                                    │
      ▼                                    │
MasteryManager.update() ──────────────→ 保存
      │
      ▼
StatsManager.calculate() → 评级 + 折线图
      │
      ▼
MITLevelSystem.update() → 含金量 + 等级 + 进度条
```

## 页面切换机制

学习中心使用 SPA 架构，通过 `showPage(id)` / `showHome()` 函数切换：

```javascript
function showPage(id) {
  document.getElementById('home-page').style.display = 'none';
  document.querySelectorAll('.course-page').forEach(p => p.style.display = 'none');
  document.getElementById('page-' + id).style.display = 'block';
  window.scrollTo(0, 0);
}
```

URL hash 变化同步：`#mit-14-01-microeconomics` → 自动切换到对应课程页面。

## 测验系统模块依赖关系

```
QuizInitializer (入口)
  ├── 加载 window.__QUIZ_KP_DATA__
  ├── Styles (注入CSS)
  └── UIRenderer (注入UI)
        └── QuizController (控制流程)
              ├── QuizEngine (出题)
              │     └── QuestionGenerator (题库)
              │           └── MasteryManager (掌握度查询)
              ├── 用户答题
              ├── MasteryManager.update (更新状态)
              ├── StatsManager (计算统计)
              ├── EffectsEngine (播放特效)
              ├── EmotionFeedback (情绪文案)
              ├── SVGChart (折线图)
              ├── ProgressBar (进度条)
              └── GradeBadge (评级徽章)
```

## MIT 评级算法详解

### 含金量公式

```
单课含金量 = 满分含金量 × 掌握度 × (0.5 + 0.5 × 覆盖率)

满分含金量 = 难度(1-10) × 学分 × 10
覆盖率 = 已掌握知识点数 / 总知识点数
掌握度 = 平均 mastery level / 5 × 100%

示例：14.01 微观经济学（难度3, 学分12）
  满分含金量 = 3 × 12 × 10 = 360
  如果掌握度 80%, 覆盖率 90%:
  实际含金量 = 360 × 0.8 × (0.5 + 0.5 × 0.9) = 360 × 0.8 × 0.95 = 273.6
```

### 等级映射

13 级等级轴的阈值基于 MIT 实际培养方案设计：
- 一门满分入门课（难度3）≈ 360 含金量 → 对应大一水平
- 一门满分研究生课（难度7）≈ 840 含金量 → 对应研一~研二
- 完全掌握全部 9 门课 ≈ 4980 含金量 → 超过正教授阈值(2500)

### 难度评分依据

难度评分基于 MIT 课程编号体系：
- `14.0x-14.1x`：本科入门/中级 → 难度 2-4
- `14.003x/14.310x`：研究生入门 → 难度 5
- `14.320/6.C571`：研究生中级 → 难度 6
- `14.161`：研究生高阶专题 → 难度 7
- `14.121-124`：博士核心序列 → 难度 9-10（未纳入）

## 性能考虑

- **文件大小**：当前 ~925KB，知识点数据和JS代码内嵌
- **localStorage**：每个课时独立存储，避免单 key 过大
- **Canvas 特效**：使用 requestAnimationFrame，完成后自动销毁
- **MutationObserver**：监听 DOM 变化，SPA 切换时自动重新注入
- **轮询更新**：MIT 评级系统每 5 秒更新一次（可调）

## 扩展点

### 添加新课程
1. 在 `window.__QUIZ_KP_DATA__` 中添加课程数据
2. 在 HTML 中添加课程页面 `<div class="course-page" id="page-{courseId}">`
3. 在首页添加课程卡片
4. 在 `COURSE_DATABASE` 中添加课程元数据

### 修改测验算法
- 出题比例：修改 `CONFIG.VERIFY_RATIO` 和 `CONFIG.NEW_RATIO`
- 间隔时间：修改 `CONFIG.INTERVALS` 数组
- 题型数量：修改 `CONFIG.LESSON_QUIZ` 或 `CONFIG.COURSE_FINAL`

### 修改评级体系
- 等级定义：修改 `LEVELS` 数组
- 难度评分：修改 `COURSE_DATABASE` 中对应课程
- 含金量公式：修改 `Calculator.calculateCourseValue()`

### 添加新可视化
- 新图表：在 `SVGChart` 或独立模块中实现
- 新动画：在 `EffectsEngine` 中添加新的 Canvas 动画方法
