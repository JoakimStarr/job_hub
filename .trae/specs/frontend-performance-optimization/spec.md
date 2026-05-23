# 前端页面切换与岗位详情页性能优化 Spec

## Why
前端页面切换存在明显卡顿，岗位详情页打开时不丝滑且偶发无法点击，严重影响用户体验。根本原因包括：认证流程阻塞渲染、重型组件同步加载、缺少代码分割、CSS 模糊效果 GPU 开销大、流式请求缺少取消机制等。

## What Changes
- AppShell 认证流程优化：避免串行阻塞渲染，缓存认证结果
- JobDetailModal 懒加载：AI 分析面板改为按需加载，打开弹窗不自动请求
- 代码分割：ui.tsx 桶文件拆分，react-markdown 动态导入
- PageTransition 优化：添加退出动画，避免空白帧
- CSS 性能优化：减少 backdrop-filter 使用，优化动画
- 内存泄漏修复：流式请求添加 AbortController，事件监听器稳定化
- 状态管理优化：减少不必要重渲染，回调引用稳定化
- z-index 规范化：使用令牌体系替代硬编码值

## Impact
- Affected specs: 页面切换体验、岗位详情交互、AI 分析功能
- Affected code:
  - `src/components/app-shell.tsx` - 认证流程
  - `src/components/ui.tsx` - JobDetailModal、JobCard
  - `src/components/PageTransition.tsx` - 页面过渡
  - `src/components/JobAnalysisPanel.tsx` - AI 分析面板
  - `src/components/AIChatPanel.tsx` - AI 聊天面板
  - `src/components/MarkdownRenderer.tsx` - Markdown 渲染
  - `src/app/jobs/page.tsx` - 岗位列表页
  - `src/app/providers.tsx` - Provider 层
  - `src/styles/layout.css` - 布局样式
  - `src/styles/components.css` - 组件样式

---

## 问题分析

### P0 - 严重问题

#### 1. JobDetailModal 内嵌 JobAnalysisPanel，打开即加载
- **现象**：每次打开岗位详情弹窗，JobAnalysisPanel 立即挂载并调用 `loadHistory()` 发起 API 请求
- **原因**：`ui.tsx` 第 344-347 行，JobAnalysisPanel 作为 JobDetailModal 的子组件直接同步渲染
- **影响**：即使用户不关心 AI 分析，也会发起网络请求和渲染重型组件（12 个 useState、5 个 useEffect、3 个 useCallback）
- **解决方案**：将 JobAnalysisPanel 改为条件渲染 + `next/dynamic` 懒加载，仅在用户点击"AI 分析"标签时才加载

#### 2. ui.tsx 桶文件导致 react-markdown 打包进主 bundle
- **现象**：首屏加载慢，所有页面 bundle 膨胀
- **原因**：`ui.tsx` 导出了 14 个组件，其中 `JobDetailModal` 直接导入 `JobAnalysisPanel`，后者导入 `MarkdownRenderer`（基于 react-markdown）。任何使用 ui.tsx 中组件的页面都会将 react-markdown 打包进来
- **影响**：react-markdown + unified 生态系统体积大，首屏加载时间显著增加
- **解决方案**：拆分 ui.tsx，将重型组件（JobDetailModal、JobAnalysisPanel）独立导出，使用 `next/dynamic` 动态导入

#### 3. AppShell 认证流程串行阻塞渲染
- **现象**：页面切换时出现白屏/loading orb
- **原因**：`app-shell.tsx` 的 `bootstrap()` 函数先尝试 Cookie 认证，失败后再尝试 Token 认证，两次串行请求。`ready` 状态完全阻塞渲染。Next.js App Router 路由切换时 AppShell 可能重新挂载
- **影响**：最坏情况每次页面切换等待两个串行网络请求完成
- **解决方案**：
  - 并行发起 Cookie 和 Token 认证
  - 将认证结果缓存到 Zustand store，避免重复认证
  - 使用 `Promise.race` 或 `Promise.any` 策略

### P1 - 重要问题

#### 4. MarkdownRenderer 无 memo + 流式高频重渲染
- **现象**：AI 聊天时主线程阻塞，界面卡顿
- **原因**：`MarkdownRenderer` 没有 `React.memo`，每次父组件渲染都重新解析 Markdown。流式响应中 `setStreamingContent` 每个 SSE chunk 触发一次重渲染
- **影响**：长内容 Markdown 解析是 CPU 密集操作，高频触发导致主线程阻塞
- **解决方案**：
  - 给 MarkdownRenderer 添加 `React.memo`
  - 流式内容使用 `requestAnimationFrame` 或 throttle 限制更新频率（如 100ms 一次）
  - 考虑将 Markdown 解析移到 Web Worker

#### 5. topbar backdrop-filter: blur 导致滚动卡顿
- **现象**：页面滚动时卡顿，尤其在移动端
- **原因**：`layout.css` 第 268-269 行，topbar 使用 `backdrop-filter: blur(8px)`，是 GPU 密集操作。sticky 定位在滚动时持续触发合成层重绘
- **影响**：低端设备和移动端滚动明显不流畅
- **解决方案**：
  - 使用纯色半透明背景替代 blur（如 `rgba(255,255,255,0.92)`）
  - 或仅在桌面端使用 blur，移动端降级为纯色

#### 6. JobsPage 状态过多导致全量重渲染
- **现象**：筛选、翻页操作卡顿
- **原因**：`jobs/page.tsx` 有 11 个 `useState`，任何一个变化都导致整个页面重渲染，包括所有 JobCard 和筛选器
- **影响**：`setSelectedJob` 触发重渲染时，整个岗位列表也重新渲染
- **解决方案**：
  - 将筛选状态提取到独立组件
  - 使用 `useReducer` 替代多个 `useState`
  - 对 JobCard 列表使用 `React.memo` + 稳定的回调引用

#### 7. PageTransition 无退出动画
- **现象**：页面切换时闪烁、出现空白帧
- **原因**：`PageTransition.tsx` 路由变化时立即替换内容，没有等待旧内容淡出。300ms setTimeout 与 CSS 动画可能不同步
- **影响**：视觉上不丝滑
- **解决方案**：实现完整的进入/退出动画，使用 `onTransitionEnd` 替代 `setTimeout`

### P2 - 中等问题

#### 8. glass-card backdrop-filter 在 Modal 内大量使用
- **现象**：详情页渲染慢
- **原因**：JobAnalysisPanel 大量使用 `glass-card`，每个都带 `backdrop-filter: blur(10px)`
- **影响**：Modal 内同时渲染多个 glass-card 严重影响渲染性能
- **解决方案**：在 Modal 内使用纯色背景替代 glass-card 效果

#### 9. 没有代码分割 (lazy/dynamic)
- **现象**：首屏加载慢
- **原因**：项目中没有使用 `React.lazy()`、`next/dynamic` 或路由级别代码分割
- **影响**：所有页面组件和依赖都在客户端 bundle 中
- **解决方案**：对重型组件（JobAnalysisPanel、AIChatPanel、MarkdownRenderer）使用 `next/dynamic` 动态导入

#### 10. AppShell resize 监听无值比较
- **现象**：窗口调整时多余渲染
- **原因**：`setIsMobile(window.innerWidth <= 768)` 每次触发都调用 setState，即使值没变
- **解决方案**：使用 `matchMedia` 监听或添加值比较

#### 11. 流式请求缺少 AbortController（内存泄漏）
- **现象**：React 控制台警告 "Can't perform a React state update on an unmounted component"
- **原因**：`JobAnalysisPanel` 的 `handleSend` 使用 fetch + ReadableStream，组件卸载时没有取消请求。`AIChatPanel` 声明了 `abortControllerRef` 但从未使用
- **影响**：内存泄漏，对已卸载组件调用 setState
- **解决方案**：添加 AbortController，在 useEffect 清理函数中取消请求

#### 12. Escape 键监听器依赖不稳定的 onClose 引用
- **现象**：事件监听器频繁注册/注销
- **原因**：JobDetailModal 的 Escape 监听器依赖 `[onClose]`，而 onClose 是内联箭头函数 `() => setSelectedJob(null)`
- **解决方案**：使用 `useCallback` 稳定化 onClose，或使用 ref 存储最新回调

### P3 - 轻微问题

#### 13. handleToggleFavorite 回调引用不稳定
- **现象**：JobCard 的 `React.memo` 失效
- **原因**：`handleToggleFavorite` 依赖 `[mutateJobs, toast]`，toast 可能每次渲染返回新对象
- **解决方案**：确保 toast 对象稳定，或使用 ref 包装回调

#### 14. 通用 `[class*="card"] active` 规则
- **现象**：意外的动画触发
- **原因**：`components.css` 第 1742-1745 行选择器匹配范围过广
- **解决方案**：改为具体 class 选择器

#### 15. modal z-index 硬编码 1000
- **现象**：与其他组件层级冲突风险
- **原因**：modal-backdrop 使用硬编码 z-index: 1000，未使用 `var(--z-modal)` 令牌
- **解决方案**：统一使用 z-index 令牌体系

#### 16. 详情弹窗使用列表数据而非完整详情
- **现象**：详情数据可能不完整
- **原因**：`API.getJobDetail` 方法存在但从未被调用，直接复用列表 `JobItem`
- **解决方案**：打开详情时调用 `API.getJobDetail` 获取完整数据，可并行请求

#### 17. recommendations 页面残留 console.log
- **现象**：生产环境性能开销
- **原因**：`extractReadableContent` 函数包含大量 console.log
- **解决方案**：移除或替换为条件日志

#### 18. 收藏操作缺少防抖
- **现象**：快速点击可能产生并发请求
- **解决方案**：添加 debounce 或 throttle

---

## ADDED Requirements

### Requirement: 页面切换性能优化
系统 SHALL 在页面切换时提供流畅的过渡体验，无明显卡顿和白屏。

#### Scenario: 页面切换无白屏
- **WHEN** 用户从一个页面导航到另一个页面
- **THEN** 旧页面应有退出动画，新页面应有进入动画，中间无空白帧
- **AND** 认证状态应被缓存，不重复请求

#### Scenario: 首屏加载快速
- **WHEN** 用户首次访问应用
- **THEN** 首屏 JS bundle 不应包含 react-markdown 等非首屏必需的依赖
- **AND** 重型组件应通过动态导入按需加载

### Requirement: 岗位详情页交互优化
系统 SHALL 在打开岗位详情时提供丝滑的交互体验，无卡顿和点击失灵。

#### Scenario: 打开详情弹窗流畅
- **WHEN** 用户点击岗位卡片打开详情
- **THEN** 弹窗应在 200ms 内完成渲染
- **AND** 不应自动发起 AI 分析相关的 API 请求
- **AND** AI 分析面板应按需加载

#### Scenario: 关闭弹窗无内存泄漏
- **WHEN** 用户在 AI 流式响应过程中关闭详情弹窗
- **THEN** 流式请求应被取消，不应有内存泄漏
- **AND** 不应出现 React state update on unmounted component 警告

#### Scenario: 点击事件正常响应
- **WHEN** 用户点击弹窗内的元素
- **THEN** 点击事件应正常响应，不被 z-index 层级或事件冒泡问题阻塞
