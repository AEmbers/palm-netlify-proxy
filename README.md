# 🎓 Personal Learning Hub — 课程知识库与自适应测验系统

一个集课程知识点管理、自适应测验、MIT 学术水平评级于一体的个人学习中心。

**线上地址**：https://aembers.github.io/palm-netlify-proxy/

---

## 📋 项目概述

本项目是一个纯前端单页应用（SPA），不依赖任何后端服务。核心功能：

1. **知识库**：9 门课程、2400+ 知识点的结构化整理
2. **自适应测验**：基于 SM-2 间隔重复算法，自动从知识点生成题目，智能追踪掌握度
3. **MIT 水平评级**：基于真实 MIT 课程编号体系，计算含金量，映射到 13 级学术等级轴
4. **可视化**：课程规模条形图、章节知识点分布图、分数折线图、掌握度进度条

---

## 🏗 项目结构

```
learning-hub-project/
├── src/                          # 源代码
│   ├── index.html                # ★ 主文件（学习中心完整版，所有功能内嵌）
│   ├── quiz-system.js            # 测验系统源码（2439行）
│   ├── mit-level-system.js       # MIT水平评级系统源码（824行）
│   ├── live-ops-course/          # 独立课程页面（直播运营）
│   ├── mit-14-01-microeconomics/ # 独立课程页面（微观经济学）
│   ├── mit-python-6/             # 独立课程页面（Python）
│   ├── data-analysis-14.310x/    # 独立课程页面（数据分析）
│   ├── micro-theory-14.003x/     # 独立课程页面（微观理论）
│   ├── econometric-14.320/       # 独立课程页面（计量经济学）
│   ├── game-theory-14.161/       # 独立课程页面（博弈论）
│   ├── optimization-6.C571/     # 独立课程页面（优化）
│   ├── machine-learning-6.3900/ # 独立课程页面（机器学习）
│   └── learning-center/          # 多文件版学习中心首页（非完整版）
├── scripts/                      # 构建/工具脚本
│   ├── extract_kp_for_quiz.py    # 从HTML提取知识点数据
│   ├── inject_quiz.py            # 将测验系统注入HTML
│   └── fix_python_kp.py          # 修复Python课程知识点提取
├── data/                         # 数据文件
│   └── quiz_kp_data.json         # 知识点结构化数据（9门课2400个知识点）
├── docs/                         # 开发文档
│   ├── ARCHITECTURE.md           # 架构设计文档
│   ├── QUIZ_SYSTEM.md            # 测验系统详细文档
│   ├── MIT_LEVEL_SYSTEM.md       # MIT评级系统详细文档
│   └── CONTRIBUTING.md           # 贡献指南
├── assets/                       # 静态资源（预留）
└── README.md                     # 本文件
```

> **★ `src/index.html` 是唯一需要部署的文件**。所有 JS、CSS、数据都内嵌其中。其他文件是源码和独立课程页面，供开发参考。

---

## 🚀 快速开始

### 部署
```bash
# 方式1：直接部署到 GitHub Pages
# 将 src/index.html 重命名为 index.html，推送到 gh-pages 分支即可

# 方式2：本地预览
cd src && python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

### 开发流程
```bash
# 1. 修改源码（如 quiz-system.js）
# 2. 重新注入到 HTML
python3 scripts/inject_quiz.py

# 3. 如果新增了课程知识点，先提取再注入
python3 scripts/extract_kp_for_quiz.py
python3 scripts/inject_quiz.py
```

---

## 🧩 核心模块

### 1. 知识库（Knowledge Base）

- **数据来源**：B站课程逐字稿、MIT OCW 讲义 PDF
- **提取工具**：`scripts/extract_kp_for_quiz.py`
- **存储格式**：内嵌 JSON，`window.__QUIZ_KP_DATA__`
- **知识点分类标签**：概念、策略、数据、模型、公式、定理、政策、算法、语法、编程模式、示例

### 2. 测验系统（Quiz System）

**源码**：`src/quiz-system.js`（2439行，17个模块）

| 模块 | 职责 |
|------|------|
| `CONFIG` | 全局配置：测验模式、间隔重复参数、7档评级定义 |
| `Utils` | 工具函数：哈希、种子随机、洗牌、标签剥离 |
| `QuestionGenerator` | 题库生成引擎（5种变形方式） |
| `MasteryManager` | SM-2 改良版掌握度状态管理 |
| `QuizEngine` | 自适应出题算法（80%验证/20%推新） |
| `StatsManager` | 分数统计与评级计算 |
| `EmotionFeedback` | 情绪反馈文案系统 |
| `EffectsEngine` | Canvas 特效动画（6种场景） |
| `SVGChart` | 手写 SVG 折线图 |
| `ProgressBar` | 进度条组件 |
| `GradeBadge` | 评级徽章组件 |
| `UIRenderer` | UI 渲染器 |
| `QuizController` | 测验流程控制器 |
| `QuizInitializer` | 数据加载与页面注入 |

**测验规则**：
- 课时测验：50题（30单选+10多选+10判断），每题2分，满分100
- 期末考试：100题（60单选+20多选+20判断），折算100分制
- 出题比例：80%验证已掌握 + 20%推新/弱项
- 间隔重复：连续3次正确→升级，间隔1天→3天→7天→21天→60天
- 7档评级：S+降维打击 / S顶级天才 / A卓越 / B优秀 / C中等 / D待加强 / F需重塑基础

### 3. MIT 水平评级系统（MIT Level System）

**源码**：`src/mit-level-system.js`（824行）

- **13级等级轴**：附中初一 → 本科大一→大二→大三→大四 → 研一→研二 → 博一→博二 → 博后 → 正教授
- **含金量计算**：`难度(1-10) × 学分 × 10 × 掌握度 × 覆盖系数`
- **3种可切换进度条**：
  1. 当前等级 → 下一等级
  2. 在整个 MIT 等级轴上的位置
  3. 所有课程含金量上限
- **速度评价**：S+/S/A/B/C/D 六档

**课程难度数据库**（基于真实 MIT 课程编号研究）：

| 课程 | 编号 | 难度 | MIT级别 |
|------|------|------|---------|
| 微观经济学 | 14.01 | 3/10 | 大一入门 |
| Python | 6.0001/6.0002 | 2.5/10 | 大一编程 |
| 机器学习 | 6.3900 | 5/10 | 大三本科 |
| 数据分析 | 14.310x | 5/10 | 研究生入门 |
| 微观理论 | 14.003x | 5/10 | 研究生 |
| 计量经济学 | 14.320 | 6/10 | 研究生 |
| 优化方法 | 6.C571 | 6/10 | 研究生级 |
| 博弈论 | 14.161 | 7/10 | 研究生高阶 |

### 4. 可视化系统

- **首页课程规模条形图**：SVG 实现，按知识点数量降序，按分类着色
- **章节知识点分布图**：每门课程页面的堆叠条形图
- **分数折线图**：SVG 手写，显示测验分数趋势
- **掌握度进度条**：课时级 + 课程级，可增可减
- **等级轴**：MIT 13级彩色等级轴，标注当前位置和课程上限

---

## 📊 数据结构

### 知识点数据格式
```json
[
  {
    "id": "mit-14-01-microeconomics",
    "title": "MIT 14.01 Principles of Microeconomics",
    "total_kp": 605,
    "lessons": [
      {
        "title": "L01 导论：经济学思维与供需模型",
        "kp_count": 30,
        "knowledge_points": [
          {
            "text": "微观经济学研究个体和企业在稀缺性世界中如何尽可能使自己达到最优福利状态",
            "tag": "concept",
            "tag_label": "概念"
          }
        ]
      }
    ]
  }
]
```

### 掌握度状态（localStorage）
```javascript
// key: quiz_${courseId}_${lessonId}_state
{
  "kp_text_hash": {
    "level": 0-5,              // 0=未学 1=初学 2=接触 3=熟悉 4=掌握 5=精通
    "consecutive_correct": 0,   // 连续正确次数
    "last_review": 1234567890,  // 时间戳
    "next_review": 1234567890,  // 下次复习时间
    "history": [{date, correct, was_new}],
    "forgotten": false
  }
}
```

---

## 🔧 技术栈

- **前端**：纯 HTML + CSS + JavaScript（无框架、无构建工具）
- **可视化**：手写 SVG + Canvas
- **数据持久化**：localStorage
- **部署**：GitHub Pages（静态托管）
- **开发工具**：Python 3（脚本工具）

---

## 📝 添加新课程

详细步骤见 `docs/CONTRIBUTING.md`。简要流程：

1. 准备课程知识点数据（JSON 格式）
2. 运行 `scripts/extract_kp_for_quiz.py` 提取
3. 运行 `scripts/inject_quiz.py` 注入
4. 在 `mit-level-system.js` 的 `COURSE_DATABASE` 中添加课程元数据
5. 在首页 HTML 中添加课程卡片

---

## 📄 许可

个人项目，未公开发布。所有课程内容版权归原作者所有。

---

## 🤝 贡献

详见 `docs/CONTRIBUTING.md`。
