import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle, Copy } from 'lucide-react';
import { adminService, type DiagnosticsData } from '../../../services/admin.service';
import toast from 'react-hot-toast';
import { StatusBadge } from './DiagnosticsStatusBadge';
import { DepStatus } from './DiagnosticsDepStatus';

export const DiagnosticsTab = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.getDiagnostics();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success('Copied to clipboard');
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">Failed to load diagnostics</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 btn btn-sm btn-outline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const promptMismatch = data.prompts.filesOnDiskCount !== data.prompts.loadedInMemoryCount;
  const templatesMissing = !data.prompts.templatesDirExists;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Run this on both local and server to compare and find discrepancies
        </p>
        <div className="flex gap-2">
          <button onClick={copyJson} className="btn btn-sm btn-ghost gap-1.5" title="Copy JSON">
            <Copy className="w-4 h-4" /> Copy JSON
          </button>
          <button onClick={load} disabled={loading} className="btn btn-sm btn-outline gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Critical Alerts */}
      {(templatesMissing || promptMismatch || data.dependencies.mupdf !== 'OK' || data.dependencies.sharp !== 'OK') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <AlertTriangle className="w-5 h-5" />
            Issues detected
          </div>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            {templatesMissing && <li>Templates directory does NOT exist on disk — prompt files not deployed!</li>}
            {promptMismatch && <li>Prompt mismatch: {data.prompts.filesOnDiskCount} files on disk vs {data.prompts.loadedInMemoryCount} loaded in memory</li>}
            {data.dependencies.mupdf !== 'OK' && <li>mupdf failed — PDF-to-PNG conversion will not work for OpenAI</li>}
            {data.dependencies.sharp !== 'OK' && <li>sharp failed — image preprocessing will not work</li>}
          </ul>
        </div>
      )}

      {/* OCR Provider & Environment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">OCR Provider</h3>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${data.ocrProvider === 'GEMINI' ? 'text-blue-600' : 'text-green-600'}`}>
              {data.ocrProvider}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge ok={data.apiKeys.geminiConfigured} label="Gemini Key" />
            <StatusBadge ok={data.apiKeys.openaiConfigured} label="OpenAI Key" />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Environment</h3>
          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
            <span className="text-gray-500">Node</span>
            <span className="font-mono">{data.environment.nodeVersion}</span>
            <span className="text-gray-500">Platform</span>
            <span className="font-mono">{data.environment.platform}/{data.environment.arch}</span>
            <span className="text-gray-500">NODE_ENV</span>
            <span className="font-mono">{data.environment.nodeEnv}</span>
            <span className="text-gray-500">Uptime</span>
            <span className="font-mono">{formatUptime(data.environment.uptime)}</span>
          </div>
        </div>
      </div>

      {/* Dependencies */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-900">Dependencies</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">mupdf (PDF → PNG conversion)</p>
            <DepStatus status={data.dependencies.mupdf} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">sharp (image preprocessing)</p>
            <DepStatus status={data.dependencies.sharp} />
          </div>
        </div>
      </div>

      {/* Infrastructure */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-900">Infrastructure</h3>
        <div className="flex flex-wrap gap-2">
          <StatusBadge ok={data.infrastructure.redisConfigured} label="Redis (Queue)" />
          <StatusBadge ok={data.infrastructure.s3Configured} label={`S3 ${data.infrastructure.s3Bucket ? `(${data.infrastructure.s3Bucket})` : ''}`} />
        </div>
      </div>

      {/* Prompt Templates — the critical section */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Prompt Templates (.md files)</h3>
          <div className="flex gap-3 text-sm">
            <span className={`font-medium ${data.prompts.templatesDirExists ? 'text-green-600' : 'text-red-600'}`}>
              {data.prompts.templatesDirExists ? 'Dir exists' : 'Dir MISSING'}
            </span>
            <span className="text-gray-400">|</span>
            <span>{data.prompts.filesOnDiskCount} files on disk</span>
            <span className="text-gray-400">|</span>
            <span>{data.prompts.loadedInMemoryCount} loaded in memory</span>
          </div>
        </div>

        <div className="text-xs text-gray-400 font-mono break-all">{data.prompts.templatesDir}</div>

        {/* Files on disk */}
        {data.prompts.filesOnDisk.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Files on disk:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-1.5 pr-4">File</th>
                    <th className="pb-1.5 pr-4">Hash</th>
                    <th className="pb-1.5">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.prompts.filesOnDisk.map((f) => (
                    <tr key={f.path}>
                      <td className="py-1.5 pr-4 font-mono text-gray-700">{f.path}</td>
                      <td className="py-1.5 pr-4 font-mono text-gray-500">{f.hash}</td>
                      <td className="py-1.5 text-gray-500">{f.size.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loaded in memory */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Loaded in memory (what agents actually use):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b">
                  <th className="pb-1.5 pr-4">Agent</th>
                  <th className="pb-1.5 pr-4">Key</th>
                  <th className="pb-1.5 pr-4">Name</th>
                  <th className="pb-1.5 pr-4">Hash</th>
                  <th className="pb-1.5">Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.prompts.loadedInMemory.map((p) => {
                  const diskFile = data.prompts.filesOnDisk.find((f) =>
                    f.path.includes(p.promptKey),
                  );
                  const hashMatch = diskFile && diskFile.hash === p.hash;
                  const hasWarning = diskFile && !hashMatch;
                  return (
                    <tr key={`${p.agentType}-${p.promptKey}`} className={hasWarning ? 'bg-amber-50' : ''}>
                      <td className="py-1.5 pr-4 text-gray-500">{p.agentType}</td>
                      <td className="py-1.5 pr-4 font-mono text-gray-700">{p.promptKey}</td>
                      <td className="py-1.5 pr-4 text-gray-600">{p.name}</td>
                      <td className="py-1.5 pr-4 font-mono text-gray-500">
                        {p.hash}
                        {hasWarning && (
                          <span className="text-amber-600 ml-1" title={`Disk hash: ${diskFile.hash}`}>
                            (disk: {diskFile.hash})
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-gray-500">{p.length.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
