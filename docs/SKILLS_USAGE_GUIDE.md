# Trae Skills 使用指南

## ✅ 安装完成

已成功安装 **14 个高质量 Skills**，全部位于 `.trae/skills/` 目录下，可作为全局 Skills 使用。

---

## 📦 已安装 Skills 清单

### 🎯 Superpowers 核心工作流 (9个)

| Skill | 用途 | 触发时机 |
|-------|------|----------|
| **brainstorming** | 需求头脑风暴与设计 | 开始新功能前 |
| **writing-plans** | 编写详细实施计划 | 设计完成后 |
| **test-driven-development** | 测试驱动开发 | 编写代码时 |
| **systematic-debugging** | 系统化调试 | 遇到 Bug 时 |
| **requesting-code-review** | 请求代码审查 | 完成任务后 |
| **executing-plans** | 执行实施计划 | 有计划需要执行 |
| **subagent-driven-development** | 子代理驱动开发 | 复杂任务分解 |
| **using-git-worktrees** | 使用 Git Worktrees | 需要隔离工作空间 |
| **finishing-a-development-branch** | 完成开发分支 | 开发完成后 |

### 🚀 开发效率 Skills (5个)

| Skill | 用途 | 使用率 |
|-------|------|--------|
| **code-reviewer** | 代码审查专家 | 92% |
| **architecture-designer** | 架构设计与系统规划 | 87% |
| **debug-master** | 智能调试 | 83% |
| **frontend-design** | 前端设计 | 78% |
| **code-refactor** | 代码重构 | 75% |

---

## 🎮 使用方法

### 方式 1：显式加载
在 Trae 对话中直接请求：
```
使用 skill 工具加载 brainstorming
使用 skill 工具加载 code-reviewer
使用 skill 工具加载 test-driven-development
```

### 方式 2：自然语言触发
通过描述需求让 Trae 自动选择合适的 Skill：
```
"帮我审查这段代码" → 自动触发 code-reviewer
"这个 Bug 怎么解决" → 自动触发 debug-master
"设计一个登录页面" → 自动触发 frontend-design
"重构这个函数" → 自动触发 code-refactor
```

### 方式 3：工作流程自动触发
按照 Superpowers 工作流，Skills 会自动按顺序触发：
```
需求 → brainstorming → writing-plans → subagent-driven-development → 
TDD → code-review → finishing-a-development-branch
```

---

## 💡 实战示例

### 场景 1：开发新功能
```
用户：我要开发一个用户认证系统

Trae：我会使用 brainstorming skill 来帮你梳理需求...
[自动触发 brainstorming]

...讨论完成后...

Trae：现在使用 writing-plans skill 制定实施计划...
[自动触发 writing-plans]

...计划完成后...

Trae：使用 subagent-driven-development 开始开发...
[自动触发 subagent-driven-development + test-driven-development]
```

### 场景 2：代码审查
```
用户：请帮我审查这个 PR

Trae：使用 code-reviewer skill 进行代码审查...
[自动触发 code-reviewer]

输出：
## Code Review Report
### Critical Issues
1. [SQL 注入风险] auth.js:45
   - 问题：直接拼接 SQL
   - 修复：使用参数化查询
   
### Important Issues
...
```

### 场景 3：调试问题
```
用户：这个报错怎么解决？[粘贴错误日志]

Trae：使用 debug-master skill 分析问题...
[自动触发 debug-master]

输出：
## Debug Report
### Issue Summary
- 错误类型: 运行时错误
- 严重程度: High
- 根因: 空指针访问

### Solution
```javascript
// 修复前
const name = user.profile.name;

// 修复后
const name = user?.profile?.name ?? 'Anonymous';
```
```

---

## 🔧 完整开发工作流

### 标准流程
```mermaid
brainstorming(需求头脑风暴)
  ↓ 设计确认
writing-plans(编写实施计划)
  ↓ 计划确认
using-git-worktrees(创建隔离工作空间)
  ↓ 环境准备
subagent-driven-development(子代理驱动开发)
  ↓ 每个任务
TDD(测试驱动开发)
  ↓ 任务完成
requesting-code-review(代码审查)
  ↓ 所有任务完成
finishing-a-development-branch(完成开发分支)
```

### 快速流程（简单任务）
```
debug-master(调试问题)
code-reviewer(审查代码)
code-refactor(重构优化)
```

---

## 📊 Skills 选择指南

### 按开发阶段选择

| 阶段 | 推荐 Skills |
|------|-------------|
| 需求分析 | brainstorming, architecture-designer |
| 架构设计 | architecture-designer, writing-plans |
| 编码实现 | test-driven-development, subagent-driven-development |
| 调试排错 | debug-master, systematic-debugging |
| 代码审查 | code-reviewer, requesting-code-review |
| 重构优化 | code-refactor |
| UI 开发 | frontend-design |

### 按问题类型选择

| 问题 | 推荐 Skill |
|------|-----------|
| 需求不清晰 | brainstorming |
| 技术选型 | architecture-designer |
| 代码报错 | debug-master |
| 复杂 Bug | systematic-debugging |
| 代码质量差 | code-reviewer, code-refactor |
| 需要写测试 | test-driven-development |
| 要做界面 | frontend-design |
| 代码合并 | finishing-a-development-branch |

---

## 🎯 最佳实践

### 1. 组合使用
```
"帮我设计并实现一个登录功能"
→ brainstorming + architecture-designer + frontend-design + 
   writing-plans + subagent-driven-development + test-driven-development
```

### 2. 按需触发
不需要一次性加载所有 Skills，根据当前任务选择合适的 Skill。

### 3. 迭代优化
```
第1轮：brainstorming → 确定需求
第2轮：architecture-designer → 确定架构
第3轮：writing-plans → 制定计划
第4轮：subagent-driven-development → 执行开发
第5轮：code-reviewer → 代码审查
第6轮：code-refactor → 重构优化
```

### 4. 保持上下文
在长时间对话中，Trae 会自动记住已使用的 Skills，不需要重复加载。

---

## 📁 文件位置

所有 Skills 配置文件：
```
.trae/
├── skills/
│   ├── brainstorming/SKILL.md
│   ├── writing-plans/SKILL.md
│   ├── test-driven-development/SKILL.md
│   ├── systematic-debugging/SKILL.md
│   ├── requesting-code-review/SKILL.md
│   ├── executing-plans/SKILL.md
│   ├── subagent-driven-development/SKILL.md
│   ├── using-git-worktrees/SKILL.md
│   ├── finishing-a-development-branch/SKILL.md
│   ├── code-reviewer/SKILL.md
│   ├── architecture-designer/SKILL.md
│   ├── debug-master/SKILL.md
│   ├── frontend-design/SKILL.md
│   └── code-refactor/SKILL.md
├── SKILL_CONFIG.md
└── SKILLS_USAGE_GUIDE.md (本文件)
```

---

## 🔗 相关资源

- [Superpowers 官方文档](https://github.com/obra/superpowers)
- [HighMark-31 TRAE-Skills](https://github.com/HighMark-31/TRAE-Skills)
- [Trae Skills 最佳实践](https://www.trae.ai/blog/trae_tutorial_0115)

---

## ✨ 开始使用

现在你可以直接对 Trae 说：

```
"使用 skill 工具加载 code-reviewer，帮我审查这段代码"
"使用 skill 工具加载 brainstorming，我想开发一个新功能"
"使用 skill 工具加载 debug-master，帮我解决这个报错"
```

或者更简单：

```
"帮我审查代码"
"设计一个登录页面"
"重构这个函数"
"解决这个 Bug"
```

Trae 会自动选择合适的 Skills 来帮助你！
