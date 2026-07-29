import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  FileSearch,
  Cpu,
  LayoutList,
  Zap,
  GitMerge,
  CheckCircle,
  Workflow,
  ChevronDown,
  ChevronUp,
  Terminal,
  Trash2,
  ArrowLeft,
  Download,
  FileText,
  FileDown,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ScanLogEntry } from '../../../stores/gmail.store';
import { exportActivityAsText, exportActivityAsPdf } from '../../../lib/export-scan-logs';

interface Props {
  logs: ScanLogEntry[];
  scanning: boolean;
  onClear: () => void;
}

const SUMMARY_KEYWORDS: Record<string, string> = {
  'עובדו': 'text-green-400 font-semibold',
  'דולגו': 'text-orange-400 font-semibold',
  'נכשלו': 'text-error/60 font-semibold',
};

function renderDetails(details: string) {
  const regex = /(עובדו:\s*\d+|דולגו:\s*\d+|נכשלו:\s*\d+)/g;
  const parts = details.split(regex);
  return parts.map((part, i) => {
    const keyword = Object.keys(SUMMARY_KEYWORDS).find(k => part.startsWith(k));
    if (keyword) {
      return <span key={i} className={SUMMARY_KEYWORDS[keyword]}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function getRowStyle(entry: ScanLogEntry) {
  const status = entry.status || 'working';
  if (status === 'error' || entry.message.startsWith('שגיאה'))
    return { row: 'text-error/60 bg-red-950/30 rounded px-1 -mx-1', icon: 'text-error/60', label: 'text-error/60', msg: 'text-red-300', detail: 'text-error/70' };
  if (status === 'waiting')
    return { row: 'text-yellow-400/80 bg-yellow-950/20 rounded px-1 -mx-1', icon: 'text-yellow-400', label: 'text-yellow-400', msg: 'text-yellow-300/80', detail: 'text-yellow-500/50' };
  if (status === 'done')
    return { row: 'text-base-content/30', icon: '', label: '', msg: 'text-base-content/30', detail: 'text-base-content/40' };
  return { row: 'text-white', icon: '', label: '', msg: 'text-white', detail: 'text-base-content/30' };
}

export const ScanActivityFeed = observer(({ logs, scanning, onClear }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('settings');
  const [expanded, setExpanded] = useState(() => {
    try {
      const savedLogs = localStorage.getItem('scanLogs');
      return savedLogs ? JSON.parse(savedLogs).length > 0 : false;
    } catch { return false; }
  });

  const AGENT_CONFIG: Record<
    ScanLogEntry['agent'],
    { icon: React.ElementType; color: string; label: string }
  > = {
    scanner: { icon: FileSearch, color: 'text-blue-400', label: t('scanLog.agents.scanner') },
    ocr: { icon: Cpu, color: 'text-secondary', label: t('scanLog.agents.ocr') },
    intake: { icon: LayoutList, color: 'text-secondary', label: t('scanLog.agents.intake') },
    extraction: { icon: Zap, color: 'text-amber-400', label: t('scanLog.agents.extraction') },
    verification: { icon: ShieldCheck, color: 'text-teal-400', label: t('scanLog.agents.verification') },
    matching: { icon: GitMerge, color: 'text-emerald-400', label: t('scanLog.agents.matching') },
    pipeline: { icon: Workflow, color: 'text-cyan-400', label: t('scanLog.agents.pipeline') },
    postScan: { icon: CheckCircle, color: 'text-blue-400', label: t('scanLog.agents.postScan') },
  };

  // Auto-expand when scanning starts
  useEffect(() => {
    if (scanning) setExpanded(true);
  }, [scanning]);

  useEffect(() => {
    if (expanded && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, expanded]);

  // Close export dropdown on click outside
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  // Find the last "working" entry to show as current agent
  const lastWorking = scanning
    ? [...logs].reverse().find(l => l.status === 'working' || (!l.status && !l.message.startsWith('שגיאה') && !l.message.startsWith('ממתין')))
    : null;
  const currentAgent = lastWorking ? AGENT_CONFIG[lastWorking.agent] : null;

  const errorCount = logs.filter(l => l.status === 'error' || l.message.startsWith('שגיאה')).length;

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Terminal className="w-4 h-4 text-base-content/40" />
          <span className="text-sm font-medium text-base-content/30">{t('scanLog.title')}</span>
          {scanning && currentAgent && (
            <div className="flex items-center gap-1.5 bg-gray-800 rounded-full px-2.5 py-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className={`text-xs font-medium ${currentAgent.color}`}>{currentAgent.label}</span>
            </div>
          )}
          {scanning && !currentAgent && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">{t('scanLog.active')}</span>
            </div>
          )}
        </button>
        <div className="flex items-center gap-3">
          {logs.length > 0 && !scanning && (
            <>
              <div ref={exportRef} className="relative">
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="flex items-center gap-1 text-xs text-base-content/50 hover:text-green-400 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  {t('scanLog.download')}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {exportOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => { exportActivityAsText(logs); setExportOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-base-content/30 hover:bg-gray-700 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      {t('scanLog.textTxt')}
                    </button>
                    <button
                      onClick={() => { exportActivityAsPdf(logs); setExportOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-base-content/30 hover:bg-gray-700 transition-colors"
                    >
                      <FileDown className="w-3 h-3" />
                      PDF
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={onClear}
                className="flex items-center gap-1 text-xs text-base-content/50 hover:text-error/60 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                {t('scanLog.clear')}
              </button>
            </>
          )}
          {logs.length > 0 && (
            <span className="text-xs text-base-content/40">
              {logs.length} {t('scanLog.entries')}
              {errorCount > 0 && (
                <span className="text-error/60 mr-1">
                  ({errorCount} {t('scanLog.errors')})
                </span>
              )}
            </span>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-base-content/50 hover:text-base-content/30 transition-colors">
            {expanded
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
      {expanded && (
        <div ref={containerRef} className="h-80 overflow-y-auto p-4 font-mono text-[15px] leading-6 space-y-2 border-t border-gray-800" dir="rtl">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-base-content/40">
              {scanning ? t('scanLog.waitingForLogs') : t('scanLog.noLogsYet')}
            </div>
          ) : (
            <>
              {logs.map((entry, i) => {
                const config = AGENT_CONFIG[entry.agent];
                const Icon = config.icon;
                const time = entry.timestamp.split('T')[1]?.slice(0, 8) || '';
                const style = getRowStyle(entry);
                const isWaiting = entry.status === 'waiting';
                return (
                  <div key={i} className={`flex items-start gap-2 ${style.row}`}>
                    <span className="text-base-content/30 flex-shrink-0 w-16 text-left" dir="ltr">{time}</span>
                    {isWaiting ? (
                      <ArrowLeft className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-400" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${style.icon || config.color}`} />
                    )}
                    <span className={`flex-shrink-0 ${style.label || config.color}`}>[{config.label}]</span>
                    <span className={style.msg}>{entry.message}</span>
                    {entry.details && (
                      <span className={style.detail}>| {renderDetails(entry.details)}</span>
                    )}
                  </div>
                );
              })}
              <div />
            </>
          )}
        </div>
      )}
    </div>
  );
});
