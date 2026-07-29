import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { X, Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { adminService, type SystemMessage } from '../../services/admin.service';

const DISMISSED_KEY = 'dismissedSystemMessages';

const readDismissed = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
};

const styleFor = (level: SystemMessage['level']) => {
  switch (level) {
    case 'CRITICAL':
      return { bg: 'bg-red-600 text-white', Icon: AlertOctagon };
    case 'WARNING':
      return { bg: 'bg-amber-500 text-amber-950', Icon: AlertTriangle };
    default:
      return { bg: 'bg-blue-600 text-white', Icon: Info };
  }
};

export const SystemMessageBanner = observer(() => {
  const { authStore } = useStores();
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  useEffect(() => {
    if (!authStore.isAuthenticated) return;
    adminService
      .getActiveSystemMessages()
      .then(setMessages)
      .catch(() => undefined);
  }, [authStore.isAuthenticated]);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };

  const visible = messages.filter((m) => !dismissed.includes(m.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visible.map((m) => {
        const { bg, Icon } = styleFor(m.level);
        return (
          <div key={m.id} className={`flex items-start gap-3 px-4 py-2 text-sm ${bg}`}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-bold">{m.title}</span>
              <span className="opacity-90"> — {m.body}</span>
            </div>
            <button onClick={() => dismiss(m.id)} className="shrink-0 opacity-80 hover:opacity-100" aria-label="dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
});
