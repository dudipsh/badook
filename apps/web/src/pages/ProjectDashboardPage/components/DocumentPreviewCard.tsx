import { useState, useEffect, useRef } from 'react';
import { FileText, Eye, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { filesService } from '../../../services/files.service';

interface DocumentPreviewCardProps {
  name: string;
  fileUrl: string | null;
  accentColor?: string;
  onClick: () => void;
}

export const DocumentPreviewCard = ({ name, fileUrl, accentColor = 'text-secondary', onClick }: DocumentPreviewCardProps) => {
  const { t } = useTranslation('projects');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return;

    setLoading(true);
    setError(false);

    filesService.getThumbnailUrl(fileUrl, 0)
      .then((url) => {
        objectUrlRef.current = url;
        setThumbnailUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [fileUrl]);

  return (
    <div
      className="group border border-base-300 rounded-lg shadow-sm overflow-hidden hover:border-base-300 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="bg-base-200 px-3 py-2 border-b border-base-300 flex justify-between items-center text-xs">
        <span className="font-medium text-base-content truncate">{name}</span>
        <span className="flex items-center gap-1 shrink-0">
          <Eye size={12} className={`${accentColor} opacity-50 group-hover:opacity-100 transition-opacity`} />
          <span className="text-xs text-base-content/40 group-hover:text-base-content/60 transition-colors">{t('evidence.preview')}</span>
        </span>
      </div>
      <div className="aspect-[3/4] bg-base-200 flex flex-col items-center justify-center relative overflow-hidden">
        {loading ? (
          <Loader2 size={24} className="animate-spin text-base-content/30" />
        ) : thumbnailUrl && !error ? (
          <img src={thumbnailUrl} alt={name} className="w-full h-full object-contain" />
        ) : (
          <>
            <FileText size={40} className="mb-2 text-base-content/30" />
            <p className="text-xs font-medium text-base-content/40 px-2 text-center truncate max-w-full">{name}</p>
          </>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-base-100 shadow-lg rounded-full p-3">
            <Eye size={20} className={accentColor} />
          </div>
        </div>
      </div>
    </div>
  );
};
