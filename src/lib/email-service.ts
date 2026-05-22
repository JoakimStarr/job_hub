import nodemailer from 'nodemailer';
import { logger } from './logger';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  fromEmail?: string;
}

export interface JobAlertEmailData {
  to: string;
  keywords: string[];
  jobs: Array<{
    id: number;
    title: string;
    company?: string;
    location?: string;
    salary?: string;
    source?: string;
    university?: string;
    source_url?: string;
    matchedKeywords: string[];
  }>;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn('SMTP configuration not complete. Email sending will be disabled.');
    return null;
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    user,
    pass,
    fromName: process.env.SMTP_FROM_NAME || '职位提醒',
    fromEmail: process.env.SMTP_FROM_EMAIL || user,
  };
}

function createTransporter(config: SmtpConfig): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function sendJobAlertEmail(emailData: JobAlertEmailData): Promise<{ success: boolean; error?: string }> {
  const config = getSmtpConfig();

  if (!config) {
    return { success: false, error: 'SMTP configuration not complete' };
  }

  const transporter = createTransporter(config);

  const { to, keywords, jobs } = emailData;
  const keywordStr = keywords.join('、');

  const jobListHtml = jobs.map((job, index) => `
    <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">
        <a href="${job.source_url || '#'}" style="color: #3b82f6; text-decoration: none;">
          ${index + 1}. ${job.title}
        </a>
      </h3>
      ${job.company ? `<p style="margin: 5px 0; color: #666;"><strong>公司：</strong>${job.company}</p>` : ''}
      ${job.location ? `<p style="margin: 5px 0; color: #666;"><strong>地点：</strong>${job.location}</p>` : ''}
      ${job.salary ? `<p style="margin: 5px 0; color: #666;"><strong>薪资：</strong>${job.salary}</p>` : ''}
      ${job.university ? `<p style="margin: 5px 0; color: #666;"><strong>来源：</strong>${job.university}</p>` : ''}
      <p style="margin: 5px 0; color: #3b82f6;">
        <strong>匹配关键词：</strong>${job.matchedKeywords.join('、')}
      </p>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        .keyword-tag { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; margin: 2px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🎯 职位提醒</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">发现 ${jobs.length} 个匹配岗位</p>
        </div>
        <div class="content">
          <p>您好！</p>
          <p>根据您订阅的关键词：</p>
          <p style="margin: 15px 0;">
            ${keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('')}
          </p>
          <p>我们发现了以下 <strong>${jobs.length}</strong> 个新岗位：</p>
          <div style="margin: 20px 0;">
            ${jobListHtml}
          </div>
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666;">
            如需修改订阅设置或取消订阅，请登录系统设置页面。
          </p>
        </div>
        <div class="footer">
          <p>此邮件由系统自动发送，请勿直接回复。</p>
          <p>© ${new Date().getFullYear()} Job Hub 职位提醒服务</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
职位提醒 - 发现 ${jobs.length} 个匹配岗位

您好！

根据您订阅的关键词：${keywordStr}

我们发现了以下 ${jobs.length} 个新岗位：

${jobs.map((job, i) => `
${i + 1}. ${job.title}
   公司：${job.company || '未知'}
   地点：${job.location || '未知'}
   薪资：${job.salary || '面议'}
   来源：${job.university || '未知'}
   匹配关键词：${job.matchedKeywords.join('、')}
   链接：${job.source_url || ''}
`).join('\n')}

如需修改订阅设置或取消订阅，请登录系统设置页面。

此邮件由系统自动发送，请勿直接回复。
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: `【职位提醒】发现 ${jobs.length} 个匹配岗位 - ${keywordStr}`,
      text,
      html,
    });

    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to send email to ${to}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  const config = getSmtpConfig();

  if (!config) {
    return { success: false, error: 'SMTP configuration not complete' };
  }

  const transporter = createTransporter(config);

  try {
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: '【职位提醒】测试邮件',
      text: '这是一封测试邮件，如果您收到此邮件，说明邮件配置正确。',
      html: `
        <div style="padding: 20px; font-family: sans-serif;">
          <h2>测试邮件</h2>
          <p>这是一封测试邮件，如果您收到此邮件，说明邮件配置正确。</p>
          <p>发送时间：${new Date().toLocaleString('zh-CN')}</p>
        </div>
      `,
    });

    logger.info(`Test email sent to ${to}: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to send test email to ${to}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}
