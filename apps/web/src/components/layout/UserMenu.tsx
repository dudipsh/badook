import { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { UserMenuDropdown } from './UserMenuDropdown';
import { useStores } from '../../lib/store-context';

export const UserMenu = observer(() => {
  const { t } = useTranslation('nav');
  const { authStore } = useStores();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userInitials = authStore.user?.name
    ? authStore.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 border-t border-base-300 hover:bg-base-200/60 transition-colors cursor-pointer"
      >
        <div className="w-10 h-10 rounded-full bg-secondary text-secondary-content flex items-center justify-center text-sm font-medium flex-shrink-0">
          {userInitials}
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-medium text-base-content truncate">
            {authStore.user?.name || t('common:user')}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`text-base-content/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && <UserMenuDropdown userInitials={userInitials} onClose={() => setOpen(false)} />}
    </div>
  );
});
