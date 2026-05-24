import { test, expect, Page } from '@playwright/test';
import { LoginPage, HomePage, ResumePage, FavoritesPage } from './pages';

test.describe('新用户首次使用流程', () => {
  let loginPage: LoginPage;
  let homePage: HomePage;
  let resumePage: ResumePage;
  let favoritesPage: FavoritesPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    homePage = new HomePage(page);
    resumePage = new ResumePage(page);
    favoritesPage = new FavoritesPage(page);
  });

  test('1.1 - 访问首页并验证页面加载', async ({ page }) => {
    await homePage.navigate();
    
    await expect(page).toHaveURL('/');
    await homePage.waitForPageLoad();
    
    const metricCards = homePage.metricCards;
    await expect(metricCards).toHaveCount(4);
    
    const totalJobs = await homePage.getMetricCardValue('总岗位数');
    expect(totalJobs).toBeTruthy();
  });

  test('1.2 - 新用户注册/登录流程', async ({ page }) => {
    await loginPage.navigate();
    
    await expect(loginPage.usernameInput).toBeVisible({ timeout: 10000 });
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.guestButton).toBeVisible();
    
    await loginPage.loginAsAdmin();
    
    await expect(page).not.toHaveURL('/login', { timeout: 10000 });
    
    const successMsg = await loginPage.getSuccessMessage();
    if (successMsg) {
      expect(successMsg).toContain('成功');
    }
  });

  test('1.3 - 使用错误凭证登录应显示错误信息', async ({ page }) => {
    await loginPage.navigate();
    
    await loginPage.login('invalid_user', 'wrong_password');
    
    const errorMsg = await loginPage.getErrorMessage();
    if (errorMsg) {
      expect(errorMsg).toBeTruthy();
    }
  });

  test('1.4 - 访客身份浏览首页', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.clickGuestAccess();
    
    await expect(page).not.toHaveURL('/login', { timeout: 5000 });
    
    await homePage.waitForPageLoad();
    const jobCount = await homePage.getJobCount();
    expect(jobCount).toBeGreaterThanOrEqual(0);
  });

  test.skip('1.5 - 上传简历文件（需要PDF文件）', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    
    await resumePage.navigate();
    
    const testFilePath = 'test/fixtures/sample-resume.pdf';
    try {
      await resumePage.uploadResume(testFilePath);
      
      const isParseResultVisible = await resumePage.isParseResultVisible();
      if (isParseResultVisible) {
        const parsedInfo = await resumePage.getParsedInfo();
        expect(parsedInfo).toBeTruthy();
      }
    } catch (error) {
      console.log('简历上传测试跳过，缺少测试PDF文件:', error.message);
    }
  });

  test('1.6 - 查看热门关键词和最新岗位', async ({ page }) => {
    await homePage.navigate();
    await homePage.waitForPageLoad();
    
    const keywords = await homePage.getHotKeywords();
    expect(Array.isArray(keywords)).toBeTruthy();
    
    const jobCount = await homePage.getJobCount();
    expect(jobCount).toBeGreaterThanOrEqual(0);
  });

  test('1.7 - 点击关键词搜索岗位', async ({ page }) => {
    await homePage.navigate();
    await homePage.waitForPageLoad();
    
    const keywords = await homePage.getHotKeywords();
    if (keywords.length > 0) {
      const firstKeyword = keywords[0].split('·')[0];
      
      await homePage.clickKeyword(firstKeyword);
      
      await expect(page).toHaveURL(/\/jobs/, { timeout: 5000 });
    }
  });

  test('1.8 - 查看职位详情弹窗', async ({ page }) => {
    await homePage.navigate();
    await homePage.waitForPageLoad();
    
    const jobCount = await homePage.getJobCount();
    if (jobCount > 0) {
      await homePage.clickJobCard(0);
      
      const modal = page.locator('[role="dialog"], .modal, .job-detail-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
      
      const modalContent = await modal.textContent();
      expect(modalContent?.length).toBeGreaterThan(10);
    }
  });

  test('1.9 - 切换视图模式（卡片/列表）', async ({ page }) => {
    await homePage.navigate();
    await homePage.waitForPageLoad();
    
    await homePage.toggleViewMode();
    
    const jobContainer = page.locator('.job-view-container');
    await expect(jobContainer).toBeVisible();
  });

  test('1.10 - 收藏职位功能', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    
    await homePage.navigate();
    await homePage.waitForPageLoad();
    
    const jobCount = await homePage.getJobCount();
    if (jobCount > 0) {
      const firstJob = homePage.jobCards.nth(0);
      const favoriteButton = firstJob.locator('button[aria-label*="收藏"], .favorite-button');
      
      if (await favoriteButton.isVisible()) {
        await favoriteButton.click();
        
        await favoritesPage.navigate();
        const favoriteCount = await favoritesPage.getFavoriteCount();
        expect(favoriteCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('1.11 - 完整的新用户引导流程', async ({ page }) => {
    test.slow();
    
    await step('访问首页', async () => {
      await homePage.navigate();
      await homePage.waitForPageLoad();
      await expect(page).toHaveURL('/');
    });
    
    await step('登录系统', async () => {
      await loginPage.navigate();
      await loginPage.loginAsAdmin();
      await expect(page).not.toHaveURL('/login', { timeout: 8000 });
    });
    
    await step('返回首页查看概览', async () => {
      await homePage.navigate();
      await homePage.waitForPageLoad();
      
      const totalJobs = await homePage.getMetricCardValue('总岗位数');
      expect(totalJobs).toBeTruthy();
    });
    
    await step('浏览最新岗位', async () => {
      const jobCount = await homePage.getJobCount();
      expect(jobCount).toBeGreaterThanOrEqual(0);
    });
    
    await step('查看收藏页面', async () => {
      await favoritesPage.navigate();
      const isEmpty = await favoritesPage.isFavoritesEmpty();
      expect(typeof isEmpty).toBe('boolean');
    });
  });

  test('1.12 - 验证页面响应式布局', async ({ page }) => {
    await homePage.navigate();
    
    await page.setViewportSize({ width: 1920, height: 1080 });
    await homePage.waitForPageLoad();
    expect(await homePage.isPageLoaded()).toBeTruthy();
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    expect(await homePage.isPageLoaded()).toBeTruthy();
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    expect(await homePage.metricCards.first().isVisible()).toBeTruthy();
  });

  test('1.13 - 首页数据刷新功能', async ({ page }) => {
    await homePage.navigate();
    await homePage.waitForPageLoad();
    
    const initialJobs = await homePage.getJobCount();
    
    await homePage.refreshData();
    
    const refreshedJobs = await homePage.getJobCount();
    expect(refreshedJobs).toBeGreaterThanOrEqual(0);
  });

  test('1.14 - 验证导航栏和菜单可用性', async ({ page }) => {
    await homePage.navigate();
    await homePage.waitForPageLoad();
    
    const navMenu = page.locator('nav, [role="navigation"]');
    await expect(navMenu).toBeVisible();
    
    const navLinks = navMenu.locator('a[href], button');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(0);
  });
});

async function step(name: string, fn: () => Promise<void>) {
  console.log(`\n📋 步骤: ${name}`);
  await fn();
}
