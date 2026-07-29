import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { authService } from '../../services/auth.service';

export const LoginPage = observer(() => {
  const { t } = useTranslation('auth');
  const { authStore, languageStore } = useStores();
  const navigate = useNavigate();

  // The OAuth callback redirects back to /login#token=... (or #error=...).
  // Read it before react-router strips the hash, then store the token.
  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? new URLSearchParams(window.location.hash.slice(1))
      : null;
    if (!hash) return;

    const token = hash.get('token');
    const error = hash.get('error');

    if (token) {
      window.history.replaceState(null, '', window.location.pathname);
      authStore.setToken(token).then(() => navigate('/', { replace: true }));
    } else if (error) {
      window.history.replaceState(null, '', window.location.pathname);
      toast.error(decodeURIComponent(error) || t('loginFailed'));
    }
  }, [authStore, navigate, t]);

  const signIn = (provider: 'google' | 'microsoft') => {
    window.location.href = authService.oauthLoginUrl(provider);
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4" dir={languageStore.direction}>
      <div className="bg-base-100 rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-base-200 rounded-xl">
              <Shield className="w-10 h-10 text-base-content" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-base-content">{t('title')}</h1>
          <p className="text-base-content/50 mt-1">{t('subtitle')}</p>
        </div>

        <p className="text-center text-sm text-base-content/60 mb-5">{t('signInPrompt')}</p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => signIn('google')}
            className="btn w-full bg-base-100 border-base-300 hover:bg-base-200 text-base-content font-semibold gap-3"
          >
            <GoogleIcon />
            {t('continueWithGoogle')}
          </button>
          <button
            type="button"
            onClick={() => signIn('microsoft')}
            className="btn w-full bg-base-100 border-base-300 hover:bg-base-200 text-base-content font-semibold gap-3"
          >
            <MicrosoftIcon />
            {t('continueWithMicrosoft')}
          </button>
        </div>

        <p className="text-center text-xs text-base-content/40 mt-6 leading-relaxed">{t('loginHelp')}</p>
      </div>
    </div>
  );
});

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 23 23" aria-hidden="true">
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#7FBA00" d="M12 1h10v10H12z" />
    <path fill="#00A4EF" d="M1 12h10v10H1z" />
    <path fill="#FFB900" d="M12 12h10v10H12z" />
  </svg>
);
