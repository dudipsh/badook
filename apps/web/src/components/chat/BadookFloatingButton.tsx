import { createPortal } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../lib/store-context';

export const BadookFloatingButton = observer(() => {
  const { chatStore, languageStore } = useStores();
  const { t } = useTranslation('chat');

  return createPortal(
    <button
      onClick={() => chatStore.open()}
      aria-label={t('openAssistant')}
      title={t('openAssistant')}
      dir={languageStore.direction}
      className="fixed bottom-6 rtl:left-6 ltr:right-6 z-[100] btn btn-circle btn-lg bg-base-100 border border-base-300 hover:border-transparent shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(79,70,229,0.25)] hover:scale-110 transition-all duration-500 group overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-[#4F46E5]/15 via-[#8B5CF6]/15 to-[#06B6D4]/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none" />
      <div className="absolute top-0 bottom-0 left-[-150%] rtl:right-[-150%] w-full bg-gradient-to-r from-transparent via-white/80 to-transparent group-hover:translate-x-[250%] rtl:group-hover:-translate-x-[250%] transition-transform duration-[1.2s] ease-in-out z-0 pointer-events-none -skew-x-12" />
      <Sparkles
        className="w-8 h-8 relative z-10"
        stroke="url(#badookGradient)"
        fill="url(#badookGradient)"
      />
    </button>,
    document.body,
  );
});
