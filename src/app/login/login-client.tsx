'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API } from '@/lib/api';
import { APP_NAME } from '@/lib/constants';
import { Button, Input } from '@/components/ui';

function safeRedirect(raw: string | null) {
  const fallback = '/';
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value || /^https?:\/\//i.test(value) || /^\/\//.test(value)) return fallback;
  const normalized = '/' + value.replace(/^\/+/, '');
  const pathname = normalized.split(/[?#]/, 1)[0];
  if (pathname === '/login') return fallback;
  return normalized;
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 🔄 简单的防循环标记（从sessionStorage读取）
  const isRedirecting = sessionStorage.getItem('auth_is_redirecting') === 'true';

  useEffect(() => {
    // 如果正在跳转中，跳过检查
    if (isRedirecting) return;
    
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (!cancelled && data.authenticated) {
          sessionStorage.setItem('auth_is_redirecting', 'true');
          router.replace(redirect);
        }
      } catch (error) {
        console.error('认证检查失败:', error);
      }
    };

    checkAuth();
    
    return () => {
      cancelled = true;
    };
  }, [redirect, router, isRedirecting]);

  return (
    <main className="auth-page">
      <div className="auth-grid">
        <section className="auth-hero">
          <div className="brand-block" style={{ padding: 0 }}>
            <div className="brand-mark">FH</div>
            <div>
              <div className="brand-name">{APP_NAME}</div>
              <div className="brand-tagline">金融求职工作台</div>
            </div>
          </div>
          <h1>统一登录、岗位、采集和系统控制中心</h1>
          <p>
            基于 Session + Cookie 安全认证体系，
            使用 SHA256 + Salt 密码哈希存储，
            让岗位浏览、收藏管理、爬虫控制、系统配置和 AI 推荐都落在同一套页面框架里。
          </p>
          <div className="auth-meta-grid">
            <div className="auth-meta">
              <div style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12 }}>默认角色</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>admin / operator / viewer</div>
            </div>
            <div className="auth-meta">
              <div style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12 }}>访问方式</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>Session + Cookie (HttpOnly)</div>
            </div>
            <div className="auth-meta">
              <div style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12 }}>密码存储</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>SHA256 + Random Salt</div>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <h1>账号登录</h1>
          <p>登录后进入平台，并按权限访问对应模块。</p>

          <form
            className="auth-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setLoading(true);
              setMessage('');
              
              try {
                const response = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (!response.ok) {
                  throw new Error(data.error || `HTTP ${response.status}`);
                }

                if (data.success) {
                  setIsError(false);
                  
                  // ✅ 设置防循环标记
                  sessionStorage.setItem('auth_is_redirecting', 'true');
                  
                  setMessage(data.message || '登录成功，正在跳转...');
                  
                  // 立即跳转（无延迟）
                  // router.replace(redirect);
                  window.location.href = redirect;
                } else {
                  throw new Error(data.error || '登录失败');
                }
                
              } catch (requestError) {
                setIsError(true);
                setMessage(requestError instanceof Error ? requestError.message : '登录失败');
              } finally {
                setLoading(false);
              }
            }}
          >
            <label>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>用户名</div>
              <Input 
                value={username} 
                onChange={(event) => setUsername(event.target.value)} 
                placeholder="请输入用户名" 
                required 
                autoComplete="username"
              />
            </label>
            <label>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>密码</div>
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                togglePassword
                placeholder="请输入密码"
                required 
                autoComplete="current-password"
              />
            </label>
            
            {message ? (
              <div className={`notice ${isError ? 'notice-error' : 'notice-success'}`}>
                {message}
              </div>
            ) : null}
            
            <Button type="submit" disabled={loading}>
              {loading ? '正在登录...' : '登录并进入平台'}
            </Button>
          </form>

          <div className="auth-guest-link">
            <span className="auth-divider">或</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => router.push('/')}
            >
              以访客身份浏览岗位
            </button>
          </div>

          {/* 开发环境显示默认账号 */}
          {process.env.NODE_ENV === 'development' && (
          <div className="demo-hint">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>默认账号 (数据库版)</div>
            <div style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: 13 }}>
              <div><strong>admin</strong> / <code style={{ background: 'var(--panel)', padding: '2px 6px', borderRadius: 4 }}>root</code> — 全部权限</div>
              <div><strong>operator</strong> / <code style={{ background: 'var(--panel)', padding: '2px 6px', borderRadius: 4 }}>root</code> — 运营权限</div>
              <div><strong>viewer</strong> / <code style={{ background: 'var(--panel)', padding: '2px 6px', borderRadius: 4 }}>root</code> — 只读权限</div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
              ⚠️ 请立即修改默认密码！<br/>
              🔒 密码已通过 SHA256 + 随机盐值安全哈希存储
            </div>
          </div>
          )}
        </section>
      </div>
    </main>
  );
}
