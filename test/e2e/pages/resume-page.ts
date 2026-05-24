import { BasePage } from './base-page';
import { Page, Locator } from '@playwright/test';

export class ResumePage extends BasePage {
  readonly uploadArea: Locator;
  readonly uploadButton: Locator;
  readonly fileInput: Locator;
  readonly parseResult: Locator;
  readonly progressBar: Locator;
  readonly diagnosisButton: Locator;

  constructor(page: Page) {
    super(page);
    this.uploadArea = page.locator('.resume-upload-area, [data-testid="resume-upload"]');
    this.uploadButton = page.locator('button:has-text("上传简历")');
    this.fileInput = page.locator('input[type="file"][accept*="pdf"]');
    this.parseResult = page.locator('.resume-parse-result, .resume-summary');
    this.progressBar = page.locator('.progress-bar, .upload-progress');
    this.diagnosisButton = page.locator('button:has-text("诊断")');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/');
    await this.waitForLoadingComplete();
    
    const resumeSection = this.page.locator('text=简历上传');
    if (await resumeSection.isVisible()) {
      await resumeSection.scrollIntoViewIfNeeded();
    }
  }

  async uploadResume(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await this.waitForUploadComplete();
  }

  async waitForUploadComplete(): Promise<void> {
    try {
      await this.progressBar.waitFor({ state: 'hidden', timeout: 30000 });
    } catch {
      await this.page.waitForTimeout(2000);
    }
  }

  async isParseResultVisible(): Promise<boolean> {
    return await this.parseResult.isVisible({ timeout: 10000 });
  }

  async getParsedInfo(): Promise<{ name?: string; education?: string; skills?: string[] }> {
    if (!await this.isParseResultVisible()) {
      return {};
    }

    const result: any = {};
    
    const nameElement = this.parseResult.locator('[data-field="name"]');
    if (await nameElement.isVisible()) {
      result.name = await nameElement.textContent();
    }

    const educationElement = this.parseResult.locator('[data-field="education"]');
    if (await educationElement.isVisible()) {
      result.education = await educationElement.textContent();
    }

    const skillsElements = this.parseResult.locator('[data-field="skill"]');
    if (await skillsElements.first().isVisible()) {
      const count = await skillsElements.count();
      result.skills = [];
      for (let i = 0; i < count; i++) {
        result.skills.push(await skillsElements.nth(i).textContent() || '');
      }
    }

    return result;
  }

  async startDiagnosis(): Promise<void> {
    if (await this.diagnosisButton.isVisible()) {
      await this.diagnosisButton.click();
      await this.waitForLoadingComplete();
    }
  }
}
