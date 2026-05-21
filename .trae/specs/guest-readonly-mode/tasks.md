# Tasks

- [x] Task 1: 新增 `optionalAuthUnified` 辅助函数
  - [x] 在 `src/lib/auth-server.ts` 中新增 `optionalAuthUnified(request)` 函数，已登录返回用户信息，未登录返回 `{ authorized: false, user: null }` 不抛异常

- [x] Task 2: 修改 middleware.ts 放行访客页面
  - [x] 对 `/` 和 `/jobs` 路径允许无 session_token 访问，不重定向登录页
  - [x] 其他页面路径保持原有重定向逻辑

- [x] Task 3: 修改 AppShell 支持访客模式
  - [x] 新增 `isGuest` 状态，未登录且在访客允许页面时设为 true，不跳转登录页
  - [x] 访客模式下侧边栏仅显示"首页"和"岗位列表"导航项
  - [x] 侧边栏底部"退出登录"改为"登录"按钮，跳转 `/login`
  - [x] 用户角色显示"访客"
  - [x] 页面顶部显示访客提示条，含"立即登录"按钮

- [x] Task 4: 修改 NAV_ITEMS 支持访客可见性
  - [x] 在 `src/lib/constants.ts` 的 NavItem 接口新增 `guestVisible?: boolean` 字段
  - [x] 首页和岗位列表设为 `guestVisible: true`
  - [x] AppShell 中根据 isGuest 过滤导航项

- [x] Task 5: API 写操作添加认证保护
  - [x] `POST /api/jobs/[id]/favorite` — 添加 `requireAuthUnified`
  - [x] `PATCH /api/jobs/[id]` — 添加 `requireAuthUnified`
  - [x] `POST /api/jobs/[id]/ai-analysis` — 添加 `requireAuthUnified`
  - [x] `POST /api/resume/parse` — 添加 `requireAuthUnified`
  - [x] `POST /api/resume/diagnose` — 添加 `requireAuthUnified`
  - [x] `POST /api/recommendations/resume-advice` — 添加 `requireAuthUnified`
  - [x] `POST /api/recommendations/delivery-assistant` — 添加 `requireAuthUnified`
  - [x] `GET /api/crawler/logs` — 添加 `requirePermissionUnified('crawler:read')`
  - [x] `GET /api/system/config` — 添加 `requirePermissionUnified('system:read')`
  - [x] `GET /api/system/status` — 添加 `requirePermissionUnified('system:read')`

- [x] Task 6: 前端访客操作拦截
  - [x] 收藏按钮：访客点击时弹出登录引导提示
  - [x] 岗位详情中的 AI 分析按钮：访客点击时提示登录
  - [x] 简历匹配/智能推荐页面：访客访问时显示登录引导卡片

- [x] Task 7: 访客提示条 UI 组件
  - [x] 在 AppShell 中添加访客提示条组件
  - [x] 提示条文案："当前为访客模式，登录后可使用收藏、匹配、AI推荐等完整功能"
  - [x] 含"立即登录"按钮，点击跳转 `/login`

# Task Dependencies
- Task 1 → Task 5 (API 认证依赖 optionalAuthUnified，但 requireAuthUnified 已存在，Task 5 可独立进行)
- Task 2 → Task 3 (middleware 放行后 AppShell 才能正确处理访客)
- Task 4 → Task 3 (NAV_ITEMS 修改后 AppShell 才能过滤导航)
- Task 3 → Task 6, Task 7 (AppShell 访客模式是前端拦截的基础)
- Task 5 和 Task 2-4 可并行
