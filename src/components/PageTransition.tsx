'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 页面路由过渡动画组件
 *
 * 当路由变化时，为页面内容添加淡入动画效果。
 * 使用 CSS animation 而非 transition，避免与 React 渲染冲突。
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [animating, setAnimating] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // 首次渲染不播放动画
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayChildren(children);
      return;
    }

    // 路由变化时播放过渡动画
    setAnimating(true);
    setDisplayChildren(children);

    const timer = setTimeout(() => {
      setAnimating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname, children]);

  return (
    <div
      className={animating ? 'page-transition-enter' : 'page-transition-idle'}
    >
      {displayChildren}
    </div>
  );
}
