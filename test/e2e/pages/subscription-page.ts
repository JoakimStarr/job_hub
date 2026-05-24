import { BasePage } from './base-page';
import { Page, Locator } from '@playwright/test';

export class SubscriptionPage extends BasePage {
  readonly createSubscriptionButton: Locator;
  readonly subscriptionForm: Locator;
  readonly keywordInput: Locator;
  readonly locationInput: Locator;
  readonly salaryMinInput: Locator;
  readonly salaryMaxInput: Locator;
  readonly enableNotification: Locator;
  readonly saveButton: Locator;
  readonly subscriptionList: Locator;
  readonly subscriptionItems: Locator;

  constructor(page: Page) {
    super(page);
    this.createSubscriptionButton = page.locator('button:has-text("创建订阅")');
    this.subscriptionForm = page.locator('.subscription-form, form[data-type="subscription"]');
    this.keywordInput = page.locator('input[name="keywords"], input[placeholder*="关键词"]');
    this.locationInput = page.locator('input[name="location"], input[placeholder*="地点"]');
    this.salaryMinInput = page.locator('input[name="salary_min"], input[placeholder*="最低薪资"]');
    this.salaryMaxInput = page.locator('input[name="salary_max"], input[placeholder*="最高薪资"]');
    this.enableNotification = page.locator('input[type="checkbox"][name*="notify"], [data-enable-notification]');
    this.saveButton = page.locator('button:has-text("保存"), button[type="submit"]:has-text("创建")');
    this.subscriptionList = page.locator('.subscription-list');
    this.subscriptionItems = page.locator('.subscription-item');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/settings/subscriptions');
    await this.waitForLoadingComplete();
  }

  async createSubscription(config: {
    keywords?: string;
    location?: string;
    salaryMin?: string;
    salaryMax?: string;
    enableNotification?: boolean;
  }): Promise<void> {
    await this.createSubscriptionButton.click();
    await this.subscriptionForm.waitFor({ state: 'visible' });

    if (config.keywords) {
      await this.keywordInput.fill(config.keywords);
    }
    if (config.location) {
      await this.locationInput.fill(config.location);
    }
    if (config.salaryMin) {
      await this.salaryMinInput.fill(config.salaryMin);
    }
    if (config.salaryMax) {
      await this.salaryMaxInput.fill(config.salaryMax);
    }
    if (config.enableNotification !== undefined && await this.enableNotification.isVisible()) {
      const isChecked = await this.enableNotification.isChecked();
      if (config.enableNotification !== isChecked) {
        await this.enableNotification.check();
      }
    }

    await this.saveButton.click();
    await this.waitForLoadingComplete();
  }

  async getSubscriptionCount(): Promise<number> {
    return await this.subscriptionItems.count();
  }

  async isFormVisible(): Promise<boolean> {
    return await this.subscriptionForm.isVisible({ timeout: 3000 });
  }

  async testNotification(subscriptionId: string): Promise<any> {
    const response = await this.waitForAPIResponse(`/api/alerts/${subscriptionId}/trigger`);
    return response;
  }
}
