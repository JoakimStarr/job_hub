# Tasks

- [x] Task 1: JobCard 组件支持列表模式
  - [x] SubTask 1.1: 在 `src/components/ui.tsx` 的 JobCard 组件中新增 `viewMode` prop（`'card'` | `'list'`）
  - [x] SubTask 1.2: 当 viewMode 为 `'list'` 时，渲染横向紧凑行布局：标题 + 公司/地点/薪资信息在一行，标签在第二行
  - [x] SubTask 1.3: 当 viewMode 为 `'card'` 时，保持现有卡片布局不变

- [x] Task 2: 新增 ViewToggle 视图切换按钮组件
  - [x] SubTask 2.1: 在 `src/components/ui.tsx` 中导出 `ViewToggle` 组件，接受 `mode` 和 `onToggle` props
  - [x] SubTask 2.2: 按钮使用图标区分状态（列表视图显示网格图标，卡片视图显示列表图标）
  - [x] SubTask 2.3: 按钮有 aria-label="切换视图" 和 title 提示

- [x] Task 3: 岗位页面集成视图切换功能
  - [x] SubTask 3.1: 在 `src/app/jobs/page.tsx` 中新增 `viewMode` state（默认 `'list'`）
  - [x] SubTask 3.2: 在排序控件左侧添加 `<ViewToggle mode={viewMode} onToggle={setViewMode} />`
  - [x] SubTask 3.3: 将 viewMode 传递给每个 `<JobCard viewMode={viewMode} ... />`
  - [x] SubTask 3.4: 列表模式时容器使用 `.job-list` 类（单列纵向排列），卡片模式保持 `.grid`

- [x] Task 4: 列表视图 CSS 样式
  - [x] SubTask 4.1: 在 `src/styles/components.css` 中添加 `.job-list-item` 样式（横向行布局）
  - [x] SubTask 4.2: 添加 `.job-list` 容器样式（单列、无 grid）
  - [x] SubTask 4.3: 列表项 hover 整行高亮效果
  - [x] SubTask 4.4: 移动端响应式适配（小屏幕隐藏次要信息）

- [x] Task 5: 修复岗位卡片点击无法打开详情的问题
  - [x] SubTask 5.1: 排查并修复点击事件不触发的原因（确认 onClick 回调正确传递，CSS 无 pointer-events 阻断）
  - [x] SubTask 5.2: 确保 onClick 回调正确传递和执行（handleJobClick → setSelectedJob → JobDetailModal）
  - [x] SubTask 5.3: 验证列表模式和卡片模式下点击均能正常打开详情弹窗

# Task Dependencies
- [Task 2] depends on [Task 1] ✅
- [Task 3] depends on [Task 1, Task 2] ✅
- [Task 4] can run in parallel with [Task 1, Task 2] ✅
- [Task 5] independent ✅
