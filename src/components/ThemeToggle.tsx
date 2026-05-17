'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const buttonStyle: React.CSSProperties = {
    minWidth: 44,
    minHeight: 44,
    padding: '8px 12px',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 18,
  };

  if (!mounted) {
    return (
      <button
        className="btn btn-secondary theme-toggle"
        aria-label="切换主题"
        style={buttonStyle}
      >
        <span style={iconStyle}>☀️</span>
      </button>
    );
  }

  return (
    <button
      className="btn btn-secondary theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
      style={buttonStyle}
    >
      <span style={iconStyle}>{theme === 'light' ? '🌙' : '☀️'}</span>
    </button>
  );
}
