import { Suspense } from 'react';
import { LoginClient } from './login-client';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="app-loading"><div className="loading-orb" /><div>正在载入登录页...</div></div>}>
      <LoginClient />
    </Suspense>
  );
}
