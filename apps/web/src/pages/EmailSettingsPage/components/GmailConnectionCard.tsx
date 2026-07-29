import { CheckCircle2, Mail, Unlink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { formatDateTime } from '../../../lib/formatters';

interface GmailConnectionCardProps {
  connected: boolean;
  gmailEmail: string | null;
  connectedAt: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const GmailConnectionCard = ({ connected, gmailEmail, connectedAt, onConnect, onDisconnect }: GmailConnectionCardProps) => {
  const { t } = useTranslation('settings');
  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6">
      <h3 className="text-lg font-semibold mb-4">{t('gmailConnection.title')}</h3>
      {connected ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-base-content">{gmailEmail}</p>
              <p className="text-sm text-base-content/50">
                {t('gmailConnection.connectedSince')}{connectedAt ? formatDateTime(connectedAt) : ''}
              </p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={onDisconnect}>
            <Unlink className="w-4 h-4" />
            {t('gmailConnection.disconnect')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-base-content/50">
            {t('gmailConnection.helperText')}
          </p>
          <Button onClick={onConnect}>
            <Mail className="w-4 h-4" />
            {t('gmailConnection.connect')}
          </Button>
        </div>
      )}
    </div>
  );
}
