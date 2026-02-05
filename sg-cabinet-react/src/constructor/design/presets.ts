import type { ThemeTokens } from './theme';

export type ThemePreset = {
  id: string;
  title: string;
  tokens: Partial<ThemeTokens>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'dark-pro',
    title: 'Dark Pro',
    tokens: {
      'color-bg': '#0b0f18',
      'color-surface': '#0f172a',
      'color-card': '#0b1220',
      'color-border': '#263048',
      'color-text': '#e8f0ff',
      'color-muted': '#97aac4',
      'color-brand': '#7C5CFF',
      'btn-primary-bg': '#7C5CFF',
      'btn-primary-text': '#ffffff',
      'tabbar-bg': '#0c0d12',
      'tabbar-text': '#97aac4',
      'tabbar-active': '#ffffff',
      'a-surface': 0.88,
      'a-card': 0.92,
      'a-overlay': 0.70,
      'shadow-a': 0.22,
      'glow-a': 0.28,
    },
  },
  {
    id: 'light-air',
    title: 'Light Air',
    tokens: {
      'color-bg': '#f4f6ff',
      'color-surface': '#eef2ff',
      'color-card': '#ffffff',
      'color-border': '#dbe3ff',
      'color-text': '#0b1220',
      'color-muted': '#4b5563',
      'color-brand': '#22d3ee',
      'btn-primary-bg': '#22d3ee',
      'btn-primary-text': '#001018',
      'tabbar-bg': '#ffffff',
      'tabbar-text': '#6b7280',
      'tabbar-active': '#0b1220',
      'a-surface': 0.92,
      'a-card': 0.92,
      'a-overlay': 0.60,
      'shadow-a': 0.16,
      'glow-a': 0.18,
    },
  },
  {
    id: 'neon',
    title: 'Neon',
    tokens: {
      'color-bg': '#060812',
      'color-surface': '#0b1020',
      'color-card': '#08112b',
      'color-border': '#253055',
      'color-text': '#eaf1ff',
      'color-muted': '#9db0d1',
      'color-brand': '#22d3ee',
      'btn-primary-bg': '#22d3ee',
      'btn-primary-text': '#001018',
      'a-surface': 0.86,
      'a-card': 0.90,
      'shadow-a': 0.28,
      'glow-a': 0.45,
    },
  },
];
