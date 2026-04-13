import { useEffect } from 'react';
import { isMac } from '@/lib/platform';

interface HotkeyBinding {
  key: string;
  mod?: boolean;      // Cmd (Mac) / Ctrl (Win)
  shift?: boolean;
  handler: () => void;
}

/**
 * Global keyboard shortcut handler.
 * Cross-platform: uses Cmd on macOS, Ctrl on Windows/Linux.
 */
export function useHotkeys(bindings: HotkeyBinding[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if focused in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Allow Escape even in inputs
        if (e.key !== 'Escape') return;
      }

      for (const binding of bindings) {
        const modPressed = isMac ? e.metaKey : e.ctrlKey;
        const modMatch = binding.mod ? modPressed : !modPressed;
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;
        const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();

        if (keyMatch && modMatch && shiftMatch) {
          e.preventDefault();
          binding.handler();
          return;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [bindings]);
}
