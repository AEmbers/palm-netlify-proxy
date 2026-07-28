# 🤝 贡献指南

感谢你参与本项目！无论你是人类开发者还是 AI 助手，本文档都会帮助你快速上手。

---

## 开发环境准备

```bash
# 克隆仓库
git clone https://github.com/AEmbers/palm-netlify-proxy.git
cd palm-netlify-proxy

# 本地预览
cd src && python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

无需安装任何依赖。纯前端项目，只需一个浏览器。

---

## 项目结构说明

```
src/
├── index.html              # ★ 唯一部署文件（所有功能内嵌）
├── quiz-system.js           # 测验系统源码
├── mit-level-system.js      # MIT评级系统源码
└── [课程目录]/              # 独立课程页面（非完整版用）

scripts/
├── extract_kp_for_quiz.py   # 从HTML提取知识点
├── inject_quiz.py            # 将JS注入HTML
└── fix_python_kp.py         # Python课程修复脚本

data/
└── quiz_kp_data.json        # 知识点结构化数据

docs/
├── ARCHITECTURE.md           # 架构文档
├── QUIZ_SYSTEM.md            # 测验系统文档
├── MIT_LEVEL_SYSTEM.md       # MIT评级文档
└── CONTRIBUTING.md           # 本文件
```

> **重要**：`src/index.html` 是最终产物，所有 JS 和数据都内嵌其中。开发时修改 `src/quiz-system.js` 或 `src/mit-level-system.js`，然后用 `scripts/inject_quiz.py` 重新注入。

---

## 常见开发任务

### 任务 1：添加一门新课程

#### 步骤 1：准备知识点数据

将课程知识点整理为以下 JSON 格式：
```json
{
  "id": "new-course-id",
  "title": "课程名称",
  "total_kp": 100,
  "lessons": [
    {
      "title": "第一讲 标题",
      "kp_count": 20,
      "knowledge_points": [
        {
          "text": "知识点文本",
          "tag": "concept",
          "tag_label": "概念"
        }
      ]
    }
  ]
}
```

标签可选值：`concept`(概念), `strategy`(策略), `data`(数据), `model`(模型), `formula`(公式), `theorem`(定理), `policy`(政策), `algorithm`(算法), `syntax`(语法), `pattern`(编程模式), `example`(示例), `operation`(操作)

#### 步骤 2：添加课程页面 HTML

在 `src/index.html` 中，在最后一个 `course-page` 之后添加：
```html
<div class="course-page" id="page-new-course-id">
  <!-- 返回按钮 -->
  <div style="...">
    <button onclick="showHome();return false;">返回学习中心</button>
  </div>
  <!-- 课程内容 -->
  <div class="wrap">
    <header class="hero">...</header>
    <section class="chapter">...</section>
  </div>
</div>
```

#### 步骤 3：在首页添加课程卡片

在 `course-grid` 中添加：
```html
<article class="course-card" data-category="economics" data-search="关键词">
  <div class="card-cover">...</div>
  <div class="card-body">
    <h3>课程名称</h3>
    <div class="card-meta">...</div>
    <div class="chap-tags">...</div>
    <div class="progress-wrap">...</div>
    <div class="card-action">
      <a href="#" onclick="showPage('new-course-id');return false;" class="btn-primary">
        查看课程知识点
      </a>
    </div>
  </div>
</article>
```

#### 步骤 4：添加 MIT 评级数据

在 `src/mit-level-system.js` 的 `COURSE_DATABASE` 中添加：
```javascript
'new-course-id': {
  name: '课程名称',
  mit_equiv: '14.xxx',      // MIT课程编号，非MIT课程设为null
  level: 'ug-junior',       // 参考已有课程
  difficulty: 5,            // 1-10，参考docs/MIT_LEVEL_SYSTEM.md
  credits: 12,              // MIT学分制，一般12
  category: 'economics',     // economics | cs | media
  note: '课程说明'
}
```

#### 步骤 5：更新知识点数据

将新课程数据添加到 `data/quiz_kp_data.json`，然后运行：
```bash
python3 scripts/inject_quiz.py
```

#### 步骤 6：更新 showPage 配置

在 `src/index.html` 底部的 `showPage` 函数和 `courseIds` 数组中添加新课程 ID。

---

### 任务 2：修改测验算法

所有测验参数在 `src/quiz-system.js` 的 `CONFIG` 对象中：

```javascript
const CONFIG = {
  LESSON_QUIZ: {
    totalQuestions: 50,    // 修改题目总数
    single: 30,            // 单选题数
    multiple: 10,          // 多选题数
    truefalse: 10,         // 判断题数
    pointsPerQ: 2,         // 每题分值
    maxScore: 100,         // 满分
  },
  VERIFY_RATIO: 0.8,       // 验证题比例（0-1）
  NEW_RATIO: 0.2,          // 推新题比例（0-1）
  INTERVALS: [             // 间隔重复天数
    0,                     // level 0
    1 * 24 * 60 * 60 * 1000,  // level 1: 1天
    3 * 24 * 60 * 60 * 1000,  // level 2: 3天
    // ... 修改这些值
  ],
  GRADES: [                // 7档评级阈值
    { id: 'S+', name: '降维打击', minAttempts: 1, minScore: 95, ... },
    // ... 修改这些阈值
  ],
};
```

修改后运行 `python3 scripts/inject_quiz.py` 重新注入。

---

### 任务 3：修改 MIT 评级体系

#### 修改等级阈值
在 `src/mit-level-system.js` 的 `LEVELS` 数组中修改 `min` 和 `max` 值。

#### 修改含金量公式
在 `Calculator.calculateCourseValue()` 中修改。

#### 修改课程难度
在 `COURSE_DATABASE` 中修改对应课程的 `difficulty` 值。

修改后运行 `python3 scripts/inject_quiz.py` 重新注入。

---

### 任务 4：修改 UI 样式

#### 全局样式
在 `src/index.html` 的 `<style>` 标签中修改 CSS 变量：
```css
:root {
  --bg: #f0f3f7;        /* 背景色 */
  --ink: #1a202c;       /* 主文字色 */
  --accent: #2b4f81;    /* 强调色 */
  --accent2: #d4a03a;   /* 次强调色 */
}
```

#### 测验 UI 样式
在 `src/quiz-system.js` 的 `Styles` 模块中修改注入的 CSS。

---

### 任务 5：添加新的可视化

#### 新图表
在 `src/quiz-system.js` 中添加新的 SVG 生成函数，参考 `SVGChart` 模块。

#### 新动画
在 `src/quiz-system.js` 的 `EffectsEngine` 中添加新的 Canvas 动画方法：
```javascript
newEffect(score, context) {
  const canvas = this._createCanvas();
  const ctx = canvas.getContext('2d');
  // 动画逻辑...
  // 完成后 this._destroyCanvas(canvas);
}
```

---

## 提交规范

```bash
# 1. 修改源码文件
# 2. 重新注入
python3 scripts/inject_quiz.py

# 3. 提交
git add .
git commit -m "feat: 添加XXX课程"        # 新功能
git commit -m "fix: 修复XXX评分计算"      # 修复
git commit -m "docs: 更新XXX文档"         # 文档
git commit -m "refactor: 重构XXX模块"     # 重构
git commit -m "style: 优化XXX样式"         # 样式
git push
```

---

## 调试技巧

### 控制台 API

```javascript
// 查看测验系统状态
QuizSystem.MasteryManager._cache

// 查看某个课程的掌握度
QuizSystem.MasteryManager.getCourseProgress('mit-14-01-microeconomics', courses[1].lessons)

// 手动触发 MIT 评级更新
MITLevelSystem.update()

// 查看 MIT 评级计算结果
MITLevelSystem.Calculator.calculateTotal(MITLevelSystem.Controller.getCourseData())

// 重置某课程数据
QuizSystem.QuizController.resetLessonProgress(courseId, lessonTitle)

// 清除所有测验数据
Object.keys(localStorage).filter(k => k.startsWith('quiz_')).forEach(k => localStorage.removeItem(k))
```

### 查看知识点数据
```javascript
// 查看所有课程
window.__QUIZ_KP_DATA__.map(c => ({id: c.id, title: c.title, kp: c.total_kp}))

// 查看某课程的课时
window.__QUIZ_KP_DATA__.find(c => c.id === 'mit-14-01-microeconomics').lessons
```

---

## 注意事项

1. **不要直接修改 `src/index.html` 中的内嵌 JS**，而是修改 `src/quiz-system.js` 和 `src/mit-level-system.js`，然后用脚本注入
2. **`src/index.html` 是最终产物**，部署时只需要这一个文件
3. **localStorage 有容量限制**（通常 5-10MB），大量课程数据可能需要优化存储方式
4. **GitHub Pages 有缓存**，推送后可能需要 1-2 分钟生效
5. **移动端适配**：所有 UI 组件都需要在 <600px 和 <400px 断点下测试
