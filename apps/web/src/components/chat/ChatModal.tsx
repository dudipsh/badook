import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, PanelLeftClose } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../lib/store-context';
import { ChatSidebar } from './ChatSidebar';
import { ChatWelcomeScreen } from './ChatWelcomeScreen';
import { ChatMessageFeed } from './ChatMessageFeed';
import { ChatInput } from './ChatInput';
import { ChatScopeBar } from './ChatScopeBar';
import { DocumentDetailModal } from './DocumentDetailModal';

export const ChatModal = observer(() => {
  const { chatStore, languageStore } = useStores();
  const { t } = useTranslation('chat');
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [inputBarHeight, setInputBarHeight] = useState(0);

  // The input bar is overlaid (absolute) to keep the gradient fade over the
  // feed. Reserve exactly its measured height as bottom padding so the last
  // message is never hidden behind it — even as the bar grows with multi-line
  // text or attachment previews.
  useLayoutEffect(() => {
    const el = inputBarRef.current;
    if (!el) return;
    const update = () => setInputBarHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [chatStore.isOpen]);

  const handlePickAction = (prompt: string) => {
    chatStore.setInput(prompt);
    void chatStore.sendMessage(prompt);
  };

  return createPortal(
    <AnimatePresence>
      {chatStore.isOpen && (
        <motion.div
          key="chat-modal"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-4 md:inset-6 z-[100] bg-base-100/95 backdrop-blur-3xl shadow-[0_20px_60px_rgb(0,0,0,0.15)] rounded-3xl border border-base-300 flex overflow-hidden"
          dir={languageStore.direction}
        >
          <ChatSidebar />

          <div className="flex-1 flex flex-col relative bg-base-100/40">
            <div className="px-6 py-5 flex items-center justify-between absolute top-0 w-full z-10 bg-gradient-to-b from-base-100 via-base-100/95 to-transparent pointer-events-none">
              <div className="flex items-center gap-3 pointer-events-auto">
                <div className="md:hidden flex items-center gap-3">
                  <Sparkles
                    className="w-5 h-5 text-primary"
                    stroke="url(#badookGradient)"
                    fill="url(#badookGradient)"
                  />
                  <h3 className="font-bold text-lg tracking-tight text-base-content/80 mt-1">
                    {t('assistantTitle')}
                  </h3>
                </div>
                <button
                  aria-label={t('toggleSidebar')}
                  className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:bg-base-200 hover:text-base-content hidden md:flex transition-colors"
                >
                  <PanelLeftClose className="w-5 h-5 rtl:-scale-x-100" />
                </button>
              </div>
              <button
                onClick={() => chatStore.close()}
                aria-label={t('close')}
                className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:bg-base-200 hover:text-base-content transition-colors pointer-events-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="flex-1 w-full overflow-y-auto px-4 pt-24 pb-36 flex flex-col items-center"
              style={inputBarHeight ? { paddingBottom: inputBarHeight + 16 } : undefined}
            >
              {chatStore.messages.length === 0 ? (
                <ChatWelcomeScreen onPickAction={handlePickAction} />
              ) : (
                <ChatMessageFeed />
              )}
            </div>

            <div
              ref={inputBarRef}
              className="absolute bottom-0 w-full bg-gradient-to-t from-base-100 via-base-100/95 to-transparent pt-14 pb-12 px-4 z-20"
            >
              <ChatScopeBar />
              <ChatInput />
            </div>
          </div>
          <DocumentDetailModal />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
});
