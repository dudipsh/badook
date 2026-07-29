import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { TestTube2, Loader2, PlayCircle } from 'lucide-react';
import { useStores } from '../../../../lib/store-context';
import { TestCaseCard } from './components/TestCaseCard';
import { TestResultsPanel } from './components/TestResultsPanel';
import toast from 'react-hot-toast';

export const TestingTab = observer(() => {
  const { t } = useTranslation('settings');
  const { testingStore } = useStores();

  useEffect(() => { testingStore.fetchCases(); }, [testingStore]);

  const handleRunLive = async (id: string) => {
    try {
      const result = await testingStore.runLive(id);
      const failed = result.assertions.filter((a) => !a.passed).length;
      toast[result.status === 'passed' ? 'success' : 'error'](
        `${result.caseName}: ${result.status === 'passed' ? 'כל הטסטים עברו' : `${failed} טסטים נכשלו`}`,
      );
    } catch {
      toast.error('שגיאה בהרצת טסט חי');
    }
  };

  const handleRunMock = async (id: string) => {
    try {
      const result = await testingStore.runMock(id);
      const failed = result.assertions.filter((a) => !a.passed).length;
      toast[result.status === 'passed' ? 'success' : 'error'](
        `${result.caseName}: ${result.status === 'passed' ? 'כל הטסטים עברו' : `${failed} טסטים נכשלו`}`,
      );
    } catch {
      toast.error('שגיאה בהרצת טסט מול מוק');
    }
  };

  const handleGenerateMocks = async (id: string) => {
    try {
      await testingStore.generateMocks(id);
      toast.success('מוקים נוצרו בהצלחה');
    } catch {
      toast.error('שגיאה ביצירת מוקים');
    }
  };

  const handleRunAllMocks = async () => {
    try {
      const results = await testingStore.runAllMocks();
      if (!results) return;
      const passed = results.filter((r) => r.status === 'passed').length;
      const failed = results.length - passed;
      toast[failed === 0 ? 'success' : 'error'](
        failed === 0 ? `כל ${passed} הטסטים עברו` : `${passed} עברו, ${failed} נכשלו`,
      );
    } catch {
      toast.error('שגיאה בהרצת כל הטסטים');
    }
  };

  if (testingStore.loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (testingStore.cases.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <TestTube2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium">{t('testing.noCases', 'אין טסטים')}</p>
        <p className="text-sm mt-1">{t('testing.noCasesDesc', 'הוסף תקיות עם מסמכים ב-test-fixtures/chains/')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={handleRunAllMocks}
          disabled={testingStore.running || testingStore.cases.filter((c) => c.hasMocks).length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
        >
          {testingStore.running && testingStore.runningCaseId === '__all__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {t('testing.runAllMocks', 'הרצת כל המוקים')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {testingStore.cases.map((tc) => (
          <TestCaseCard
            key={tc.id}
            testCase={tc}
            running={testingStore.running}
            runningCaseId={testingStore.runningCaseId}
            generatingMocksForId={testingStore.generatingMocksForId}
            onRunLive={handleRunLive}
            onRunMock={handleRunMock}
            onGenerateMocks={handleGenerateMocks}
          />
        ))}
      </div>

      {testingStore.currentResult && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('testing.lastResult', 'תוצאת הרצה אחרונה')}</h2>
          <TestResultsPanel result={testingStore.currentResult} />
        </div>
      )}

      {testingStore.results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('testing.allResults', 'תוצאות הרצת כל המוקים')}</h2>
          {testingStore.results.map((result) => <TestResultsPanel key={result.runId} result={result} />)}
        </div>
      )}

    </div>
  );
});
