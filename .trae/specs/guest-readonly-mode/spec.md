# 访客只读模式 Spec

## Why
当前系统要求所有用户必须登录才能访问任何页面（middleware 层拦截 + AppShell 跳转登录页），未登录用户无法查看任何内容。需要支持未登录访客以只读方式浏览岗位信息，降低使用门槛，同时保护写操作和敏感功能。

## What Changes
- 修改 middleware.ts，对允许访客访问的页面路径放行（不检查 session_token）
- 修改 AppShell 组件，支持"访客模式"：未登录时展示有限导航和只读内容，不跳转登录页
- 新增 `guest` 角色概念：访客可查看首页、岗位列表、岗位详情，不可收藏/匹配/推荐/管理
- 修改 API 路由：对写操作（收藏、AI分析、简历解析等）添加认证要求，读操作允许访客访问
- 前端页面增加"访客模式"提示条，引导用户登录以解锁完整功能
- 侧边栏在访客模式下显示"登录"按钮替代"退出登录"

## Impact
- Affected specs: 认证系统、页面路由守卫、API 权限控制
- Affected code:
  - `src/middleware.ts` — 路由放行逻辑
  - `src/components/app-shell.tsx` — 认证引导与访客模式 UI
  - `src/lib/auth-server.ts` — 新增可选认证辅助函数
  - `src/lib/constants.ts` — NAV_ITEMS 访客可见性
  - `src/lib/types.ts` — 新增 guest 相关类型
  - `src/app/api/jobs/[id]/favorite/route.ts` — 添加认证
  - `src/app/api/jobs/[id]/route.ts` — PATCH 添加认证
  - `src/app/api/jobs/[id]/ai-analysis/route.ts` — 添加认证
  - `src/app/api/resume/parse/route.ts` — 添加认证
  - `src/app/api/resume/diagnose/route.ts` — 添加认证
  - `src/app/api/recommendations/resume-advice/route.ts` — 添加认证
  - `src/app/api/recommendations/delivery-assistant/route.ts` — 添加认证
  - `src/app/api/crawler/logs/route.ts` — 添加认证
  - `src/app/api/system/config/route.ts` — GET 添加认证
  - `src/app/api/system/status/route.ts` — 添加认证

## ADDED Requirements

### Requirement: 访客只读浏览
系统 SHALL 允许未登录用户以访客身份浏览以下页面和功能：
- 首页（统计数据概览、热门关键词、最新岗位）
- 岗位列表页（搜索、筛选、分页）
- 岗位详情查看

#### Scenario: 访客访问首页
- **WHEN** 未登录用户访问 `/`
- **THEN** 系统展示首页内容，包含统计数据、热门关键词、最新岗位，不跳转登录页

#### Scenario: 访客访问岗位列表
- **WHEN** 未登录用户访问 `/jobs`
- **THEN** 系统展示岗位列表，支持搜索和筛选，不跳转登录页

#### Scenario: 访客尝试收藏岗位
- **WHEN** 未登录用户点击收藏按钮
- **THEN** 系统提示"请登录后收藏"，引导用户登录

#### Scenario: 访客尝试使用 AI 功能
- **WHEN** 未登录用户点击 AI 分析/简历匹配/智能推荐
- **THEN** 系统提示"请登录后使用"，引导用户登录

### Requirement: 访客模式 UI
系统 SHALL 在访客模式下展示差异化的 UI 元素：

#### Scenario: 侧边栏导航
- **WHEN** 用户以访客身份浏览
- **THEN** 侧边栏仅显示"首页"和"岗位列表"导航项，底部显示"登录"按钮（非"退出登录"），用户角色显示"访客"

#### Scenario: 访客提示条
- **WHEN** 访客浏览任何页面
- **THEN** 页面顶部显示提示条"当前为访客模式，登录后可使用收藏、匹配、AI推荐等完整功能"，含"立即登录"按钮

#### Scenario: 收藏按钮状态
- **WHEN** 访客查看岗位列表或详情
- **THEN** 收藏按钮可见但点击后弹出登录引导，而非直接操作

### Requirement: API 写操作认证保护
系统 SHALL 对以下写操作 API 添加认证要求，未登录时返回 401：

- `POST /api/jobs/[id]/favorite` — 收藏/取消收藏
- `PATCH /api/jobs/[id]` — 更新岗位状态
- `POST /api/jobs/[id]/ai-analysis` — AI 分析
- `POST /api/resume/parse` — 简历解析
- `POST /api/resume/diagnose` — 简历诊断
- `POST /api/recommendations/resume-advice` — 简历建议
- `POST /api/recommendations/delivery-assistant` — 投递助手
- `GET /api/crawler/logs` — 爬虫日志（需权限）
- `GET /api/system/config` — 系统配置（需权限）
- `GET /api/system/status` — 系统状态（需权限）

#### Scenario: 访客调用写操作 API
- **WHEN** 未认证用户调用上述任一 API
- **THEN** 返回 HTTP 401 和错误信息"请先登录"

#### Scenario: 访客调用读操作 API
- **WHEN** 未认证用户调用 `/api/jobs`、`/api/jobs/search`、`/api/jobs/filters`、`/api/stats/overview` 等 GET 接口
- **THEN** 正常返回数据

### Requirement: 可选认证辅助函数
系统 SHALL 提供 `optionalAuthUnified` 辅助函数，用于需要区分访客/登录用户的 API 路由。

#### Scenario: API 使用可选认证
- **WHEN** API 路由调用 `optionalAuthUnified(request)`
- **THEN** 已登录时返回用户信息，未登录时返回 `{ authorized: false, user: null }` 而不抛出异常

## MODIFIED Requirements

### Requirement: Middleware 路由守卫
原策略：所有非 `/login`、非 `/api/*`、非静态资源路径，无 session_token 则重定向登录页。
修改为：首页 `/` 和岗位列表 `/jobs` 路径允许无 session_token 访问，其他页面保持原有重定向逻辑。

### Requirement: AppShell 认证引导
原行为：未登录时 `redirectToLogin()` 跳转登录页。
修改为：对访客允许的页面，未登录时设置访客状态（user=null, isGuest=true），不跳转登录页；对需登录的页面，保持原有跳转逻辑。

## REMOVED Requirements
无移除的需求。
