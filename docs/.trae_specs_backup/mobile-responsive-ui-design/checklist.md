# 移动端响应式UI设计与优化 - 验证清单

## Phase 1: 基础设施验证

### ✅ Task 1.1: 设计令牌系统
- [ ] 所有新定义的CSS变量在 `variables.css` 中存在且格式正确
- [ ] 间距令牌完整（--space-xs 到 --space-2xl，至少8个等级）
- [ ] 字体令牌包含字号、字重、行高三个维度
- [ ] Z-index层级从 --z-base 到 --z-tooltip 递增且无跳跃
- [ ] 动画令牌包含时长和缓动函数两类
- [ ] 暗色模式 `[data-theme='dark']` 下所有新变量有对应值覆盖
- [ ] 现有组件使用新令牌后视觉无变化（向后兼容）
- [ ] 无硬编码的颜色值、尺寸值残留在组件样式中（除极少数例外）
- [ ] 设计令牌文档注释清晰，包含使用示例

**验证方法**: 代码审查 + 视觉对比测试

---

### ✅ Task 1.2: 响应式断点工具
- [ ] 断点常量定义明确，命名统一（xs/sm/md/lg/xl/2xl）
- [ ] 媒体查询混入模板可复用，减少重复代码
- [ ] `layout.css` 中所有媒体查询使用统一的断点值
- [ ] 移除重复或冲突的媒体查询规则（如grid-4的多处定义）
- [ ] 断点顺序符合 mobile-first 或 desktop-first 策略（一致即可）
- [ ] 断点边界值清晰（如768px属于哪个区间有明确定义）
- [ ] 新增响应式样式时有明确的模板可遵循

**验证方法**: 代码搜索确认无遗漏 + Chrome DevTools设备模拟器测试各断点

---

### ✅ Task 1.3: Grid系统重构
- [ ] .grid, .grid-2, .grid-3, .grid-4 类名基础样式正确
- [ ] Grid gap 使用设计令牌（--space-*）而非硬编码
- [ ] 各断点下Grid列数变化符合预期：
  - [ ] ≥1280px: grid-4显示4列
  - [ ] 1024px-1279px: grid-4显示2-3列
  - [ ] 768px-1023px: grid-4显示2列
  - [ ] 481px-767px: grid-4显示2列
  - [ ] ≤480px: grid-4显示1列
- [ ] Grid子元素不会溢出容器（overflow处理）
- [ ] Grid在不同内容长度下高度自适应正常
- [ ] 新增的实用类（.grid-auto, .grid-fit）工作正常
- [ ] Grid使用文档或示例代码存在

**验证方法**: 创建包含多个卡片的测试页面，调整窗口宽度观察布局变化

---

## Phase 2: 核心组件验证

### ✅ Task 2.1: 导航系统（Mobile Drawer）
#### 功能完整性
- [ ] ≤768px时侧边栏默认隐藏（transform: translateX(-100%)）
- [ ] 点击汉堡菜单按钮后侧边栏滑出
- [ ] 侧边栏滑出时显示半透明遮罩层
- [ ] 点击遮罩层可关闭侧边栏
- [ ] 按ESC键可关闭侧边栏（桌面端测试）
- [ ] 侧边栏打开时页面内容不可滚动（body overflow: hidden）
- [ ] 快速连续点击菜单按钮无异常（防抖或状态检查）

#### 样式与动画
- [ ] 汉堡菜单按钮尺寸 ≥ 44×44px（触摸友好）
- [ ] 按钮图标为 ☰ 或清晰的SVG图标
- [ ] 按钮位置：顶部导航栏左侧
- [ ] ARIA属性完整：aria-label, aria-expanded, role="button"
- [ ] 侧边栏滑入/滑出动画流畅（200-250ms ease-out）
- [ ] 遮罩层淡入淡出效果自然（150-200ms）
- [ ] 顶部导航栏移动端sticky定位生效

#### 响应式行为
- [ ] iPhone SE (375px): 导航正常，无水平滚动
- [ ] iPhone 14 Pro Max (430px): 导航正常，间距合理
- [ ] iPad (768px): 自动切换为桌面端侧边栏模式
- [ ] iPad Pro (1024px): 侧边栏始终可见
- [ ] 横竖屏切换时导航模式正确切换

**验证方法**: 真机测试 + BrowserStack云测试 + 自动化截图对比

---

### ✅ Task 2.2: 卡片组件适配
#### JobCard岗位卡片
- [ ] **桌面端（≥768px）**：
  - [ ] 水平布局：左信息区 + 右收藏按钮
  - [ ] padding: 20px，间距合理
  - [ ] hover效果：上浮1px + 阴影加深
  - [ ] 收藏按钮hover时星标放大1.15倍
- [ ] **平板端（481px-767px）**：
  - [ ] 保持水平但更紧凑（padding: 16px）
  - [ ] 字体缩小1-2px但仍清晰可读
- [ ] **移动端（≤480px）**：
  - [ ] 垂直布局：标题→元信息→描述→标签
  - [ ] 收藏按钮绝对定位右上角（position: absolute; top: 14px; right: 14px）
  - [ ] 容器position: relative
  - [ ] padding: 14px
- [ ] **通用要求**：
  - [ ] 极长标题单行截断并显示省略号
  - [ ] 描述文本2-3行截断（-webkit-line-clamp）
  - [ ] 点击反馈：active态scale(0.98)或透明度变化
  - [ ] 最小宽度280px时内容不溢出
  - [ ] 卡片间gap在移动端10-12px

#### StatCard统计卡片
- [ ] **桌面端**：4列网格，min-height: 180px
- [ ] **平板端**：2列网格，min-height: 160px
- [ ] **移动端**：2列网格，min-height: 140px
- [ ] Header区域有底部分隔线（border-bottom）
- [ ] 列表项hover背景色 rgba(59, 130, 246, 0.08)
- [ ] 列表项cursor: pointer明确可点击
- [ ] 列表项名称文本溢出省略（text-overflow: ellipsis）
- [ ] 计数数字右对齐，font-weight: 600
- [ ] 移动端列表max-height限制+可滚动（overflow-y: auto）
- [ ] 空数据时显示"暂无数据"提示而非空白
- [ ] Badge标签（TOP 5等）样式正确，颜色区分明显

#### UserCard用户卡片
- [ ] 桌面端：头像+信息水平排列
- [ ] 移动端：垂直居中布局，头像64px居中
- [ ] 用户名过长时省略号处理
- [ ] 操作按钮组在移动端换行或横向滚动

**验证方法**: 创建包含各种长度内容的测试数据，逐设备验证

---

### ✅ Task 2.3: 表单与筛选组件
#### HierarchicalFilter下拉选择器
- [ ] 移动端触摸目标高度 ≥ 48px
- [ ] 下拉选项列表最大高度200px+可滚动
- [ ] 选中项高亮显示（背景色或文字颜色）
- [ ] 占位符文字颜色较浅（--muted色）
- [ ] 箭头图标指示可展开（▼）

#### Search搜索框
- [ ] type="search" 属性设置
- [ ] 输入内容后出现清除按钮（×）
- [ ] 清除按钮点击清空输入框并聚焦
- [ ] placeholder="搜索岗位或公司" 显示正确
- [ ] 移动端不自动聚焦（避免键盘弹出挡住页面）

#### Input & Button基础组件
- [ ] Input min-height: 44px（移动）/ 42px（桌面）
- [ ] Input font-size: 16px（防止iOS缩放）
- [ ] Input focus时蓝色边框（--primary色）+ 轻微阴影
- [ ] Button min-height: 44px（符合触摸标准）
- [ ] Button :active态有明显反馈（scale或深色）
- [ ] Button loading态：spinner旋转 + 禁用点击 + 文字变为"加载中..."
- [ ] Button variant齐全：primary蓝、secondary灰、ghost透明、danger红

#### 筛选栏布局
- [ ] 桌面：filter-grid auto-fit列数，minmax(180px, 1fr)
- [ ] 平板：2-3列自适应
- [ ] 移动：单列堆叠，每个筛选器width: 100%
- [ ] "清除筛选"按钮在所有屏幕尺寸下可见
- [ ] 已选筛选项Tag展示，单个可删除

**验证方法**: 表单填写流程测试 + 边界输入测试（超长文本、特殊字符）

---

### ✅ Task 2.4: 弹窗与Bottom Sheet
#### Modal桌面端行为（保持不变）
- [ ] 居中显示，最大宽度800px
- [ ] 圆角16px（--radius-xl）
- [ ] 最大高度90vh，超出部分滚动
- [ ] 遮罩层半透明黑色（rgba(0,0,0,0.5)）
- [ ] 淡入+上滑动画（200ms）
- [ ] 点击遮罩或按ESC关闭
- [ ] 关闭时焦点返回触发元素

#### Bottom Sheet移动端行为（新增）
- [ ] 检测到≤768px时自动启用Bottom Sheet模式
- [ ] 固定在底部，width: 100%，左右圆角16px
- [ ] max-height: 85vh
- [ ] 从底部滑入动画（250ms ease-out）
- [ ] 顶部拖拽手柄（drag handle）：宽40px高4px灰色圆角条
- [ ] 向下滑动>50px触发关闭，<50px回弹
- [ ] 点击下方遮罩关闭
- [ ] 内容区域overflow-y: auto可滚动
- [ ] 关闭时向下滑出动画（200ms ease-in）

#### JobDetailModal具体实现
- [ ] 头部固定：标题+关闭按钮，padding: 16px
- [ ] 主体区域滚动：岗位详情、AI分析、操作按钮
- [ ] 底部操作栏（可选）：收藏、查看原网页按钮fixed定位
- [ ] 安全区域适配：padding-bottom: env(safe-area-inset-bottom)（iPhone X系列）
- [ ] 关闭按钮位置：右上角，尺寸44×44px

#### 动画性能
- [ ] 使用transform代替top/bottom属性（GPU加速合成层）
- [ ] 动画开始前添加will-change: transform
- [ ] 动画结束后移除will-change（避免内存占用）
- [ ] 动画期间pointer-events: none防止误触

#### 兼容性测试
- [ ] 快速打开/关闭（<500ms间隔）无闪烁或错位
- [ ] 内容超长（>3屏）时滚动流畅，帧率≥55fps
- [ ] 横竖屏切换时弹窗重新定位正确
- [ ] iOS Safari底部安全区域不遮挡内容
- [ ] Android Chrome行为一致

**验证方法**: Chrome DevTools Performance面板录制动画帧率 + 真机测试

---

## Phase 3: 页面级验证

### ✅ Task 3.1: Jobs页面完美适配
#### 筛选条件区域
- [ ] SectionCard标题"筛选条件"字体大小合适（18px桌/16px平板/15px手机）
- [ ] 移动端默认仅显示：搜索框 + 地点筛选
- [ ] "更多筛选"按钮展开其余4个筛选器（类型、行业、学历、来源）
- [ ] 展开/折叠动画平滑（height过渡或max-height技巧，300ms）
- [ ] 展开后筛选器单列堆叠，每个占满宽
- [ ] "清除筛选"按钮始终可见，位置合理
- [ ] "共 X 条"Badge显示正确

#### 数据概览区域
- [ ] 默认折叠状态："数据概览面板已折叠 · 共 X 个来源..."
- [ ] 折叠/展开按钮："▼ 展开" / "▲ 收起"，易点击（min-height: 36px）
- [ ] 展开后4个统计卡片2列网格（移动端）
- [ ] 统计卡片内部数据显示正确（来源分布TOP 5等）
- [ ] 点击统计项可筛选（如点击"Boss直聘"则筛选来源为该值）

#### 岗位列表区域
- [ ] Grid间距：桌24px / 平板16px / 手机10-12px
- [ ] JobCard渲染正确，样式符合Task 2.2规范
- [ ] 空状态插图+文字+操作按钮居中显示
- [ ] 加载状态Skeleton数量：桌5个 / 平板4个 / 手机2-3个
- [ ] Skeleton动画pulse效果（比shimmer更省电）

#### 分页组件
- [ ] 桌面：完整分页（上一页 1 2 3 ... 351 下一页）
- [ ] 平板：简化分页（上一页 当前页/总页 下一页 + 页码跳转输入框）
- [ ] 手机：极简分页（< 上一页 12/351 下一页 >）
- [ ] 页码输入框：type="number", min=1, max=总页数
- [ ] 输入页码后按Enter或失焦跳转
- [ ] 边界处理：第1页时"上一页"禁用，最后一页时"下一页"禁用
- [ ] 当前页码高亮（蓝色背景白字）

#### 性能指标
- [ ] 岗位列表虚拟滚动在items.length > 50时自动启用
- [ ] 虚拟滚动时DOM节点数保持恒定（~20个可视节点）
- [ ] 滚动帧率稳定在55fps以上（DevTools Performance测量）
- [ ] 内存占用无明显增长（Chrome DevTools Memory面板监控）

#### 用户流程测试
- [ ] 完整流程：打开页面 → 输入搜索 → 选择筛选 → 查看列表 → 点击卡片 → 查看详情 → 关闭 → 收藏 → 取消收藏
- [ ] 每步操作响应时间 < 100ms（感知即时）
- [ ] 无控制台错误或警告
- [ ] 网络请求合理（无重复请求、无冗余数据）

**验证方法**: Lighthouse审计 + 手动用户流程测试 + Performance API监控

---

### ✅ Task 3.2: Match & Recommendations页面
#### Match页面
- [ ] 双栏布局（简历上传区 + 结果展示区）在≤900px时变为单列堆叠
- [ ] 上传区域拖拽目标在移动端足够大（min-height: 200px）
- [ ] 点击上传区域触发文件选择器（移动端备选方案）
- [ ] 上传进度条清晰可见（百分比文字+进度条填充）
- [ ] MatchResults匹配度圆环在移动端缩小但不失真（120px → 80px）
- [ ] 结果卡片垂直布局，信息层次清晰
- [ ] AI建议文字13-14px，行高1.7易于阅读

#### Recommendations页面
- [ ] 推荐理由卡片网格响应式（2列→1列）
- [ ] 操作按钮组（接受/拒绝/忽略）在小屏换行或横向滚动
- [ ] 卡片间距适中，不拥挤

**验证方法**: 真机上传简历文件测试 + 各种屏幕尺寸截图对比

---

### ✅ Task 3.3: Favorites & Users页面
#### Favorites页面
- [ ] 收藏列表空状态："暂无收藏记录" + "去发现心仪岗位"链接
- [ ] 取消收藏按钮触摸区域≥44×44px
- [ ] 长按卡片弹出操作菜单（删除/分享）- 如果实现了Task 4.1
- [ ] 批量编辑模式：编辑→多选checkbox→批量删除
- [ ] 删除确认对话框（Bottom Sheet或Alert）
- [ ] 下拉刷新功能（如果启用）：刷新动画+时间戳

#### Users页面（如有）
- [ ] 用户卡片网格：桌3列 / 平板2列 / 手机1列
- [ ] 操作菜单（更多⋮按钮）点击后底部弹出选项
- [ ] 头像上传支持：拍照（相机图标）+ 相册（图片图标）
- [ ] 上传的新头像预览+裁剪（可选）

**验证方法**: 收藏/取消收藏操作多次循环测试 + 边界情况（空列表、单条、大量）

---

### ✅ Task 3.4: Auth认证流程
#### 登录页面布局
- [ ] 登录卡片居中，桌面max-width: 400px，移动端width: calc(100% - 32px)
- [ ] 卡片圆角、阴影、背景色符合设计规范
- [ ] 品牌Logo/名称在卡片顶部居中

#### 表单字段
- [ ] 用户名输入框：
  - [ ] type="text" 或 type="email"
  - [ ] 左侧图标🔑或📧（可选）
  - [ ] placeholder="用户名/邮箱"
  - [ ] autofocus仅在桌面端（移动端不自动聚焦）
- [ ] 密码输入框：
  - [ ] type="password"
  - [ ] 显示/隐藏切换按钮（👁图标）
  - [ ] placeholder="密码"
  - [ ] autocomplete="current-password"
- [ ] "记住我"复选框：
  - [ ] 视觉尺寸24×24px（触摸区域44×44px）
  - [ ] label文字"记住登录状态"紧邻右侧
- [ ] 登录按钮：
  - [ ] 全宽（width: 100%）
  - [ ] 高度48px
  - [ ] 文字"登 录"（字间距美观）
  - [ ] 背景色--primary， hover时--primary-hover

#### 交互行为
- [ ] 表单验证：
  - [ ] 必填字段为空时显示红色提示"请输入用户名"/"请输入密码"
  - [ ] 提示文字靠近对应字段下方
  - [ ] 输入时实时验证（blur事件或debounce 300ms）
- [ ] 提交逻辑：
  - [ ] 点击登录或按Enter键提交表单
  - [ ] 提交中：按钮显示spinner，文字变"登录中..."，整个表单disabled
  - [ ] 成功：跳转到Jobs页面或首页
  - [ ] 失败：显示错误消息（红色notice），表单恢复可编辑
- [ ] 键盘适配：
  - [ ] 用户名字段聚焦时，键盘Return键跳到密码字段
  - [ ] 密码字段聚焦时，键盘Return/Go键提交表单
  - [ ] 移动端键盘弹出时，登录卡片可见且不被遮挡（scrollIntoViewIfNeeded）
  - [ ] 密码字段"完成"按钮收起键盘（如果支持）

#### 错误处理
- [ ] 用户名或密码错误：显示"用户名或密码错误，请重试"
- [ ] 网络异常：显示"网络连接失败，请检查网络后重试" + 重试按钮
- [ ] 服务器错误(500)：显示"服务器繁忙，请稍后再试"
- [ ] 请求超时：显示"请求超时，请检查网络"

#### 注册/忘记密码链接
- [ ] "还没有账号？立即注册"链接在登录按钮下方
- [ ] "忘记密码？"链接在密码字段下方或登录按钮下方
- [ ] 链接颜色--primary，hover时--primary-hover
- [ ] 不抢眼但不难找

**验证方法**: 
- 故意输入错误密码测试错误提示
- 断网状态下测试网络错误提示
- iOS/Android真机测试键盘行为

---

## Phase 4: 增强功能验证

### ✅ Task 4.1: 手势交互
#### 下拉刷新（Pull-to-Refresh）
- [ ] 在岗位列表顶部向下拉动>80px触发刷新
- [ ] 拉动过程中显示箭头/动画指示释放可刷新
- [ ] 松手后箭头旋转为loading spinner
- [ ] 刷新完成后收回动画（300ms）
- [ ] 显示"最后更新: HH:mm:ss"时间戳
- [ ] 刷新期间阻止重复触发
- [ ] 正常滚动时不误触发（需快速向下再向上）

#### 卡片滑动操作（可选）
- [ ] 左滑JobCard >60px显示"删除/归档"红色操作
- [ ] 右滑 >60px显示"收藏/分享"蓝色/绿色操作
- [ ] 未达阈值时回弹原位
- [ ] 操作按钮点击执行相应动作
- [ ] 滑动时页面不跟随滚动（touch-action: pan-y or none）

#### 长按菜单
- [ ] 岗位卡片长按500ms触发震动（如果授权）
- [ ] 弹出Bottom Sheet菜单：
  - [ ] 复制岗位标题
  - [ ] 分享链接（调用Web Share API或复制剪贴板）
  - [ ] 在新标签打开
  - [ ] 取消
- [ ] 菜单项高度56px，图标+文字，分隔线

#### 浏览器兼容性
- [ ] iOS Safari: 下拉刷新可能需禁用原生bounce（overscroll-behavior: contain）
- [ ] Android Chrome: 下拉刷新正常工作
- [ ] 降级策略：不支持touch events的设备回退为按钮触发的刷新

**验证方法**: 
- 真机手势测试（iPhone + Android）
- 快速滑动、中断滑动、多点触控边界情况
- Chrome DevTools Touch模拟器测试

---

### ✅ Task 4.2: 性能优化
#### 监控集成
- [ ] web-vitals库已安装并初始化
- [ ] 控制台输出开发环境性能报告（LCP, FID, CLS, TTFB）
- [ ] Core Web Vitals指标阈值设定：
  - [ ] LCP < 2.5s (良好)
  - [ ] FID < 100ms (良好)
  - [ ] CLS < 0.1 (良好)

#### 渲染优化证据
- [ ] JobCard组件包裹React.memo（通过源码确认）
- [ ] 筛选后的排序列表使用useMemo缓存（Profiler验证命中缓存）
- [ ] 事件处理函数使用useCallback稳定引用（避免子组件不必要的重渲染）
- [ ] 虚拟滚动条件：items.length > 50时启用@tanstack/react-virtual
- [ ] 虚拟滚动DOM节点数：可视区域~20个节点（React DevTools Components树确认）

#### 资源加载优化
- [ ] 字体font-display: swap（查看computed style）
- [ ] 关键CSS内联在<html>内的<style>标签（查看Page Source）
- [ ] Next.js Image组件使用：<Image src={...} width height alt />
- [ ] 图片格式：自动转换为WebP（Network面板检查Content-Type）
- [ ] React.lazy()用于Modal、Toast等非首屏组件（Bundle Analyzer确认code split）
- [ ] MarkdownRenderer动态import()加载（Source Map确认）

#### Lighthouse审计结果（目标）
- [ ] Performance: ≥ 90 （移动端）
- [ ] Accessibility: ≥ 95
- [ ] Best Practices: ≥ 90
- [ ] SEO: ≥ 85（如适用）
- [ ] PWA: 如实反映（可选）

**验证工具**: 
- Lighthouse CI (GitHub Actions或本地)
- Chrome DevTools Performance面板录制6
- WebPageTest.org多地点测试
- Bundle Analyzer (webpack-bundle-analyzer或next-bundle-analyzer)

---

### ✅ Task 4.3: 无障碍访问(A11y)
#### 自动化审计通过率
- [ ] axe-core扫描：0 Critical, 0 Serious问题
- [ ] Minor问题数量 < 10（可后续优化）
- [ ] 扫描覆盖所有路由页面（/, /jobs, /match, /favorites, /login）

#### Critical问题修复确认
- [ ] 所有<img>标签含有有意义的alt文本（非空alt=""除非装饰图）
- [ ] 所有<form input>关联<label>或有aria-label
- [ ] 所有图标<button>（如收藏★、关闭✕）含aria-label
- [ ] 颜色对比度检查：
  - [ ] 正文文本（14px）对比度 ≥ 4.5:1
  - [ ] 大文本（18px+）对比度 ≥ 3:1
  - [ ] UI组件（按钮、标签）对比度 ≥ 3:1
- [ ] Modal焦点陷阱：打开时焦点在Modal内，Tab不逃逸
- [ ] Modal关闭后焦点返回触发元素（open modal的按钮）

#### 键盘导航完整性
- [ ] Tab顺序符合视觉阅读顺序（上→下，左→右）
- [ ] Focus轮廓可见：2px solid var(--primary)，offset 2px
- [ ] "Skip to content"链接存在于页面首个可聚焦元素
- [ ] Escape键关闭：Modal、Dropdown、Sidebar drawer、Toast通知
- [ ] 方向键支持：
  - [ ] 下拉选择器：上下键选项导航，Enter选择，Esc关闭
  - [ ] 标签页(Tab)：左右键切换，Home/End首末
  - [ ] 单选/复选组：方向键导航

#### 屏幕阅读器优化
- [ ] aria-live="polite"区域：
  - [ ] 搜索结果更新提示("找到 X 条结果")
  - [ ] Toast通知（成功/错误消息）
  - [ ] 筛选项移除提示（"已移除 XX 筛选"）
- [ ] 状态属性：
  - [ ] aria-busy="true" 加载中（skeleton区域）
  - [ ] aria-expanded 折叠/展开状态（统计面板、FAQ）
  - [ ] aria-current="page" 当前页面导航项
  - [ ] aria-pressed 切换按钮状态（收藏按钮、主题切换）
- [ ] 语义化角色：
  - [ ] role="navigation" 包裹<nav>
  - [ ] role="main" 包裹主内容
  - [ ] role="list" / role="listitem" 用于岗位列表
  - [ ] role="dialog" / aria-modal="true" 用于Modal
- [ ] 装饰性元素隐藏：aria-hidden="true"应用于纯装饰图标

#### 减少运动偏好
- [ ] prefers-reduced-motion: reduce媒体查询激活时：
  - [ ] 所有动画duration改为0.01ms（已在variables.css实现）
  - [ ] 过渡效果简化或移除
  - [ ] 提供静态替代方案

#### 手动测试通过
- [ ] ✅ **纯键盘完成核心任务**：
  - [ ] Tab到搜索框 → 输入关键词 → Tab到筛选 → 选择 → Tab到搜索按钮 → Enter
  - [ ] Tab到岗位列表 → 方向键或Tab遍历 → Enter打开详情 → Esc关闭
  - [ ] Tab到收藏按钮 → Enter/Space切换 → Toast提示可朗读
- [ ] ✅ **VoiceOver(iOS)/TalkBack(Android)测试**：
  - [ ] 页面标题正确朗读 ("岗位列表页面")
  - [ ] 导航菜单项可朗读 ("首页", "岗位列表", "我的收藏"...)
  - [ ] 卡片信息完整朗读 (标题, 公司, 地点, 薪资)
  - [ ] 按钮用途明确 ("收藏按钮", "查看详情", "关闭对话框")
- [ ] ✅ **放大到200%测试**（Cmd/Ctrl + Plus）：
  - [ ] 无水平滚动条
  - [ ] 布局不乱不重叠
  - [ ] 文本仍可读
- [ ] ✅ **高对比度模式**（Windows高对比度设置）：
  - [ ] 颜色仍可区分
  - [ ] 信息不丢失

**验证工具**: 
- axe DevTools浏览器扩展（免费）
- WAVE浏览器扩展（辅助）
- macOS VoiceOver (Cmd+F5)
- Android TalkBack (设置→无障碍→TalkBack)
- Chrome DevTools Emulation: 模拟高对比度/减少运动

---

### ✅ Task 4.4: 暗色模式全覆盖
#### 截图对比审查
- [ ] 以下页面已截图对比亮色/暗色两种模式：
  - [ ] 首页 (/)
  - [ ] 岗位列表 (/jobs) - 含展开的统计面板
  - [ ] 岗位详情弹窗
  - [ ] 匹配页面 (/match)
  - [ ] 收藏页面 (/favorites)
  - [ ] 登录页面 (/login)
  - [ ] 用户管理页面 (/users)（如有）
- [ ] 对比结果：无明显的颜色错误、文字不可读、边框消失等问题

#### 常见暗色模式问题修复确认
- [ ] 阴影柔和：box-shadow使用rgba(0,0,0,0.x)而非纯黑
- [ ] 边框可见：border-color使用rgba(255,255,255,0.1)或--panel-border暗色值
- [ ] 透明图片处理：如有logo带透明背景，添加background弥补
- [ ] 代码块(<pre>)：深色背景(#1e293b)浅色文字(#e2e8f0)
- [ ] 第三方组件样式覆盖：MarkdownRenderer输出在暗色模式下可读
- [ ] 白色文字不在白色/浅灰背景上（对比度反转错误）

#### 主题切换体验
- [ ] 切换按钮（ThemeToggle）在导航栏/设置中容易找到
- [ ] 点击切换后所有组件在300ms内平滑过渡到新主题
- [ ] CSS transition作用于color, background-color, border-color, box-shadow
- [ ] 切换过程中无闪烁（FOUC - Flash of Unstyled Content）
- [ ] 内联script在<head>中读取localStorage.theme并同步设置<html data-theme>
- [ ] 系统偏好检测：matchMedia('(prefers-color-scheme: dark)')监听变化
- [ ] 手动选择优先于系统偏好（一旦手动选择，不再跟随系统直到重置）

#### 特殊场景
- [ ] 打印样式强制亮色：@media print { :root { --bg: #fff; --text: #000; } }
- [ ] 图片暗色模式适配：如有必要，使用filter: brightness(0.8) invert(1)
- [ ] 图表/图表颜色：如有图表库，配置暗色palette
- [ ] Toast通知在两种模式下都醒目（success绿/danger红在暗色背景下仍清晰）

#### 持久化与重置
- [ ] localStorage存储key: 'theme'，值: 'light' | 'dark'
- [ ] 首次访问：读取系统偏好，无则默认light
- [ ] 手动选择后记住，下次访问恢复
- [ ] 提供"跟随系统"选项（重置为自动模式）
- [ ] 清除浏览器数据后恢复正常初始状态

#### 压力测试
- [ ] 快速连续点击切换按钮（10次/秒）无异常
- [ ] 切换过程中正在进行的操作不中断（如加载中的API请求）
- [ ] 横竖屏切换时主题保持不变
- [ ] 多个标签页同步切换（storage event监听或每次读取localStorage）

**验证工具**: 
- 浏览器开发者工具Device Mode切换暗色模式
- 真机iOS/Android暗色模式设置
- 截图工具对比（或Percy自动化）
- Chrome DevTools Elements面板检查计算后的颜色值

---

## 最终验收标准

### 🎯 必须全部达成（Go-Live Gate）

- [ ] **Lighthouse移动端评分**: Performance ≥ 90, Accessibility ≥ 95
- [ ] **Core Web Vitals**: 全部绿色（LCP < 2.5s, FID < 100ms, CLS < 0.1）
- [ ] **真机测试通过**: iPhone SE + iPhone 14 Pro + Galaxy S22 + iPad Air
- [ ] **axe-core审计**: 0 Critical, 0 Serious
- [ ] **键盘导航**: 核心任务流程可纯键盘完成
- [ ] **暗色模式**: 所有页面/组件两种模式均正常无闪烁
- [ ] **性能预算**: 首屏加载 < 3s (4G网络), 交互响应 < 100ms
- [ ] **用户验收**: 3名真实用户完成移动端核心任务无阻碍

### ⚠️ 强烈建议达成（Phase 2优化目标）

- [ ] 手势交互（下拉刷新、长按菜单）上线
- [ ] 虚拟滚动启用（大数据集场景）
- [ ] 离线缓存策略（Service Worker基础版本）
- [ ] 多语言准备（i18n key提取，即使暂不翻译）
- [ ] 组件Storybook文档建立

### 📋 后续持续改进（Backlog）

- [ ] PWA manifest配置（可安装到主屏幕）
- [ ] 推送通知集成（新岗位提醒）
- [ ] 生物识别认证（Face ID / 指纹）
- [ ] 离线-first架构（IndexedDB缓存关键数据）
- [ ] 微交互动画库（Framer Motion）引入复杂转场

---

## 验证工具清单

| 工具 | 用途 | 安装方式 |
|------|------|---------|
| Chrome DevTools | 调试、性能、无障碍 | 浏览器内置 |
| Lighthouse | 性能/无障碍/最佳实践审计 | DevTools内置或CLI |
| axe DevTools | 自动化无障碍扫描 | Chrome扩展（免费）|
| web-vitals | Core Web Vitals监控 | npm install web-vitals |
| React DevTools | 组件树/Props/性能 | Chrome扩展 |
| Bundle Analyzer | 打包体积分析 | npm install @next/bundle-analyzer |
| BrowserStack | 真机云测试 | browserstack.com账号 |
| Percy/Chromatic | 视觉回归测试 | SaaS服务 |
| VoiceOver (macOS) | 屏幕阅读器测试 | 系统自带 (Cmd+F5) |
| TalkBack (Android) | 屏幕阅读器测试 | 设置→无障碍 |

---

## 签署确认

**前端开发负责人**: _______________ 日期: _________

**UI/UX设计师**: _______________ 日期: _________

**产品经理**: _______________ 日期: _________

**测试工程师**: _______________ 日期: _________

*所有Checklist项目勾选并通过验证后，方可发布到生产环境。*
