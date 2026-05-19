# 移动端响应式UI设计与优化 - 实施任务列表

## Phase 1: 设计系统基础设施

### Task 1.1: 扩展CSS设计令牌系统
- [ ] 在 `src/styles/variables.css` 中新增完整的设计令牌
  - [ ] 添加间距令牌（--space-* 系列，8个等级）
  - [ ] 添加字体令牌（--text-* 字号、--font-* 字重、--leading-* 行高）
  - [ ] 添加Z-index层级变量（--z-base 到 --z-tooltip）
  - [ ] 添加动画令牌（--duration-*, --ease-*）
  - [ ] 确保所有新令牌在暗色模式下有对应值
- [ ] 创建 `src/styles/tokens.css` 作为设计令牌的文档参考
- [ ] 验证：所有现有组件使用新令牌后显示正常

**依赖**: 无  
**预估时间**: 2小时  
**产出**: 完整的设计令牌系统

---

### Task 1.2: 建立响应式断点工具与混入
- [ ] 创建 `src/styles/mixins.css` 或使用CSS自定义属性定义断点
  - [ ] 定义6个标准断点常量（xs/sm/md/lg/xl/2xl）
  - [ ] 创建媒体查询混入模板（可复用）
  - [ ] 编写断点使用文档注释
- [ ] 重构 `src/styles/layout.css` 中的媒体查询
  - [ ] 统一使用新的断点命名
  - [ ] 移除重复或冲突的媒体查询规则
  - [ ] 确保断点顺序正确（mobile-first: min-width）
- [ ] 验证：各断点下布局切换正确无误

**依赖**: Task 1.1  
**预估时间**: 1.5小时  
**产出**: 统一的响应式工具系统

---

### Task 1.3: 重构Grid布局系统
- [ ] 优化 `src/styles/components.css` 中的Grid类
  - [ ] 统一 .grid, .grid-2, .grid-3, .grid-4 的基础样式
  - [ ] 使用设计令牌替代硬编码值（gap, padding等）
  - [ ] 添加新的实用类：.grid-auto（auto-fill）, .grid-fit（auto-fit）
- [ ] 建立完整的响应式覆盖规则
  - [ ] ≤480px: 所有网格单列（.grid-4 除外特殊处理）
  - [ ] 481px-768px: 小屏手机适配
  - [ ] 769px-1024px: 平板适配
  - [ ] 1025px-1279px: 小桌面适配
  - [ ] ≥1280px: 标准桌面布局
- [ ] 测试：在不同屏幕宽度下验证Grid行为
- [ ] 文档：编写Grid使用指南示例

**依赖**: Task 1.2  
**预估时间**: 2小时  
**产出**: 强大且灵活的Grid系统

---

## Phase 2: 核心组件移动端适配

### Task 2.1: 导航系统重构（Sidebar → Mobile Drawer）
- [ ] 修改 `src/components/app-shell.tsx` 和 `src/styles/layout.css`
  - [ ] 实现≤768px时侧边栏转换为抽屉菜单
  - [ ] 添加半透明遮罩层（.sidebar-backdrop）
  - [ ] 实现滑入/滑出动画（transform + transition）
  - [ ] 支持点击遮罩关闭
  - [ ] 支持ESC键关闭（桌面端）/ 右滑手势（移动端可选）
- [ ] 优化汉堡菜单按钮（.mobile-menu-btn）
  - [ ] 尺寸：44×44px触摸目标
  - [ ] 图标：☰ 文字或SVG图标
  - [ ] 位置：顶部导航栏左侧
  - [ ] ARIA标签：aria-label="打开菜单" aria-expanded状态
- [ ] 调整顶部导航栏（.topbar）
  - [ ] 移动端固定定位（position: sticky; top: 0）
  - [ ] 高度：56px（含安全区域）
  - [ ] z-index高于内容区域
  - [ ] 背景模糊效果（backdrop-filter: blur）
- [ ] 测试：
  - [ ] iPhone SE (375px) 显示正常
  - [ ] iPad Pro (1024px) 自动切换为侧边栏模式
  - [ ] 快速连续开关无异常
- [ ] 验证：焦点陷阱在抽屉打开时生效

**依赖**: Task 1.3  
**预估时间**: 4小时  
**产出**: 完美的移动端导航体验

---

### Task 2.2: 卡片组件全面适配
#### 2.2.1 JobCard岗位卡片优化
- [ ] 修改 `src/components/ui.tsx` 中的JobCard样式
  - [ ] **桌面端（≥768px）**：
    - [ ] 水平布局：左侧信息区 + 右侧收藏按钮
    - [ ] padding: 20px
    - [ ] hover时轻微上浮（translateY(-1px)）+ 阴影加深
  - [ ] **平板端（481px-767px）**：
    - [ ] 保持水平布局但更紧凑
    - [ ] padding: 16px
    - [ ] 字体缩小1-2px
  - [ ] **移动端（≤480px）**：
    - [ ] 垂直布局：标题→元信息→描述→标签
    - [ ] 收藏按钮绝对定位到右上角
    - [ ] padding: 14px
    - [ ] position: relative容器
  - [ ] 统一最小高度：避免卡片高度差异过大
  - [ ] 优化文本截断：标题单行、描述2-3行clamp
  - [ ] 触摸反馈：active态scale(0.98)

#### 2.2.2 StatCard统计卡片修复
- [ ] 已在v2.2.1部分修复，继续完善
  - [ ] **桌面端**：4列网格，min-height: 180px
  - [ ] **平板端**：2列网格，min-height: 160px，显示TOP 3
  - [ ] **移动端**：2列网格，min-height: 140px，列表max-height可滚动
  - [ ] Header添加底部分隔线（已实现）
  - [ ] 列表项hover效果增强（已实现）
  - [ ] 空数据状态：显示"暂无数据"提示而非空白

#### 2.2.3 UserCard用户卡片适配
- [ ] 修改用户信息展示方式
  - [ ] 桌面：水平排列头像+信息+操作按钮
  - [ ] 移动：垂直居中布局，头像较大（64px），信息居中对齐

- [ ] 测试用例：
  - [ ] 极长标题不破坏布局
  - [ ] 无描述时的优雅降级
  - [ ] 收藏状态图标正确显示

**依赖**: Task 2.1  
**预估时间**: 3小时  
**产出**: 全设备完美的卡片体验

---

### Task 2.3: 表单与筛选组件优化
- [ ] 重构 `src/components/HierarchicalFilter.tsx`
  - [ ] 下拉选择器移动端适配
    - [ ] 使用原生select元素或自定义底部弹出选择器
    - [ ] 触摸目标高度：48px（iOS推荐）
    - [ ] 选项列表最大高度+滚动
  - [ ] 搜索框优化
    - [ ] type="search" 属性
    - [ ] 清除按钮（×）在输入时显示
    - [ ] 自动聚焦逻辑（页面加载时不自动聚焦移动端）
  - [ ] 筛选标签展示
    - [ ] 已选筛选项以Tag形式横向展示
    - [ ] Tag支持单个删除（×按钮）
    - [ ] 超出时可横向滚动

- [ ] 修改 `src/components/ui.tsx` 中的Input/Button组件
  - [ ] Input:
    - [ ] min-height: 44px（移动端）/ 42px（桌面）
    - [ ] font-size: 16px（防止iOS自动缩放）
    - [ ] focus时边框高亮+轻微阴影
  - [ ] Button:
    - [ ] min-height: 44px（符合触摸标准）
    - [ ] active态反馈（:active伪类）
    - [ ] loading状态禁用交互+spinner
    - [ ] variant样式完整（primary/secondary/ghost/danger）

- [ ] 筛选栏布局响应式
  - [ ] 桌面：filter-grid 自适应列数（auto-fit, minmax(180px, 1fr)）
  - [ ] 平板：2-3列
  - [ ] 移动：单列堆叠，每个筛选器占满宽
  - [ ] "清除筛选"按钮始终可见

**依赖**: Task 2.2  
**预估时间**: 3小时  
**产出**: 移动端友好的表单交互

---

### Task 2.4: 弹窗与模态框Bottom Sheet实现
- [ ] 修改 `src/components/ui.tsx` 中的Modal相关组件
  - [ ] **检测设备类型**：
    ```typescript
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    // 或使用matchMedia监听
    ```
  - [ ] **桌面端Modal**（保持现状）：
    - [ ] 居中显示，圆角16px
    - [ ] max-width: 800px, max-height: 90vh
    - [ ] 淡入+上滑动画
  - [ ] **移动端Bottom Sheet**（新增）：
    - [ ] 固定在底部，全宽，顶部圆角16px
    - [ ] max-height: 85vh
    - [ ] 从底部滑入动画（250ms ease-out）
    - [ ] 拖拽手柄（drag handle）：顶部灰色横条
    - [ ] 向下滑动>50px触发关闭
    - [ ] 点击遮罩关闭
    - [ ] 内容区域可滚动（overflow-y: auto）

- [ ] JobDetailModal具体改造
  - [ ] 头部固定：标题+关闭按钮
  - [ ] 主体滚动：岗位详情、AI分析等
  - [ ] 底部操作栏（可选）：收藏、查看原网页按钮固定
  - [ ] 安全区域适配：padding-bottom: env(safe-area-inset-bottom)

- [ ] 动画性能优化
  - [ ] 使用transform代替top/bottom（GPU加速）
  - [ ] will-change: transform（动画开始前添加，结束后移除）
  - [ ] pointer-events: none during animation（防止误触）

- [ ] 测试：
  - [ ] 快速打开/关闭无闪烁
  - [ ] 内容超长时滚动流畅
  - [ ] 横竖屏切换正常
  - [ ] 键盘弹出时弹窗位置正确

**依赖**: Task 2.3  
**预估时间**: 4小时  
**产出**: 符合平台规范的模态交互

---

## Phase 3: 页面级深度适配

### Task 3.1: Jobs页面完美适配
- [ ] 修改 `src/app/jobs/page.tsx`
  - [ ] **顶部区域**：
    - [ ] 筛选条件SectionCard：
      - [ ] 移动端默认折叠高级筛选（仅显示搜索框+地点）
      - [ ] "更多筛选"按钮展开其余选项
      - [ ] 展开时有平滑过渡动画（height auto + max-height trick或grid）
    - [ ] 数据概览SectionCard：
      - [ ] 默认折叠（当前实现）
      - [ ] 展开后统计卡片2列网格
      - [ ] 折叠/展开按钮明显易触
  
  - [ ] **岗位列表区域**：
    - [ ] Grid间距调整：移动端gap: 10-12px
    - [ ] 列表/网格视图切换按钮（桌面端功能，移动端隐藏）
    - [ ] 排序控件：下拉选择改为底部弹出
    - [ ] 分页组件：
      - [ ] 移动端简化：上一页/下一页 + 页码输入
      - [ ] 当前页码高亮显示
      - [ ] 总页数提示
  
  - [ ] **空状态优化**：
    - [ ] 插图尺寸自适应（移动端60px，桌面80px）
    - [ ] 文字大小：标题15px，描述13px
    - [ ] 操作按钮全宽显示

  - [ ] **加载状态**：
    - [ ] Skeleton屏幕：移动端减少骨架数量（2-3个而非5个）
    - [ ] 骨架动画pulse效果（比shimmer更省电）

- [ ] 性能优化：
  - [ ] 岗位列表虚拟滚动（react-window或@tanstack/react-virtual）
  - [ ] 图片懒加载（如果有岗位logo图）
  - [ ] 筛选防抖已存在，确认300ms合适

- [ ] 测试完整用户流程：
  - [ ] 搜索 → 筛选 → 查看列表 → 点击详情 → 关闭 → 收藏

**依赖**: Task 2.4  
**预估时间**: 3小时  
**产出**: Jobs页面移动端体验达到生产级别

---

### Task 3.2: Match & Recommendations页面适配
- [ ] 修改 `src/app/match/page.tsx` 和 `src/components/MatchResults.tsx`
  - [ ] Match页面双栏布局变单栏（≤900px时堆叠）
  - [ ] ResumeUploader组件：
    - [ ] 拖拽区域在移动端增大触摸目标
    - [ ] 支持文件选择器备选（点击上传）
    - [ ] 上传进度条清晰可见
  - [ ] MatchResults结果展示：
    - [ ] 匹配度圆环/进度条响应式缩放
    - [ ] 结果卡片垂直布局
    - [ ] AI建议文字大小适中（13-14px）

- [ ] 修改 `src/app/recommendations/page.tsx`
  - [ ] 推荐理由卡片适配
  - [ ] 操作按钮组横向滚动或换行

- [ ] 测试简历上传流程在移动端的可用性

**依赖**: Task 3.1  
**预估时间**: 2小时  
**产出**: 匹配推荐功能移动端可用

---

### Task 3.3: Favorites & User页面适配
- [ ] 修改 `src/app/favorites/page.tsx`
  - [ ] 取消收藏按钮触摸友好（≥44px）
  - [ ] 批量操作模式（编辑→多选→删除）
  - [ ] 空状态引导："去发现心仪岗位"
  - [ ] 下拉刷新功能（可选）

- [ ] 修改 `src/app/users/page.tsx`（如果存在用户管理）
  - [ ] 用户卡片网格响应式
  - [ ] 操作菜单（更多按钮）底部弹出
  - [ ] 头像上传支持拍照/相册选择

- [ ] 测试收藏功能的完整生命周期

**依赖**: Task 3.2  
**预估时间**: 1.5小时  
**产出**: 个人中心功能完善

---

### Task 3.4: Auth认证流程移动端优化
- [ ] 修改 `src/app/login/page.tsx` 和 `src/app/login/login-client.tsx`
  - [ ] 登录表单：
    - [ ] 居中卡片，最大宽度400px（桌面）/ 全宽减padding（移动）
    - [ ] 输入框带图标（用户名🔑 密码🔒）
    - [ ] "记住我"复选框足够大（24×24px触摸区）
    - [ ] 登录按钮全宽，高度48px
    - [ ] 错误提示红色醒目，靠近相关字段
  - [ ] 注册链接：明显但不抢眼
  - [ ] 第三方登录按钮（如有）：图标+文字，适当间距

- [ ] 键盘适配：
  - [ ] 用户名字段：type="text" / email（type="email"）
  - [ ] 密码字段：type="password"，显示/隐藏切换
  - [ ] 回车键提交表单
  - [ ] 最后一个输入框"完成"按钮收起键盘

- [ ] 加载状态：
  - [ ] 登录按钮显示spinner，禁用重复点击
  - [ ] 表单字段disable防止修改

- [ ] 测试：
  - [ ] 错误密码提示清晰
  - [ ] 网络错误处理友好
  - [ ] 表单验证即时反馈

**依赖**: Task 3.3  
**预估时间**: 2小时  
**产出**: 流畅的移动端登录体验

---

## Phase 4: 增强功能与优化

### Task 4.1: 手势交互与触摸优化
- [ ] 实现下拉刷新（Pull-to-Refresh）
  - [ ] 使用库：@tanstack/react-virtual 或 react-pullrefresh
  - [ ] 自定义刷新动画（符合品牌调性）
  - [ ] 刷新距离阈值：80px触发
  - [ ] 松手后回弹动画

- [ ] 卡片滑动操作（可选）
  - [ ] 左滑显示"删除"/"归档"
  - [ ] 右滑显示"收藏"/"分享"
  - [ ] 使用react-swipeable或类似库
  - [ ] 滑动阈值：>60px触发操作

- [ ] 长按菜单
  - [ ] 岗位卡片长按：复制标题、分享链接、在新标签打开
  - [ ] 震动反馈（Vibration API，需用户授权）
  - [ ] 500ms触发长按

- [ ] 双指缩放控制
  - [ ] 图片查看器支持捏合缩放
  - [ ] meta viewport设置user-scalable=yes（特定页面）

- [ ] 测试手势在各种情况下的表现
  - [ ] 边界情况：快速滑动、中断滑动、多点触控
  - [ ] 与原生手势冲突处理（如浏览器后退）

**依赖**: Phase 3全部完成  
**预估时间**: 4小时  
**产出]: 丰富的手势交互能力

---

### Task 4.2: 性能监控与深度优化
- [ ] 集成性能监控
  - [ ] 安装web-vitals库监控Core Web Vitals
  - [ ] 自定义指标：首次内容渲染时间、交互就绪时间
  - [ ] 控制台输出开发环境性能报告
  - [ ] 生产环境上报至分析服务（可选）

- [ ] 渲染性能优化
  - [ ] React.memo包装所有列表项组件（JobCard等）
  - [ ] useMemo缓存昂贵计算（筛选后的列表排序等）
  - [ ] useCallback稳定事件处理函数引用
  - [ ] 虚拟滚动集成：
    - [ ] 条件：items.length > 50时启用
    - [ ] 库选择：@tanstack/react-virtual（轻量）
    - [ ] 动态高度支持（如果卡片高度不一）

- [ ] 资源加载优化
  - [ ] 字体优化：
    - [ ] 使用font-display: swap防止FOIT/FOUT
    - [ ] 子集化中文字体（仅加载常用3000字）
    - [ ] preload关键字体
  - [ ] 图片优化：
    - [ ] Next.js Image组件自动WebP转换
    - [ ] srcset响应式图片
    - [ ] blurDataURL占位符
  - [ ] 代码分割：
    - [ ] React.lazy()加载非首屏组件（Modal等）
    - [ ] 动态import()分离重型库（Markdown渲染器）

- [ ] 运行Lighthouse审计
  - [ ] 目标：Performance > 90, Accessibility > 95, Best Practices > 90
  - [ ] 修复发现的问题

**依赖**: Task 4.1  
**预估时间**: 3小时  
**产出]: 卓越的性能表现

---

### Task 4.3: 无障碍访问（A11y）全面审查
- [ ] 运行自动化审计工具
  - [ ] 安装axe-core或@axe-core/react
  - [ ] 编写测试脚本扫描所有页面
  - [ ] 生成报告并分级修复（Critical → Minor）

- [ ] 修复Critical问题
  - [ ] **图片alt文本**：所有<img>必须有有意义的alt
  - [ ] **表单label**：<label for=""> 或 aria-label
  - [ ] **按钮文本**：图标按钮必须aria-label
  - [ ] **颜色对比度**：检查所有文本组合，<4.5:1的需加深
  - [ ] **焦点管理**：Modal打开时焦点 trapped，关闭时返回触发元素

- [ ] 增强键盘导航
  - [ ] Tab顺序符合视觉流（上到下，左到右）
  - [ ] Focus轮廓清晰可见（2px solid primary色）
  - [ ] Skip to content链接（首页第一个可聚焦元素）
  - [ ] 方向键支持：下拉菜单、标签页、对话框
  - [ ] Escape键统一关闭所有浮层

- [ ] 屏幕阅读器优化
  - [ ] 动态区域：aria-live="polite"用于搜索结果更新、toast通知
  - [ ] 状态变更：aria-busy="true"加载中，aria-expanded展开状态
  - [ ] 角色语义：role="list", role="listitem", role="navigation"
  - [ ] 隐藏装饰性内容：aria-hidden="true"（图标纯装饰时）

- [ ] 减少运动偏好
  - [ ] 尊重prefers-reduced-motion: reduce（已在variables.css实现）
  - [ ] 提供静态备选方案（如简单淡入代替复杂动画）

- [ ] 手动测试清单
  - [ ] 仅用键盘完成核心任务流程（搜索-筛选-查看-收藏）
  - [ ] 使用VoiceOver(iOS)/TalkBack(Android)听取页面朗读
  - [ ] 放大到200%确认布局不乱
  - [ ] 高对比度模式下色彩仍可区分

- [ ] 文档：编写无障碍使用指南

**依赖**: Task 4.2  
**预估时间**: 3小时  
**产出]: WCAG 2.1 AA级合规

---

### Task 4.4: 暗色模式最终验证与修复
- [ ] 全面审查暗色模式
  - [ ] 截图对比：逐页面对比亮色/暗色模式
  - [ ] 检查遗漏：找出仍使用硬编码颜色的地方
  - [ ] 对比度检查：暗色模式下文字可读性

- [ ] 修复常见问题
  - [ ] **阴影过重**：暗色背景阴影应更透明/更柔和
  - [ ] **边框不明显**：暗色模式边框需提亮（rgba(255,255,255,0.1)）
  - [ ] **图片问题**：透明背景图片可能需要invert滤镜
  - [ ] **代码块**：AI分析中的<pre>代码块确保暗色友好
  - [ ] **第三方组件**：覆盖第三方库样式（如Markdown渲染器）

- [ ] 主题切换增强
  - [ ] 切换动画：CSS transition on color/background 300ms
  - [ ] 无闪烁：内联script提前读取localStorage设置theme
  - [ ] 系统跟随：检测prefers-color-system变化实时切换
  - [ ] 打印样式：强制亮色模式（print media query）

- [ ] 用户偏好持久化
  - [ ] localStorage存储选择
  - [ ] 首次访问跟随系统，手动选择后记住
  - [ ] 提供重置为系统默认选项

- [ ] 测试：
  - [ ] 快速连续切换主题无异常
  - [ ] 所有页面、所有组件两种模式均正常
  - [ ] 切换时正在进行的操作不中断

**依赖**: Task 4.3  
**预估时间**: 2小时  
**产出]: 完美的暗色模式体验

---

## Task Dependencies Graph

```
Phase 1: 基础设施
├─ Task 1.1: 设计令牌 [无依赖]
├─ Task 1.2: 断点工具 [依赖 1.1]
└─ Task 1.3: Grid系统 [依赖 1.2]

Phase 2: 核心组件
├─ Task 2.1: 导航系统 [依赖 1.3]
├─ Task 2.2: 卡片组件 [依赖 2.1]
│   ├─ 2.2.1: JobCard
│   ├─ 2.2.2: StatCard
│   └─ 2.2.3: UserCard
├─ Task 2.3: 表单组件 [依赖 2.2]
└─ Task 2.4: 弹窗组件 [依赖 2.3]

Phase 3: 页面适配
├─ Task 3.1: Jobs页面 [依赖 2.4]
├─ Task 3.2: Match/Recs [依赖 3.1]
├─ Task 3.3: Fav/Users [依赖 3.2]
└─ Task 3.4: Auth流程 [依赖 3.3]

Phase 4: 增强
├─ Task 4.1: 手势交互 [依赖 Phase 3]
├─ Task 4.2: 性能优化 [依赖 4.1]
├─ Task 4.3: 无障碍 [依赖 4.2]
└─ Task 4.4: 暗色模式 [依赖 4.3]
```

**注意**: 同Phase内的Task在满足依赖后可并行开发。

---

## 总预估时间

| Phase | 任务数 | 预估工时 | 并行后预估 |
|-------|--------|----------|-----------|
| Phase 1: 基础设施 | 3 | 5.5h | 5.5h |
| Phase 2: 核心组件 | 4 | 14h | 10h（部分并行）|
| Phase 3: 页面适配 | 4 | 8.5h | 6h（部分并行）|
| Phase 4: 增强功能 | 4 | 12h | 8h（部分并行）|
| **总计** | **15** | **40h** | **~30h** |

---

## 风险与缓解措施

| 风险 | 可能性 | 影响 | 缓解策略 |
|------|--------|------|---------|
| 第三方库兼容性问题 | 中 | 高 | 选择成熟库，锁定版本，准备fallback |
| 测试设备覆盖不足 | 中 | 中 | 使用BrowserStack云测试，优先P0设备 |
| 性能优化过度工程 | 低 | 中 | 设定明确指标，避免过早优化 |
| 暗色模式细节繁琐 | 高 | 低 | 系统化截图对比，建立checklist |
| 手势交互跨浏览器差异 | 高 | 中 | 使用polyfill，渐进增强 |

---

## 后续维护建议

1. **建立组件文档**：使用Storybook展示所有组件的响应式变体
2. **视觉回归测试**：每次PR自动截图对比（Percy/Chromatic）
3. **性能预算**：设定首屏<3s，超则告警
4. **定期审计**：每季度运行Lighthouse + axe审计
5. **用户反馈**：收集移动端用户反馈，持续迭代
