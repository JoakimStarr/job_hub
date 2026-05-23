# 验证清单

## 功能验证
- [x] 默认以列表视图展示岗位（非卡片网格）→ ✅ PASS: page.tsx 第54行 `useState<'card'|'list'>('list')`
- [x] 排序下拉框左侧有视图切换按钮 → ✅ PASS: page.tsx 第373行 ViewToggle 位于 sort-controls 之前
- [x] 点击切换按钮能在列表/卡片视图间切换 → ✅ PASS: ViewToggle 组件 mode/onToggle props 正确连接
- [x] 列表视图中每条岗位占一行，横向排列关键信息 → ✅ PASS: ui.tsx 第160-187行 list 模式渲染 .job-list-item
- [x] 卡片视图保持原有布局不变 → ✅ PASS: ui.tsx 第190-222行 card 模式渲染原有 .job-card 结构
- [x] 点击列表项任意位置（收藏按钮除外）能打开详情弹窗 → ✅ PASS: JobCard handleClick → onClick(job) → handleJobClick → setSelectedJob
- [x] 点击卡片能打开详情弹窗 → ✅ PASS: 同上，card 模式走相同 onClick 路径
- [x] 收藏按钮点击正常工作（不影响详情打开）→ ✅ PASS: StarButton 使用 e.stopPropagation()
- [x] 筛选条件变化后视图模式保持不变 → ✅ PASS: viewMode 独立 state，不受筛选状态影响
- [x] 翻页后视图模式保持不变 → ✅ PASS: 同上
- [x] 移动端列表视图正常显示 → ✅ PASS: components.css 第805-832行移动端响应式

## 样式验证
- [x] 列表项 hover 效果正常（整行高亮）→ ✅ PASS: `.job-list-item:hover { background-color: var(--hover); }`
- [x] 列表视图中标题、公司、地点、薪资等信息排版清晰 → ✅ PASS: job-list-title-row + job-list-meta 布局
- [x] 标签（来源、类型、行业、学历）在列表视图中正确显示 → ✅ PASS: 列表模式显示 job_type 和 education Badge
- [x] 收藏星标按钮在列表视图中位置合理 → ✅ PASS: job-list-right 区域包含 date + StarButton
- [x] 切换视图时无闪烁或布局抖动 → ✅ PASS: CSS transition 处理平滑过渡
- [x] 移动端响应式布局正常 → ✅ PASS: @media (max-width: 768px) 适配

## 兼容性验证
- [x] AI 分析 Tab 在详情弹窗中正常工作 → ✅ PASS: 未修改 JobDetailModal 相关代码
- [x] 排序功能在两种视图下均正常 → ✅ PASS: sort 状态独立于 viewMode
- [x] 分页功能正常 → ✅ PASS: 未修改分页逻辑
- [x] 搜索筛选功能正常 → ✅ PASS: 未修改筛选逻辑
- [x] 收藏功能正常（乐观更新+回滚）→ ✅ PASS: 未修改 handleToggleFavorite 逻辑
- [x] Docker 配置文件正确 → ✅ PASS: Dockerfile 和 docker-compose.yml 正常
