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
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const isFirstRender = useRef(true);
  const pendingChildren = useRef<ReactNode>(null);

  useEffect(() => {
    // 首次渲染不播放动画
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayChildren(children);
      return;
    }

    // 存储新内容并开始退出动画
    pendingChildren.current = children;
    setTransitionState('exiting');
  }, [pathname]); // 仅依赖 pathname，不依赖 children

  const handleAnimationEnd = () => {
    if (transitionState === 'exiting' && pendingChildren.current !== null) {
      // 退出动画完成，替换内容并开始进入动画
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
