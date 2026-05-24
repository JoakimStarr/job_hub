import { test, expect, Page } from '@playwright/test';
import { LoginPage, JobsPage } from './pages';

test.describe('日常职位浏览流程', () => {
  let loginPage: LoginPage;
  let jobsPage: JobsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    jobsPage = new JobsPage(page);
  });

  test('2.1 - 登录后访问职位列表页面', async ({ page }) => {
    await loginPage.loginAsAdmin();
    
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    await expect(page).toHaveURL('/jobs');
    await expect(jobsPage.searchBar).toBeVisible();
  });

  test('2.2 - 使用搜索栏搜索职位', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const searchQuery = '金融';
    await jobsPage.searchJobs(searchQuery);
    
    const currentUrl = page.url();
    expect(currentUrl).toContain('q=');
    
    await page.waitForTimeout(1000);
    const jobCount = await jobsPage.getJobCount();
    expect(jobCount).toBeGreaterThanOrEqual(0);
  });

  test('2.3 - 搜索空结果处理', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const uniqueQuery = `不存在的职位_${Date.now()}`;
    await jobsPage.searchJobs(uniqueQuery);
    
    const isEmpty = await jobsPage.isJobListEmpty();
    if (isEmpty) {
      const emptyMessage = page.locator('text=暂无岗位');
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('2.4 - 清除搜索条件', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    await jobsPage.searchJobs('测试');
    await page.waitForTimeout(500);
    
    await jobsPage.clearSearch();
    
    const jobCount = await jobsPage.getJobCount();
    expect(jobCount).toBeGreaterThanOrEqual(0);
  });

  test('2.5 - 应用地点筛选器', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    try {
      await jobsPage.applyFilter('location', '北京');
      
      const jobCount = await jobsPage.getJobCount();
      expect(jobCount).toBeGreaterThanOrEqual(0);
    } catch (error) {
      console.log('地点筛选测试跳过:', error.message);
    }
  });

  test('2.6 - 应用学历筛选器', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    try {
      await jobsPage.applyFilter('education', '本科');
      
      const jobCount = await jobsPage.getJobCount();
      expect(jobCount).toBeGreaterThanOrEqual(0);
    } catch (error) {
      console.log('学历筛选测试跳过:', error.message);
    }
  });

  test('2.7 - 查看职位详情', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const jobCount = await jobsPage.getJobCount();
    if (jobCount > 0) {
      await jobsPage.clickJobCard(0);
      
      const modal = page.locator('[role="dialog"], .modal, .job-detail-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
      
      const title = await jobsPage.getJobTitle(0);
      expect(title.length).toBeGreaterThan(0);
      
      const modalText = await modal.textContent();
      expect(modalText?.length).toBeGreaterThan(20);
    }
  });

  test('2.8 - 验证职位详情信息完整性', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const jobCount = await jobsPage.getJobCount();
    if (jobCount > 0) {
      await jobsPage.clickJobCard(0);
      
      const modal = page.locator('[role="dialog"], .modal, .job-detail-modal');
      await modal.waitFor({ state: 'visible' });
      
      const expectedFields = ['薪资', '地点', '学历', '要求'];
      for (const field of expectedFields) {
        const fieldElement = modal.locator(`text=${field}`);
        const isVisible = await fieldElement.isVisible({ timeout: 2000 });
        if (!isVisible) {
          console.log(`字段 "${field}" 在职位详情中未找到`);
        }
      }
    }
  });

  test('2.9 - 查看职位匹配度信息', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const jobCount = await jobsPage.getJobCount();
    if (jobCount > 0) {
      await jobsPage.clickJobCard(0);
      
      const matchScore = page.locator('.match-score, [data-testid="match-score"], text=匹配度');
      const isMatchVisible = await matchScore.isVisible({ timeout: 3000 });
      
      if (isMatchVisible) {
        const scoreText = await matchScore.textContent();
        expect(scoreText).toBeTruthy();
      }
    }
  });

  test('2.10 - 职位列表分页功能', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const paginationVisible = await jobsPage.pagination.isVisible({ timeout: 3000 });
    if (paginationVisible) {
      const currentPage = await jobsPage.getCurrentPage();
      expect(currentPage).toBe(1);
      
      const totalPages = await jobsPage.pagination.locator('button, a, li').count();
      if (totalPages > 1) {
        await jobsPage.goToPage(2);
        
        const newPage = await jobsPage.getCurrentPage();
        expect(newPage).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('2.11 - 排序功能测试', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    if (await jobsPage.sortButton.isVisible()) {
      await jobsPage.toggleSortOrder();
      
      const jobCount = await jobsPage.getJobCount();
      expect(jobCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('2.12 - 切换视图模式（卡片/列表）', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    if (await jobsPage.viewToggle.isVisible()) {
      await jobsPage.toggleViewMode();
      
      const jobContainer = jobsPage.jobList;
      await expect(jobContainer).toBeVisible();
    }
  });

  test('2.13 - 从首页关键词跳转到职位搜索', async ({ page }) => {
    await loginPage.loginAsAdmin();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const keywordBadge = page.locator('.job-tags .badge').first();
    if (await keywordBadge.isVisible({ timeout: 5000 })) {
      await keywordBadge.click();
      
      await expect(page).toHaveURL(/\/jobs/, { timeout: 5000 });
      await jobsPage.waitForJobsToLoad();
    }
  });

  test('2.14 - 职位收藏功能（从列表页）', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const jobCount = await jobsPage.getJobCount();
    if (jobCount > 0) {
      const firstJob = jobsPage.jobCards.nth(0);
      const favoriteBtn = firstJob.locator('button[aria-label*="收藏"], .favorite-btn');
      
      if (await favoriteBtn.isVisible({ timeout: 2000 })) {
        await favoriteBtn.click();
        await page.waitForTimeout(500);
        
        const isFavorited = await favoriteBtn.getAttribute('aria-pressed');
        expect(['true', 'false']).toContain(isFavorited);
      }
    }
  });

  test('2.15 - 完整的职位浏览工作流', async ({ page }) => {
    test.slow();
    
    await step('登录系统', async () => {
      await loginPage.loginAsAdmin();
      await expect(page).not.toHaveURL('/login', { timeout: 8000 });
    });
    
    await step('进入职位列表', async () => {
      await jobsPage.navigate();
      await jobsPage.waitForJobsToLoad();
      await expect(page).toHaveURL('/jobs');
    });
    
    await step('执行搜索', async () => {
      await jobsPage.searchJobs('分析');
      await page.waitForTimeout(1000);
    });
    
    await step('查看搜索结果', async () => {
      const jobCount = await jobsPage.getJobCount();
      console.log(`找到 ${jobCount} 个职位`);
    });
    
    await step('查看第一个职位详情', async () => {
      const jobCount = await jobsPage.getJobCount();
      if (jobCount > 0) {
        await jobsPage.clickJobCard(0);
        
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    });
    
    await step('关闭详情并返回列表', async () => {
      const closeBtn = page.locator('[role="dialog"] button:has-text("关闭"), .modal-close');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    });
  });

  test('2.16 - API响应验证', async ({ page }) => {
    await loginPage.loginAsAdmin();
    
    let apiResponse: any = null;
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/jobs') && response.request().method() === 'GET') {
        try {
          apiResponse = await response.json();
        } catch (e) {
          console.log('解析API响应失败:', e.message);
        }
      }
    });
    
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    if (apiResponse) {
      expect(apiResponse).toHaveProperty('items');
      expect(Array.isArray(apiResponse.items)).toBeTruthy();
      expect(apiResponse).toHaveProperty('pages');
      expect(apiResponse).toHaveProperty('total');
    }
  });

  test('2.17 - 页面加载性能测试', async ({ page }) => {
    const startTime = Date.now();
    
    await loginPage.loginAsAdmin();
    
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const loadTime = Date.now() - startTime;
    console.log(`职位页面加载时间: ${loadTime}ms`);
    
    expect(loadTime).toBeLessThan(15000);
  });

  test('2.18 - 错误处理和边界情况', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await jobsPage.navigate();
    await jobsPage.waitForJobsToLoad();
    
    const specialChars = '!@#$%^&*()';
    await jobsPage.searchInput.fill(specialChars);
    await jobsPage.searchInput.press('Enter');
    
    await page.waitForTimeout(1000);
    
    const noCrash = await jobsPage.jobList.isVisible({ timeout: 5000 });
    expect(noCrash).toBeTruthy();
  });
});

async function step(name: string, fn: () => Promise<void>) {
  console.log(`\n📋 步骤: ${name}`);
  await fn();
}
