# FinIntern Hub - Finance Internship Recruitment Platform

## Project Overview

FinIntern Hub is a finance internship recruitment information aggregation platform built with Next.js and Python. The platform collects internship and full-time job information from multiple finance university career websites through an intelligent crawler system, providing users with unified job search, bookmarking, and recommendation services.

### Core Features

- 🎯 **Multi-source Data Aggregation**: Supports data collection from 9 finance university career websites
- 🚀 **High-Performance Crawler System**: Asynchronous concurrent crawling, supports both HTTP API and browser modes
- 🔐 **User Permission Management**: Role-based access control (RBAC)
- 🔍 **Intelligent Search**: Multi-dimensional filtering by keywords, location, industry, etc.
- 💡 **AI-Powered Recommendations**: Job recommendation system based on user profiles
- 📊 **Data Visualization**: Job statistics, trend analysis, and other data displays
- 🐳 **Containerized Deployment**: Supports one-click Docker deployment

---

## Technical Architecture

### Technology Stack

#### Frontend
- **Framework**: Next.js 15.3.3 (App Router)
- **UI Library**: React 18.3.1
- **Language**: TypeScript 5.8.3
- **Styling**: CSS-in-JS (inline styles)
- **Database**: better-sqlite3 (SQLite)

#### Backend Crawler
- **Language**: Python 3.13+
- **Async Framework**: asyncio, aiosqlite
- **Browser Automation**: Playwright (optional)
- **HTML Parsing**: BeautifulSoup4
- **Logging**: loguru

#### Deployment
- **Containerization**: Docker + docker-compose
- **Runtime**: Node.js 20 Alpine

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Home    │  │ Jobs List│  │Favorites │  │  System  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application Layer                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Pages   │  │API Routes│  │  Auth    │  │  State   │   │
│  │          │  │          │  │Middleware│  │Management│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Storage Layer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SQLite Database (jobs.db)                │  │
│  │  - jobs table (job information)                      │  │
│  │  - crawl_logs table (crawler logs)                   │  │
│  │  - users table (user information)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                   Python Crawler System                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ HTTP API │  │ Browser  │  │  Data    │  │Deduplication│ │
│  │ Crawler  │  │ Crawler  │  │Cleaning  │  │  & Storage  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│               Data Source Layer (9 Universities)             │
│  SUFE | ZUEL | CUFE | DUFE | SWUFE | UIBE | JXUFE | NEU    │
│                    | SmartEdu                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
next-app/
├── src/                      # Source code directory
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/              # API routes
│   │   │   ├── jobs/         # Job-related APIs
│   │   │   ├── favorites/    # Favorite-related APIs
│   │   │   └── stats/        # Statistics-related APIs
│   │   ├── crawler/          # Crawler management page
│   │   ├── favorites/        # Favorites center page
│   │   ├── jobs/             # Job list page
│   │   ├── login/            # Login page
│   │   ├── recommendations/  # Recommendations page
│   │   ├── system/           # System management page
│   │   ├── users/            # User management page
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   └── globals.css       # Global styles
│   ├── components/           # React components
│   │   ├── app-shell.tsx     # Application shell (navigation, sidebar)
│   │   └── ui.tsx            # UI component library
│   ├── lib/                  # Utility libraries
│   │   ├── api.ts            # API client
│   │   ├── auth.ts           # Authentication utilities
│   │   ├── constants.ts      # Constant definitions
│   │   └── types.ts          # TypeScript type definitions
│   └── spiders/              # Python crawler system
│       ├── base.py           # Crawler base class
│       ├── unified_spider.py # Unified crawler implementation
│       ├── spider_configs.py # Crawler configurations
│       ├── crawler.py        # Concurrent crawler manager
│       ├── database.py       # Database operations
│       ├── run.py            # Crawler entry point
│       └── ...               # Other crawler modules
├── data/                     # Data directory
│   └── jobs.db               # SQLite database
├── log/                      # Log directory
├── output/                   # Output directory
│   └── visited_urls.json     # Visited URLs record
├── public/                   # Static assets
├── .dockerignore             # Docker ignore file
├── .gitignore                # Git ignore file
├── .npmrc                    # npm configuration
├── Dockerfile                # Docker image build file
├── docker-compose.yml        # Docker Compose configuration
├── next.config.ts            # Next.js configuration
├── package.json              # Node.js dependencies configuration
├── tsconfig.json             # TypeScript configuration
├── run_spiders.py            # Crawler startup script
└── run_browser_spiders.py    # Browser crawler startup script
```

---

## Quick Start

### Requirements

- Node.js >= 20.0.0
- Python >= 3.13
- Docker & Docker Compose (optional, for containerized deployment)
- Playwright (optional, for browser crawlers)

### Local Development

#### 1. Clone the Project

```bash
git clone <repository-url>
cd finintern_hub/next-app
```

#### 2. Install Frontend Dependencies

```bash
npm install
```

#### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### 4. Install Playwright (optional, for browser crawlers)

```bash
pip install playwright
playwright install chromium
```

#### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

#### 6. Run Crawlers

```bash
# Run all crawlers
npm run spiders

# Run specific crawlers
python3 run_spiders.py --sources sufe zuel swufe

# List all available data sources
npm run spiders:list
```

### Docker Deployment

#### 1. Build and Start Container

```bash
docker-compose up -d --build
```

#### 2. View Logs

```bash
docker-compose logs -f
```

#### 3. Stop Container

```bash
docker-compose down
```

---

## Configuration

### Environment Variables

Create a `.env.local` file to configure environment variables:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=/api
API_BACKEND_URL=http://localhost:8080

# Docker Deployment Port
NEXT_APP_PORT=3001
```

### Next.js Configuration

Key configurations in [next.config.ts](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/next.config.ts):

```typescript
{
  output: 'standalone',          // Standalone output for Docker deployment
  reactStrictMode: true,         // React strict mode
  rewrites: async () => [...]    // API proxy configuration
}
```

### Crawler Configuration

Crawler configurations are located in [src/spiders/spider_configs.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/spider_configs.py), using a configuration-driven architecture:

```python
SPIDER_CONFIGS = {
    "sufe": {
        "name": "Shanghai University of Finance and Economics",
        "type": "api_post",
        "list_url": "https://career.sufe.edu.cn/career//zpxx/search/zpxx",
        "detail_url": "https://career.sufe.edu.cn/career//zpxx/data/zpxx/{id}",
        # ... more configurations
    },
    # ... other data source configurations
}
```

---

## Feature Modules

### 1. User Authentication & Permission Management

- **Authentication Method**: JWT Token
- **Permission System**: Role-based access control (RBAC)
- **Permission Types**:
  - `view_jobs`: View jobs
  - `view_stats`: View statistics
  - `manage_crawler`: Manage crawler
  - `view_system`: View system
  - `use_recommendations`: Use recommendations
  - `manage_users`: Manage users

### 2. Job Management

- **Job Search**: Multi-dimensional filtering by keywords, location, industry, education, etc.
- **Job Details**: Display complete job information, company introduction, application link
- **Bookmark Feature**: Users can bookmark jobs of interest
- **Timeline**: Record job application progress

### 3. Crawler System

#### Data Source List

| Data Source | Name | Crawling Method | Notes |
|-------------|------|-----------------|-------|
| sufe | Shanghai University of Finance and Economics | HTTP POST API | Recommended, fast |
| zuel | Zhongnan University of Economics and Law | HTTP GET API | Recommended, fast |
| cufe | Central University of Finance and Economics | HTTP POST API | Requires Cookie |
| dufe | Dongbei University of Finance and Economics | HTTP POST API | Requires Cookie |
| swufe | Southwestern University of Finance and Economics | HTTP HTML | Direct URL traversal |
| smartedu | National Student Employment Service Platform | Browser + API | Requires Playwright |
| uibe | University of International Business and Economics | Browser + Encryption | Requires Playwright |
| jxufe | Jiangxi University of Finance and Economics | Browser | Requires Playwright |
| neu | Northeastern University | Browser | Requires Playwright |

#### Crawler Features

- ✅ **Configuration-Driven**: Adding new data sources only requires configuration, no code needed
- ✅ **Asynchronous Concurrency**: Supports concurrent crawling from multiple data sources
- ✅ **Intelligent Deduplication**: URL and content hash-based deduplication
- ✅ **Incremental Crawling**: Supports incremental updates to avoid duplicate crawling
- ✅ **Error Handling**: Comprehensive exception catching and logging
- ✅ **Rate Limiting**: Browser crawler concurrency limits

### 4. Data Statistics

- **Overview Statistics**: Total jobs, bookmarks, today's additions, data source count
- **Hot Keywords**: High-frequency word analysis based on job information
- **Trend Analysis**: Job posting trend charts
- **Data Source Statistics**: Crawling status of each data source

### 5. AI Recommendation System

- **Job Recommendations**: Intelligent recommendations based on user profiles
- **Resume Advice**: AI analyzes resumes and provides improvement suggestions
- **Interview Question Generation**: Generate interview questions based on job requirements
- **Delivery Assistant**: Intelligent delivery suggestions

---

## API Documentation

### Authentication API

```typescript
// Login
POST /api/auth/login
Body: { username: string, password: string }
Response: { access_token: string, user: AppUser }

// Get current user
GET /api/auth/me
Headers: { Authorization: "Bearer {token}" }
Response: AppUser

// Logout
POST /api/auth/logout
```

### Jobs API

```typescript
// Get job list
GET /api/jobs?page=1&page_size=20&keyword=finance&location=Beijing
Response: PagedResponse<JobItem>

// Get job details
GET /api/jobs/{id}
Response: JobItem

// Toggle bookmark status
POST /api/jobs/{id}/favorite
Response: { success: boolean }

// Get bookmark list
GET /api/jobs/favorites?page=1&page_size=20
Response: PagedResponse<JobItem>
```

### Statistics API

```typescript
// Get overview statistics
GET /api/stats/overview
Response: StatsOverview

// Get trend data
GET /api/stats/trends?days=7
Response: TrendData[]
```

### Crawler API

```typescript
// Get crawler status
GET /api/crawler/status
Response: CrawlerStatus

// Start crawler
POST /api/crawler/start
Body: { sources?: string[], max_items?: number }
Response: { success: boolean }

// Stop crawler
POST /api/crawler/stop
Response: { success: boolean }
```

---

## Development Guide

### Code Standards

- **TypeScript**: Strict mode, all types must be clearly defined
- **React**: Functional components, using Hooks
- **Python**: Follow PEP 8 standards, use type annotations
- **Naming Conventions**:
  - Components: PascalCase
  - Functions/Variables: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Files: kebab-case

### Adding New Data Sources

1. Add configuration in `src/spiders/spider_configs.py`:

```python
SPIDER_CONFIGS = {
    "new_source": {
        "name": "New Data Source Name",
        "type": "api_post",  # or api_get, html, browser_api, browser_js
        "list_url": "https://example.com/api/jobs",
        "detail_url": "https://example.com/api/jobs/{id}",
        "field_mapping": {
            "title": "jobTitle",
            "company": "companyName",
            # ... other field mappings
        },
        # ... other configurations
    }
}
```

2. Add data source name in `src/spiders/constants.py`:

```python
SOURCE_NAMES = {
    "new_source": "New Data Source Name",
}
```

3. Test the crawler:

```bash
python3 run_spiders.py --sources new_source --max-items 10
```

### Adding New Pages

1. Create page directory under `src/app/`:

```bash
mkdir src/app/new-page
touch src/app/new-page/page.tsx
```

2. Write page component:

```typescript
'use client';

import { AppShell } from '@/components/app-shell';

export default function NewPage() {
  return (
    <AppShell title="New Page" description="Page description">
      {/* Page content */}
    </AppShell>
  );
}
```

3. Add navigation item in `src/lib/constants.ts`:

```typescript
export const NAV_ITEMS = [
  // ... other navigation items
  { key: 'new-page', label: 'New Page', href: '/new-page', emoji: '🆕' },
];
```

---

## Deployment Guide

### Docker Deployment (Recommended)

#### 1. Prepare Environment Variables

Create `.env` file:

```bash
NEXT_PUBLIC_API_URL=/api
API_BACKEND_URL=http://host.docker.internal:8080
NEXT_APP_PORT=3001
```

#### 2. Build and Start

```bash
docker-compose up -d --build
```

#### 3. View Logs

```bash
docker-compose logs -f finintern-next
```

#### 4. Access Application

Visit http://localhost:3001

### Manual Deployment

#### 1. Build Application

```bash
npm run build
```

#### 2. Start Service

```bash
npm start
```

#### 3. Configure Reverse Proxy

Use Nginx or other reverse proxy servers:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Performance Optimization

### Frontend Optimization

- ✅ Server-side rendering with Next.js App Router
- ✅ Code splitting and lazy loading
- ✅ Image optimization (Next.js Image component)
- ✅ CSS optimization (avoid unnecessary repaints)

### Crawler Optimization

- ✅ Asynchronous concurrent crawling
- ✅ Browser crawler concurrency limits
- ✅ Batch database writes
- ✅ URL deduplication cache
- ✅ Incremental crawling strategy

### Database Optimization

- ✅ Index optimization (source_url, company, publish_date)
- ✅ Batch inserts to reduce transaction count
- ✅ Regular cleanup of historical data

---

## Common Issues

### 1. Crawler Execution Failure

**Issue**: Browser crawler reports "Playwright not found" error

**Solution**:
```bash
pip install playwright
playwright install chromium
```

### 2. Database Locking

**Issue**: SQLite database locking error

**Solution**:
- Ensure no multiple processes are writing to the database simultaneously
- Use WAL mode: `PRAGMA journal_mode=WAL;`

### 3. Docker Container Startup Failure

**Issue**: Container exits immediately after startup

**Solution**:
- Check logs: `docker-compose logs finintern-next`
- Ensure port is not occupied
- Check environment variable configuration

### 4. API Request Timeout

**Issue**: Frontend API request timeout

**Solution**:
- Check if backend service is running normally
- Check network connection
- Increase timeout duration (default 30 seconds)

---

## License

This project is for learning and research purposes only.

---

## Contact

For questions or suggestions, please submit an Issue or Pull Request.

---

## Changelog

### v0.2.0 (2026-05-16)
- ✨ Refactored crawler system with configuration-driven architecture
- ✨ Added unified crawler implementation
- ✨ Supported asynchronous concurrent crawling
- 🐛 Fixed database locking issues
- 📝 Improved technical documentation

### v0.1.0
- 🎉 Initial release
- ✨ Basic crawler functionality
- ✨ User authentication system
- ✨ Job management features
