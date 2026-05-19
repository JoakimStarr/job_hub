# 移动端响应式UI设计与整体优化方案 Spec

## Why

当前项目虽然已实现基础的响应式布局，但在移动端体验、视觉一致性、交互流畅度和可访问性方面存在明显不足。用户反馈卡片显示异常、布局拉伸等问题，需要系统性地建立完善的移动端适配规范和UI设计体系，提升跨设备用户体验。

## What Changes

* **建立完整的响应式断点系统**：统一管理所有屏幕尺寸的适配规则

* **优化移动端核心组件**：导航栏、侧边栏、卡片、表单、弹窗等关键组件

* **统一视觉设计语言**：间距、字体、颜色、圆角等设计令牌标准化

* **增强交互体验**：触摸优化、手势支持、动画过渡

* **完善无障碍访问**：ARIA标签、键盘导航、焦点管理

* **性能优化**：减少重绘、懒加载、虚拟滚动

* **暗色模式全面覆盖**：确保所有组件在两种主题下表现一致

### 核心原则

1. **Mobile-First**：优先考虑移动端体验，再向上扩展
2. **渐进增强**：基础功能在所有设备可用，高级功能按能力递增
3. **一致性**：统一的交互模式和视觉语言
4. **可访问性**：符合WCAG 2.1 AA标准
5. **性能优先**：移动端特别关注加载速度和流畅度

## Impact

* Affected specs: 全局样式系统、组件库、页面布局

* Affected code:

  * `src/styles/variables.css` - 设计令牌扩展

  * `src/styles/layout.css` - 布局系统重构

  * `src/styles/components.css` - 组件样式优化

  * `src/components/*.tsx` - 所有UI组件适配

  * `src/app/*/page.tsx` - 各页面响应式调整

***

## ADDED Requirements

### Requirement: 响应式断点系统

系统 SHALL 提供标准化的响应式断点定义，覆盖从手机到超宽屏的所有场景。

#### 断点定义表

| 断点名称 | 像素范围            | 设备类型      | 典型设备                  |
| ---- | --------------- | --------- | --------------------- |
| xs   | 0 - 479px       | 小屏手机      | iPhone SE, Galaxy S系列 |
| sm   | 480px - 767px   | 大屏手机      | iPhone Pro Max, Pixel |
| md   | 768px - 1023px  | 平板竖屏      | iPad, Android平板       |
| lg   | 1024px - 1279px | 平板横屏/小笔记本 | iPad Pro, Surface     |
| xl   | 1280px - 1599px | 桌面显示器     | MacBook Air, 常见显示器    |
| 2xl  | 1600px+         | 超宽屏/大显示器  | iMac 27", 4K显示器       |

#### Scenario: 断点正确应用

* **WHEN** 用户在不同尺寸设备访问系统

* **THEN** 界面自动适配对应断点的布局规则，无需横向滚动

### Requirement: 移动端导航系统

系统 SHALL 在移动端提供符合平台规范的导航体验。

#### 导航行为要求

1. **侧边栏转换**：

   * ≤768px：侧边栏变为抽屉式，从左侧滑入

   * 遮罩层背景，点击或滑动关闭

   * 支持右滑关闭手势

2. **顶部导航栏**：

   * 固定在顶部（sticky）

   * 包含汉堡菜单按钮（☰）

   * 显示当前页面标题

   * 高度：56px（iOS）/ 48px（Android）

3. **底部Tab栏（可选）**：

   * 主要功能页面使用底部导航

   * 图标+文字，最多5个入口

   * 安全区域适配（iPhone X系列底部）

#### Scenario: 移动端导航操作

* **WHEN** 用户点击汉堡菜单按钮

* **THEN** 侧边栏从左侧滑出，显示半透明遮罩

* **WHEN** 用户点击遮罩或向右滑动

* **THEN** 侧边栏滑出关闭，恢复正常视图

### Requirement: 卡片组件响应式适配

系统 SHALL 确保所有卡片组件在各种屏幕尺寸下正确显示。

#### 卡片适配规则

1. **岗位卡片（JobCard）**：

   * 桌面：水平布局，左侧信息右侧收藏按钮

   * 平板：保持水平布局，减小padding

   * 手机：垂直布局，收藏按钮右上角定位

   * 最小宽度：280px（grid自适应）

2. **统计卡片（StatCard）**：

   * 桌面：4列网格，显示完整列表

   * 平板：2列网格，显示TOP 3

   * 手机：2列网格/单列，限制高度可滚动

   * 统一最小高度：180px（桌面）/ 140px（移动）

3. **用户卡片（UserCard）**：

   * 桌面：水平信息展示

   * 移动：垂直堆叠，头像居中

#### Scenario: 卡片网格布局

* **WHEN** 屏幕宽度变化时

* **THEN** 卡片自动重新排列，保持合理的间距和大小

* **AND** 不出现内容溢出或过度压缩

### Requirement: 表单与输入组件优化

系统 SHALL 为移动端优化的表单输入体验。

#### 输入框规范

1. **触摸目标尺寸**：

   * 最小高度：44px（iOS HIG标准）

   * 最小触摸区域：44×44px

   * 按钮内边距：12px 16px

2. **输入类型优化**：

   * 搜索框：type="search"，显示搜索图标

   * 数字输入：type="tel" 或 pattern

   * 日期选择：原生日期选择器

   * 下拉选择：原生 select 或自定义移动端友好组件

3. **键盘适配**：

   * 自动弹出合适类型的键盘

   * 表单提交后收起键盘

   * 键盘弹出时页面可滚动到聚焦元素

#### Scenario: 移动端表单填写

* **WHEN** 用户点击输入框

* **THEN** 输入框获得焦点，键盘弹出

* **AND** 页面自动滚动，输入框不被遮挡

* **WHEN** 用户完成输入

* **THEN** 可通过"完成"按钮或点击空白处收起键盘

### Requirement: 弹窗与模态框适配

系统 SHALL 在移动端提供符合平台规范的模态交互。

#### 弹窗规范

1. **位置与尺寸**：

   * 桌面：居中显示，最大宽度800px，圆角16px

   * 平板：居中显示，90%宽度，圆角12px

   * 手机：底部弹出（Bottom Sheet），全宽，顶部圆角16px

2. **动画效果**：

   * 桌面：淡入+轻微上滑（200ms）

   * 移动：从底部滑入（250ms），支持拖拽关闭

3. **内容处理**：

   * 最大高度：桌面90vh / 移动85vh

   * 超出内容可滚动

   * 底部操作按钮固定

#### Scenario: 岗位详情查看

* **WHEN** 用户在手机上点击岗位卡片

* **THEN** 详情从底部滑出，显示完整信息

* **AND** 背景模糊/变暗

* **WHEN** 用户向下滑动或点击遮罩

* **THEN** 弹窗关闭，返回列表

### Requirement: 触摸交互与手势支持

系统 SHALL 提供流畅的触摸交互体验。

#### 手势支持清单

1. **基础手势**：

   * 点击（Tap）：所有可交互元素

   * 长按（Long Press）：显示上下文菜单（如复制、分享）

   * 滑动（Swipe）：卡片删除、列表刷新

2. **反馈机制**：

   * 点击反馈：scale(0.97) 或透明度变化

   * 加载状态：禁用点击，显示spinner

   * 触觉反馈（可选）：重要操作触发振动

3. **防误触设计**：

   * 列表项间8px以上间隔

   * 重要操作需二次确认

   * 撤销机制（如删除操作）

#### Scenario: 下拉刷新

* **WHEN** 用户在列表顶部向下拉动

* **THEN** 显示刷新动画，释放后更新数据

* **AND** 刷新完成后收回提示，显示更新时间

### Requirement: 性能优化策略

系统 SHALL 在移动端实施严格的性能优化措施。

#### 性能指标目标

| 指标                       | 目标值     | 测量方法                 |
| ------------------------ | ------- | -------------------- |
| First Contentful Paint   | < 1.5s  | Lighthouse           |
| Largest Contentful Paint | < 2.5s  | Lighthouse           |
| Time to Interactive      | < 3.5s  | Lighthouse           |
| Cumulative Layout Shift  | < 0.1   | Lighthouse           |
| 帧率                       | ≥ 55fps | DevTools Performance |

#### 优化策略

1. **资源加载**：

   * 图片懒加载（Intersection Observer）

   * 字体子集化（仅加载中文字符）

   * CSS/JS代码分割（路由级别）

   * 关键CSS内联

2. **渲染优化**：

   * 虚拟列表（100+条数据时启用）

   * React.memo避免不必要渲染

   * will-change属性合理使用

   * GPU加速动画（transform/opacity）

3. **网络优化**：

   * API请求缓存（SWR/React Query）

   * 图片压缩格式（WebP/AVIF）

   * 预加载关键资源

   * 离线缓存策略（Service Worker可选）

#### Scenario: 大数据量列表滚动

* **WHEN** 页面包含500+条岗位数据

* **THEN** 使用虚拟滚动，仅渲染可视区域

* **AND** 滚动帧率稳定在55fps以上

* **AND** 内存占用保持在合理范围

### Requirement: 无障碍访问（A11y）合规

系统 SHALL 符合WCAG 2.1 Level AA标准。

#### 核心要求

1. **语义化HTML**：

   * 正确使用heading层级（h1-h6）

   * landmark区域（nav, main, aside, footer）

   * 表单label关联

   * 按钮vs链接的正确使用

2. **ARIA属性**：

   * 动态内容：aria-live区域

   * 展开/折叠：aria-expanded

   * 加载状态：aria-busy

   * 弹窗焦点陷阱：aria-modal

3. **键盘导航**：

   * Tab顺序符合逻辑

   * Focus可见（outline）

   * Escape关闭弹窗

   * 方向键导航复杂组件

4. **色彩对比度**：

   * 文本对比度 ≥ 4.5:1（正常文本）

   * 文本对比度 ≥ 3:1（大文本/图标）

   * 不依赖单一颜色传达信息

5. **屏幕阅读器支持**：

   * 有意义的alt文本

   * 图标按钮有aria-label

   * 状态变化有通知

#### Scenario: 键盘用户浏览岗位列表

* **WHEN** 用户仅使用键盘操作

* **THEN** 可通过Tab键遍历所有可交互元素

* **AND** Focus状态清晰可见

* **AND** Enter/Space激活当前元素

* **AND** Escape关闭打开的弹窗

### Requirement: 暗色模式全覆盖

系统 SHALL 确保所有UI组件在亮色/暗色主题下均表现良好。

#### 主题切换要求

1. **CSS变量完整性**：

   * 所有颜色值使用CSS变量

   * 新增组件必须定义暗色变量

   * 渐变、阴影需双主题适配

2. **图片处理**：

   * 支持暗色模式图片（如果需要）

   * Logo自动适应背景

3. **系统偏好**：

   * 尊重 prefers-color-scheme 设置

   * 记住用户手动选择

   * 切换时平滑过渡（300ms）

4. **特殊场景**：

   * 图表/图表颜色适配

   * 第三方组件覆盖

   * 打印样式处理

#### Scenario: 主题切换

* **WHEN** 用户点击主题切换按钮

* **THEN** 所有组件在300ms内平滑过渡到新主题

* **AND** 无闪烁或样式错乱

* **AND** 用户偏好被持久化存储

***

## MODIFIED Requirements

### Requirement: 设计令牌系统（Design Tokens）

扩展现有CSS变量系统，建立完整的设计令牌体系。

#### 新增令牌分类

**间距令牌（Spacing）**

```css
--space-xs: 4px;    /* 内部紧凑间距 */
--space-sm: 8px;    /* 小间距 */
--space-md: 16px;   /* 中等间距 */
--space-lg: 24px;   /* 大间距 */
--space-xl: 32px;   /* 特大间距 */
--space-2xl: 48px;  /* 区块间距 */
```

**字体令牌（Typography）**

```css
/* 字体大小 */
--text-xs: 12px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 18px;
--text-2xl: 22px;
--text-3xl: 28px;
--text-4xl: 32px;

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* 行高 */
--leading-tight: 1.25;
--leading-normal: 1.6;
--leading-relaxed: 1.75;
```

**断点令牌（Breakpoints）** - 用于JS中媒体查询

```css
/* 仅作为参考，实际使用@media查询 */
--bp-xs: 480px;
--bp-sm: 768px;
--bp-md: 1024px;
--bp-lg: 1280px;
--bp-xl: 1600px;
```

**Z-index层级**

```css
--z-base: 0;
--z-dropdown: 100;
--z-sticky: 200;
--z-sidebar: 300;
--z-overlay: 400;
--z-modal: 500;
--z-toast: 600;
--z-tooltip: 700;
```

**动画令牌（Animation）**

```css
/* 时长 */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;

/* 缓动函数 */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Requirement: Grid系统重构

统一并优化现有的Grid布局系统。

#### Grid类名规范

```css
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

/* 响应式覆盖 */
@media (max-width: 1200px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .grid, .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .grid-4 { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}

@media (max-width: 480px) {
  .grid-4 { grid-template-columns: 1fr; }
}
```

### Requirement: 组件库一致性

确保所有组件遵循统一的设计规范。

#### 统一要求

1. **命名规范**：BEM方法论（block\_\_element--modifier）
2. **Props接口**：TypeScript严格类型定义
3. **事件处理**：统一的回调函数签名
4. **样式隔离**：CSS Modules或styled-components
5. **文档注释**：JSDoc描述组件用途和用法

***

## REMOVED Requirements

### Requirement: 旧版媒体查询分散定义

**原因**: 当前媒体查询分散在多个文件中，难以维护且容易冲突。
**迁移**: 统一集中管理，建立断点混入（mixin）或工具类。所有新增响应式样式必须使用统一的断点常量。

### Requirement: 固定的桌面优先设计思维

**原因**: 传统桌面优先导致移动端体验是"降级"而非"优化"。
**迁移**: 采用Mobile-First策略，基础样式针对移动端，通过min-width媒体查询增强桌面体验。

***

## Implementation Phases

### Phase 1: 基础设施（Week 1）

* [ ] 扩展设计令牌系统

* [ ] 建立响应式断点工具

* [ ] 重构Grid/Flexbox布局系统

* [ ] 创建Base组件（Button, Input, Text）

### Phase 2: 核心组件适配（Week 2）

* [ ] 导航系统（Sidebar → Mobile Drawer）

* [ ] 卡片组件（JobCard, StatCard, UserCard）

* [ ] 表单组件（Filter, Search, Form）

* [ ] 弹窗组件（Modal → Bottom Sheet）

### Phase 3: 页面级优化（Week 3）

* [ ] Jobs页面完全适配

* [ ] Match/Recommendations页面

* [ ] Favorites/User页面

* [ ] Login/Auth流程

### Phase 4: 增强功能（Week 4）

* [ ] 手势交互实现

* [ ] 性能监控与优化

* [ ] 无障碍审计修复

* [ ] 暗色模式最终验证

***

## Success Metrics

### 定量指标

* ✅ Lighthouse性能评分 > 90（移动端）

* ✅ Core Web Vitals全部达标（绿色）

* ✅ 触摸响应时间 < 100ms

* ✅ 页面大小 < 500KB（首屏gzip后）

* ✅ WCAG 2.1 AA合规率 100%

### 定性指标

* ✅ 用户可在单手操作下完成主要任务

* ✅ 视觉层次清晰，信息架构合理

* ✅ 跨设备体验一致且符合平台规范

* ✅ 无明显布局错乱或显示异常

***

## Testing Strategy

### 浏览器/设备测试矩阵

| 设备类型             | 测试设备/模拟器                      | 优先级 |
| ---------------- | ----------------------------- | --- |
| iOS Safari       | iPhone SE, 13 Pro, 14 Pro Max | P0  |
| Chrome Android   | Galaxy S22, Pixel 6, OnePlus  | P0  |
| iPadOS Safari    | iPad Air, iPad Pro            | P1  |
| 桌面Chrome         | Windows, macOS, Linux         | P1  |
| 桌面Firefox/Safari | 最新2个版本                        | P2  |

### 自动化测试

* **Visual Regression**: Percy或Chromatic截图对比

* **Responsive**: BrowserStack或LambdaTest云测试

* **Accessibility**: axe-core自动化扫描

* **Performance**: Lighthouse CI集成

### 手动测试用例集

1. 基础交互测试（50+用例）
2. 边界情况测试（极端数据、弱网络）
3. 真实用户场景模拟（任务完成度）

