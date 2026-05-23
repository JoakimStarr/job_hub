# Tasks

## Phase 1: P0 严重问题修复

- [x] Task 1: JobDetailModal 懒加载优化 - 将 AI 分析面板改为按需加载
  - [x] SubTask 1.1: 将 JobAnalysisPanel 从 JobDetailModal 中移除直接导入，改为 `next/dynamic` 动态导入
  - [x] SubTask 1.2: 在 JobDetailModal 中添加 Tab 切换（岗位详情 / AI 分析），AI 分析面板仅在用户切换到对应 Tab 时才渲染
  - [x] SubTask 1.3: 确保动态导入的组件有 loading 占位符

- [x] Task 2: ui.tsx 桶文件拆分与代码分割
  - [x] SubTask 2.1: 将 JobDetailModal 从 ui.tsx 中独立出来为单独文件（通过 dynamic import 实现代码分割）
  - [x] SubTask 2.2: 将重型组件（JobAnalysisPanel、AIChatPanel、MarkdownRenderer）使用 `next/dynamic` 包装导出
  - [x] SubTask 2.3: 更新所有导入 ui.tsx 的文件，确保只导入需要的组件
  - [x] SubTask 2.4: 验证 react-markdown 不再包含在首屏 bundle 中（LazyJobAnalysisPanel with ssr: false）

- [x] Task 3: AppShell 认证流程优化
  - [x] SubTask 3.1: 将认证结果缓存到 Zustand store（authReady 字段），避免重复认证
  - [x] SubTask 3.2: Cookie/Token 认证保持串行但添加缓存快速路径（路由切换时跳过网络请求）
  - [x] SubTask 3.3: 在 AppShell 挂载时先检查 store 缓存，有缓存则跳过网络请求
  - [x] Bonus: resize 监听改用 matchMedia 替代 addEventListener('resize')

## Phase 2: P1 重要问题修复

- [x] Task 4: MarkdownRenderer 性能优化
  - [x] SubTask 4.1: 给 MarkdownRenderer 添加 `React.memo`
  - [x] SubTask 4.2: 在 JobAnalysisPanel 流式响应中添加 throttle（100ms + rAF 补偿），限制 setStreamingContent 频率
  - [x] SubTask 4.3: 流式循环结束后确保最终内容被设置

- [x] Task 5: CSS backdrop-filter 性能优化
  - [x] SubTask 5.1: topbar 的 backdrop-filter 移动端已使用不透明背景（保持不变），桌面端保留 blur
  - [x] SubTask 5.2: glass-card 移除 backdrop-filter: blur(10px)，改为纯色 var(--panel) 背景
  - [x] SubTask 5.3: `[class*="card"]:active` 规则包裹在 `@media (prefers-reduced-motion: no-preference)` 中

- [x] Task 6: JobsPage 状态优化
  - [x] SubTask 6.1: 使用 toastRef 稳定化 handleToggleFavorite 回调引用
  - [x] SubTask 6.2: handleCloseDetail 和 handleJobClick 使用 useCallback 空依赖数组
  - [x] SubTask 6.3: 添加 lastToggleRef 防抖（500ms）防止快速连续点击收藏

- [x] Task 7: PageTransition 退出动画
  - [x] SubTask 7.1: 实现完整的进入/退出动画机制（TransitionState 类型）
  - [x] SubTask 7.2: 使用 onAnimationEnd 替代 setTimeout 控制动画状态切换
  - [x] SubTask 7.3: useEffect 仅依赖 pathname，避免 children 引用变化触发不必要动画

## Phase 3: P2 中等问题修复

- [x] Task 8: 流式请求 AbortController 与内存泄漏修复
  - [x] SubTask 8.1: JobAnalysisPanel 的 handleSend 添加 AbortController，signal 传入 fetch，catch 处理 AbortError
  - [x] SubTask 8.2: AIChatPanel 启用已声明的 abortControllerRef，signal 传入 fetch
  - [x] SubTask 8.3: 两个组件均添加 useEffect 清理函数在卸载时 abort 请求

- [x] Task 9: 事件监听器稳定化
  - [x] SubTask 9.1: JobDetailModal 的 onClose 使用 onCloseRef 存储，Escape 键监听器使用 ref 回调
  - [x] SubTask 9.2: Escape 键监听器 useEffect 依赖数组为空 []，不再因 onClose 变化频繁注册/注销
  - [x] SubTask 9.3: AppShell resize 监听改用 matchMedia + change 事件（已在 Task 3 中完成）

- [x] Task 10: z-index 规范化
  - [x] SubTask 10.1: modal-backdrop z-index 改用 `var(--z-modal)`
  - [x] SubTask 10.2: bottom-sheet-overlay z-index 改用 `var(--z-modal)`，移除不必要的 fallback
  - [x] SubTask 10.3: HierarchicalFilter 下拉菜单 z-index 改用 `calc(var(--z-modal) + 1)`，确保在 Modal 内正常显示
  - [x] Bonus: 移动端 topbar z-index 改用 `var(--z-sticky)`

## Phase 4: P3 轻微问题修复

- [x] Task 11: 其他优化
  - [x] SubTask 11.1: 收藏操作添加防抖（debounce 500ms via lastToggleRef）
  - [x] SubTask 11.2: 移除 recommendations 页面 extractReadableContent 和 renderResult 中所有 console.log/console.warn
  - [x] SubTask 11.3: `[class*="card"]:active` 改为 `.job-card:active, .history-card:active` 具体选择器
  - [ ] SubTask 11.4: ~~详情弹窗打开时调用 API.getJobDetail 获取完整数据~~ （暂不实现，当前列表数据足够展示详情）

# Task Dependencies
- [Task 2] depends on [Task 1] ✅
- [Task 4] depends on [Task 2] ✅
- [Task 6] depends on [Task 2] ✅
- [Task 8] independent ✅
- [Task 9] independent ✅
- [Task 10] independent ✅
- [Task 11] depends on [Task 8] ✅
