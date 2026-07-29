import { makeAutoObservable } from 'mobx';

export type ThemeMode = 'light' | 'dark';

const THEME_NAME: Record<ThemeMode, string> = {
  light: 'badook',
  dark: 'badook-dark',
};

export class ThemeStore {
  mode: ThemeMode = (localStorage.getItem('badook-theme') as ThemeMode) || 'light';

  constructor() {
    makeAutoObservable(this);
    this.apply();
  }

  get isDark(): boolean {
    return this.mode === 'dark';
  }

  toggle() {
    this.setMode(this.mode === 'light' ? 'dark' : 'light');
  }

  setMode(mode: ThemeMode) {
    this.mode = mode;
    localStorage.setItem('badook-theme', mode);
    this.apply();
  }

  private apply() {
    document.documentElement.setAttribute('data-theme', THEME_NAME[this.mode]);
  }
}
