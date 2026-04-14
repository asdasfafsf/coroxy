import { useState, useEffect, useCallback } from 'react';
import { WindowSetDarkTheme, WindowSetLightTheme, WindowSetSystemDefaultTheme, WindowSetBackgroundColour } from '../../wailsjs/runtime/runtime';

type Theme = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'coroxy-theme';

// CSS dark background ≈ oklch(0.130 0.010 270) → RGB(18, 18, 22)
// CSS dark card ≈ oklch(0.155 0.010 270) → RGB(23, 23, 28)
// CSS light background ≈ oklch(0.975 0.003 270) → RGB(245, 244, 243)
const DARK_BG = { r: 23, g: 23, b: 28 };
const LIGHT_BG = { r: 245, g: 244, b: 243 };

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(resolved);

  // Sync Wails native window appearance
  try {
    if (theme === 'system') {
      WindowSetSystemDefaultTheme();
    } else if (resolved === 'dark') {
      WindowSetDarkTheme();
    } else {
      WindowSetLightTheme();
    }

    // Update native window background to match CSS theme
    const bg = resolved === 'dark' ? DARK_BG : LIGHT_BG;
    WindowSetBackgroundColour(bg.r, bg.g, bg.b, 255);
  } catch {
    // Wails runtime not available (e.g. running in browser dev)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as Theme) || 'dark';
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }, []);

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes when in 'system' mode
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
