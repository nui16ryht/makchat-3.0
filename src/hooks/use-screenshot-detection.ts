
"use client";

import { useEffect, useCallback } from 'react';

// A simple Debounce function
function debounce(func: (...args: any[]) => void, delay: number) {
  let timeout: NodeJS.Timeout;
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}


export function useScreenshotDetection({ onScreenshot }: { onScreenshot: () => void }) {

  useEffect(() => {
    // Debounce the onScreenshot call to avoid multiple triggers for a single action
    const debouncedOnScreenshot = debounce(onScreenshot, 500);

    const handleKeyDown = (event: KeyboardEvent) => {
      // Basic check for PrintScreen key and common OS-level screenshot shortcuts.
      // This is not foolproof but covers many cases.
      if (event.key === 'PrintScreen' || 
         ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === '3' || event.key === '4' || event.key === 's' || event.key === 'S'))
      ) {
        debouncedOnScreenshot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScreenshot]);
}
