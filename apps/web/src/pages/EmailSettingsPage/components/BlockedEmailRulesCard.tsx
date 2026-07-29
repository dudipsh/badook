import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ShieldBan, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';

export const BlockedEmailRulesCard = observer(() => {
  const { gmailStore } = useStores();
  const { t } = useTranslation('settings');
  const [type, setType] = useState<'sender' | 'subject'>('sender');
  const [pattern, setPattern] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!pattern.trim()) return;
    setAdding(true);
    try {
      await gmailStore.addBlockedRule(type, pattern.trim());
      setPattern('');
      toast.success(t('blocked.ruleAdded'));
    } catch {
      toast.error(t('blocked.ruleAddError'));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (index: number) => {
    try {
      await gmailStore.removeBlockedRule(index);
      toast.success(t('blocked.ruleRemoved'));
    } catch {
      toast.error(t('blocked.ruleRemoveError'));
    }
  };

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldBan className="w-5 h-5 text-warning" />
        <h3 className="text-lg font-semibold">{t('blocked.title')}</h3>
      </div>
      <p className="text-sm text-base-content/50 mb-4">
        {t('blocked.description')}
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'sender' | 'subject')}
          className="px-3 py-2 border border-base-300 rounded-lg text-sm bg-base-100"
        >
          <option value="sender">{t('blocked.sender')}</option>
          <option value="subject">{t('blocked.subject')}</option>
        </select>
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={t('blocked.enterPattern')}
          className="flex-1 px-3 py-2 border border-base-300 rounded-lg text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !pattern.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-warning text-warning-content hover:bg-warning/85 disabled:bg-base-300 disabled:text-base-content/50 text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('common:add')}
        </button>
      </div>

      {gmailStore.blockedRules.length > 0 ? (
        <div className="border border-base-300 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-base-200 border-b border-base-300">
                <th className="text-right py-2 px-4 font-medium text-base-content/60">{t('blocked.type')}</th>
                <th className="text-right py-2 px-4 font-medium text-base-content/60">{t('blocked.pattern')}</th>
                <th className="py-2 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {gmailStore.blockedRules.map((rule, index) => (
                <tr key={index} className="border-b border-base-300 last:border-0">
                  <td className="py-2 px-4 text-base-content/50">
                    {rule.type === 'sender' ? t('blocked.sender') : t('blocked.subject')}
                  </td>
                  <td className="py-2 px-4 font-medium">{rule.pattern}</td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => handleRemove(index)}
                      className="text-error/60 hover:text-error transition-colors"
                      title={t('blocked.removeRule')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-base-content/40 text-center py-4">{t('blocked.noRules')}</p>
      )}
    </div>
  );
});
