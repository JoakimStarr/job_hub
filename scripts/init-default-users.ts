/**
 * 初始化默认用户脚本
 * 
 * 在数据库中创建默认的 admin/operator/viewer 用户
 * 用于替代环境变量中的 TOKEN 验证方式
 * 
 * 使用方法:
 * npx ts-node scripts/init-default-users.ts
 */

import { AuthDatabase } from '../src/lib/auth-db';
import path from 'path';

const DEFAULT_USERS = [
  {
    username: 'admin',
    password: 'admin123', // 生产环境应该修改
    role: 'admin' as const,
  },
  {
    username: 'operator',
    password: 'operator123',
    role: 'operator' as const,
  },
  {
    username: 'viewer',
    password: 'viewer123',
    role: 'viewer' as const,
  },
];

async function initDefaultUsers() {
  const dbPath = path.join(process.cwd(), 'data', 'jobs.db');
  const authDb = new AuthDatabase(dbPath);

  try {
    console.log('🔗 连接数据库...');
    authDb.connect();

    console.log('👤 创建默认用户...\n');

    for (const user of DEFAULT_USERS) {
      try {
        // 检查用户是否已存在
        const existing = authDb.getUserByUsername(user.username);
        if (existing) {
          console.log(`⚠️  用户已存在: ${user.username} (role=${user.role})`);
          continue;
        }

        // 创建用户
        const created = authDb.createUser(
          user.username,
          user.password,
          user.role
        );

        console.log(`✅ 创建成功: ${created.username} (id=${created.id}, role=${created.role})`);
        console.log(`   密码: ${user.password}`);
        console.log(`   权限: ${created.permissions.slice(0, 5).join(', ')}...`);
        console.log('');
      } catch (error) {
        console.error(`❌ 创建用户 ${user.username} 失败:`, error);
      }
    }

    console.log('\n🎉 默认用户初始化完成！');
    console.log('\n登录信息:');
    console.log('  admin    / admin123    (管理员)');
    console.log('  operator / operator123 (操作员)');
    console.log('  viewer   / viewer123   (访客)');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  } finally {
    authDb.close();
  }
}

// 运行脚本
initDefaultUsers();
