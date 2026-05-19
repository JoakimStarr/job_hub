'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

export default function SettingsPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (!data.authenticated) {
          router.replace('/login?redirect=/settings/password');
        }
      } catch (error) {
        console.error('认证检查失败:', error);
        router.replace('/login?redirect=/settings/password');
      }
    };

    checkAuth();
  }, [router]);

  return (
    <main className="settings-password-page">
      <div className="page-header">
        <h1>账户设置</h1>
        <p>管理您的账户安全和偏好</p>
      </div>

      <div className="settings-content">
        <ChangePasswordForm
          onSuccess={() => {
            router.push('/');
          }}
        />
      </div>
    </main>
  );
}
