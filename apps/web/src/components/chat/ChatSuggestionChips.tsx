import { useTranslation } from 'react-i18next';

interface Props {
  onPick: (prompt: string) => void;
}

const SUGGESTION_KEYS = ['itemTotal', 'itemByProject', 'itemBySupplier'] as const;

export const ChatSuggestionChips = ({ onPick }: Props) => {
  const { t } = useTranslation('chat');

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6">
      {SUGGESTION_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => onPick(t(`suggestions.${key}`))}
          className="btn btn-sm h-auto py-1.5 rounded-full bg-base-200/60 border-base-300 hover:bg-base-200 text-base-content/70 font-medium text-[12.5px]"
        >
          {t(`suggestions.${key}`)}
        </button>
      ))}
    </div>
  );
};
