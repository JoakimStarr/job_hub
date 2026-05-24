import { Page, Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForElementVisible(selector: string, timeout = 10000): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  async waitForElementClickable(selector: string, timeout = 10000): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    await element.isEnabled();
    return element;
  }

  async clickElement(selector: string): Promise<void> {
    const element = await this.waitForElementClickable(selector);
    await element.click();
  }

  async fillInput(selector: string, value: string): Promise<void> {
    const input = await this.waitForElementVisible(selector);
    await input.fill(value);
  }

  async getTextContent(selector: string): Promise<string> {
    const element = await this.waitForElementVisible(selector);
    return element.textContent() || '';
  }

  async isElementVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isVisible({ timeout: 5000 });
    } catch {
      return false;
    }
  }

  async waitForNavigation(urlPattern?: string): Promise<void> {
    if (urlPattern) {
      await this.page.waitForURL(urlPattern);
    } else {
      await this.page.waitForLoadState('networkidle');
    }
  }

  async waitForAPIResponse(urlPattern: string | RegExp, timeout = 30000): Promise<any> {
    const response = await this.page.waitForResponse(
      (response) => typeof urlPattern === 'string' 
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url()),
      { timeout }
    );
    return response.json();
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}-${Date.now()}.png` });
  }

  async waitForLoadingComplete(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);
  }
}
