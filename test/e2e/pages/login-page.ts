import { BasePage } from './base-page';
import { Page, Locator } from '@playwright/test';

export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly guestButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.locator('input[placeholder="请输入用户名"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.loginButton = page.locator('button[type="submit"]:has-text("登录")');
    this.guestButton = page.locator('button:has-text("访客身份")');
    this.errorMessage = page.locator('.notice-error');
    this.successMessage = page.locator('.notice-success');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForLoadingComplete();
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.waitForLoadingComplete();
  }

  async loginAsAdmin(): Promise<void> {
    await this.login('admin', 'root');
  }

  async loginAsOperator(): Promise<void> {
    await this.login('operator', 'root');
  }

  async loginAsViewer(): Promise<void> {
    await this.login('viewer', 'root');
  }

  async clickGuestAccess(): Promise<void> {
    await this.guestButton.click();
    await this.waitForLoadingComplete();
  }

  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  async getSuccessMessage(): Promise<string | null> {
    if (await this.successMessage.isVisible()) {
      return this.successMessage.textContent();
    }
    return null;
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForURL('**/login', { timeout: 3000 });
      return false;
    } catch {
      return true;
    }
  }
}
