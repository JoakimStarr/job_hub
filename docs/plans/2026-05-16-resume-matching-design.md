# 简历智能匹配系统设计文档

**日期**: 2026-05-16  
**版本**: v1.0  
**作者**: AI Assistant

## 目录

1. [系统架构](#系统架构)
2. [简历解析服务](#简历解析服务)
3. [匹配算法服务](#匹配算法服务)
4. [评分引擎与可视化报告](#评分引擎与可视化报告)
5. [API接口设计](#api接口设计)
6. [数据存储方案](#数据存储方案)
7. [前端组件设计](#前端组件设计)
8. [多语言支持](#多语言支持)
9. [实施计划](#实施计划)
10. [测试方案](#测试方案)

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  简历上传    │  │  匹配结果    │  │  可视化报告  │  │
│  │  组件        │  │  展示        │  │  组件        │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    API层 (Next.js API Routes)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ /api/resume  │  │ /api/match   │  │ /api/reports │  │
│  │   /parse     │  │   /jobs      │  │   /matching  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   核心服务层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 简历解析服务 │  │ 匹配算法服务 │  │ 评分引擎服务 │  │
│  │ ResumeParser │  │ MatchEngine  │  │ ScoreEngine  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   数据层                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  jobs.db     │  │ user_profiles│  │ skill_dict   │  │
│  │  (岗位数据)  │  │  (用户画像)  │  │  (技能词典)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 核心模块

1. **简历解析服务**: 提取技能、教育、经历等关键信息
2. **匹配算法服务**: 多维度匹配（技能、专业、地点、行业等）
3. **评分引擎服务**: 计算匹配度分数（0-100分）
4. **可视化报告**: 生成匹配报告和改进建议

---

## 简历解析服务

### 解析流程

```
PDF简历 → 文本提取 → 结构化解析 → 用户画像生成
```

### 核心功能模块

#### 1. 文本提取层

- 支持PDF、Word、TXT格式
- 使用 `pdf-parse` (Node.js) 或 `PyPDF2` (Python)
- 保留文本结构和格式信息

#### 2. 信息提取层

使用正则表达式 + 关键词匹配

```typescript
interface ResumeProfile {
  // 基本信息
  name: string;
  phone: string;
  email: string;
  
  // 教育背景
  education: {
    school: string;
    major: string;
    degree: string; // 本科/硕士/博士
    graduationYear: number;
  }[];
  
  // 技能列表
  skills: string[]; // ["Python", "Excel", "Wind", "数据分析"]
  
  // 实习经历
  internships: {
    company: string;
    position: string;
    duration: string;
    description: string;
  }[];
  
  // 项目经历
  projects: {
    name: string;
    role: string;
    description: string;
  }[];
  
  // 证书
  certifications: string[]; // ["CFA", "CPA", "FRM"]
}
```

#### 3. 智能识别层

- 使用预定义的技能词典（金融、技术、语言等）
- 识别专业关键词（金融工程、数量经济学等）
- 提取院校信息（匹配国内高校名单）

### 技术选型

- Node.js + TypeScript（前端API层）
- 正则表达式 + 字典匹配（轻量级，无需AI模型）
- 可选：集成第三方AI服务（如智谱AI、硅基流动）提升准确度

---

## 匹配算法服务

### 多维度匹配算法

```typescript
interface MatchScore {
  total: number; // 总分 0-100
  breakdown: {
    skills: number;      // 技能匹配 0-30分
    education: number;   // 学历匹配 0-20分
    major: number;       // 专业匹配 0-15分
    location: number;    // 地点匹配 0-10分
    experience: number;  // 经验匹配 0-15分
    industry: number;    // 行业匹配 0-10分
  };
  matchedFields: string[];  // 匹配的字段
  gaps: string[];           // 能力缺口
  risks: string[];          // 风险提示
}
```

### 匹配策略

#### 1. 技能匹配（30分）

```
用户技能: ["Python", "Excel", "Wind", "数据分析"]
岗位要求: ["Python", "SQL", "数据分析", "机器学习"]

匹配度 = (交集技能数 / 岗位要求技能数) * 30
匹配技能: ["Python", "数据分析"] → 2/4 * 30 = 15分
缺失技能: ["SQL", "机器学习"]
```

#### 2. 学历匹配（20分）

```
用户学历: 硕士
岗位要求: 硕士

完全匹配 → 20分
高于要求 → 15分（可能overqualified）
低于要求 → 0-10分（根据差距）
```

#### 3. 专业匹配（15分）

```
用户专业: ["金融工程", "数量经济学"]
岗位要求: ["金融学", "经济学", "统计学"]

使用专业相似度矩阵计算匹配度
```

#### 4. 地点匹配（10分）

```
用户意向: ["重庆", "成都"]
岗位地点: "成都"

完全匹配 → 10分
同省份 → 7分
同区域 → 5分
不匹配 → 0分
```

#### 5. 经验匹配（15分）

```
用户经验: "有实习经历"
岗位要求: "有实习经历优先"

完全匹配 → 15分
部分匹配 → 8分
不匹配 → 0分
```

#### 6. 行业匹配（10分）

```
用户意向: ["证券"]
岗位行业: "证券/投行"

完全匹配 → 10分
相关行业 → 7分
不相关 → 0分
```

### 优化策略

- 使用加权平均，权重可配置
- 支持模糊匹配（如"金融工程"匹配"金融学"）
- 考虑技能重要性（核心技能权重更高）

---

## 评分引擎与可视化报告

### 评分引擎设计

```typescript
class ScoreEngine {
  // 计算总分
  calculateTotalScore(breakdown: MatchBreakdown): number {
    const weights = {
      skills: 0.30,      // 30%
      education: 0.20,   // 20%
      major: 0.15,       // 15%
      location: 0.10,    // 10%
      experience: 0.15,  // 15%
      industry: 0.10,    // 10%
    };
    
    return Object.entries(breakdown)
      .reduce((sum, [key, value]) => sum + value * weights[key], 0);
  }
  
  // 生成匹配等级
  getMatchLevel(score: number): string {
    if (score >= 85) return "冲刺岗";  // 高度匹配
    if (score >= 70) return "匹配岗";  // 较好匹配
    if (score >= 55) return "潜力岗";  // 有潜力
    return "挑战岗";                   // 需要努力
  }
  
  // 生成改进建议
  generateSuggestions(profile: ResumeProfile, job: JobItem): string[] {
    const suggestions = [];
    
    if (this.hasSkillGap(profile, job)) {
      suggestions.push("建议补充相关技能证书或项目经历");
    }
    
    if (this.hasExperienceGap(profile, job)) {
      suggestions.push("建议增加相关实习或项目经验");
    }
    
    return suggestions;
  }
}
```

### 可视化报告设计

#### 1. 匹配度雷达图

```
技能匹配度: 80%
学历匹配度: 100%
专业匹配度: 90%
地点匹配度: 100%
经验匹配度: 70%
行业匹配度: 100%
```

#### 2. 匹配详情卡片

```
┌────────────────────────────────┐
│ 匹配度: 88分 - 冲刺岗          │
├────────────────────────────────┤
│ ✅ 匹配项:                     │
│   • 学历: 硕士 (完全匹配)      │
│   • 专业: 金融工程 (高度相关)  │
│   • 技能: Python, 数据分析     │
│                                │
│ ⚠️  能力缺口:                  │
│   • 缺少SQL技能                │
│   • 缺少机器学习经验           │
│                                │
│ 💡 改进建议:                   │
│   • 学习SQL数据库操作          │
│   • 参加机器学习项目           │
└────────────────────────────────┘
```

#### 3. 简历诊断报告

```
简历诊断分: 67/100

优势亮点:
• 院校背景: 东北财经大学
• 专业明确: 金融工程、数量经济学
• 技能丰富: Python、Excel、Wind

风险提示:
• 缺少明确实习单位描述
• 项目经历信息较少

优化建议:
• 补充项目经历和量化成果
• 考虑考取CFA/FRM等证书
```

### 用户体验优化

- 实时匹配度预览（上传简历后立即显示）
- 一键生成匹配报告
- 支持导出PDF格式报告
- 历史匹配记录查看

---

## API接口设计

### 1. 简历解析接口

```typescript
POST /api/resume/parse
Request: { file: File }
Response: {
  profile: ResumeProfile;
  confidence: number; // 解析置信度 0-1
  warnings: string[]; // 解析警告
}
```

### 2. 岗位匹配接口

```typescript
POST /api/match/jobs
Request: {
  profile: ResumeProfile;
  filters?: {
    location?: string[];
    jobType?: string[];
    industry?: string[];
    maxResults?: number;
  };
}
Response: {
  matches: {
    job: JobItem;
    score: MatchScore;
    rank: number;
  }[];
  total: number;
  processingTime: number;
}
```

### 3. 单岗位匹配接口

```typescript
POST /api/match/job/:id
Request: { profile: ResumeProfile }
Response: {
  score: MatchScore;
  recommendation: string; // 推荐等级
  suggestions: string[];  // 改进建议
}
```

### 4. 匹配报告生成接口

```typescript
POST /api/reports/matching
Request: {
  profile: ResumeProfile;
  jobId: number;
}
Response: {
  reportUrl: string; // PDF报告下载链接
  reportData: object; // 报告数据
}
```

### 5. 简历诊断接口

```typescript
POST /api/resume/diagnose
Request: { profile: ResumeProfile }
Response: {
  score: number; // 简历诊断分 0-100
  highlights: string[]; // 优势亮点
  risks: string[]; // 风险提示
  gaps: string[]; // 主要缺口
  suggestions: string[]; // 优化建议
}
```

---

## 数据存储方案

### 1. 用户画像存储（已存在）

```
data/user_profiles/records/{user_id}.json
{
  id: string;
  profile: ResumeProfile;
  created_at: string;
  updated_at: string;
}
```

### 2. 匹配历史存储（新增表）

```sql
CREATE TABLE match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  job_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  match_level TEXT NOT NULL,
  matched_fields TEXT, -- JSON数组
  gaps TEXT, -- JSON数组
  suggestions TEXT, -- JSON数组
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
```

### 3. 技能词典存储（新增JSON文件）

```
data/skill_dictionary.json
{
  "finance": ["Python", "Excel", "Wind", "SQL", "数据分析", ...],
  "tech": ["Python", "Java", "JavaScript", "React", ...],
  "certifications": ["CFA", "CPA", "FRM", "ACCA", ...],
  "majors": {
    "金融学": ["金融工程", "数量经济学", "投资学", ...],
    "经济学": ["经济学", "统计学", "数量经济学", ...]
  }
}
```

### 4. 专业相似度矩阵（新增JSON文件）

```
data/major_similarity.json
{
  "金融工程": {
    "金融学": 0.9,
    "经济学": 0.7,
    "统计学": 0.8,
    "数量经济学": 0.95
  }
}
```

### 性能优化

- 使用缓存存储常用技能词典
- 批量匹配时使用异步处理
- 匹配结果缓存（避免重复计算）

---

## 前端组件设计

### 1. 简历上传组件 (`ResumeUploader.tsx`)

```tsx
<ResumeUploader
  onParseSuccess={(profile) => setProfile(profile)}
  onParseError={(error) => showError(error)}
  acceptedFormats={['.pdf', '.doc', '.docx', '.txt']}
  maxSize={5} // 5MB
/>
```

**功能**:
- 拖拽上传
- 文件格式验证
- 上传进度显示
- 解析结果预览
- 手动编辑修正

### 2. 匹配结果展示组件 (`MatchResults.tsx`)

```tsx
<MatchResults
  matches={matchResults}
  onViewDetail={(jobId) => router.push(`/jobs/${jobId}`)}
  onExportReport={(jobId) => generateReport(jobId)}
/>
```

**功能**:
- 匹配度排序
- 匹配度可视化（进度条、雷达图）
- 匹配详情展开
- 一键投递按钮
- 导出报告按钮

### 3. 匹配详情卡片组件 (`MatchDetailCard.tsx`)

```tsx
<MatchDetailCard
  job={job}
  score={score}
  matchedFields={matchedFields}
  gaps={gaps}
  suggestions={suggestions}
/>
```

**功能**:
- 匹配度分数显示
- 匹配项高亮
- 能力缺口提示
- 改进建议展示
- 风险警告

### 4. 简历诊断组件 (`ResumeDiagnosis.tsx`)

```tsx
<ResumeDiagnosis
  profile={profile}
  onImprove={(suggestions) => showImproveModal(suggestions)}
/>
```

**功能**:
- 简历诊断分数
- 优势亮点展示
- 风险提示列表
- 优化建议列表
- 一键优化按钮

### 用户体验流程

```
步骤1: 上传简历
  ┌─────────────────┐
  │  拖拽或点击上传  │
  │  PDF/Word/TXT   │
  └─────────────────┘
         ↓
步骤2: 解析简历
  ┌─────────────────┐
  │  正在解析简历... │
  │  ████████░░ 80% │
  └─────────────────┘
         ↓
步骤3: 确认画像
  ┌─────────────────┐
  │  基本信息: ✓    │
  │  教育背景: ✓    │
  │  技能列表: ✓    │
  │  实习经历: ⚠️   │
  │  [手动编辑]     │
  └─────────────────┘
         ↓
步骤4: 开始匹配
  ┌─────────────────┐
  │  匹配条件设置:   │
  │  地点: 重庆     │
  │  类型: 实习     │
  │  行业: 证券     │
  │  [开始匹配]     │
  └─────────────────┘
         ↓
步骤5: 查看结果
  ┌─────────────────┐
  │  找到 12 个匹配  │
  │  冲刺岗: 3个    │
  │  匹配岗: 5个    │
  │  潜力岗: 4个    │
  └─────────────────┘
         ↓
步骤6: 查看详情
  ┌─────────────────┐
  │  匹配度: 88分   │
  │  匹配项: ...    │
  │  缺口: ...      │
  │  建议: ...      │
  │  [投递] [报告]  │
  └─────────────────┘
```

### 交互优化

- 实时反馈（上传进度、解析状态）
- 智能提示（缺少字段提醒）
- 快捷操作（一键填充、批量投递）
- 历史记录（查看之前匹配结果）

---

## 多语言支持

### 国际化架构设计

```typescript
// 1. 语言配置文件结构
/locales
  /zh-CN
    common.json      // 通用文本
    resume.json      // 简历相关
    matching.json    // 匹配相关
    jobs.json        // 岗位相关
  /en-US
    common.json
    resume.json
    matching.json
    jobs.json

// 2. 使用next-intl库
import { NextIntlClientProvider } from 'next-intl';
import { useRouter } from 'next/navigation';

export default function RootLayout({ children }) {
  const locale = useLocale();
  const messages = useMessages();
  
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 核心功能模块

#### 1. 语言切换组件

```tsx
<LanguageSwitcher
  currentLocale="zh-CN"
  onSwitch={(locale) => changeLocale(locale)}
/>
```

**功能**:
- 下拉菜单选择语言
- 自动保存用户偏好
- 实时切换无需刷新

#### 2. 文本翻译示例

```json
// locales/zh-CN/resume.json
{
  "upload.title": "上传简历",
  "upload.drag": "拖拽或点击上传",
  "parse.success": "简历解析成功",
  "match.score": "匹配度",
  "match.level.sprint": "冲刺岗",
  "match.level.match": "匹配岗",
  "match.level.potential": "潜力岗",
  "match.level.challenge": "挑战岗"
}

// locales/en-US/resume.json
{
  "upload.title": "Upload Resume",
  "upload.drag": "Drag or click to upload",
  "parse.success": "Resume parsed successfully",
  "match.score": "Match Score",
  "match.level.sprint": "Sprint Position",
  "match.level.match": "Match Position",
  "match.level.potential": "Potential Position",
  "match.level.challenge": "Challenge Position"
}
```

#### 3. 动态内容翻译

```typescript
// 使用翻译函数
import { useTranslations } from 'next-intl';

function MatchResultCard({ score }) {
  const t = useTranslations('matching');
  
  const getLevelText = (level: string) => {
    return t(`match.level.${level}`);
  };
  
  return (
    <div>
      <h3>{t('match.score')}: {score}</h3>
      <p>{getLevelText(getMatchLevel(score))}</p>
    </div>
  );
}
```

### 技术实现

#### 1. 安装依赖

```bash
npm install next-intl
```

#### 2. 配置next-intl

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

export default withNextIntl({
  // your next config
});
```

#### 3. 中间件配置

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['zh-CN', 'en-US'],
  defaultLocale: 'zh-CN'
});

export const config = {
  matcher: ['/', '/(zh-CN|en-US)/:path*']
};
```

### 翻译范围

- ✅ 界面文本（按钮、标签、提示）
- ✅ 匹配等级名称
- ✅ 错误消息
- ✅ 表单验证提示
- ✅ 邮件通知模板
- ⚠️ 岗位描述（保持原文）
- ⚠️ 简历内容（保持原文）

### 用户偏好存储

```typescript
// 存储在localStorage和用户配置中
localStorage.setItem('locale', 'en-US');

// 用户配置表
ALTER TABLE users ADD COLUMN preferred_locale TEXT DEFAULT 'zh-CN';
```

---

## 实施计划

### 分阶段实施

```
第一阶段：基础架构（1-2天）
├── 创建数据表和词典文件
├── 搭建API路由框架
└── 配置多语言支持

第二阶段：简历解析（2-3天）
├── 实现PDF/Word解析
├── 开发信息提取模块
├── 构建技能词典
└── 测试解析准确度

第三阶段：匹配算法（2-3天）
├── 实现多维度匹配算法
├── 开发评分引擎
├── 优化匹配性能
└── 测试匹配准确度

第四阶段：前端界面（2-3天）
├── 开发简历上传组件
├── 实现匹配结果展示
├── 创建可视化报告
└── 集成多语言切换

第五阶段：测试优化（1-2天）
├── 功能测试
├── 性能测试
├── 用户体验测试
└── Bug修复和优化
```

---

## 测试方案

### 1. 简历解析测试

```typescript
测试用例：
- 标准格式简历（PDF）
- 非标准格式简历
- 多语言简历（中英文）
- 缺失字段简历

验证指标：
- 信息提取准确率 > 90%
- 技能识别召回率 > 85%
- 解析时间 < 3秒
```

### 2. 匹配算法测试

```typescript
测试数据：
- 100个真实简历
- 1000个真实岗位

验证指标：
- 匹配准确率 > 85%（人工评估）
- 排序相关性 > 0.8（NDCG）
- 响应时间 < 500ms（单个匹配）
```

### 3. 性能测试

```typescript
场景：
- 单用户上传简历并匹配
- 10个用户并发匹配
- 100个岗位批量匹配

指标：
- 平均响应时间 < 2秒
- 并发成功率 > 95%
- 内存占用 < 200MB
```

### 4. 用户体验测试

```typescript
测试流程：
1. 上传简历 → 解析 → 确认画像
2. 设置匹配条件 → 开始匹配
3. 查看匹配结果 → 查看详情
4. 导出匹配报告

评估指标：
- 任务完成率 > 90%
- 用户满意度 > 4.0/5.0
- 错误率 < 5%
```

### 验收标准

#### 功能完整性

- ✅ 简历解析功能正常
- ✅ 匹配算法准确度高
- ✅ 可视化报告清晰
- ✅ 多语言切换流畅

#### 性能指标

- ✅ 简历解析 < 3秒
- ✅ 单岗位匹配 < 500ms
- ✅ 批量匹配 < 5秒
- ✅ 页面加载 < 2秒

#### 用户体验

- ✅ 界面友好易用
- ✅ 操作流程顺畅
- ✅ 错误提示清晰
- ✅ 帮助文档完善

---

## 部署方案

1. 开发环境测试 → 修复Bug
2. 预发布环境验证 → 性能调优
3. 生产环境部署 → 监控告警
4. 用户反馈收集 → 持续优化

---

## 附录

### 技术栈

- **前端**: Next.js 15, React 18, TypeScript
- **后端**: Next.js API Routes, Node.js
- **数据库**: SQLite (better-sqlite3)
- **国际化**: next-intl
- **PDF解析**: pdf-parse
- **可视化**: Chart.js / Recharts

### 参考资料

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)

---

**文档版本历史**:
- v1.0 (2026-05-16): 初始设计文档
