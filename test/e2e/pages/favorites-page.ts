import { BasePage } from './base-page';
import { Page, Locator } from '@playwright/test';

export class FavoritesPage extends BasePage {
  readonly favoritesList: Locator;
  readonly favoriteItems: Locator;
  readonly emptyState: Locator;
  readonly unfavoriteButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.favoritesList = page.locator('.favorites-list, [data-testid="favorites"]');
    this.favoriteItems = page.locator('.favorite-item');
    this.emptyState = page.locator('text=暂无收藏');
    this.unfavoriteButtons = page.locator('button:has-text("取消收藏")');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/favorites');
    await this.waitForLoadingComplete();
  }

  async waitForFavoritesToLoad(): Promise<void> {
    await this.favoritesList.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getFavoriteCount(): Promise<number> {
    return await this.favoriteItems.count();
  }

  async unfavoriteItem(index: number): Promise<void> {
    await this.unfavoriteButtons.nth(index).click();
    await this.waitForLoadingComplete();
  }

  async isFavoritesEmpty(): Promise<boolean> {
    return await this.emptyState.isVisible({ timeout: 3000 });
  }

  async getFavoriteTitles(): Promise<string[]> {
    const titles: string[] = [];
    const count = await this.favoriteItems.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const title = await this.favoriteItems.nth(i).locator('.job-title').textContent();
      if (title) titles.push(title);
    }
    return titles;
  }
}
