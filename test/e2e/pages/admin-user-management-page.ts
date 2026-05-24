import { BasePage } from './base-page';
import { Page, Locator } from '@playwright/test';

export class AdminUserManagementPage extends BasePage {
  readonly userTable: Locator;
  readonly userRows: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly filterSelect: Locator;
  readonly createUserButton: Locator;
  readonly editButtons: Locator;
  readonly pagination: Locator;
  readonly modal: Locator;
  readonly usernameInput: Locator;
  readonly roleSelect: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.userTable = page.locator('table, [data-testid="user-table"]');
    this.userRows = page.locator('tbody tr, .user-row');
    this.searchInput = page.locator('input[placeholder*="搜索"], input[name="search"]');
    this.searchButton = page.locator('button:has-text("搜索")');
    this.filterSelect = page.locator('select[name="role"], [data-filter="role"]');
    this.createUserButton = page.locator('button:has-text("创建用户")');
    this.editButtons = page.locator('button:has-text("编辑")');
    this.pagination = page.locator('.pagination');
    this.modal = page.locator('.modal, [role="dialog"]');
    this.usernameInput = page.locator('.modal input[name="username"]');
    this.roleSelect = page.locator('.modal select[name="role"]');
    this.saveButton = page.locator('.modal button[type="submit"], .modal button:has-text("保存")');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/admin/users');
    await this.waitForLoadingComplete();
  }

  async waitForUsersToLoad(): Promise<void> {
    await this.userTable.waitFor({ state: 'visible', timeout: 15000 });
  }

  async searchUsers(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.waitForLoadingComplete();
  }

  async filterByRole(role: string): Promise<void> {
    await this.filterSelect.selectOption(role);
    await this.waitForLoadingComplete();
  }

  async getUserCount(): Promise<number> {
    return await this.userRows.count();
  }

  async getUserInfo(index: number): Promise<{ username: string; role: string; status: string }> {
    const row = this.userRows.nth(index);
    const cells = row.locator('td, .cell');
    return {
      username: (await cells.nth(0).textContent()) || '',
      role: (await cells.nth(1).textContent()) || '',
      status: (await cells.nth(2).textContent()) || '',
    };
  }

  async clickEditUser(index: number): Promise<void> {
    await this.editButtons.nth(index).click();
    await this.modal.waitFor({ state: 'visible' });
  }

  async editUserInfo(config: { username?: string; role?: string }): Promise<void> {
    if (config.username) {
      await this.usernameInput.fill(config.username);
    }
    if (config.role) {
      await this.roleSelect.selectOption(config.role);
    }
    await this.saveButton.click();
    await this.waitForLoadingComplete();
  }

  async openCreateUserModal(): Promise<void> {
    await this.createUserButton.click();
    await this.modal.waitFor({ state: 'visible' });
  }

  async isModalOpen(): Promise<boolean> {
    return await this.modal.isVisible({ timeout: 3000 });
  }

  async closeModal(): Promise<void> {
    const closeButton = this.modal.locator('button:has-text("关闭"), .modal-close');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }
}
