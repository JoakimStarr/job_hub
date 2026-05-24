import { BasePage } from './base-page';
import { Page, Locator, expect } from '@playwright/test';

export class AdminSystemMonitorPage extends BasePage {
  readonly systemStatusCard: Locator;
  readonly crawlerStatusCard: Locator;
  readonly logViewer: Locator;
  readonly healthCheckButton: Locator;
  readonly refreshButton: Locator;
  readonly crawlerStartButton: Locator;
  readonly crawlerStopButton: Locator;
  readonly logContent: Locator;
  readonly statusIndicators: Locator;

  constructor(page: Page) {
    super(page);
    this.systemStatusCard = page.locator('[data-testid="system-status"], .system-status-card');
    this.crawlerStatusCard = page.locator('[data-testid="crawler-status"], .crawler-status-card');
    this.logViewer = page.locator('.log-viewer, [data-testid="log-viewer"]');
    this.healthCheckButton = page.locator('button:has-text("健康检查"), button:has-text("Health Check")');
    this.refreshButton = page.locator('button:has-text("刷新")');
    this.crawlerStartButton = page.locator('button:has-text("启动爬虫")');
    this.crawlerStopButton = page.locator('button:has-text("停止爬虫")');
    this.logContent = page.locator('.log-content, pre');
    this.statusIndicators = page.locator('.status-indicator, .health-indicator');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/admin/system');
    await this.waitForLoadingComplete();
    
    if (!await this.systemStatusCard.isVisible({ timeout: 5000 })) {
      await this.page.goto('/system');
      await this.waitForLoadingComplete();
    }
  }

  async waitForSystemStatusToLoad(): Promise<void> {
    try {
      await this.systemStatusCard.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      await this.page.waitForTimeout(2000);
    }
  }

  async getSystemStatus(): Promise<{ database: string; api: string; memory: string }> {
    const indicators = this.statusIndicators;
    const result: any = {};
    
    const dbIndicator = indicators.filter({ hasText: /数据库|Database/i });
    if (await dbIndicator.isVisible()) {
      result.database = await dbIndicator.textContent() || '';
    }

    const apiIndicator = indicators.filter({ hasText: /API|接口/i });
    if (await apiIndicator.isVisible()) {
      result.api = await apiIndicator.textContent() || '';
    }

    const memIndicator = indicators.filter({ hasText: /内存|Memory/i });
    if (await memIndicator.isVisible()) {
      result.memory = await memIndicator.textContent() || '';
    }

    return result;
  }

  async getCrawlerStatus(): Promise<string> {
    const statusText = await this.crawlerStatusCard.textContent();
    return statusText || '';
  }

  async runHealthCheck(): Promise<any> {
    if (await this.healthCheckButton.isVisible()) {
      await this.healthCheckButton.click();
      await this.page.waitForTimeout(1000);
      
      try {
        const response = await this.waitForAPIResponse('/api/system/status');
        return response;
      } catch {
        return null;
      }
    }
    return null;
  }

  async viewLogs(logType?: string): Promise<void> {
    if (logType) {
      const logTab = this.page.locator(`text=${logType}`);
      if (await logTab.isVisible()) {
        await logTab.click();
      }
    }
    await this.logViewer.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getLogContent(): Promise<string> {
    if (await this.logContent.isVisible()) {
      return await this.logContent.textContent() || '';
    }
    return '';
  }

  async startCrawler(): Promise<void> {
    if (await this.crawlerStartButton.isVisible()) {
      await this.crawlerStartButton.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async stopCrawler(): Promise<void> {
    if (await this.crawlerStopButton.isVisible()) {
      await this.crawlerStopButton.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async refreshSystemStatus(): Promise<void> {
    if (await this.refreshButton.isVisible()) {
      await this.refreshButton.click();
      await this.waitForLoadingComplete();
    }
  }

  async isSystemHealthy(): Promise<boolean> {
    const healthyIndicator = this.page.locator('.status-healthy, text=正常, text=Healthy');
    return await healthyIndicator.isVisible({ timeout: 3000 });
  }
}
