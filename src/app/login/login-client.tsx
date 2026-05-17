'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API } from '@/lib/api';
import { loadCurrentUser, setSession } from '@/lib/auth';
import { APP_NAME, AUTH_TOKEN_KEY } from '@/lib/constants';
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

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined' || !window.localStorage.getItem(AUTH_TOKEN_KEY)) {
      return () => {
        cancelled = true;
      };
    }

    void loadCurrentUser().then((user) => {
      if (!cancelled && user) {
        router.replace(redirect);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [redirect, router]);

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
            保留原有账号体系和 API 结构，使用 Next.js 15 + React 18 + TypeScript 重建前端壳层，
            让岗位浏览、收藏管理、爬虫控制、系统配置和 AI 推荐都落在同一套页面框架里。
          </p>
          <div className="auth-meta-grid">
            <div className="auth-meta">
              <div style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12 }}>默认角色</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>admin / operator / viewer</div>
            </div>
            <div className="auth-meta">
              <div style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12 }}>访问方式</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>Token + localStorage</div>
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
                const payload = await API.login({ username, password });
                setSession(payload.access_token, payload.user);
                setIsError(false);
                setMessage('登录成功，正在跳转...');
                router.replace(redirect);
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
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入用户名" required />
            </label>
            <label>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>密码</div>
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="请输入密码" required />
            </label>
            {message ? <div className={`notice ${isError ? 'notice-error' : 'notice-success'}`}>{message}</div> : null}
            <Button type="submit" disabled={loading}>{loading ? '正在登录...' : '登录并进入平台'}</Button>
          </form>

          <div className="auth-note">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>登录说明</div>
            <div style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: 14 }}>
              默认管理员账号由后端自动创建。未登录或权限不足时，页面会跳转回这里。
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
