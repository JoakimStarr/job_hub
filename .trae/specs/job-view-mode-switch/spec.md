# 岗位列表/卡片视图切换 + 点击修复 Spec

## Why
当前岗位列表仅支持卡片网格布局，用户希望默认使用更紧凑的列表视图（横向行式），并能在两种视图间切换。同时存在点击岗位卡片无法打开详情弹窗的问题需要修复。

## What Changes
- 新增 `viewMode` 状态（`'card'` | `'list'`），默认为 `'list'`
- 在排序控件左侧添加视图切换按钮（图标切换：卡片/列表）
- JobCard 组件新增列表模式渲染（横向紧凑行布局）
- 修复岗位卡片点击无法打开详情页的问题

## Impact
- Affected specs: 岗位列表页交互、岗位详情弹窗
- Affected code:
  - `src/components/ui.tsx` — JobCard 组件增加列表模式 + 新增 ViewToggle 组件
  - `src/app/jobs/page.tsx` — 添加 viewMode 状态和切换按钮
  - `src/styles/components.css` — 添加 `.job-list-item` 列表样式

---

## ADDED Requirements

### Requirement: 岗位视图切换
系统 SHALL 提供卡片视图和列表视图两种展示方式，用户可自由切换。

#### Scenario: 默认列表视图
- **WHEN** 用户进入岗位列表页
- **THEN** 岗位以列表形式展示（每条一行，横向排列标题/公司/地点/薪资等关键信息）
- **AND** 视图切换按钮显示"当前为列表视图"

#### Scenario: 切换到卡片视图
- **WHEN** 用户点击视图切换按钮
- **THEN** 视图切换为卡片网格布局
- **AND** 按钮状态更新为"当前为卡片视图"
- **AND** 切换过程无闪烁

#### Scenario: 切换回列表视图
- **WHEN** 用户再次点击视图切换按钮
- **THEN** 视图切回列表形式
- **AND** 当前选中的筛选条件和排序保持不变

### Requirement: 视图切换按钮位置
系统 SHALL 在排序下拉框左侧放置视图切换按钮。

#### Scenario: 按钮位置
- **WHEN** 用户查看岗位结果区域的操作栏
- **THEN** 排序控件的左侧显示一个图标按钮，用于切换卡片/列表视图
- **AND** 按钮有清晰的 aria-label 和 tooltip

### Requirement: 列表视图样式
列表视图 SHALL 以紧凑的横向行式展示每个岗位的关键信息。

#### Scenario: 列表项布局
- **WHEN** 岗位以列表视图展示
- **THEN** 每个岗位占一行，从左到右依次显示：
  - 岗位标题（加粗，主视觉焦点）
  - 公司名称
  - 地点
  - 薪资
  - 学历/类型标签
  - 发布日期
  - 收藏星标按钮
- **AND** 鼠标悬停时整行高亮
- **AND** 点击任意位置（除收藏按钮外）打开详情弹窗

## MODIFIED Requirements

### Requirement: 岗位卡片点击打开详情
岗位卡片/列表项的点击事件 SHALL 正确触发详情弹窗打开。

#### Scenario: 点击列表项打开详情
- **WHEN** 用户点击列表视图中的任意岗位行（收藏按钮除外）
- **THEN** 弹出该岗位的详情模态框
- **AND** 详情内容正确显示

#### Scenario: 点击卡片打开详情
- **WHEN** 用户点击卡片视图中的岗位卡片
- **THEN** 弹出该岗位的详情模态框

### Requirement: 视图模式持久化（可选增强）
用户的视图偏好 SHOULD 在页面刷新或路由切换后保持。

#### Scenario: 记住视图偏好
- **WHEN** 用户切换到某种视图模式
- **THEN** 该偏好被保存到 localStorage
- **AND** 下次访问页面时自动恢复上次的视图模式
