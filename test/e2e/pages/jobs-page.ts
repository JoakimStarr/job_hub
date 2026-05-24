import { BasePage } from './base-page';
import { Page, Locator, expect } from '@playwright/test';

export class JobsPage extends BasePage {
  readonly searchBar: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly jobList: Locator;
  readonly jobCards: Locator;
  readonly pagination: Locator;
  readonly sortButton: Locator;
  readonly viewToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.searchBar = page.locator('.search-bar-wrapper');
    this.searchInput = page.locator('input[placeholder="搜索岗位"]');
    this.filterButton = page.locator('button:has-text("筛选")');
    this.jobList = page.locator('.job-list, .job-view-container');
    this.jobCards = page.locator('[role="listitem"]');
    this.pagination = page.locator('.pagination');
    this.sortButton = page.locator('button:has-text("排序")');
    this.viewToggle = page.locator('.view-toggle');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/jobs');
    await this.waitForLoadingComplete();
  }

  async waitForJobsToLoad(): Promise<void> {
    await this.jobList.waitFor({ state: 'visible', timeout: 15000 });
  }

  async searchJobs(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingComplete();
  }

  async clearSearch(): Promise<void> {
    const clearButton = this.searchBar.locator('button:has-text("清除")');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await this.waitForLoadingComplete();
    }
  }

  async applyFilter(filterType: string, value: string): Promise<void> {
    await this.filterButton.click();
    await this.page.waitForTimeout(300);
    
    let filterSelector: string;
    switch (filterType) {
      case 'location':
        filterSelector = `text=${value}`;
        break;
      case 'jobType':
        filterSelector = `[data-job-type="${value}"]`;
        break;
      case 'education':
        filterSelector = `[data-education="${value}"]`;
        break;
      default:
        filterSelector = `text=${value}`;
    }
    
    await this.page.locator(filterSelector).click();
    await this.waitForLoadingComplete();
  }

  async getJobCount(): Promise<number> {
    return await this.jobCards.count();
  }

  async clickJobCard(index: number): Promise<void> {
    await this.jobCards.nth(index).click();
    await this.page.waitForTimeout(500);
  }

  async getJobTitle(index: number): Promise<string> {
    return await this.jobCards.nth(index).locator('.job-title').textContent() || '';
  }

  async goToPage(pageNumber: number): Promise<void> {
    await this.pagination.locator(`text=${pageNumber}`).click();
    await this.waitForLoadingComplete();
  }

  async getCurrentPage(): Promise<number> {
    const activePage = this.pagination.locator('.active');
    if (await activePage.isVisible()) {
      return parseInt(await activePage.textContent() || '1');
    }
    return 1;
  }

  async toggleSortOrder(): Promise<void> {
    await this.sortButton.click();
    await this.waitForLoadingComplete();
  }

  async toggleViewMode(): Promise<void> {
    await this.viewToggle.click();
    await this.page.waitForTimeout(500);
  }

  async waitForSearchResults(): Promise<any> {
    return await this.waitForAPIResponse('/api/jobs');
  }

  async isJobListEmpty(): Promise<boolean> {
    const emptyState = this.page.locator('text=暂无岗位');
    return await emptyState.isVisible({ timeout: 3000 });
  }
}
