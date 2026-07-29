import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserCog, LogOut, X } from 'lucide-react';
import { useStores } from '../../lib/store-context';

export const ImpersonationBanner = observer(() => {
  const { t } = useTranslation('common');
  const { authStore } = useStores();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!authStore.isImpersonating || dismissed) return null;

  const handleExit = async () => {
    await authStore.exitImpersonation();
    navigate('/super-admin/companies', { replace: true });
  };

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-sm font-semibold shadow-sm">
      <UserCog className="w-4 h-4 shrink-0" />
      <span>{t('impersonation.banner', { name: authStore.user?.name || authStore.user?.email || '' })}</span>
      <button
        onClick={handleExit}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 hover:bg-amber-950/20 px-2.5 py-1 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        {t('impersonation.exit')}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('impersonation.dismiss')}
        className="inline-flex items-center justify-center rounded-md hover:bg-amber-950/20 p-1 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
});
