export interface ParsedUserAgent {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  version?: string;
}

const BROWSER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Edg\/(\d+)/, name: 'Edge' },
  { pattern: /Chrome\/(\d+)/, name: 'Chrome' },
  { pattern: /Firefox\/(\d+)/, name: 'Firefox' },
  { pattern: /Safari\/(\d+)/, name: 'Safari' },
  { pattern: /Opera\/(\d+)|OPR\/(\d+)/, name: 'Opera' },
  { pattern: /MSIE (\d+)|Trident.*rv:(\d+)/, name: 'IE' },
];

const OS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Windows NT 10\.0/, name: 'Windows 10/11' },
  { pattern: /Windows NT 6\.[23]/, name: 'Windows 8' },
  { pattern: /Windows NT 6\.1/, name: 'Windows 7' },
  { pattern: /Mac OS X (\d+[._]\d+)/, name: 'macOS' },
  { pattern: /Android (\d+(\.\d+)?)/, name: 'Android' },
  { pattern: /iPhone OS (\d+[_\.]\d+)/, name: 'iOS' },
  { pattern: /iPad.*OS (\d+[_\.]\d+)/, name: 'iPadOS' },
  { pattern: /Linux/, name: 'Linux' },
  { pattern: /CrOS/, name: 'Chrome OS' },
];

const MOBILE_KEYWORDS = ['Mobile', 'Android', 'iPhone', 'iPad', 'Windows Phone'];
const TABLET_KEYWORDS = ['iPad', 'Tablet', 'PlayBook', 'Silk'];

export function parseUserAgent(ua: string): ParsedUserAgent {
  if (!ua || typeof ua !== 'string') {
    return {
      deviceType: 'desktop',
      browser: 'Unknown',
      os: 'Unknown',
    };
  }

  const deviceType = detectDeviceType(ua);
  const browser = detectBrowser(ua);
  const os = detectOS(ua);

  return { deviceType, browser, os };
}

function detectDeviceType(ua: string): 'desktop' | 'mobile' | 'tablet' {
  if (TABLET_KEYWORDS.some(keyword => ua.includes(keyword))) {
    return 'tablet';
  }
  if (MOBILE_KEYWORDS.some(keyword => ua.includes(keyword))) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowser(ua: string): string {
  for (const { pattern, name } of BROWSER_PATTERNS) {
    const match = ua.match(pattern);
    if (match) {
      const version = match[1] || match[2];
      return version ? `${name} ${version}` : name;
    }
  }
  return 'Unknown';
}

function detectOS(ua: string): string {
  for (const { pattern, name } of OS_PATTERNS) {
    if (pattern.test(ua)) {
      if (name === 'macOS') {
        const match = ua.match(/Mac OS X (\d+[._]\d+)/);
        return match ? `macOS ${match[1].replace('_', '.')}` : name;
      }
      if (name === 'Android') {
        const match = ua.match(/Android (\d+(\.\d+)?)/);
        return match ? `Android ${match[1]}` : name;
      }
      if (name === 'iOS') {
        const match = ua.match(/iPhone OS (\d+[_\.]\d+)/);
        return match ? `iOS ${match[1].replace('_', '.')}` : name;
      }
      return name;
    }
  }
  return 'Unknown';
}

export function formatDeviceIcon(deviceType: string): string {
  switch (deviceType) {
    case 'mobile': return '📱';
    case 'tablet': return '📋';
    default: return '🖥️';
  }
}
