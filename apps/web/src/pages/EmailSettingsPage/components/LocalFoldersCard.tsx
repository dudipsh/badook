import { FolderOpen, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';

interface LocalFolder {
  name: string;
  fileCount: number;
  selected: boolean;
}

interface LocalFoldersCardProps {
  folders: LocalFolder[];
  scanning: boolean;
  onToggleFolder: (name: string) => void;
  onToggleAll: (selected: boolean) => void;
  onRefresh: () => void;
  onScan: () => void;
}

export const LocalFoldersCard = ({ folders, scanning, onToggleFolder, onToggleAll, onRefresh, onScan }: LocalFoldersCardProps) => {
  const { t } = useTranslation('settings');

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6">
      <h3 className="text-lg font-semibold mb-2">{t('localFolders.title')}</h3>
      <p className="text-sm text-base-content/50 mb-4">
        {t('localFolders.description').split('<code>').map((part, i) => {
          if (i === 0) return part;
          const [code, rest] = part.split('</code>');
          return <span key={i}><code className="bg-base-200 px-1 rounded" dir="ltr">{code}</code>{rest}</span>;
        })}
      </p>
      {folders.length === 0 ? (
        <div className="text-center py-8 text-base-content/40">
          <FolderOpen className="w-8 h-8 mx-auto mb-2" />
          <p>{t('localFolders.noFolders').split('<code>').map((part, i) => {
            if (i === 0) return part;
            const [code, rest] = part.split('</code>');
            return <span key={i}><code dir="ltr">{code}</code>{rest}</span>;
          })}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm text-base-content/60">
              <input
                type="checkbox"
                checked={folders.every((f) => f.selected)}
                onChange={(e) => onToggleAll(e.target.checked)}
                className="rounded border-base-300 text-primary"
              />
              {t('localFolders.selectAll')}
            </label>
            <Button onClick={onRefresh} variant="secondary" size="sm">
              <RefreshCw className="w-3 h-3" />
              {t('common:refresh')}
            </Button>
          </div>
          <div className="space-y-2 mb-4">
            {folders.map((folder) => (
              <label
                key={folder.name}
                className="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={folder.selected}
                  onChange={() => onToggleFolder(folder.name)}
                  className="rounded border-base-300 text-primary"
                />
                <FolderOpen className="w-4 h-4 text-base-content/40" />
                <span className="font-medium flex-1" dir="ltr">{folder.name}</span>
                <span className="text-sm text-base-content/50">{t('localFolders.filesCount', { count: folder.fileCount })}</span>
              </label>
            ))}
          </div>
          <Button
            onClick={onScan}
            disabled={scanning || folders.every((f) => !f.selected)}
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? t('localFolders.scanning') : t('localFolders.scanSelected')}
          </Button>
        </>
      )}
    </div>
  );
}
