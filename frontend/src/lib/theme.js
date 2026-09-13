import { useEffect, useState } from 'react';

const THEME_KEY = 'theme';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

// Persists the choice and mirrors it onto <html data-theme="...">;
// 'light' is the default, so the attribute is cleared for light.
export function setTheme(value) {
  const next = value === 'dark' ? 'dark' : 'light';
  if (next === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  } else {
    delete document.documentElement.dataset.theme;
  }
  localStorage.setItem(THEME_KEY, next);
  return next;
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

// React binding: state + effect so subscribers re-render on change
// without prop drilling or context.
export function useTheme() {
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  const setThemeAndState = (value) => setThemeState(value === 'dark' ? 'dark' : 'light');
  const toggle = () => setThemeState(current => (current === 'dark' ? 'light' : 'dark'));

  return { theme, setTheme: setThemeAndState, toggleTheme: toggle };
}
