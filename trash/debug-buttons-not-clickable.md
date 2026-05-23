# Debug Session: buttons-not-clickable

**Status**: [OPEN]
**Created**: 2026-05-23
**Description**: 全局按钮无法点击，包括 jobs 页面的岗位列表项、recommendations 页面的"职位提醒"等按钮。

## Hypotheses

### H1: JS runtime error 阻塞事件循环
某个组件或页面的异常（如未捕获的 React 错误）导致后续组件的事件处理函数无法注册或执行。

**Evidence**: 查看浏览器控制台是否有未捕获的异常/报错。
**Status**: PENDING

### H2: CSS 覆盖层/半透明遮罩阻挡点击
某个全屏覆盖层（modal-backdrop, sidebar-backdrop, overlay等）虽然不可见但实际覆盖了页面，拦截了点击事件。

**Evidence**: 检查 DOM 中是否有不可见的覆盖层占位，z-index 是否过高。
**Status**: PENDING

### H3: 事件绑定失败 — onClick 回调未正确传递
JobCard 或按钮组件的 `onClick` 回调在渲染时未能正确绑定到 DOM 元素上。

**Evidence**: 检查按钮 DOM 元素上是否挂载了 click 事件监听器。
**Status**: PENDING

### H4: AppShell 认证流程阻塞渲染
AppShell 的 `authReady` 或 `ready` 状态未正确设置，导致页面始终处于 loading 状态而非交互状态。

**Evidence**: 检查 `ready` 状态是否为 true，用户对象是否存在。
**Status**: PENDING

### H5: React key 变化导致组件卸载重建
使用 `key={viewMode}` 或类似模式导致组件在点击发生时被卸载/重建，事件绑定丢失。

**Evidence**: 检查 click 事件触发时目标元素是否在 DOM 中。
**Status**: PENDING