import { DollarSign, Hash, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UsageStats } from '../../../../services/admin.service';

const OPERATION_LABEL_KEYS: Record<string, string> = {
  OCR_DETECT_TYPE: 'ai.operations.docTypeDetection',
  OCR_MULTI_DOC_DETECT: 'ai.operations.multiDocDetection',
  OCR_PARSE_DN: 'ai.operations.deliveryNoteParsing',
  OCR_PARSE_INV: 'ai.operations.invoiceParsing',
  OCR_PARSE_PO: 'ai.operations.poParsing',
  AI_MATCHING: 'ai.operations.smartMatching',
};

function StatsTable({ title, data, labelMap, t }: { title: string; data: Record<string, unknown>; labelMap?: Record<string, string>; t: (key: string) => string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="text-right py-2">{title === t('ai.byProvider') ? t('ai.provider') : t('ai.operation')}</th>
            <th className="text-right py-2">{t('ai.calls')}</th>
            <th className="text-right py-2">{t('ai.tokens')}</th>
            <th className="text-right py-2">{t('ai.cost')}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([key, s]) => {
            const stats = s as { calls: number; tokens: number; cost: number };
            return (
              <tr key={key} className="border-b">
                <td className="py-2 font-medium">{labelMap?.[key] ? t(labelMap[key]) : key}</td>
                <td className="py-2">{stats.calls.toLocaleString()}</td>
                <td className="py-2">{stats.tokens.toLocaleString()}</td>
                <td className="py-2">${stats.cost.toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const AIUsageSection = ({ usageStats }: { usageStats: UsageStats | null }) => {
  const { t } = useTranslation('settings');
  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <DollarSign className="w-5 h-5" />
        {t('ai.title')}
      </h2>
      {usageStats && usageStats.totalCalls > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-sm mb-1">
                <Zap className="w-4 h-4" />
                {t('ai.apiCalls')}
              </div>
              <span className="text-2xl font-bold">{usageStats.totalCalls.toLocaleString()}</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-sm mb-1">
                <Hash className="w-4 h-4" />
                {t('ai.tokens')}
              </div>
              <span className="text-2xl font-bold">{usageStats.totalTokens.toLocaleString()}</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                {t('ai.estimatedCost')}
              </div>
              <span className="text-2xl font-bold">${usageStats.totalCost.toFixed(4)}</span>
            </div>
          </div>
          <StatsTable title={t('ai.byProvider')} data={usageStats.byProvider} t={t} />
          <StatsTable title={t('ai.byOperation')} data={usageStats.byOperation} labelMap={OPERATION_LABEL_KEYS} t={t} />
        </>
      ) : (
        <p className="text-gray-500 text-sm">{t('ai.noUsageData')}</p>
      )}
    </div>
  );
}
