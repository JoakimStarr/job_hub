# 认证系统单元测试

## 📋 测试覆盖范围

### 1. AuthDatabase 类测试 ([auth-db.test.ts](src/__tests__/auth/auth-db.test.ts))

#### 密码哈希功能 (100% 覆盖)
- ✅ `generateSalt()` - 盐值生成（默认长度、自定义长度、唯一性）
- ✅ `hashPassword()` - SHA256 哈希（一致性、盐值影响）
- ✅ `verifyPassword()` - 密码验证（正确/错误密码、时序攻击防护）
- ✅ `generateSessionToken()` - Token 生成（格式、唯一性）

#### 用户 CRUD 操作 (95%+ 覆盖)
- ✅ `createUser()` - 创建用户（成功/重复用户名/空值/权限映射）
- ✅ `getUserById()` - 按 ID 查询（存在/不存在/敏感信息过滤）
- ✅ `getUserByUsername()` - 按用户名查询（大小写敏感）
- ✅ `getAllUsers()` - 获取所有用户（排序/过滤已删除）
- ✅ `updateUser()` - 更新用户（各字段/空更新/无效字段）
- ✅ `deleteUser()` - 删除用户（软删除/级联删除会话）

#### 认证逻辑 (90%+ 覆盖)
- ✅ `authenticate()` - 认证流程（成功/失败/IP记录/时间重置）

#### 会话管理 (95%+ 覆盖)
- ✅ `createSession()` - 创建会话（过期时间/多会话）
- ✅ `validateSession()` - 验证会话（有效/无效/过期/滑动续期）
- ✅ `destroySession()` - 销毁单个会话
- ✅ `destroyAllUserSessions()` - 销毁所有会话

#### 安全特性 (100% 覆盖)
- ✅ 登录失败锁定机制（计数/锁定/解锁时间/重置）
- ✅ 账户状态检查（禁用账户）
- ✅ 时序攻击防护验证

#### 边界条件
- 特殊字符用户名
- 超长密码
- Unicode 支持
- 并发操作
- 快速连续请求

### 2. API 路由测试 ([api-routes.test.ts](src/__tests__/auth/api-routes.test.ts))

#### POST /api/auth/login
- ✅ 成功登录（200 + 用户信息 + Cookie）
- ✅ 错误密码（401 + 剩余尝试次数）
- ✅ 不存在的用户（401，不泄露信息）
- ✅ 缺少参数（400）
- ✅ 无效 JSON（500）
- ✅ Cookie 属性验证（HttpOnly/SameSite/Secure）
- ✅ 不同角色登录测试

#### GET /api/auth/me
- ✅ 有效 Session 返回用户信息
- ✅ 无 Cookie 返回未登录
- ✅ 无效 Token 清除 Cookie
- ✅ 过期 Session 处理
- ✅ 禁用用户 Session 失效

#### POST /api/auth/logout
- ✅ 成功登出清除 Cookie
- ✅ Cookie 属性正确性
- ✅ 无 Session 也能调用

#### 安全性测试
- ✅ 不泄露用户名是否存在
- ✅ 密码错误次数过多锁定
- ✅ XSS 防护

## 🚀 安装和运行

### 1. 安装依赖

```bash
# 方式一：使用安装脚本
chmod +x install-test-deps.sh
./install-test-deps.sh

# 方式二：手动安装
npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8
```

### 2. 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式（开发时使用）
npm run test:watch

# 只运行 AuthDatabase 测试
npx vitest run src/__tests__/auth/auth-db.test.ts

# 只运行 API 路由测试
npx vitest run src/__tests__/auth/api-routes.test.ts
```

### 3. 查看覆盖率报告

运行 `npm run test:coverage` 后，报告将输出到：
- 控制台：文本格式摘要
- 文件：`coverage/index.html`（HTML 报告）
- 文件：`coverage/coverage-final.json`（JSON 格式）

## 📊 预期覆盖率

| 模块 | 语句 | 分支 | 函数 | 行 |
|------|------|------|------|-----|
| auth-db.ts | >90% | >85% | >90% | >90% |
| API 路由 | >80% | >75% | >80% | >80% |

## 🔧 配置说明

### Vitest 配置 ([vitest.config.ts](vitest.config.ts))

- **环境**: Node.js（适合后端逻辑测试）
- **路径别名**: `@` → `./src`
- **覆盖率阈值**: 80%（语句/分支/函数/行）
- **超时时间**: 10 秒（适合数据库操作）

### 测试数据库

- 使用内存或临时 SQLite 数据库
- 每个测试用例独立数据库实例
- 测试结束后自动清理临时文件

## ⚠️ 注意事项

1. **依赖安装**: 如果 npm install 失败，请检查网络连接或使用镜像源
2. **数据库文件**: 测试会在 `data/test_*.db` 创建临时数据库，会自动清理
3. **并发测试**: API 路由测试可能需要较长时间（~30秒）
4. **环境变量**: 测试会读取 `.env` 文件中的配置

## 🎯 测试设计原则

1. **隔离性**: 每个测试用例独立运行，不共享状态
2. **完整性**: 覆盖正常流程和异常情况
3. **安全性**: 特别关注安全特性（时序攻击、SQL注入等）
4. **可维护性**: 清晰的测试结构和命名
5. **真实性**: Mock 数据库但保持真实的行为

## 📝 已知问题和优化建议

详见代码提交后的分析报告。
