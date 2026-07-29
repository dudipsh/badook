import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Settings, Globe, Moon, Sun } from 'lucide-react';
import { useStores } from '../../lib/store-context';

declare const __APP_VERSION__: string;

interface UserMenuDropdownProps {
  userInitials: string;
  onClose: () => void;
}

export const UserMenuDropdown = observer(({ userInitials, onClose }: UserMenuDropdownProps) => {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const { authStore, languageStore, themeStore } = useStores();

  return (
    <div className="absolute bottom-full left-2 right-2 mb-1 bg-base-100 border border-base-300 rounded-2xl shadow-xl z-50 overflow-hidden">
      <div className="flex flex-col items-center py-5 px-4 border-b border-base-300">
        <div className="w-16 h-16 rounded-full bg-secondary text-secondary-content flex items-center justify-center text-2xl font-bold mb-3">
          {userInitials}
        </div>
        <p className="text-sm font-semibold text-base-content">{authStore.user?.name || t('common:user')}</p>
        <p className="text-xs text-base-content/40">{authStore.user?.email || ''}</p>
        <p className="text-xs text-base-content/30 mt-1">v{__APP_VERSION__}</p>
      </div>

      {authStore.isAdmin && authStore.user?.companyId && (
        <div className="py-1.5">
          <button
            onClick={() => { navigate('/settings'); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-base-content/60 hover:bg-base-200 transition-colors"
          >
            <Settings size={16} className="text-base-content/40" />
            <span>{t('settings')}</span>
          </button>
        </div>
      )}

      <div className="border-t border-base-300 py-1.5">
        <button
          onClick={() => {
            const newLang = languageStore.language === 'he' ? 'en' : 'he';
            languageStore.changeLanguage(newLang);
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-base-content/60 hover:bg-base-200 transition-colors"
        >
          <Globe size={16} className="text-base-content/40" />
          <span>{t('languageToggle')}</span>
        </button>
        <button
          onClick={() => themeStore.toggle()}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-base-content/60 hover:bg-base-200 transition-colors"
        >
          {themeStore.isDark ? (
            <Sun size={16} className="text-base-content/40" />
          ) : (
            <Moon size={16} className="text-base-content/40" />
          )}
          <span>{themeStore.isDark ? t('themeToggleLight') : t('themeToggle')}</span>
        </button>
      </div>

      <div className="border-t border-base-300 py-1.5">
        <button
          onClick={() => { authStore.logout(); navigate('/login'); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-base-content/60 hover:bg-error/10 hover:text-error transition-colors"
        >
          <LogOut size={16} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </div>
  );
});
