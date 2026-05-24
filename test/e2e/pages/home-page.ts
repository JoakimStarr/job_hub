import { BasePage } from './base-page';
import { Page, Locator } from '@playwright/test';

export class HomePage extends BasePage {
  readonly metricCards: Locator;
  readonly hotKeywordsSection: Locator;
  readonly latestJobsSection: Locator;
  readonly jobCards: Locator;
  readonly refreshButton: Locator;
  readonly viewToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.metricCards = page.locator('.metric-card');
    this.hotKeywordsSection = page.locator('text=热门关键词');
    this.latestJobsSection = page.locator('text=最新岗位');
    this.jobCards = page.locator('[role="listitem"]');
    this.refreshButton = page.locator('button:has-text("刷新数据")');
    this.viewToggle = page.locator('.view-toggle');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/');
    await this.waitForLoadingComplete();
  }

  async waitForPageLoad(): Promise<void> {
    await this.metricCards.first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async getMetricCardValue(label: string): Promise<string> {
    const card = this.page.locator(`.metric-card:has-text("${label}")`);
    await card.waitFor({ state: 'visible' });
    return card.locator('.metric-value').textContent() || '';
  }

  async getHotKeywords(): Promise<string[]> {
    const keywords = this.page.locator('.job-tags .badge');
    const count = await keywords.count();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(await keywords.nth(i).textContent() || '');
    }
    return result;
  }

  async getJobCount(): Promise<number> {
    return await this.jobCards.count();
  }

  async clickJobCard(index: number): Promise<void> {
    await this.jobCards.nth(index).click();
  }

  async clickKeyword(keyword: string): Promise<void> {
    await this.page.locator(`.job-tags .badge:has-text("${keyword}")`).click();
  }

  async refreshData(): Promise<void> {
    await this.refreshButton.click();
    await this.waitForLoadingComplete();
  }

  async toggleViewMode(): Promise<void> {
    await this.viewToggle.click();
    await this.page.waitForTimeout(500);
  }

  async isPageLoaded(): Promise<boolean> {
    return await this.metricCards.first().isVisible({ timeout: 5000 });
  }
}
