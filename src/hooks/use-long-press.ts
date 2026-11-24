
"use client";

import { useCallback, useRef } from 'react';

interface LongPressOptions {
  delay?: number;
  threshold?: number;
}

export const useLongPress = <T extends HTMLElement>({
  onLongPress,
  onClick,
  options = {},
}: {
  onLongPress: (event: React.MouseEvent<T> | React.TouchEvent<T>) => void;
  onClick?: (event: React.MouseEvent<T> | React.TouchEvent<T>) => void;
  options?: LongPressOptions;
}) => {
  const { delay = 400, threshold = 10 } = options;
  const timeout = useRef<NodeJS.Timeout>();
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggered = useRef(false);

  const clear = useCallback((shouldTriggerClick = true, event?: any) => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    
    if (shouldTriggerClick && !isLongPressTriggered.current && onClick && event) {
      onClick(event);
    }
    
    isLongPressTriggered.current = false;
    startPos.current = null;
  }, [onClick]);

  const start = useCallback(
    (event: React.MouseEvent<T> | React.TouchEvent<T>) => {
      // Don't prevent default here! Let the scroll happen.
      isLongPressTriggered.current = false;
      
      const pos = 'touches' in event 
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : { x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY };
      
      startPos.current = pos;

      timeout.current = setTimeout(() => {
        onLongPress(event);
        isLongPressTriggered.current = true;
      }, delay);
    },
    [onLongPress, delay]
  );

  const move = useCallback((event: React.TouchEvent<T> | React.MouseEvent<T>) => {
    if (!startPos.current) return;

    const pos = 'touches' in event 
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY };

    const distance = Math.sqrt(
      Math.pow(pos.x - startPos.current.x, 2) + Math.pow(pos.y - startPos.current.y, 2)
    );

    // If moved more than the threshold, cancel the long press (it's a scroll/swipe)
    if (distance > threshold) {
      clear(false);
    }
  }, [clear, threshold]);

  return {
    onMouseDown: (e: React.MouseEvent<T>) => start(e),
    onMouseMove: (e: React.MouseEvent<T>) => move(e),
    onMouseUp: (e: React.MouseEvent<T>) => clear(true, e),
    onMouseLeave: () => clear(false),
    onTouchStart: (e: React.TouchEvent<T>) => start(e),
    onTouchMove: (e: React.TouchEvent<T>) => move(e),
    onTouchEnd: (e: React.TouchEvent<T>) => clear(true, e),
    // Prevent context menu only if we triggered long press
    onContextMenu: (e: React.MouseEvent<T>) => {
      if (isLongPressTriggered.current) {
        e.preventDefault();
      }
    }
  };
};
