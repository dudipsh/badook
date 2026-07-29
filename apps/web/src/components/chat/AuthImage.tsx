import { useEffect, useState } from 'react';
import { apiClient } from '../../services/api-client';

interface Props {
  attachmentId: string;
  alt?: string;
  className?: string;
}

const cache = new Map<string, string>();

export const AuthImage = ({ attachmentId, alt = '', className }: Props) => {
  const [url, setUrl] = useState<string | null>(() => cache.get(attachmentId) ?? null);

  useEffect(() => {
    if (cache.has(attachmentId)) {
      setUrl(cache.get(attachmentId)!);
      return;
    }
    let cancelled = false;
    void apiClient
      .get(`/chat/attachments/${attachmentId}/raw`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(res.data as Blob);
        cache.set(attachmentId, objectUrl);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  if (!url) {
    return <div className={`${className ?? ''} bg-base-200 animate-pulse`} />;
  }
  return <img src={url} alt={alt} className={className} />;
};
