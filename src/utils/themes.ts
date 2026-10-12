import type { ThemeType } from '../types/market';

export interface ThemeConfig {
  id: ThemeType;
  name: string;
}

export const THEMES: Record<ThemeType, ThemeConfig> = {
  light: {
    id: 'light',
    name: 'Light',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
  },
};
