import { makeAutoObservable } from 'mobx';
import i18n from '../i18n';
import { apiClient } from '../services/api-client';

export type SupportedLanguage = 'he' | 'en';

const RTL_LANGUAGES = new Set<string>(['he', 'ar']);

export class LanguageStore {
  language: SupportedLanguage = (localStorage.getItem('i18nextLng') as SupportedLanguage) || 'he';

  constructor() {
    makeAutoObservable(this);
    this.applyDirection();
  }

  get direction(): 'rtl' | 'ltr' {
    return RTL_LANGUAGES.has(this.language) ? 'rtl' : 'ltr';
  }

  get isRtl(): boolean {
    return this.direction === 'rtl';
  }

  get locale(): string {
    return this.language === 'he' ? 'he-IL' : 'en-US';
  }

  /** Called after login/profile load to sync with server preference */
  setFromProfile(lang: string) {
    const safeLang = (lang === 'en' ? 'en' : 'he') as SupportedLanguage;
    this.language = safeLang;
    i18n.changeLanguage(safeLang);
    localStorage.setItem('i18nextLng', safeLang);
    this.applyDirection();
  }

  /** Called from the language selector UI */
  async changeLanguage(lang: SupportedLanguage) {
    this.language = lang;
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    this.applyDirection();

    try {
      await apiClient.patch('/auth/me/language', { language: lang });
    } catch {
      // Local preference saved to localStorage regardless
    }
  }

  private applyDirection() {
    const html = document.documentElement;
    html.setAttribute('dir', this.direction);
    html.setAttribute('lang', this.language);
  }
}
