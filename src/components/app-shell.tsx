'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { APP_NAME, APP_TAGLINE, APP_VERSION, NAV_ITEMS, ROUTE_TITLES } from '@/lib/constants';
import { clearSession, getCachedUser, hasPermission, loadCurrentUser } from '@/lib/auth';
import { AUTH_EXPIRED_EVENT } from '@/lib/constants';
import type { AppUser, PermissionKey } from '@/lib/types';
import { useAppStore } from '@/store';
import { ThemeToggle } from '@/components/ThemeToggle';

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export function AppShell({
  children,
  title,
  description,
  requiredPermission,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  requiredPermission?: PermissionKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setUser: setStoreUser } = useAppStore();
  const visibleItems = useMemo(() => NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission)), [user]);

  useEffect(() => {
    let cancelled = false;

    function redirectToLogin() {
      clearSession();
      setUser(null);
      setStoreUser(null);
      setReady(false);
      const redirect = encodeURIComponent(`${pathname}${window.location.search}`);
      router.replace(`/login?redirect=${redirect}`);
    }

    async function bootstrap() {
      const cached = getCachedUser();
      if (cached?.id) {
        if (cancelled) return;
        setUser(cached);
        setStoreUser(cached);
        setReady(true);
        void loadCurrentUser(true).then((current) => {
          if (!cancelled && current) {
            setUser(current);
            setStoreUser(current);
          }
        });
        return;
      }

      const current = await loadCurrentUser(true);
      if (cancelled) return;
      if (!current) {
        redirectToLogin();
        return;
      }

      setUser(current);
      setStoreUser(current);
      setReady(true);
    }

    const onAuthExpired = () => {
      if (!cancelled) redirectToLogin();
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    void bootstrap();
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    };
  }, [pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const currentRouteTitle = ROUTE_TITLES[pathname] || title;

  if (!ready) {
    return (
      <div className="app-loading">
        <div className="loading-orb" />
        <div>正在载入 {currentRouteTitle}...</div>
      </div>
    );
  }

  if (requiredPermission && user && !hasPermission(user, requiredPermission)) {
    return (
      <div className="app-root app-denied">
        <div className="denied-card">
          <div className="denied-badge">权限受限</div>
          <h1>当前账号没有访问这个页面的权限</h1>
          <p>你已经登录，但当前账号缺少进入此模块所需的权限。请切换账号或联系管理员。</p>
          <div className="row-gap">
            <button className="btn btn-secondary" onClick={() => router.push('/')}>返回首页</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                try {
                  clearSession();
                } finally {
                  router.replace('/login');
                }
              }}
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user?.display_name || user?.username || '访客';
  const userRole = user?.role || 'guest';

  return (
    <div className="app-root">
      <aside className={joinClassNames('sidebar', mobileOpen && 'sidebar-open')}>
        <div className="brand-block">
          <div className="brand-mark">FH</div>
          <div>
            <div className="brand-name">{APP_NAME}</div>
            <div className="brand-tagline">{APP_TAGLINE}</div>
          </div>
        </div>

        <nav className="nav-list" role="navigation" aria-label="主导航">
          {visibleItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={joinClassNames('nav-item', pathname === item.href && 'nav-item-active')}
              onClick={() => setMobileOpen(false)}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              <div className="nav-item-content">
                {item.emoji && <span className="nav-emoji">{item.emoji}</span>}
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-info">
              <div className="user-chip-name">{displayName}</div>
              <div className="user-chip-role">{APP_VERSION}</div>
            </div>
          </div>
          <button
            className="btn sidebar-logout-danger"
            onClick={async () => {
              try {
                clearSession();
              } finally {
                router.replace('/login');
              }
            }}
            aria-label="退出登录"
          >
            退出登录
          </button>
        </div>
      </aside>

      <div className={joinClassNames('sidebar-backdrop', mobileOpen && 'show')} onClick={() => setMobileOpen(false)} />

      <main className="main-shell">
        <header className="topbar">
          <button className="btn btn-secondary mobile-menu-btn" onClick={() => setMobileOpen((value) => !value)} aria-label="打开菜单" aria-expanded={mobileOpen}>
            ☰
          </button>
          <div>
            <div className="topbar-title">{currentRouteTitle}</div>
            <div className="topbar-subtitle">{description || '统一账号、岗位和系统控制中心'}</div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>

        <div className="page-content">{children}</div>

        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-row">
              <span className="footer-label">网站声明</span>
              <span>仅为个人学习开发用途</span>
            </div>
            <div className="footer-row">
              <span className="footer-label">灵感来源</span>
              <span>我们伟大的宝宝</span>
            </div>
            <div className="footer-row">
              <span className="footer-label">网站作者</span>
              <span>JoakimStarr / 文人病</span>
            </div>
            <div className="footer-version">{APP_VERSION}</div>
          </div>
        </footer>
      </main>
    </div>
  );
}