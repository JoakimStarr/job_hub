'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxHeight?: string;
}

export function BottomSheet({ isOpen, onClose, children, title, maxHeight = '85vh' }: BottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    setStartY(clientY);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const diff = clientY - startY;
    if (diff > 0) {
      setCurrentY(diff);
    }
  }, [isDragging, startY]);

  const handleDragEnd = useCallback((clientY: number) => {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = clientY - startY;
    if (diff > 50) {
      onClose();
    }
    setCurrentY(0);
  }, [isDragging, startY, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  }, [handleDragMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    handleDragEnd(e.changedTouches[0].clientY);
  }, [handleDragEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleDragStart(e.clientY);
  }, [handleDragStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    handleDragMove(e.clientY);
  }, [isDragging, handleDragMove]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    handleDragEnd(e.clientY);
  }, [handleDragEnd]);

  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener('mousemove', handleMouseMove as unknown as EventListener);
    window.addEventListener('mouseup', handleMouseUp as unknown as EventListener);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove as unknown as EventListener);
      window.removeEventListener('mouseup', handleMouseUp as unknown as EventListener);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className={`bottom-sheet ${isDragging ? 'bottom-sheet--dragging' : ''}`}
        style={{
          transform: `translateY(${currentY}px)`,
          maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        role="dialog"
        aria-modal="true"
        aria-label={title || "详情面板"}
      >
        <div className="bottom-sheet__handle" />
        
        {title && (
          <div className="bottom-sheet__header">
            <h3 className="bottom-sheet__title">{title}</h3>
            <button 
              className="bottom-sheet__close"
              onClick={onClose}
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        )}
        
        <div className="bottom-sheet__content">
          {children}
        </div>
      </div>
    </div>
  );
}
