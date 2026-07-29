import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Play, FileSearch, Wand2, Loader2 } from 'lucide-react';
import type { TestCaseSummary } from '../../../../../services/testing.service';
import { StatusBadge } from './TestStatusBadge';

interface Props {
  testCase: TestCaseSummary;
  running: boolean;
  runningCaseId: string | null;
  generatingMocksForId: string | null;
  onRunLive: (id: string) => void;
  onRunMock: (id: string) => void;
  onGenerateMocks: (id: string) => void;
}

export const TestCaseCard = observer(({
  testCase,
  running,
  runningCaseId,
  generatingMocksForId,
  onRunLive,
  onRunMock,
  onGenerateMocks,
}: Props) => {
  const { t } = useTranslation('settings');
  const isRunning = running && runningCaseId === testCase.id;
  const isGenerating = generatingMocksForId === testCase.id;
  const isDisabled = running || isGenerating;

  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{testCase.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{testCase.description}</p>
        </div>
        {testCase.lastRun && <StatusBadge status={testCase.lastRun.status} />}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {testCase.tags.map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
            {tag}
          </span>
        ))}
        <span className={`px-2 py-0.5 text-xs rounded-full ${testCase.hasMocks ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
          {testCase.hasMocks ? 'מוקים זמינים' : 'ללא מוקים'}
        </span>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
          {testCase.documentCount} {t('testing.documents', 'מסמכים')}
        </span>
      </div>

      {testCase.lastRun && (
        <div className="text-xs text-gray-400 mb-3">
          {t('testing.lastRun', 'הרצה אחרונה')}: {new Date(testCase.lastRun.completedAt).toLocaleString('he-IL')}
          {' · '}
          {testCase.lastRun.passedCount} {t('testing.passed', 'עברו')} / {testCase.lastRun.failedCount} {t('testing.failed', 'נכשלו')}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onRunLive(testCase.id)}
          disabled={isDisabled || testCase.documentCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning && runningCaseId === testCase.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {t('testing.runLive', 'סריקה חיה')}
        </button>

        <button
          onClick={() => onRunMock(testCase.id)}
          disabled={isDisabled || !testCase.hasMocks}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning && runningCaseId === testCase.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileSearch className="w-3.5 h-3.5" />
          )}
          {t('testing.runMock', 'הרצה מול מוק')}
        </button>

        <button
          onClick={() => onGenerateMocks(testCase.id)}
          disabled={isDisabled || testCase.documentCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wand2 className="w-3.5 h-3.5" />
          )}
          {t('testing.generateMocks', 'צור מוקים')}
        </button>
      </div>
    </div>
  );
});
