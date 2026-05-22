/**
 * 隐私信息脱敏工具
 * 用于在前端展示和API响应中对敏感信息进行脱敏处理
 */

// 手机号脱敏：13812345678 → 138****5678
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.slice(0, 3) + '****' + cleaned.slice(7);
  }
  if (cleaned.length >= 7) {
    return cleaned.slice(0, 3) + '****' + cleaned.slice(-4);
  }
  return phone.slice(0, 2) + '****';
}

// 邮箱脱敏：zhangsan@example.com → zha****@example.com
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return local[0] + '***@' + domain;
  }
  return local.slice(0, 3) + '***@' + domain;
}

// 身份证号脱敏：110101199001011234 → 1101****1234
export function maskIdCard(idCard: string): string {
  if (!idCard) return '';
  if (idCard.length >= 15) {
    return idCard.slice(0, 4) + '**********' + idCard.slice(-4);
  }
  return idCard.slice(0, 3) + '****';
}

// 姓名脱敏：张三 → 张*，欧阳修 → 欧阳*
export function maskName(name: string): string {
  if (!name) return '';
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name.slice(0, name.length > 3 ? 2 : 1) + '*'.repeat(name.length - (name.length > 3 ? 2 : 1));
}

// 地址脱敏：北京市朝阳区xx路xx号 → 北京市朝阳区***
export function maskAddress(address: string): string {
  if (!address) return '';
  // 保留省市区，后面脱敏
  const match = address.match(/^(.{2,6}(?:省|市|区|县|镇))/);
  if (match) {
    return match[1] + '***';
  }
  return address.slice(0, 4) + '***';
}

// 通用脱敏：保留前后各n个字符
export function maskGeneric(text: string, keepStart = 2, keepEnd = 2): string {
  if (!text) return '';
  if (text.length <= keepStart + keepEnd) return text[0] + '***';
  return text.slice(0, keepStart) + '***' + text.slice(-keepEnd);
}

// 对整个 profile 对象进行脱敏（用于前端展示）
export function maskProfile<T extends Record<string, any>>(profile: T): T {
  return {
    ...profile,
    phone: maskPhone(profile.phone || ''),
    email: maskEmail(profile.email || ''),
  };
}
