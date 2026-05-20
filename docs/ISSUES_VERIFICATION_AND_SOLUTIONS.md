# Job Hub 问题验证与解决方案

> 验证日期：2026-05-20 | 基于 PROJECT_ANALYSIS_REPORT.md 逐项核实

---

## 验证结果总览

| 编号 | 问题 | 报告状态 | 验证结果 | 是否修复 |
|------|------|----------|----------|----------|
| C1 | SQLite WAL 不一致 | Critical | ✅ 确认 | 需修复 |
| C2 | Docker 缺少爬虫 | Critical | ✅ 确认 | 需修复 |
| C3 | 双爬虫系统 | Critical | ✅ 确认 | 需修复 |
| H1 | .env 未 gitignore | High | ✅ 确认 | **必须立即修复** |
| H2 | 硬编码绝对路径 | High | ✅ 确认 | 需修复 |
| H3 | PID 文件机制失效 | High | ✅ 确认 | 需修复 |
| H4 | API 路由缺认证 | High | ✅ 确认 | 需评估 |
| H5 | 登录无速率限制 | High | ✅ 确认 | 需修复 |
| M1 | 前端Logger仅控制台 | Medium | ✅ 确认 | 建议修复 |
| M2 | Zustand无持久化 | Medium | ✅ 确认 | 建议修复 |
| M3 | getFilterOptions性能 | Medium | ✅ 确认(有缓存) | 数据量大时需优化 |
| M4 | smartedu/neu配置 | Medium | ⚠️ 部分确认 | smartedu无独立策略 |
| M5 | 双份SOURCE_NAME_MAP | Medium | ✅ 确认 | 建议统一 |
| M6 | dufe引用cufe | Medium | ✅ 确认(已处理) | 无需修复 |
| M7 | HTTP超时不一致 | Medium | ✅ 确认 | 建议统一 |
| L1 | trash目录 | Low | ✅ 确认 | 可清理 |
| L2 | .dockerignore排除md | Low | ✅ 确认 | 无需修复 |
| L3 | scripts脚本未使用 | Low | ✅ 确认 | 建议归类 |
| L4 | __pycache__提交 | Low | ✅ 确认 | 需修复 |
| L5 | Alpine版本硬编码 | Low | ✅ 确认 | 建议修复 |
| S1 | .env泄露风险 | Critical | ✅ 确认 | **必须立即修复** |
| S2 | 登录无速率限制 | High | ✅ 确认 | 需修复 |
| S5 | SameSite=lax | Medium | ✅ 确认 | 安全可接受 |
| S6 | SHA256非bcrypt | Medium | ✅ 确认 | 建议升级 |
| P1 | getFilterOptions全表扫描 | High | ✅ 确认 | 需优化 |
| P2 | db-utils WAL未启用 | High | ✅ 确认 | 需修复 |
| P4 | 浏览器实例管理 | Medium | ✅ 确认(browser_wrapper) | 需验证 |
| P5 | visited_urls无限增长 | Medium | ✅ 确认(有上限) | 部分已处理 |

---

## 🔴 严重问题 (Critical) 详细验证与解决方案

### C1. SQLite WAL 模式不一致

**验证结果**: ✅ 确认

**证据**:
- [db-utils.ts:72-77](file:///home/joakim/Project/job_hub/src/lib/db-utils.ts#L72-L77): `getDb()` 创建连接时只设置 `{ readonly: false, fileMustExist: false }`，未启用WAL
- [auth-db.ts:111](file:///home/joakim/Project/job_hub/src/lib/auth-db.ts#L111): `connect()` 中启用 `PRAGMA journal_mode = WAL` 和 `PRAGMA synchronous = NORMAL`
- [database.py:71-74](file:///home/joakim/Project/job_hub/src/spiders/database.py#L71-L74): Python爬虫启用 WAL + synchronous=NORMAL + cache_size=-64000 + temp_store=MEMORY

**影响**:
- `getDb()` 创建的连接使用默认 DELETE 日志模式
- 当Python爬虫写入jobs表时，Next.js的 `getDb()` 读操作可能被阻塞(SQLITE_BUSY)
- 同一进程内 `auth-db.ts` 使用WAL，`db-utils.ts` 不使用WAL，造成两个不同journal文件

**解决方案**:

```typescript
// db-utils.ts getDb() 函数中添加:
export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { readonly: false, fileMustExist: false });
    // 启用 WAL 模式提升并发性能
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('busy_timeout = 5000');  // 5秒超时等待
  }
  return dbInstance;
}
```

**替代方案**（长期）:
1. 引入写入队列（如 better-queue），串行化写入操作
2. 考虑迁移到 PostgreSQL 彻底解决并发问题
3. 爬虫写入前检查是否有读操作在进行

---

### C2. Docker 部署缺少爬虫支持

**验证结果**: ✅ 确认

**证据**:
- [Dockerfile](file:///home/joakim/Project/job_hub/Dockerfile): 基于 `node:20-alpine`，仅安装 Node.js 相关依赖
- [docker-compose.yml](file:///home/joakim/Project/job_hub/docker-compose.yml#L17-L62): 只有一个 `finintern-next` 服务
- [DEPLOYMENT.md](file:///home/joakim/Project/job_hub/DEPLOYMENT.md) 明确指出 "爬虫**不应该**打包到 Docker 镜像中"
- `init_db.py` 在宿主机运行，Docker 中未使用

**影响**:
- Docker 容器中无法运行任何爬虫
- 数据只能通过宿主机手动运行爬虫来更新
- 数据库通过 `./data:/app/data` volume 共享，但爬虫路径不一致

**解决方案**:

**方案A: 独立爬虫服务（推荐）**
```yaml
# docker-compose.yml 添加:
services:
  finintern-next:
    # ... 现有配置 ...
  
  finintern-spider:
    build:
      context: .
      dockerfile: Dockerfile.spider
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - DATABASE_PATH=/app/data/jobs.db
    command: python -m src.spiders.run --sources sufe zuel cufe dufe swufe
    restart: "no"
```

```dockerfile
# Dockerfile.spider
FROM python:3.13-alpine
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium --with-deps
COPY src/spiders/ ./src/spiders/
CMD ["python", "-m", "src.spiders.run"]
```

**方案B: 宿主机 Cron 定时运行（当前临时方案）**
```bash
# crontab -e
0 6 * * * cd /home/joakim/Project/job_hub && python -m src.spiders.run --sources sufe zuel cufe dufe swufe
0 18 * * * cd /home/joakim/Project/job_hub && python -m src.spiders.run --sources uibe jxufe smartedu neu
```

---

### C3. 两套爬虫系统表结构不一致

**验证结果**: ✅ 确认

**证据**:
- [database.py:89-116](file:///home/joakim/Project/job_hub/src/spiders/database.py#L89-L116): 主爬虫 jobs 表有完整字段
- [lite_crawler.py:447-466](file:///home/joakim/Project/job_hub/lite_crawler.py#L447-L466): lite_crawler 的 jobs 表缺失字段

**字段差异对比**:

| 字段 | database.py | lite_crawler.py |
|------|-------------|-----------------|
| experience | ✅ | ❌ |
| tags | ✅ | ❌ |
| category | ✅ | ❌ |
| is_favorite | ✅ | ❌ |
| is_read | ✅ | ❌ |
| content_hash | ✅ | ❌ |
| updated_at | ✅ | ❌ |
| deadline | ✅ | ❌ |

**影响**:
- 先运行 lite_crawler 创建表，再用主爬虫写入 → 字段缺失报错
- 先运行主爬虫创建表，再用 lite_crawler 写入 → 缺少字段数据丢失

**解决方案**:

**方案A: lite_crawler 复用 database.py（推荐）**
```python
# lite_crawler.py 修改为:
# 删除 init_database() 中的 CREATE TABLE
# 改为:
import sys
sys.path.insert(0, str(Path(__file__).parent / "src" / "spiders"))
from database import LocalDatabase

def init_database():
    """初始化数据库 - 复用主爬虫的表结构和索引"""
    import sqlite3
    import asyncio
    
    # 使用主爬虫的 LocalDatabase 初始化
    async def _init():
        db = LocalDatabase()
        await db.connect()
        await db.close()
    
    asyncio.run(_init())
```

**方案B: 统一 lite_crawler 为精简模式**
```python
# lite_crawler.py init_database() 补全字段:
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    salary TEXT,
    education TEXT,
    requirements TEXT,
    description TEXT,
    publish_date TEXT,
    source TEXT NOT NULL,
    university TEXT,
    source_url TEXT UNIQUE,
    apply_url TEXT,
    job_type TEXT,
    industry TEXT,
    experience TEXT DEFAULT '',      -- 新增
    tags TEXT DEFAULT '',            -- 新增
    category TEXT DEFAULT '',        -- 新增
    is_favorite INTEGER DEFAULT 0,   -- 新增
    is_read INTEGER DEFAULT 0,       -- 新增
    content_hash TEXT,               -- 新增
    deadline TEXT DEFAULT '',        -- 新增
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- 新增
)
```

---

## 🟠 高危问题 (High) 详细验证与解决方案

### H1. `.env` 文件不在 `.gitignore` 中

**验证结果**: ✅ 确认 — **严重安全漏洞**

**证据**:
- [.gitignore](file:///home/joakim/Project/job_hub/.gitignore) 内容:
```
.next
node_modules
.env.local
*.tsbuildinfo
```
- `.env.local` 被排除但 `.env` 未被排除
- [.env](file:///home/joakim/Project/job_hub/.env) 文件存在，包含:
  - `ADMIN_TOKEN=finintern-admin-2024-change-me`
  - `OPERATOR_TOKEN=finintern-operator-2024-change-me`
  - `VIEWER_TOKEN=finintern-viewer-2024-change-me`
  - `AUTH_SALT=your-random-salt-at-least-32-characters-long`
  - 数据库路径配置

**立即风险**: 如果已提交到 git 仓库，任何人可以获取这些 token

**解决方案**:

**第一步: 立即添加到 .gitignore**
```
.next
node_modules
.env.local
.env          # 新增
*.tsbuildinfo
__pycache__/  # 建议同时添加
```

**第二步: 检查是否已提交到git**
```bash
git log --all --full-history -- .env
```

**第三步: 如果已提交，必须:**
1. 从 git 历史中移除（`git filter-branch` 或 `BFG Repo-Cleaner`）
2. **轮换所有密钥**: 修改 .env 中所有 token/salt 的值
3. 通知所有有仓库访问权限的人

---

### H2. 硬编码绝对路径

**验证结果**: ✅ 确认

**证据**:
- [crawler/status/route.ts:23](file:///home/joakim/Project/job_hub/src/app/api/crawler/status/route.ts#L23):
  ```typescript
  const pidFile = '/home/joakim/Project/job_hub/.crawler.pid';
  ```

**影响**: Docker容器、其他服务器、其他开发者机器上此路径不存在，`existsSync` 永远返回false

**解决方案**:
```typescript
// 方案1: 使用相对路径
import path from 'path';
const pidFile = path.join(process.cwd(), '.crawler.pid');

// 方案2: 使用环境变量（更灵活）
const pidFile = process.env.CRAWLER_PID_FILE || path.join(process.cwd(), '.crawler.pid');

// 方案3: 更健壮的实现 - 通过数据库状态表判断
// 在 crawl_logs 表中记录运行状态，而不是依赖PID文件
```

---

### H3. 爬虫状态API机制完全失效

**验证结果**: ✅ 确认 — **联动断裂**

**证据**:
- [crawler/status/route.ts:23-28](file:///home/joakim/Project/job_hub/src/app/api/crawler/status/route.ts#L23-L28): 检查 `.crawler.pid` 文件
- [run.py](file:///home/joakim/Project/job_hub/src/spiders/run.py): 整个文件都没有写入 PID 文件的代码
- [crawler.py](file:///home/joakim/Project/job_hub/src/spiders/crawler.py): 同样没有写入 PID 文件
- 前端 `/crawler` 页面永远显示 "爬虫当前未运行"

**影响**:
- 前端爬虫管理页面完全无法得知爬虫真实状态
- 用户可能以为爬虫没运行而重复启动
- 无法判断爬虫是否崩溃、完成或正在运行

**解决方案**:

**方案A: 基于数据库状态表（推荐）**
```python
# crawler.py 中添加状态记录
class AsyncMultiCrawler:
    async def crawl_all_parallel(self, ...):
        try:
            # 写入状态: running
            await self.db.log_crawl_status('running', sources)
            
            results = ...  # 实际爬取
            
            # 写入状态: completed
            await self.db.log_crawl_status('completed', sources, results)
        except Exception as e:
            # 写入状态: error
            await self.db.log_crawl_status('error', sources, error=str(e))
```

```typescript
// crawler/status/route.ts 改造
export async function GET() {
  const db = getDb();
  const latest = db.prepare(`
    SELECT * FROM crawl_logs ORDER BY start_time DESC LIMIT 1
  `).get();
  
  if (latest && latest.status === 'running') {
    // 判断是否超时（如果超过预期时间则视为异常退出）
    return { is_running: true, status: 'running', ... };
  }
  return { is_running: false, status: 'idle', ... };
}
```

**方案B: 写入PID文件（简单但不推荐用于Docker）**
```python
# run.py main() 中添加:
import os, atexit

PID_FILE = Path(__file__).parent.parent.parent / ".crawler.pid"

def write_pid():
    PID_FILE.write_text(str(os.getpid()))

def remove_pid():
    if PID_FILE.exists():
        PID_FILE.unlink()

write_pid()
atexit.register(remove_pid)
```

---

### H4. API 路由认证覆盖不完整

**验证结果**: ✅ 确认

**证据**: 以下路由**没有**认证检查:
- `/api/jobs` GET - 岗位列表公开访问
- `/api/jobs/[id]` GET/PUT - 岗位详情和更新
- `/api/jobs/search` GET - 搜索
- `/api/jobs/filters` GET - 筛选选项
- `/api/jobs/favorites` GET - 收藏列表
- `/api/jobs/[id]/favorite` POST - 收藏操作
- `/api/jobs/[id]/ai-analysis` GET - AI分析
- `/api/crawler/sources` GET - 数据源列表
- `/api/crawler/status` GET - 爬虫状态
- `/api/crawler/logs` GET - 爬虫日志

而以下路由**有**认证:
- `/api/auth/me` - Cookie认证
- `/api/auth/logout` - Cookie认证
- `/api/match/*` - Cookie认证
- `/api/recommendations/*` - Cookie认证
- `/api/resume/*` - Cookie认证
- `/api/system/*` - Cookie认证
- `/api/stats/*` - Cookie认证

**影响评估**: 
- 岗位浏览类API（jobs/search/list）公开访问是合理的设计选择
- 收藏操作（favorite）应该是需要登录的用户行为
- 爬虫管理类（crawler/*）应该仅管理员可访问

**解决方案**:

```typescript
// src/lib/auth-server.ts 中添加中间件
export async function requireAuth(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  if (!sessionToken) {
    return NextResponse.json(
      { success: false, error: '请先登录', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  // 验证 session
  const authDb = getAuthDb();
  const result = authDb.validateSession(sessionToken);
  if (!result.valid) return /* 401 */;
  return null; // 认证通过
}

export async function requireRole(request: NextRequest, role: string) {
  const sessionToken = request.cookies.get('session_token')?.value;
  // 验证session + 角色检查
}
```

**建议的认证策略**:

| 路由类别 | 认证要求 | 原因 |
|----------|----------|------|
| 岗位浏览(/api/jobs GET) | 无需认证 | 公开资源 |
| 收藏操作(/api/jobs/*/favorite) | 需登录 | 用户行为 |
| 爬虫管理(/api/crawler/*) | 需管理员 | 系统管理 |
| 简历匹配(/api/match/*) | 需登录 | 用户数据 |
| AI服务(/api/recommendations/*) | 需登录 | 资源消耗 |
| 系统管理(/api/system/*) | 需管理员 | 敏感配置 |

---

### H5. 登录接口缺少速率限制

**验证结果**: ✅ 确认

**证据**:
- [login/route.ts:28-91](file:///home/joakim/Project/job_hub/src/app/api/auth/login/route.ts#L28-L91): 无任何速率限制
- 虽然有 `auth-db.ts` 账户锁定（MAX_LOGIN_ATTEMPTS=5, LOGIN_LOCKOUT_MINUTES=15），但是基于账户而非IP

**攻击场景**: 攻击者可以用不同用户名轮流尝试，绕过账户锁定

**解决方案**:

```typescript
// 方案1: 内存级IP限流（简单，适用于单实例）
const ipAttempts = new Map<string, { count: number; resetTime: number }>();

export async function POST(request: NextRequest) {
  // 获取客户端IP
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 'unknown';
  
  // IP级别限流: 10次/分钟
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (record && now < record.resetTime && record.count >= 10) {
    return NextResponse.json(
      { success: false, error: '请求过于频繁，请稍后再试', errorCode: 'RATE_LIMITED' },
      { status: 429 }
    );
  }
  
  if (!record || now >= record.resetTime) {
    ipAttempts.set(ip, { count: 1, resetTime: now + 60000 });
  } else {
    record.count++;
  }
  
  // ... 继续原有登录逻辑
}
```

```typescript
// 方案2: 基于数据库的全局限流（适合多实例/生产环境）
// 在 auth-db.ts 中添加:
function checkIpRateLimit(db: Database.Database, ip: string): boolean {
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM login_logs 
    WHERE ip_address = ? AND created_at > ? AND action = 'failed'
  `).get(ip, oneMinuteAgo) as { count: number };
  return count.count < 10;
}
```

---

## 🟡 中等问题 (Medium) 详细验证与解决方案

### M1. 前端 Logger 只输出到控制台

**验证结果**: ✅ 确认

**证据**:
- [logger.ts](file:///home/joakim/Project/job_hub/src/lib/logger.ts): 使用 console.log/warn/error
- 对比 [logger.py](file:///home/joakim/Project/job_hub/src/spiders/logger.py): loguru 日志有文件轮转、压缩、格式配置

**解决方案**:

```typescript
// 方案1: 使用 pino（轻量，适合 Serverless/Edge）
import pino from 'pino';

const logger = pino({
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
  },
  level: process.env.LOG_LEVEL || 'info',
});

// 方案2: 使用 winston（功能完整，适合传统服务器）
// 需要安装: npm install winston
```

**但考虑到 Next.js 的 Edge 兼容性，建议保持 console 但增加日志收集方案**：
- 生产环境使用 Docker 的 `docker logs` 收集
- 或使用 `process.stdout.write` + 日志文件重定向

---

### M2. Zustand Store 缺少持久化

**验证结果**: ✅ 确认

**解决方案**:

```typescript
// store/index.ts 中添加 persist 中间件
import { persist } from 'zustand/middleware';

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      favoriteJobIds: new Set(),
      toggleFavorite: (id: number) => { /* ... */ },
      // ...
    }),
    {
      name: 'job-hub-storage',
      partialize: (state) => ({
        // 只持久化部分状态
        favoriteJobIds: Array.from(state.favoriteJobIds),
      }),
      merge: (persisted, current) => ({
        ...current,
        favoriteJobIds: new Set(persisted.favoriteJobIds || []),
      }),
    }
  )
);
```

---

### M3. getFilterOptions 性能问题

**验证结果**: ✅ 确认（但有缓存机制减轻影响）

**证据**:
- [db-utils.ts:327-357](file:///home/joakim/Project/job_hub/src/lib/db-utils.ts#L327-L357): 5次 `SELECT ... FROM jobs` 全表扫描
- 缓存 TTL = 5分钟（CACHE_TTL_MS）
- 内存缓存 + 文件缓存双级缓存

**影响**: 在缓存失效时（每5分钟一次），如果jobs表有 >10万条记录，每次请求耗时可能超过500ms

**解决方案**:

**方案1: 添加覆盖索引（立即见效）**
```sql
CREATE INDEX IF NOT EXISTS idx_jobs_location_notnull ON jobs(location) WHERE location != '';
CREATE INDEX IF NOT EXISTS idx_jobs_jobtype_notnull ON jobs(job_type) WHERE job_type != '';
CREATE INDEX IF NOT EXISTS idx_jobs_industry_notnull ON jobs(industry) WHERE industry != '';
CREATE INDEX IF NOT EXISTS idx_jobs_education_notnull ON jobs(education) WHERE education != '';
```

**方案2: 使用 COUNT + GROUP BY 优化**
```typescript
// 改为带计数的聚合查询，避免JS端 countOccurrences
const locations = db.prepare(`
  SELECT location, COUNT(*) as count
  FROM jobs 
  WHERE location IS NOT NULL AND location != ''
  GROUP BY location
  ORDER BY count DESC
`).all();
```

**方案3: 预计算缓存表**
```sql
CREATE TABLE filter_cache (
  cache_key TEXT PRIMARY KEY,
  cache_data TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
运行时更新，避免全表扫描。

---

### M4. smartedu 和 neu 数据源配置分析

**验证结果**: ⚠️ 部分确认

**smartedu 分析**:
- [spider_configs.py:227-253](file:///home/joakim/Project/job_hub/src/spiders/spider_configs.py#L227-L253): `spider_type: "browser_api"`
- strategies/ 目录中 **没有** `browser_api_strategy.py`
- `browser_js` 类型会走 [browser_strategy.py](file:///home/joakim/Project/job_hub/src/spiders/strategies/browser_strategy.py)（基类）
- 需要确认 [get_strategy()](file:///home/joakim/Project/job_hub/src/spiders/strategies/__init__.py) 如何处理 `browser_api` 类型

**neu 分析**:
- `spider_type: "browser_js"` 使用浏览器渲染，配置完整
- `selectors.detail_content: ".details-mge .info"` 依赖于目标网站的DOM结构

**解决方案**:
- 确认 smartedu 的 `browser_api` 类型是否在 get_strategy() 中被正确映射
- 如果 smartedu 使用浏览器渲染，改为 `browser_js`
- neu 配置取决于东北大学网站实际DOM是否匹配 `.details-mge .info`

---

### M5. 双份 SOURCE_NAME_MAP 维护

**验证结果**: ✅ 确认

**证据**:
- [constants.ts:11-21](file:///home/joakim/Project/job_hub/src/lib/constants.ts#L11-L21): TypeScript 版
- [constants.py:1-11](file:///home/joakim/Project/job_hub/src/spiders/constants.py#L1-L11): Python 版

**两者内容一致**（本次验证已比对），但维护成本高。

**解决方案**:

**方案A: JSON 配置文件（推荐）**
```json
// data/source_names.json
{
  "sufe": "上海财经大学",
  "zuel": "中南财经政法大学",
  ...
}
```
TypeScript 和 Python 各自读取同一个 JSON 文件。

**方案B: 从数据库动态读取**
```sql
CREATE TABLE crawler_sources (
  source_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1
);
INSERT INTO crawler_sources VALUES ('sufe', '上海财经大学', 1), ...;
```
两端都从数据库读取，不需要硬编码。

---

### M6. dufe 配置引用 cufe（已验证已处理）

**验证结果**: ✅ 确认 — spider_configs.py 已正确处理

**证据**:
- [spider_configs.py:324-327](file:///home/joakim/Project/job_hub/src/spiders/spider_configs.py#L324-L327):
  ```python
  if fm == "same_as_cufe":
      fm = SPIDER_CONFIGS["cufe"]["field_mapping"]
  ```
- `get_lite_sources()` 函数已经正确处理了字符串引用
- 不影响主爬虫（主爬虫使用完整的 SPIDER_CONFIGS）

**无需修复**

---

### M7. HTTP Session 超时不一致

**验证结果**: ✅ 确认

**证据**:
- [crawler.py:54](file:///home/joakim/Project/job_hub/src/spiders/crawler.py#L54): `timeout=aiohttp.ClientTimeout(total=30)` (共享Session)
- [unified_spider.py:108](file:///home/joakim/Project/job_hub/src/spiders/unified_spider.py#L108): `timeout=aiohttp.ClientTimeout(total=20)` (独立Session)
- [base.py:219](file:///home/joakim/Project/job_hub/src/spiders/base.py#L219): `request_with_retry` 默认超时30秒

**实际影响**: 使用共享Session时，实际超时是共享Session的30秒（由 connector 管理）。`request_with_retry` 的30秒超时可能是多余的（已被外层覆盖）。

**解决方案**: 
- 统一所有超时配置到 constants.py 中
- 共享Session使用60秒（浏览器渲染慢），独立Session使用30秒
- 或者全部使用 `spider_configs.py` 中的 per-source `request_timeout` 配置

---

## 🟢 低优先级问题 验证与解决方案

### L4. `__pycache__` 已提交到仓库

**验证结果**: ✅ 确认 — 14个 .pyc 文件存在于 `src/spiders/__pycache__/`

**解决方案**:
```bash
# 1. 从git中移除（保留本地文件）
git rm --cached -r src/spiders/__pycache__/

# 2. 添加到 .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore

# 3. 提交
git add .gitignore
git commit -m "Remove __pycache__ from tracking"
```

---

### L5. Dockerfile Alpine v3.23 硬编码

**验证结果**: ✅ 确认

**证据**:
- [Dockerfile:11-12](file:///home/joakim/Project/job_hub/Dockerfile#L11-L12):
  ```dockerfile
  # 硬编码了 v3.23
  echo "http://mirrors.aliyun.com/alpine/v3.23/main" >> /etc/apk/repositories
  echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories
  ```

**影响**: 当前 node:20-alpine 对应 Alpine 3.20，未来升级到 node:22-alpine 时这些仓库地址会不匹配

**解决方案**:
```dockerfile
# 使用变量替代硬编码
ARG ALPINE_VERSION=3.23
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|http://mirrors.aliyun.com/alpine|g' /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v${ALPINE_VERSION}/main" >> /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories
```

---

## 🔒 安全问题 验证与解决方案

### S1. `.env` 文件泄露风险

**验证结果**: ✅ 确认

见 H1 解决方案（已合并到 H1）。

---

### S6. 密码哈希使用 SHA256

**验证结果**: ✅ 确认

**证据**:
- [auth-db.ts:214-215](file:///home/joakim/Project/job_hub/src/lib/auth-db.ts#L214-L215):
  ```typescript
  static hashPassword(password: string, salt: string): string {
    return createHash('sha256').update(`${password}${salt}`).digest('hex');
  }
  ```

**问题**: SHA256 是快速哈希算法，容易被暴力破解。应使用慢速哈希算法(bcrypt/scrypt/argon2)增加破解成本。

**解决方案**:
```typescript
// 方案1: 使用 bcrypt（需要 npm install bcrypt）
import bcrypt from 'bcrypt';

static async hashPassword(password: string): string {
  return bcrypt.hash(password, 12); // 12轮salt
}

static async verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compare(password, hash);
}

// 方案2: 使用 Node.js 内置 scrypt（无需额外依赖）
import { scryptSync, timingSafeEqual } from 'crypto';

static hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}
```

**迁移策略**:
1. 新用户注册直接使用 bcrypt
2. 老用户登录时，验证成功后自动升级为 bcrypt（透明迁移）

---

## ⚡ 性能问题 验证与解决方案

### P1. getFilterOptions 全表扫描

**验证结果**: ✅ 确认

见 M3 解决方案（已合并）。

---

### P2. db-utils WAL 未启用

**验证结果**: ✅ 确认

见 C1 解决方案（已合并）。

---

### P4. 浏览器实例内存管理

**验证结果**: ✅ 确认（已有一定管理机制）

**证据**:
- [base.py:399-498](file:///home/joakim/Project/job_hub/src/spiders/base.py#L399-L498): `BaseBrowserSpider` 有 `close()` 方法
- [crawler.py:40](file:///home/joakim/Project/job_hub/src/spiders/crawler.py#L40): `_browser_semaphore = asyncio.Semaphore(3)` 限制并发
- `close()` 中依次关闭 context → browser → playwright

**潜在风险**: 如果 `close()` 未被调用（如异常退出），浏览器进程会泄漏

**解决方案**:
```python
# 使用 contextlib.asynccontextmanager 确保资源释放
from contextlib import asynccontextmanager

@asynccontextmanager
async def browser_context(spider: BaseBrowserSpider):
    try:
        await spider.initialize()
        yield spider
    finally:
        await spider.close()
```

---

### P5. visited_urls 内存集合增长

**验证结果**: ✅ 确认（但有上限机制）

**证据**:
- [crawler.py:41](file:///home/joakim/Project/job_hub/src/spiders/crawler.py#L41): `self._visited_urls: Set[str] = set()`
- [constants.py:28-29](file:///home/joakim/Project/job_hub/src/spiders/constants.py#L28-L29):
  ```python
  MAX_VISITED_URLS = 50000
  VISITED_URLS_CLEANUP_RATIO = 0.3
  ```

**分析**: 有 50000 上限和清理机制，对于单次爬取足够。但多轮爬取之间不会自动清理。

**解决方案**:
```python
# 每次爬取前清理 visited_urls（已在 _load_visited_urls 中处理）
# 建议: 爬取完成后调用 gc.collect() 释放内存
async def close(self):
    self._visited_urls.clear()
    # ...
```

---

## 📊 联动问题汇总

### 前端 ↔ 爬虫联动断裂

| 联动点 | 状态 | 根本原因 | 解决方案 |
|--------|------|----------|----------|
| 爬虫状态展示 | ❌ 断裂 | PID文件机制不工作 | 改用数据库状态表 (见 H3) |
| 数据源列表 | ⚠️ 缺2个 | smartedu/neu未在SOURCE_TYPE_MAP | 补全映射 (见 sources/route.ts) |
| 爬虫触发 | ❌ 缺失 | 无触发API | 添加 `/api/crawler/start` POST |
| 爬虫日志 | ⚠️ 受限 | 只能看数据库日志 | 增加实时日志流 |

### 数据库写入方联动

| 写入方 | WAL | 风险 |
|--------|-----|------|
| db-utils.ts | ❌ | 读写互相阻塞 |
| auth-db.ts | ✅ | 安全 |
| database.py | ✅ | 安全 |
| lite_crawler.py | ✅ | 安全（但表结构不同） |

**统一行动**: db-utils.ts 启用 WAL 后，所有写入方一致。

### Schema 不一致

|lite_crawler 缺失字段| 前端影响 |
|------|------|
| is_favorite | 收藏状态无法跨系统同步 |
| is_read | 已读状态不可追踪 |
| content_hash | 去重逻辑不完整 |
| experience | 前端筛选缺失 |
| tags | 标签不可用 |
| category | 分类不可用 |

---

## 📋 修复优先级排序

| 优先级 | 问题编号 | 修复工作量 | 风险 |
|--------|----------|-----------|------|
| P0 (立即) | H1/S1 (.env泄露) | 5分钟 | **极高** |
| P0 (立即) | H2 (硬编码路径) | 5分钟 | 高 |
| P0 (立即) | C1 (WAL模式) | 5分钟 | 高 |
| P1 (本周) | L4 (__pycache__) | 5分钟 | 低 |
| P1 (本周) | H3 (PID机制) | 1-2小时 | 中 |
| P1 (本周) | C3 (表结构统一) | 30分钟 | 中 |
| P2 (下周) | H5 (速率限制) | 2小时 | 中 |
| P2 (下周) | P1/M3 (索引优化) | 1小时 | 低 |
| P2 (下周) | M5 (SOURCE统一) | 30分钟 | 低 |
| P3 (本月) | C2 (Docker爬虫) | 4小时 | 高 |
| P3 (本月) | H4 (认证加固) | 4小时 | 中 |
| P3 (本月) | S6 (密码升级) | 2小时 | 中(需要迁移) |
| P4 (下月) | M1 (文件日志) | 2小时 | 低 |
| P4 (下月) | M2 (状态持久化) | 1小时 | 低 |
| P4 (下月) | L5 (Alpine版本) | 5分钟 | 低 |

---

*报告生成时间：2026-05-20 | 验证方式：逐行代码审查*