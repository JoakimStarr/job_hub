# Tasks

## 第一批：表单类页面（无即时响应需求）

- [ ] Task 1: 修改 ProfileEditor.tsx — 32 处受控输入框改为非受控
  - [ ] 1.1: 将整个编辑器内容用 `<form onSubmit={handleSave}>` 包裹
  - [ ] 1.2: 所有 `<Input>` / `<input type="text">` 改为 `name="xxx" defaultValue={profile.xxx || ''}`
  - [ ] 1.3: 所有 `<textarea>` 改为 `<Textarea name="xxx" defaultValue={...}>`
  - [ ] 1.4: 所有 `<select>` 改为 `name="xxx" defaultValue={...}`
  - [ ] 1.5: 所有 `<input type="number/date/tel/email">` 改为 `name="xxx" defaultValue={...}`
  - [ ] 1.6: handleSave 改为接受 `FormEvent`，用 `FormData` 取值后构造 profile 对象
  - [ ] 1.7: 删除不再需要的受控 state 和 updateField/updateEducation 等函数
  - [ ] 1.8: 保存按钮改为 `type="submit"`

- [ ] Task 2: 修改 login-client.tsx — 登录表单改为非受控
  - [ ] 2.1: 用 `<form onSubmit={handleLogin}>` 包裹登录表单
  - [ ] 2.2: 用户名/密码 Input 改为 `name="username/password" defaultValue=""`
  - [ ] 2.3: handleLogin 改为接受 `FormEvent`，用 `FormData` 取值
  - [ ] 2.4: 删除 username/password state

- [ ] Task 3: 修改 CreateUserModal.tsx — 创建用户表单改为非受控
  - [ ] 3.1: 用 `<form onSubmit={handleSubmit}>` 包裹表单
  - [ ] 3.2: 用户名/密码 Input 改为 `name="xxx" defaultValue=""`
  - [ ] 3.3: 角色 Select 改为 `name="role" defaultValue="analyst"`
  - [ ] 3.4: 权限 checkbox 改为 `name="permissions" value={key} defaultChecked`
  - [ ] 3.5: handleSubmit 改为接受 `FormEvent`，用 `FormData` 取值
  - [ ] 3.6: 删除 formData state 和相关 handler

- [ ] Task 4: 修改 EditUserModal.tsx — 编辑用户表单改为非受控
  - [ ] 4.1: 用 `<form key={user.id} onSubmit={handleSubmit}>` 包裹表单
  - [ ] 4.2: 用户名 Input 改为 `name="username" defaultValue={user.username}`
  - [ ] 4.3: 角色 Select 改为 `name="role" defaultValue={user.role}`
  - [ ] 4.4: 权限 checkbox 改为 `name="permissions" value={key} defaultChecked`
  - [ ] 4.5: handleSubmit 改为接受 `FormEvent`，用 `FormData` 取值
  - [ ] 4.6: 删除 formData state 和相关 handler

- [ ] Task 5: 修改 ChangePasswordModal.tsx — 修改密码弹窗改为非受控
  - [ ] 5.1: 用 `<form onSubmit={handleSubmit}>` 包裹表单
  - [ ] 5.2: 新密码/确认密码 Input 改为 `name="xxx" defaultValue=""`
  - [ ] 5.3: handleSubmit 改为接受 `FormEvent`，用 `FormData` 取值
  - [ ] 5.4: 删除 formData state

- [ ] Task 6: 修改 ChangePasswordForm.tsx — 修改密码表单改为非受控
  - [ ] 6.1: 用 `<form onSubmit={handleSubmit}>` 包裹表单
  - [ ] 6.2: 当前密码/新密码/确认密码 Input 改为 `name="xxx" defaultValue=""`
  - [ ] 6.3: handleSubmit 改为接受 `FormEvent`，用 `FormData` 取值
  - [ ] 6.4: 删除 currentPassword/newPassword/confirmPassword state

## 第二批：搜索/聊天类（Enter 触发）

- [ ] Task 7: 修改 SearchBar.tsx — 搜索框改为非受控
  - [ ] 7.1: 用 `<form onSubmit>` 包裹 Input
  - [ ] 7.2: Input 改为 `name="query" defaultValue=""`
  - [ ] 7.3: Enter 键触发搜索，删除 query state 和 onChange

- [ ] Task 8: 修改 favorites/page.tsx — 搜索框改为非受控
  - [ ] 8.1: 用 `<form onSubmit>` 包裹 Input
  - [ ] 8.2: Input 改为 `name="query" defaultValue=""`
  - [ ] 8.3: Enter 键触发搜索，删除 query state

- [ ] Task 9: 修改 AIChatPanel.tsx — 聊天输入框改为非受控
  - [ ] 9.1: 用 `<form onSubmit>` 包裹 Input
  - [ ] 9.2: Input 改为 `name="message" defaultValue=""`
  - [ ] 9.3: Enter 键发送消息，提交后 form.reset()
  - [ ] 9.4: 删除 input state

- [ ] Task 10: 修改 JobAnalysisPanel.tsx — 追问输入框改为非受控
  - [ ] 10.1: 用 `<form onSubmit>` 包裹 textarea
  - [ ] 10.2: textarea 改为 `<Textarea name="message" defaultValue="">`
  - [ ] 10.3: Enter 键发送消息，提交后 form.reset()
  - [ ] 10.4: 删除 chatInput state

## 第三批：其他文本输入

- [ ] Task 11: 修改 ResumeUploader.tsx — 简历粘贴框改为非受控
  - [ ] 11.1: 用 `<form onSubmit>` 包裹 textarea 和提交按钮
  - [ ] 11.2: textarea 改为 `<Textarea name="resumeText" defaultValue="">`
  - [ ] 11.3: 提交按钮改为 `type="submit"`
  - [ ] 11.4: 删除 resumeText state

- [ ] Task 12: 修改 system/page.tsx — 配置编辑器改为非受控
  - [ ] 12.1: 用 `<form onSubmit>` 包裹 textarea 和保存按钮
  - [ ] 12.2: textarea 改为 `<Textarea name="config" defaultValue={configText}>`
  - [ ] 12.3: 保存按钮改为 `type="submit"`
  - [ ] 12.4: handleSubmit 用 `FormData` 取值

- [ ] Task 13: 修改 Pagination.tsx — 页码跳转改为非受控
  - [ ] 13.1: 用 `<form onSubmit>` 包裹 input
  - [ ] 13.2: input 改为 `name="page" defaultValue={currentPage}`
  - [ ] 13.3: Enter 键跳转，删除 inputValue state

## 第四批：保留受控的筛选器（无需修改，仅确认）

- [ ] Task 14: 确认以下筛选器保留受控模式（即时响应，无 IME 问题）
  - admin/logs/page.tsx: 时间范围、事件类型、每页条数 select
  - UserManagementPage.tsx: 角色/状态筛选 select
  - AuthLogViewer.tsx: 时间筛选 select、仅显示失败 checkbox
  - jobs/page.tsx: 排序字段 select
  - JobAlertsPanel.tsx: 显示已禁用 checkbox
  - crawler/page.tsx: 无头模式 checkbox
  - admin/logs/page.tsx: 用户搜索和 IP 过滤 Input → 改为非受控（Enter 触发）

## 第五批：验证与提交

- [ ] Task 15: 全站 TypeScript 类型检查 + 手动验证
  - [ ] 15.1: 运行 `npx tsc --noEmit` 确保无类型错误
  - [ ] 15.2: 手动验证中文输入法在所有已修改输入框中正常工作
  - [ ] 15.3: 更新 package.json / package-lock.json 版本号
  - [ ] 15.4: 提交到 git 仓库

# Task Dependencies
- Task 1-6: 互相独立，可并行
- Task 7-10: 互相独立，可并行
- Task 11-13: 互相独立，可并行
- Task 14: 无依赖，确认即可
- Task 15: 依赖 Task 1-14 全部完成
