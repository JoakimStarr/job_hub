'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { APP_NAME, APP_TAGLINE, APP_VERSION, NAV_ITEMS, ROUTE_TITLES } from '@/lib/constants';
import { clearSession, getCachedUser, hasPermission, loadCurrentUser } from '@/lib/auth';
import { AUTH_EXPIRED_EVENT } from '@/lib/constants';
import type { AppUser, PermissionKey } from '@/lib/types';
import { useAppStore } from '@/store';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

const GUEST_ALLOWED_PATHS = ['/', '/jobs'];

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
  const [isGuest, setIsGuest] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { setUser: setStoreUser, setIsGuest: setStoreIsGuest } = useAppStore();
  const visibleItems = useMemo(() => {
    if (isGuest) {
      return NAV_ITEMS.filter((item) => item.guestVisible);
    }
    return NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission));
  }, [user, isGuest]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (mobileOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      const firstFocusable = sidebarRef.current?.querySelector<HTMLElement>(
        'a, button, input, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    } else {
      document.body.style.overflow = '';
      if (mobileOpen === false && isMobile) {
        menuButtonRef.current?.focus();
      }
    }
  }, [mobileOpen, isMobile]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [mobileOpen]);

  useEffect(() => {
    let cancelled = false;

    function redirectToLogin() {
      // 🚨 简单防循环机制：使用时间戳锁（1秒内不重复跳转）
      const lastRedirect = parseInt(sessionStorage.getItem('auth_last_redirect') || '0');
      const now = Date.now();
      
      if (now - lastRedirect < 1000) {
        sessionStorage.removeItem('auth_last_redirect');
        window.location.reload();
        return;
      }
      
      // 记录本次跳转时间
      sessionStorage.setItem('auth_last_redirect', String(now));

      clearSession();
      setUser(null);
      setStoreUser(null);
      setReady(false);
      const redirect = encodeURIComponent(`${pathname}${window.location.search}`);
      router.replace(`/login?redirect=${redirect}`);
    }

    /**
     * 用户身份验证引导函数（极速版）
     * 
     * 设计原则：
     * - 单次检查，快速响应（无重试、无延迟）
     * - 简单的防循环机制（1秒时间戳锁）
     * - 优先Cookie认证，回退Token认证
     */
    async function bootstrap() {
      try {
        // ===== 方式1: Cookie 认证（单次检查） =====
        const authMeResponse = await fetch('/api/auth/me', {
          credentials: 'same-origin',
        });
        
        if (authMeResponse.ok) {
          const authData = await authMeResponse.json();
          
          if (authData.authenticated && authData.user) {
            if (cancelled) return;
            
            // ✅ 认证成功！清除所有锁
            sessionStorage.removeItem('auth_last_redirect');
            sessionStorage.removeItem('auth_is_redirecting');
            
            const user: AppUser = {
              id: authData.user.id,
              username: authData.user.username,
              role: authData.user.role as any,
              permissions: authData.user.permissions || [],
            };
            
            setUser(user);
            setStoreUser(user);
            setStoreIsGuest(false);
            setReady(true);
            
            localStorage.setItem('finintern_hub_auth_token', 'cookie-session');
            localStorage.setItem('finintern_hub_auth_user', JSON.stringify(user));
            
            return;
          }
        }
        
        // ===== 方式2: Token 认证（向后兼容） =====
        const cached = getCachedUser();
        if (cached?.id) {
          if (cancelled) return;
          setUser(cached);
          setStoreUser(cached);
          setStoreIsGuest(false);
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
          // 访客允许的页面，不跳转登录页
          if (GUEST_ALLOWED_PATHS.includes(pathname)) {
            setIsGuest(true);
            setStoreIsGuest(true);
            setReady(true);
            return;
          }
          redirectToLogin();
          return;
        }

        setUser(current);
        setStoreUser(current);
        setStoreIsGuest(false);
        setReady(true);
        
      } catch (error) {
        if (!cancelled) {
          if (GUEST_ALLOWED_PATHS.includes(pathname)) {
            setIsGuest(true);
            setStoreIsGuest(true);
            setReady(true);
          } else {
            redirectToLogin();
          }
        }
      }
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
  }, [router]); // ✅ 移除 pathname 依赖，只在组件挂载时认证一次

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

  const displayName = isGuest ? '访客' : (user?.display_name || user?.username || '访客');
  const userRole = isGuest ? '访客模式' : (user?.role || 'guest');

  return (
    <div className="app-root">
      {isMobile && mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={joinClassNames('sidebar', mobileOpen && 'sidebar-open')}
        aria-label="主导航菜单"
      >
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
            <div className="user-chip-avatar">{getInitials(displayName)}</div>
            <div className="user-info">
              <div className="user-chip-name">{displayName}</div>
              <div className="user-chip-role">{userRole}</div>
            </div>
          </div>
          {isGuest ? (
            <button
              className="btn sidebar-login-btn"
              onClick={() => router.push('/login')}
              aria-label="登录"
            >
              登录
            </button>
          ) : (
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
          )}
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          {isMobile && (
            <button
              ref={menuButtonRef}
              className="btn btn-secondary mobile-menu-btn"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
              aria-expanded={mobileOpen}
            >
              ☰
            </button>
          )}
          <div>
            <div className="topbar-title">{currentRouteTitle}</div>
            <div className="topbar-subtitle">{description || '统一账号、岗位和系统控制中心'}</div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>

        {isGuest && (
          <div className="guest-banner">
            <span className="guest-banner-text">当前为访客模式，登录后可使用收藏、匹配、AI推荐等完整功能</span>
            <button className="btn btn-sm guest-banner-login" onClick={() => router.push('/login')}>
              立即登录
            </button>
          </div>
        )}

        <PageTransition>
          <div className="page-content">{children}</div>
        </PageTransition>

        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-main">
              <span className="footer-brand">FinIntern Hub</span>
              <span className="footer-separator">·</span>
              <span className="footer-text">仅为个人学习开发用途</span>
            </div>
            <div className="footer-sub">
              <span>灵感来源：我们伟大的宝宝</span>
              <span className="footer-separator">·</span>
              <span>作者：JoakimStarr / 文人病</span>
              <span className="footer-separator">·</span>
              <span className="footer-version">{APP_VERSION}</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}