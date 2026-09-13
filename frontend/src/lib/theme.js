import { useEffect, useState } from 'react';

const THEME_KEY = 'theme';
const PRESET_KEY = 'preset';

// Palette ids from styles/tokens.css [data-preset] blocks;
// 'snow' is the default and has no block of its own.
export const PRESET_IDS = [
  'snow', 'midnight-blue', 'forest-green', 'rose-pink', 'solarized', 'nord',
  'dracula', 'tokyo-night', 'github', 'google', 'gruvbox', 'cream',
];

export function getPreset() {
  const stored = localStorage.getItem(PRESET_KEY);
  return PRESET_IDS.includes(stored) ? stored : 'snow';
}

// Persists the choice and mirrors it onto <html data-preset="...">;
// 'snow' is the default, so the attribute is cleared for snow.
export function setPreset(id) {
  const next = PRESET_IDS.includes(id) ? id : 'snow';
  if (next === 'snow') {
    delete document.documentElement.dataset.preset;
  } else {
    document.documentElement.dataset.preset = next;
  }
  localStorage.setItem(PRESET_KEY, next);
  return next;
}

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
  const [preset, setPresetState] = useState(getPreset);

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    setPreset(preset);
  }, [preset]);

  const setThemeAndState = (value) => setThemeState(value === 'dark' ? 'dark' : 'light');
  const toggle = () => setThemeState(current => (current === 'dark' ? 'light' : 'dark'));
  const setPresetAndState = (id) => setPresetState(PRESET_IDS.includes(id) ? id : 'snow');

  return { theme, setTheme: setThemeAndState, toggleTheme: toggle, preset, setPreset: setPresetAndState };
}
