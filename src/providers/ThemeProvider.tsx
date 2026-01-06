'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Force light theme for now (dark theme needs work)
  useEffect(() => {
    setMounted(true);
    // Clear any saved dark theme preference and force light
    localStorage.setItem('theme', 'light');
    setTheme('light');
  }, []);

  // Apply theme changes - FORCED LIGHT for now (dark theme needs work)
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Always force light theme
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
    setResolvedTheme('light');
  }, [theme, mounted]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
