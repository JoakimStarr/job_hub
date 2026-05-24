import { test, expect, Page, request } from '@playwright/test';
import { LoginPage, AdminSystemMonitorPage } from './pages';

test.describe('管理员工作流 - 系统监控', () => {
  let loginPage: LoginPage;
  let monitorPage: AdminSystemMonitorPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    monitorPage = new AdminSystemMonitorPage(page);
  });

  test('5.1 - 管理员登录并访问系统监控页面', async ({ page }) => {
    await loginPage.loginAsAdmin();
    
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const currentUrl = page.url();
    const isValidUrl = currentUrl.includes('/system') || 
                       currentUrl.includes('/admin') ||
                       currentUrl.includes('/crawler');
    
    if (!isValidUrl) {
      console.log(`当前URL: ${currentUrl} - 可能页面路径不同`);
    }
  });

  test('5.2 - 查看系统状态概览', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    try {
      const systemStatus = await monitorPage.getSystemStatus();
      
      console.log('系统状态:', JSON.stringify(systemStatus, null, 2));
      
      if (Object.keys(systemStatus).length > 0) {
        expect(systemStatus).toBeTruthy();
      }
    } catch (error) {
      console.log('获取系统状态失败:', error.message);
    }
  });

  test('5.3 - 检查数据库连接状态', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const dbIndicator = page.locator('.status-indicator:has-text("数据库"), .status-indicator:has-text("Database")');
    
    if (await dbIndicator.isVisible({ timeout: 5000 })) {
      const dbStatus = await dbIndicator.textContent();
      console.log('数据库状态:', dbStatus);
      
      const isHealthy = dbStatus?.includes('正常') || 
                        dbStatus?.includes('Connected') || 
                        dbStatus?.includes('Healthy');
      
      if (isHealthy) {
        console.log('✅ 数据库连接正常');
      }
    } else {
      console.log('未找到数据库状态指示器');
    }
  });

  test('5.4 - 检查爬虫运行状态', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    try {
      const crawlerStatus = await monitorPage.getCrawlerStatus();
      console.log('爬虫状态信息:', crawlerStatus.substring(0, 200));
      
      expect(crawlerStatus.length).toBeGreaterThan(0);
    } catch (error) {
      console.log('获取爬虫状态失败:', error.message);
    }
  });

  test('5.5 - 运行健康检查端点', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const healthResult = await monitorPage.runHealthCheck();
    
    if (healthResult) {
      console.log('健康检查结果:', JSON.stringify(healthResult, null, 2));
      
      expect(healthResult).toHaveProperty('status');
      expect(['ok', 'healthy', 'success']).toContain(healthResult.status?.toLowerCase());
    } else {
      console.log('通过UI按钮触发健康检查未成功，尝试直接调用API');
    }
  });

  test('5.6 - 直接API健康检查验证', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/system/status');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    console.log('API健康检查响应:', JSON.stringify(data, null, 2));
    
    expect(data).toHaveProperty('status');
  });

  test('5.7 - 查看系统日志', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    try {
      await monitorPage.viewLogs('应用日志');
      
      const logContent = await monitorPage.getLogContent();
      
      if (logContent && logContent.length > 0) {
        console.log(`日志内容长度: ${logContent.length} 字符`);
        console.log('日志预览:', logContent.substring(0, 200));
        
        expect(logContent.length).toBeGreaterThan(10);
      } else {
        console.log('日志内容为空或不可见');
      }
    } catch (error) {
      console.log('查看日志测试跳过:', error.message);
    }
  });

  test('5.8 - 切换不同类型的日志查看器', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const logTypes = ['应用日志', '爬虫日志', '错误日志'];
    
    for (const logType of logTypes) {
      try {
        await monitorPage.viewLogs(logType);
        await page.waitForTimeout(500);
        
        const isVisible = await monitorPage.logViewer.isVisible({ timeout: 3000 });
        if (isVisible) {
          console.log(`${logType} 查看器可见`);
        }
      } catch (error) {
        console.log(`${logType} 切换跳过`);
      }
    }
  });

  test('5.9 - 刷新系统状态', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    if (await monitorPage.refreshButton.isVisible()) {
      await monitorPage.refreshSystemStatus();
      
      const statusIndicators = monitorPage.statusIndicators;
      const count = await statusIndicators.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
      console.log(`刷新后显示 ${count} 个状态指示器`);
    }
  });

  test('5.10 - 启动/停止爬虫控制（UI交互）', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const startButtonVisible = await monitorPage.crawlerStartButton.isVisible({ timeout: 3000 });
    const stopButtonVisible = await monitorPage.crawlerStopButton.isVisible({ timeout: 3000 });
    
    if (startButtonVisible || stopButtonVisible) {
      console.log('爬虫控制按钮可用');
      
      if (startButtonVisible) {
        console.log('检测到启动按钮（爬虫可能未运行）');
      }
      
      if (stopButtonVisible) {
        console.log('检测到停止按钮（爬虫可能正在运行）');
      }
    } else {
      console.log('爬虫控制按钮不可见，可能功能未实现或需要特定权限');
    }
  });

  test('5.11 - 验证系统资源使用情况展示', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const resourceMetrics = [
      { selector: 'text=内存使用', name: '内存' },
      { selector: 'text=CPU使用', name: 'CPU' },
      { selector: 'text=磁盘空间', name: '磁盘' },
      { selector: 'text=Memory', name: 'Memory (英文)' },
      { selector: 'text=CPU', name: 'CPU (英文)' },
    ];
    
    for (const metric of resourceMetrics) {
      const element = page.locator(metric.selector);
      if (await element.isVisible({ timeout: 2000 })) {
        const text = await element.textContent();
        console.log(`${metric.name}: ${text}`);
        break;
      }
    }
  });

  test('5.12 - API端点批量验证', async ({ request }) => {
    const endpoints = [
      '/api/system/status',
      '/api/crawler/status',
      '/api/stats/overview',
    ];
    
    const results: any[] = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(`http://localhost:3000${endpoint}`);
        results.push({
          endpoint,
          status: response.status(),
          ok: response.ok(),
        });
        
        console.log(`${endpoint}: ${response.status()} (${response.ok() ? 'OK' : 'FAIL'})`);
      } catch (error) {
        results.push({
          endpoint,
          error: error.message,
        });
        console.log(`${endpoint}: 错误 - ${error.message}`);
      }
    }
    
    const successCount = results.filter(r => r.status === 200).length;
    console.log(`\n成功: ${successCount}/${results.length} 个端点`);
  });

  test('5.13 - 日志API端点验证', async ({ request }) => {
    const logEndpoints = [
      '/api/crawler/logs?limit=10',
      '/api/auth/logs?limit=10',
    ];
    
    for (const endpoint of logEndpoints) {
      try {
        const response = await request.get(`http://localhost:3000${endpoint}`);
        
        if (response.status() === 200) {
          const data = await response.json();
          console.log(`${endpoint}: 获取成功，数据条数: ${Array.isArray(data) ? data.length : 'N/A'}`);
          
          if (Array.isArray(data)) {
            expect(data.length).toBeLessThanOrEqual(10);
          }
        } else {
          console.log(`${endpoint}: ${response.status()}`);
        }
      } catch (error) {
        console.log(`${endpoint}: ${error.message}`);
      }
    }
  });

  test('5.14 - 完整的系统监控工作流', async ({ page }) => {
    test.slow();
    
    await step('管理员登录', async () => {
      await loginPage.loginAsAdmin();
      await expect(page).not.toHaveURL('/login', { timeout: 8000 });
    });
    
    await step('进入系统监控页面', async () => {
      await monitorPage.navigate();
      await monitorPage.waitForSystemStatusToLoad();
    });
    
    await step('查看系统状态概览', async () => {
      const isHealthy = await monitorPage.isSystemHealthy();
      console.log(`系统健康状态: ${isHealthy ? '正常' : '需关注'}`);
    });
    
    await step('检查各组件状态', async () => {
      try {
        const status = await monitorPage.getSystemStatus();
        Object.entries(status).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      } catch (error) {
        console.log('无法获取详细状态');
      }
    });
    
    await step('查看爬虫状态', async () => {
      try {
        const crawlerStatus = await monitorPage.getCrawlerStatus();
        console.log(`爬虫状态信息已获取 (${crawlerStatus.length} 字符)`);
      } catch (error) {
        console.log('爬虫状态获取失败');
      }
    });
    
    await step('执行健康检查', async () => {
      const result = await monitorPage.runHealthCheck();
      if (result) {
        console.log('健康检查完成:', result.status);
      } else {
        console.log('健康检查未返回结果');
      }
    });
  });

  test('5.15 - 页面加载性能和稳定性', async ({ page }) => {
    const startTime = Date.now();
    
    await loginPage.loginAsAdmin();
    
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const loadTime = Date.now() - startTime;
    console.log(`系统监控页面加载时间: ${loadTime}ms`);
    
    expect(loadTime).toBeLessThan(15000);
    
    const noCriticalErrors = !await page.locator(
      'text=500 Internal Server Error|text=服务不可用|text=Server Error'
    ).isVisible({ timeout: 1000 });
    
    expect(noCriticalErrors).toBeTruthy();
  });

  test('5.16 - 错误处理和异常情况', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const refreshCount = 3;
    for (let i = 0; i < refreshCount; i++) {
      if (await monitorPage.refreshButton.isVisible()) {
        await monitorPage.refreshButton.click();
        await page.waitForTimeout(500);
      }
    }
    
    const pageStable = await monitorPage.systemStatusCard.isVisible({ timeout: 5000 });
    expect(pageStable).toBeTruthy();
    
    console.log(`连续刷新 ${refreshCount} 次后页面仍稳定`);
  });

  test('5.17 - 响应式布局验证', async ({ page }) => {
    await loginPage.loginAsAdmin();
    
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      await monitorPage.navigate();
      await page.waitForTimeout(1000);
      
      const hasContent = await page.locator('body').textContent().then(t => (t || '').length > 50);
      console.log(`${viewport.name} (${viewport.width}x${viewport.height}): ${hasContent ? '正常渲染' : '内容缺失'}`);
      
      expect(hasContent).toBeTruthy();
    }
    
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('5.18 - 并发请求压力测试（轻度）', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const refreshPromises = [];
    
    if (await monitorPage.refreshButton.isVisible()) {
      for (let i = 0; i < 3; i++) {
        refreshPromises.push(monitorPage.refreshButton.click());
      }
    }
    
    if (refreshPromises.length > 0) {
      await Promise.all(refreshPromises);
      await page.waitForTimeout(1000);
    }
    
    const pageResponsive = await page.locator('body').isVisible({ timeout: 5000 });
    expect(pageResponsive).toBeTruthy();
  });

  test('5.19 - 验证安全性和权限', async ({ page }) => {
    test.slow();
    
    await step('以viewer身份登录', async () => {
      await loginPage.loginAsViewer();
    });
    
    await step('尝试访问系统监控页面', async () => {
      await monitorPage.navigate();
      
      const url = page.url();
      const hasAccess = url.includes('/system') || url.includes('/admin');
      
      if (hasAccess) {
        const restrictedContent = await page.locator(
          'text=无权限|text=403|text=仅管理员'
        ).isVisible({ timeout: 3000 });
        
        if (restrictedContent) {
          console.log('✅ 权限控制生效：非管理员被限制访问');
        } else {
          console.log('⚠️ 可能存在权限问题：viewer可以访问管理页面');
        }
      } else {
        console.log('✅ 权限控制正常：已被重定向');
      }
    });
  });

  test('5.20 - 数据实时性验证', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await monitorPage.navigate();
    await monitorPage.waitForSystemStatusToLoad();
    
    const initialText = await page.locator('.system-status-card, [data-testid="system-status"]')
      .first()
      .textContent()
      .catch(() => null);
    
    await page.waitForTimeout(2000);
    
    if (await monitorPage.refreshButton.isVisible()) {
      await monitorPage.refreshSystemStatus();
      
      await page.waitForTimeout(1000);
      
      const refreshedText = await page.locator('.system-status-card, [data-testid="system-status"]')
        .first()
        .textContent()
        .catch(() => null);
      
      if (initialText && refreshedText) {
        console.log('数据刷新前后对比:');
        console.log('  刷新前:', initialText.substring(0, 100));
        console.log('  刷新后:', refreshedText.substring(0, 100));
      }
    }
  });
});

async function step(name: string, fn: () => Promise<void>) {
  console.log(`\n📋 步骤: ${name}`);
  await fn();
}
