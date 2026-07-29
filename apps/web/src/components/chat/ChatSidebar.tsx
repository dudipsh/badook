import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { ChatConversation } from '../../services/chat.service';
import { useStores } from '../../lib/store-context';

type Bucket = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

const bucketOf = (iso: string): Bucket => {
  const now = new Date();
  const d = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);

  if (d >= today) return 'today';
  if (d >= yesterday) return 'yesterday';
  if (d >= weekStart) return 'thisWeek';
  return 'earlier';
};

const BUCKET_ORDER: Bucket[] = ['today', 'yesterday', 'thisWeek', 'earlier'];

export const ChatSidebar = observer(() => {
  const { chatStore } = useStores();
  const { t } = useTranslation('chat');

  const grouped = useMemo(() => {
    const map: Record<Bucket, ChatConversation[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    };
    for (const conv of chatStore.conversations) {
      map[bucketOf(conv.updatedAt)].push(conv);
    }
    return map;
  }, [chatStore.conversations]);

  return (
    <div className="hidden md:flex flex-col w-[260px] lg:w-[280px] shrink-0 bg-base-200/30 border-e border-base-300 z-20">
      <div className="p-4 pt-5">
        <button
          onClick={() => chatStore.resetToWelcome()}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-base-200/80 transition-colors border border-base-300 bg-base-100 shadow-sm group"
        >
          <span className="flex items-center gap-2.5 font-bold text-[15px] text-base-content/90 tracking-tight">
            <Sparkles
              className="w-4 h-4 text-primary"
              stroke="url(#badookGradient)"
              fill="url(#badookGradient)"
            />
            {t('newChat')}
          </span>
          <Plus className="w-4 h-4 text-base-content/40 group-hover:text-primary transition-colors" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {chatStore.conversations.length === 0 && !chatStore.isLoadingConversations && (
          <div className="text-[13px] text-base-content/40 px-3 mt-4 text-center">
            {t('emptyConversations')}
          </div>
        )}

        {BUCKET_ORDER.map((bucket) => {
          const items = grouped[bucket];
          if (items.length === 0) return null;
          return (
            <div key={bucket}>
              <div className="text-[11px] font-bold tracking-wider uppercase text-base-content/40 mt-6 mb-3 px-3">
                {t(bucket)}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((conv) => {
                  const isActive = chatStore.activeConversationId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      className={`group/item w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-start transition-all ${
                        isActive ? 'bg-base-200/80' : 'hover:bg-base-200/60'
                      }`}
                    >
                      <button
                        onClick={() => void chatStore.selectConversation(conv.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-start"
                      >
                        <MessageSquare
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-primary' : 'text-base-content/40 group-hover/item:text-primary'
                          }`}
                        />
                        <span className="text-[14px] truncate text-base-content/80 group-hover/item:text-base-content font-medium">
                          {conv.title}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(t('deleteConfirm'))) {
                            void chatStore.deleteConversation(conv.id);
                          }
                        }}
                        aria-label={t('delete')}
                        title={t('delete')}
                        className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-base-300 text-base-content/40 hover:text-error transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
