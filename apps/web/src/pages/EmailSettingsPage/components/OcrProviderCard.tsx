import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { samplesApi } from '../../TrainingLabPage/api';
import type { OcrProvider } from '../../../services/gmail.service';

interface OcrProviderCardProps {
  currentProvider: OcrProvider;
  onChange: (provider: OcrProvider) => void;
  autoFixesEnabled?: boolean;
  onAutoFixesChange?: (enabled: boolean) => void;
}

/** Map model ID from the registry to the pipeline OcrProviderType */
const MODEL_TO_PROVIDER: Record<string, OcrProvider> = {
  gemini: 'GEMINI',
  'gemini-finetuned': 'GEMINI_FINETUNED',
};

const PROVIDER_TO_MODEL: Record<OcrProvider, string> = {
  GEMINI: 'gemini',
  GEMINI_FINETUNED: 'gemini-finetuned',
  OPENAI: 'gemini', // fallback — OpenAI model not in registry
};

interface ModelInfo {
  id: string;
  name: string;
  available: boolean;
  description?: string;
}

export const OcrProviderCard = ({ currentProvider, onChange, autoFixesEnabled, onAutoFixesChange }: OcrProviderCardProps) => {
  const { t } = useTranslation('settings');
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    samplesApi.fetchModels()
      .then((m) => setModels(m))
      .catch(() => {
        // Fallback if labeling-api is not available
        setModels([
          { id: 'gemini', name: 'Gemini 2.5 Flash', available: true },
        ]);
      });
  }, []);

  const selectedModelId = PROVIDER_TO_MODEL[currentProvider] || 'gemini';

  const handleChange = (modelId: string) => {
    const provider = MODEL_TO_PROVIDER[modelId];
    if (provider) {
      onChange(provider);
    }
  };

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6">
      <h3 className="text-lg font-semibold mb-2">{t('ocr.title')}</h3>
      <p className="text-sm text-base-content/50 mb-4">
        {t('ocr.description')}
      </p>
      <select
        className="select select-bordered w-full"
        value={selectedModelId}
        onChange={(e) => handleChange(e.target.value)}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id} disabled={!model.available || !MODEL_TO_PROVIDER[model.id]}>
            {model.name}
            {!model.available ? ' (לא מוגדר)' : ''}
            {model.available && !MODEL_TO_PROVIDER[model.id] ? ' (בדיקה בלבד)' : ''}
          </option>
        ))}
      </select>

      {onAutoFixesChange && (
        <>
          <hr className="border-base-200 my-4" />
          <div className="flex items-start gap-3">
            <label className="relative inline-flex items-center cursor-pointer mt-0.5">
              <input
                type="checkbox"
                checked={autoFixesEnabled ?? true}
                onChange={(e) => onAutoFixesChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary-content after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-base-100 after:border-base-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
            <div>
              <p className="text-sm font-medium text-base-content">
                {t('ocr.autoFixes')}
              </p>
              <p className="text-xs text-base-content/50 mt-0.5">
                {t('ocr.autoFixesDescription')}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
