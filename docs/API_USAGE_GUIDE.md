# Next.js API使用指南

## 数据库配置

**数据库路径**：`/home/joakim/Project/hmAPP/finintern_hub/next-app/data/jobs.db`

**数据库类型**：SQLite

**连接方式**：使用better-sqlite3库

---

## API端点

### 1. 获取岗位列表

**端点**：`GET /api/jobs`

**查询参数**：
- `page` (可选): 页码，默认1
- `page_size` (可选): 每页数量，默认12
- `location` (可选): 地点筛选
- `keyword` (可选): 关键词搜索（标题、公司、描述）
- `job_type` (可选): 岗位类型（全职、实习）
- `source` (可选): 数据源
- `is_favorite` (可选): 是否收藏（0或1）

**响应示例**：
```json
{
  "items": [
    {
      "id": 1,
      "title": "金融分析师",
      "company": "某证券公司",
      "location": "上海",
      "salary": "15K-25K",
      "description": "岗位描述...",
      "requirements": "本科及以上学历",
      "job_type": "全职",
      "industry": "金融",
      "education": "本科",
      "experience": "1-3年",
      "source": "zuel",
      "university": "中南财经政法大学",
      "source_url": "https://...",
      "apply_url": "https://...",
      "publish_date": "2026-05-16",
      "deadline": "2026-06-16",
      "is_favorite": 0,
      "is_read": 0,
      "created_at": "2026-05-16 10:00:00",
      "updated_at": "2026-05-16 10:00:00"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 12,
  "total_pages": 9
}
```

**使用示例**：
```bash
# 获取第一页数据
curl http://localhost:3000/api/jobs

# 筛选上海的岗位
curl "http://localhost:3000/api/jobs?location=上海"

# 搜索关键词
curl "http://localhost:3000/api/jobs?keyword=金融"

# 获取收藏的岗位
curl "http://localhost:3000/api/jobs?is_favorite=1"
```

---

### 2. 获取单个岗位详情

**端点**：`GET /api/jobs/:id`

**路径参数**：
- `id`: 岗位ID

**响应示例**：
```json
{
  "id": 1,
  "title": "金融分析师",
  "company": "某证券公司",
  "location": "上海",
  "salary": "15K-25K",
  "description": "详细描述...",
  "requirements": "本科及以上学历",
  "job_type": "全职",
  "industry": "金融",
  "education": "本科",
  "experience": "1-3年",
  "source": "zuel",
  "university": "中南财经政法大学",
  "source_url": "https://...",
  "apply_url": "https://...",
  "publish_date": "2026-05-16",
  "deadline": "2026-06-16",
  "is_favorite": 0,
  "is_read": 0,
  "created_at": "2026-05-16 10:00:00",
  "updated_at": "2026-05-16 10:00:00"
}
```

**使用示例**：
```bash
# 获取ID为1的岗位详情
curl http://localhost:3000/api/jobs/1
```

---

### 3. 更新岗位状态

**端点**：`PATCH /api/jobs/:id`

**路径参数**：
- `id`: 岗位ID

**请求体**：
```json
{
  "is_favorite": 1,
  "is_read": 1
}
```

**响应示例**：
```json
{
  "success": true
}
```

**使用示例**：
```bash
# 收藏岗位
curl -X PATCH http://localhost:3000/api/jobs/1 \
  -H "Content-Type: application/json" \
  -d '{"is_favorite": 1}'

# 标记为已读
curl -X PATCH http://localhost:3000/api/jobs/1 \
  -H "Content-Type: application/json" \
  -d '{"is_read": 1}'
```

---

### 4. 获取收藏岗位列表

**端点**：`GET /api/favorites`

**查询参数**：
- `page` (可选): 页码，默认1
- `page_size` (可选): 每页数量，默认12

**响应示例**：
```json
{
  "items": [...],
  "total": 10,
  "page": 1,
  "page_size": 12,
  "total_pages": 1
}
```

**使用示例**：
```bash
# 获取收藏的岗位
curl http://localhost:3000/api/favorites
```

---

### 5. 获取统计数据

**端点**：`GET /api/stats`

**响应示例**：
```json
{
  "total_jobs": 100,
  "favorite_jobs": 10,
  "read_jobs": 50,
  "source_stats": [
    {"source": "zuel", "count": 30},
    {"source": "sufe", "count": 25}
  ],
  "job_type_stats": [
    {"job_type": "全职", "count": 60},
    {"job_type": "实习", "count": 40}
  ],
  "location_stats": [
    {"location": "上海", "count": 30},
    {"location": "北京", "count": 25}
  ],
  "recent_jobs": [...]
}
```

**使用示例**：
```bash
# 获取统计数据
curl http://localhost:3000/api/stats
```

---

## 数据流程

```
1. 运行爬虫
   python3 -m src.spiders.run
   
2. 爬虫写入数据库
   /home/joakim/Project/hmAPP/finintern_hub/next-app/data/jobs.db
   
3. Next.js API读取数据库
   GET /api/jobs
   
4. 前端展示数据
   http://localhost:3000/jobs
```

---

## 启动服务

### 1. 启动Next.js开发服务器

```bash
cd /home/joakim/Project/hmAPP/finintern_hub/next-app
npm run dev
```

### 2. 访问应用

- 前端页面：http://localhost:3000
- 岗位列表：http://localhost:3000/jobs
- 收藏页面：http://localhost:3000/favorites
- API文档：http://localhost:3000/api/jobs

---

## 数据库表结构

**表名**：jobs

**字段**：
- `id`: 主键
- `title`: 岗位标题
- `company`: 公司名称
- `location`: 工作地点
- `salary`: 薪资
- `description`: 岗位描述
- `requirements`: 岗位要求
- `job_type`: 岗位类型（全职/实习）
- `industry`: 行业
- `education`: 学历要求
- `experience`: 经验要求
- `source`: 数据源
- `university`: 大学名称
- `source_url`: 来源URL
- `apply_url`: 申请URL
- `publish_date`: 发布日期
- `deadline`: 截止日期
- `category`: 分类
- `tags`: 标签
- `is_favorite`: 是否收藏（0/1）
- `is_read`: 是否已读（0/1）
- `created_at`: 创建时间
- `updated_at`: 更新时间

---

## 版本信息

**版本**：v2.9.0  
**更新时间**：2026-05-16  
**状态**：✅ 已完成

**核心改进**：
- ✅ 创建Next.js API路由
- ✅ 连接SQLite数据库
- ✅ 支持岗位查询、收藏、统计
- ✅ 完整的API文档
