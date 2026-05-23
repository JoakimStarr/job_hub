'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type TransitionState = 'idle' | 'entering' | 'exiting';

/**
 * 页面路由过渡动画组件
 *
 * 当路由变化时，先播放退出动画（淡出+上移），
 * 动画结束后替换内容并播放进入动画（淡入+下移）。
 * 使用 onAnimationEnd 检测动画完成，而非 setTimeout。
 *
 * 注意：通过 prevPathname ref 检测路由变更与页面内状态变更的区别，
 * 确保同一页面内的 state 变化（如弹窗打开、视图切换）能立即反映到 UI。
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const isFirstRender = useRef(true);
  const pendingChildren = useRef<ReactNode>(null);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // 首次渲染不播放动画
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayChildren(children);
      return;
    }

    if (prevPathname.current !== pathname) {
      // 路由变化 → 存储新内容并播放退出动画
      prevPathname.current = pathname;
      pendingChildren.current = children;
      setTransitionState('exiting');
    } else {
      // 同一页面内 children 变化（如弹窗、视图切换）→ 立即更新
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  const handleAnimationEnd = () => {
    if (transitionState === 'exiting' && pendingChildren.current !== null) {
      setDisplayChildren(pendingChildren.current);
      pendingChildren.current = null;
      setTransitionState('entering');
    } else if (transitionState === 'entering') {
      setTransitionState('idle');
    }
  };

  return (
    <div
      className={`page-transition-${transitionState}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {displayChildren}
    </div>
  );
}
