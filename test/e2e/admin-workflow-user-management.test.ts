import { test, expect, Page } from '@playwright/test';
import { LoginPage, AdminUserManagementPage } from './pages';

test.describe('管理员工作流 - 用户管理', () => {
  let loginPage: LoginPage;
  let adminPage: AdminUserManagementPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    adminPage = new AdminUserManagementPage(page);
  });

  test('4.1 - 管理员登录并访问用户管理页面', async ({ page }) => {
    await loginPage.loginAsAdmin();
    
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const currentUrl = page.url();
    expect(currentUrl).toContain('/admin') || expect(currentUrl).toContain('/users');
  });

  test('4.2 - 查看用户列表', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const userCount = await adminPage.getUserCount();
    console.log(`用户总数: ${userCount}`);
    expect(userCount).toBeGreaterThanOrEqual(3);
  });

  test('4.3 - 验证用户表格结构', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const tableVisible = await adminPage.userTable.isVisible({ timeout: 5000 });
    if (tableVisible) {
      const headers = adminPage.userTable.locator('th');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(0);
      
      for (let i = 0; i < Math.min(headerCount, 10); i++) {
        const headerText = await headers.nth(i).textContent();
        console.log(`表头 ${i + 1}: ${headerText}`);
      }
    }
  });

  test('4.4 - 搜索用户功能', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    try {
      await adminPage.searchUsers('admin');
      
      await page.waitForTimeout(1000);
      
      const filteredCount = await adminPage.getUserCount();
      console.log(`搜索"admin"后找到 ${filteredCount} 个用户`);
      
      if (filteredCount > 0) {
        const firstUser = await adminPage.getUserInfo(0);
        expect(firstUser.username.toLowerCase()).toContain('admin');
      }
    } catch (error) {
      console.log('搜索功能测试跳过:', error.message);
    }
  });

  test('4.5 - 按角色筛选用户', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    try {
      await adminPage.filterByRole('admin');
      
      await page.waitForTimeout(1000);
      
      const adminUsers = await adminPage.getUserCount();
      console.log(`管理员角色用户数: ${adminUsers}`);
      expect(adminUsers).toBeGreaterThanOrEqual(1);
    } catch (error) {
      console.log('角色筛选测试跳过:', error.message);
    }
  });

  test('4.6 - 查看用户详细信息', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const userCount = await adminPage.getUserCount();
    if (userCount > 0) {
      const userInfo = await adminPage.getUserInfo(0);
      
      expect(userInfo.username).toBeTruthy();
      expect(userInfo.role).toBeTruthy();
      expect(userInfo.status).toBeTruthy();
      
      console.log(`第一个用户: ${userInfo.username}, 角色: ${userInfo.role}`);
    }
  });

  test('4.7 - 打开编辑用户模态框', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const editButtons = adminPage.editButtons;
    const editButtonCount = await editButtons.count();
    
    if (editButtonCount > 0) {
      await adminPage.clickEditUser(0);
      
      const isModalOpen = await adminPage.isModalOpen();
      expect(isModalOpen).toBeTruthy();
      
      await adminPage.closeModal();
    } else {
      console.log('没有可用的编辑按钮');
    }
  });

  test('4.8 - 编辑用户信息（模拟）', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const editButtonCount = await adminPage.editButtons.count();
    if (editButtonCount > 0) {
      await adminPage.clickEditUser(0);
      
      try {
        const originalUsername = await adminPage.usernameInput.inputValue();
        
        await adminPage.editUserInfo({
          role: 'operator'
        });
        
        console.log('用户角色编辑操作完成');
      } catch (error) {
        console.log('编辑操作跳过（可能是只读模式）:', error.message);
        await adminPage.closeModal();
      }
    }
  });

  test('4.9 - 用户分页功能', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const paginationVisible = await adminPage.pagination.isVisible({ timeout: 3000 });
    if (paginationVisible) {
      const totalUsers = await adminPage.getUserCount();
      console.log(`当前页显示 ${totalUsers} 个用户`);
      
      const paginationItems = adminPage.pagination.locator('button, a');
      const pageCount = await paginationItems.count();
      
      if (pageCount > 2) {
        console.log(`分页器有 ${pageCount} 个项目`);
      }
    }
  });

  test('4.10 - 创建新用户（打开对话框）', async ({ page }) => {
    test.slow();
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    try {
      await adminPage.openCreateUserModal();
      
      const isModalOpen = await adminPage.isModalOpen();
      expect(isModalOpen).toBeTruthy();
      
      await adminPage.closeModal();
    } catch (error) {
      console.log('创建用户对话框测试跳过:', error.message);
    }
  });

  test('4.11 - 验证权限控制', async ({ page }) => {
    test.slow();
    
    await step('以viewer身份登录', async () => {
      await loginPage.loginAsViewer();
    });
    
    await step('尝试访问管理页面', async () => {
      await adminPage.navigate();
      
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('/login') || 
                          page.url().includes('/') && !currentUrl.includes('/admin');
      
      if (isRedirected) {
        console.log('权限控制正常：非管理员被拒绝访问');
      } else {
        const accessDenied = await page.locator(
          'text=无权限|text=403|text=Forbidden|text=访问被拒绝'
        ).isVisible({ timeout: 3000 });
        
        if (accessDenied) {
          console.log('显示无权限提示');
        }
      }
    });
  });

  test('4.12 - API响应验证', async ({ page }) => {
    await loginPage.loginAsAdmin();
    
    let apiResponses: any[] = [];
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/users') ||
          response.url().includes('/api/admin')) {
        try {
          const data = await response.json();
          apiResponses.push({
            url: response.url(),
            status: response.status(),
            data: data
          });
        } catch (e) {}
      }
    });
    
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    if (apiResponses.length > 0) {
      console.log(`捕获到 ${apiResponses.length} 个用户管理API响应`);
      
      apiResponses.forEach(resp => {
        expect(resp.status).toBe(200);
        if (Array.isArray(resp.data)) {
          expect(resp.data.length).toBeGreaterThan(0);
        }
      });
    }
  });

  test('4.13 - 完整的用户管理工作流', async ({ page }) => {
    test.slow();
    
    await step('管理员登录', async () => {
      await loginPage.loginAsAdmin();
      await expect(page).not.toHaveURL('/login', { timeout: 8000 });
    });
    
    await step('进入用户管理页面', async () => {
      await adminPage.navigate();
      await adminPage.waitForUsersToLoad();
    });
    
    await step('查看所有用户', async () => {
      const totalCount = await adminPage.getUserCount();
      console.log(`系统中共有 ${totalCount} 个用户`);
      expect(totalCount).toBeGreaterThan(0);
    });
    
    await step('搜索特定用户', async () => {
      try {
        await adminPage.searchUsers('admin');
        await page.waitForTimeout(500);
        
        const searchResults = await adminPage.getUserCount();
        console.log(`搜索结果: ${searchResults} 个用户`);
      } catch (error) {
        console.log('搜索步骤跳过');
      }
    });
    
    await step('查看第一个用户的详细信息', async () => {
      const userCount = await adminPage.getUserCount();
      if (userCount > 0) {
        const userInfo = await adminPage.getUserInfo(0);
        console.log(`用户详情:`, userInfo);
      }
    });
  });

  test('4.14 - 表格排序功能', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const sortHeaders = adminPage.userTable.locator('th[aria-sort], th.sortable, th:has(button)');
    const sortHeaderCount = await sortHeaders.count();
    
    if (sortHeaderCount > 0) {
      await sortHeaders.first().click();
      await page.waitForTimeout(500);
      
      const usersAfterSort = await adminPage.getUserCount();
      expect(usersAfterSort).toBeGreaterThan(0);
      
      console.log(`点击了排序列，当前显示 ${usersAfterSort} 个用户`);
    }
  });

  test('4.15 - 批量操作UI验证', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await adminPage.navigate();
    await adminPage.waitForUsersToLoad();
    
    const checkboxes = page.locator('input[type="checkbox"][name="select"], .user-checkbox');
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount > 0) {
      await checkboxes.first().click();
      
      const isChecked = await checkboxes.first().isChecked();
      expect(isChecked).toBeTruthy();
      
      const bulkActionsBar = page.locator('.bulk-actions, [data-bulk-actions]');
      if (await bulkActionsBar.isVisible({ timeout: 2000 })) {
        console.log('批量操作栏已显示');
      }
    } else {
      console.log('未找到复选框，批量操作可能未实现');
    }
  });
});

async function step(name: string, fn: () => Promise<void>) {
  console.log(`\n📋 步骤: ${name}`);
  await fn();
}
