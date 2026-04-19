import { useState, useEffect, useCallback } from 'react';

type Theme = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'coroxy-theme';

const DARK_BG = { r: 20, g: 20, b: 26 };
const LIGHT_BG = { r: 245, g: 244, b: 243 };

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;

  // 1. CSS class toggle — this MUST happen regardless of Wails
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(resolved);

  // 2. Wails native window — optional, may fail in browser
  if (typeof window !== 'undefined' && 'runtime' in window) {
    try {
      const rt = (window as Record<string, unknown>).runtime as Record<
        string,
        (...args: unknown[]) => void
      >;
      if (theme === 'system') {
        rt.WindowSetSystemDefaultTheme();
      } else if (resolved === 'dark') {
        rt.WindowSetDarkTheme();
      } else {
        rt.WindowSetLightTheme();
      }
      const bg = resolved === 'dark' ? DARK_BG : LIGHT_BG;
      rt.WindowSetBackgroundColour(bg.r, bg.g, bg.b, 255);
    } catch {
      // Not in Wails context — ignore
    }
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      /* ignore */
    }
    return 'dark';
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    applyTheme(t);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  return { theme, setTheme, resolvedTheme };
}
