import { observer } from 'mobx-react-lite';
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import type { TestRunResult } from '../../../../../services/testing.service';

interface Props {
  result: TestRunResult;
}

export const TestResultsPanel = observer(({ result }: Props) => {
  const passedCount = result.assertions.filter((a) => a.passed).length;
  const failedCount = result.assertions.filter((a) => !a.passed).length;

  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
      <div
        className={`px-5 py-3 flex items-center justify-between ${
          result.status === 'passed'
            ? 'bg-green-50 border-b border-green-200'
            : result.status === 'failed'
              ? 'bg-red-50 border-b border-red-200'
              : 'bg-yellow-50 border-b border-yellow-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {result.status === 'passed' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : result.status === 'failed' ? (
            <XCircle className="w-5 h-5 text-red-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          )}
          <div>
            <span className="font-semibold text-gray-900">{result.caseName}</span>
            <span className="text-sm text-gray-500 mr-2">
              ({result.mode === 'live' ? 'סריקה חיה' : 'מוק'})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {(result.duration / 1000).toFixed(1)}s
          </span>
          <span className="text-green-600 font-medium">{passedCount} עברו</span>
          {failedCount > 0 && (
            <span className="text-red-600 font-medium">{failedCount} נכשלו</span>
          )}
        </div>
      </div>

      {result.error && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {result.error}
        </div>
      )}

      {result.assertions.length > 0 && (
        <div className="divide-y divide-gray-100">
          {result.assertions.map((assertion, i) => (
            <div
              key={i}
              className={`px-5 py-2.5 flex items-center justify-between text-sm ${
                !assertion.passed ? 'bg-red-50/50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {assertion.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span className="text-gray-700">{assertion.name}</span>
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                  {assertion.category}
                </span>
              </div>
              {!assertion.passed && (
                <div className="text-xs text-gray-500">
                  <span className="text-red-600">קיבלנו: {JSON.stringify(assertion.actual)}</span>
                  {' · '}
                  <span className="text-green-600">צפוי: {JSON.stringify(assertion.expected)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
