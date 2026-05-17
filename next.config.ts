import type { NextConfig } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  allowedDevOrigins: [
    'localhost:3001',
    'localhost:3000',
    '127.0.0.1:3001',
    '127.0.0.1:3000',
    '192.168.43.64:3001',
  ],
};

export default nextConfig;
