#!/bin/bash
set -e

echo "📦 安装测试依赖..."
npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8 --save-dev

echo "✅ 依赖安装完成"
echo ""
echo "🧪 可用的测试命令："
echo "  - npm test           # 运行所有测试"
echo "  - npm run test:coverage   # 运行测试并生成覆盖率报告"
echo "  - npm run test:watch      # 监听模式运行测试"
