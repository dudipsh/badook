import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import heCommon from './locales/he/common.json';
import heAuth from './locales/he/auth.json';
import heNav from './locales/he/nav.json';
import heProjects from './locales/he/projects.json';
import heSettings from './locales/he/settings.json';
import heTrainingLab from './locales/he/training-lab.json';
import heRefData from './locales/he/ref-data.json';
import heReports from './locales/he/reports.json';
import heChat from './locales/he/chat.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enNav from './locales/en/nav.json';
import enProjects from './locales/en/projects.json';
import enSettings from './locales/en/settings.json';
import enTrainingLab from './locales/en/training-lab.json';
import enRefData from './locales/en/ref-data.json';
import enReports from './locales/en/reports.json';
import enChat from './locales/en/chat.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      he: { common: heCommon, auth: heAuth, nav: heNav, projects: heProjects, settings: heSettings, 'training-lab': heTrainingLab, 'ref-data': heRefData, reports: heReports, chat: heChat },
      en: { common: enCommon, auth: enAuth, nav: enNav, projects: enProjects, settings: enSettings, 'training-lab': enTrainingLab, 'ref-data': enRefData, reports: enReports, chat: enChat },
    },
    fallbackLng: 'he',
    defaultNS: 'common',
    ns: ['common', 'auth', 'nav', 'projects', 'settings', 'training-lab', 'ref-data', 'reports', 'chat'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
