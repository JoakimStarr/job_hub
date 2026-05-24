import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/unit/**/*.test.ts',
      'test/integration/**/*.test.ts',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '.next/',
      'e2e/',
    ],
    
    // 路径别名配置
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      
      // 全局覆盖率阈值
      thresholds: {
        global: {
          statements: 82,
          branches: 77,
          functions: 82,
          lines: 82,
        },
        
        // 核心算法更高标准 (95%+)
        './src/lib/job-matcher.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        './src/lib/match-engine.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        './src/lib/score-engine.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        
        // 其他重要模块
        './src/lib/enhanced-match-engine.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        './src/lib/resume-parser.ts': {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85,
        },
      },
      
      // 排除不需要统计覆盖率的文件
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
      ],
    },
    
    // 超时时间配置
    testTimeout: 5000,       // 单个测试5秒超时
    hookTimeout: 10000,      // hook函数10秒超时
    
    // 并行配置
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: 4,
      },
    },
    
    // 全局Setup/Teardown文件
    setupFiles: [],
    globalSetup: [],
    globalTeardown: [],
    
    // 报告器配置
    reporter: ['verbose'],
    
    // 缓存配置
    cache: {
      dir: '.vitest-cache',
    },
    
    // 清理策略
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // 是否在失败时输出差异
    diff: true,
    diffOptions: {
      showSequence: true,
    },
  },
  
  // 解析配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '__mocks__': path.resolve(__dirname, './test/__mocks__'),
    },
  },
})
