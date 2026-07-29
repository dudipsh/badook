import { format } from 'date-fns';
import type { EmailScanLog } from '../services/gmail.service';
import type { ScanLogEntry } from '../stores/gmail.store';
import i18n from '../i18n';

function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(`settings:export.${key}`, options);
}

function getDocTypeLabel(docType: string): string {
  return i18n.t(`settings:export.docTypes.${docType}`, { defaultValue: docType });
}

function getStatusLabel(status: string): string {
  return i18n.t(`settings:export.statusLabels.${status}`, { defaultValue: status });
}

function getAgentLabel(agent: string): string {
  return i18n.t(`settings:export.agents.${agent}`, { defaultValue: agent });
}

function fmtDate(date: string | null | undefined): string {
  if (!date) return '-';
  try { return format(new Date(date), 'dd/MM/yyyy HH:mm'); } catch { return '-'; }
}

function buildTextReport(logs: EmailScanLog[]): string {
  const lines: string[] = [];
  lines.push(t('reportTitle'));
  lines.push(`${t('generatedAt')} ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);
  lines.push(`${t('totalScans')} ${logs.length}`);
  lines.push('='.repeat(60));
  lines.push('');

  for (const log of logs) {
    lines.push(`${t('subject')} ${log.subject || '-'}`);
    lines.push(`${t('sender')} ${log.senderName || ''} <${log.senderEmail || '-'}>`);
    lines.push(`${t('date')} ${fmtDate(log.createdAt)}`);
    lines.push(`${t('status')} ${getStatusLabel(log.status)}`);
    lines.push(i18n.t('settings:export.filesProcessed', { files: log.attachmentCount, processed: log.processedCount }));

    if (log.errorMessage) {
      lines.push(`${t('error')} ${log.errorMessage}`);
    }

    if (log.attachments && log.attachments.length > 0) {
      lines.push('');
      lines.push(`  ${t('attachments')}`);
      log.attachments.forEach((att, i) => {
        const docType = att.documentType ? ` (${getDocTypeLabel(att.documentType)})` : '';
        const status = getStatusLabel(att.status);
        const error = att.errorMessage ? ` - ${att.errorMessage}` : '';
        lines.push(`  ${i + 1}. ${att.fileName} - ${status}${docType}${error}`);
      });
    }

    lines.push('-'.repeat(60));
    lines.push('');
  }

  return lines.join('\n');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsText(logs: EmailScanLog[]) {
  const text = buildTextReport(logs);
  const bom = '\uFEFF';
  const blob = new Blob([bom + text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `scan-report-${format(new Date(), 'yyyy-MM-dd')}.txt`);
}

export function exportAsPdf(logs: EmailScanLog[]) {
  const text = buildTextReport(logs);
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const reportTitle = t('reportTitle');
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${reportTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; direction: rtl; padding: 20mm; white-space: pre-wrap; line-height: 1.6; }
    @media print { body { padding: 10mm; } @page { margin: 15mm; } }
  </style>
</head>
<body>${escaped}</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
  } else {
    // Fallback if popup blocked: download as HTML
    downloadBlob(blob, `scan-report-${format(new Date(), 'yyyy-MM-dd')}.html`);
  }
}

// --- Activity Feed (ScanLogEntry) exports ---

function buildActivityText(logs: ScanLogEntry[]): string {
  const lines: string[] = [];
  lines.push(t('scanLogTitle'));
  lines.push(`${t('generatedAt')} ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);
  lines.push(`${t('totalEntries')} ${logs.length}`);
  lines.push('='.repeat(60));
  lines.push('');

  for (const entry of logs) {
    const time = entry.timestamp.split('T')[1]?.slice(0, 8) || '';
    const agent = getAgentLabel(entry.agent);
    const detail = entry.details ? ` | ${entry.details}` : '';
    lines.push(`${time}  [${agent}]  ${entry.message}${detail}`);
  }

  return lines.join('\n');
}

export function exportActivityAsText(logs: ScanLogEntry[]) {
  const text = buildActivityText(logs);
  const bom = '\uFEFF';
  const blob = new Blob([bom + text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `scan-log-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`);
}

const AGENT_COLORS: Record<string, string> = {
  scanner: '#60a5fa',
  ocr: '#c084fc',
  intake: '#818cf8',
  extraction: '#fbbf24',
  matching: '#34d399',
  pipeline: '#22d3ee',
  postScan: '#4ade80',
};

function getEntryColors(entry: ScanLogEntry) {
  const status = entry.status || 'working';
  if (status === 'error' || entry.message.startsWith('שגיאה'))
    return { bg: 'rgba(127,29,29,0.3)', msg: '#fca5a5', detail: 'rgba(239,68,68,0.5)', label: '#f87171' };
  if (status === 'waiting')
    return { bg: 'rgba(113,63,18,0.2)', msg: 'rgba(253,224,71,0.8)', detail: 'rgba(234,179,8,0.5)', label: '#facc15' };
  if (status === 'done')
    return { bg: 'transparent', msg: '#6b7280', detail: '#4b5563', label: '' };
  return { bg: 'transparent', msg: '#e5e7eb', detail: '#6b7280', label: '' };
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function exportActivityAsPdf(logs: ScanLogEntry[]) {
  const rows = logs.map((entry) => {
    const time = entry.timestamp.split('T')[1]?.slice(0, 8) || '';
    const agent = getAgentLabel(entry.agent);
    const agentColor = AGENT_COLORS[entry.agent] || '#9ca3af';
    const colors = getEntryColors(entry);
    const labelColor = colors.label || agentColor;
    const detail = entry.details ? `<span style="color:${colors.detail}"> | ${esc(entry.details)}</span>` : '';

    return `<div style="display:flex;gap:8px;align-items:baseline;padding:2px 4px;border-radius:4px;background:${colors.bg}">
      <span style="color:#4b5563;flex-shrink:0;width:56px;text-align:left;direction:ltr">${time}</span>
      <span style="color:${labelColor};flex-shrink:0">[${esc(agent)}]</span>
      <span style="color:${colors.msg}">${esc(entry.message)}</span>${detail}
    </div>`;
  }).join('\n');

  const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
  const scanLogTitle = t('scanLogTitle');
  const entriesLabel = t('entries');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${scanLogTitle}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 11px; direction: rtl; padding: 20mm; line-height: 1.7; background: #030712 !important; color: #d1d5db !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    .header { border-bottom: 1px solid #1f2937; padding-bottom: 8px; margin-bottom: 12px; }
    .header h1 { font-size: 14px; color: #9ca3af !important; margin: 0 0 4px; }
    .header .meta { font-size: 10px; color: #6b7280 !important; }
    @media print { body { padding: 10mm; background: #030712 !important; color: #d1d5db !important; } @page { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${scanLogTitle}</h1>
    <div class="meta">${dateStr} | ${logs.length} ${entriesLabel}</div>
  </div>
  ${rows}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
  } else {
    downloadBlob(blob, `scan-log-${format(new Date(), 'yyyy-MM-dd-HHmm')}.html`);
  }
}
