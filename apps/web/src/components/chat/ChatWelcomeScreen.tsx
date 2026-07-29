import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FileText, AlertCircle, BarChart3, Bot } from 'lucide-react';
import { ChatActionCard } from './ChatActionCard';
import { ChatSuggestionChips } from './ChatSuggestionChips';

interface Props {
  onPickAction: (prompt: string) => void;
}

export const ChatWelcomeScreen = ({ onPickAction }: Props) => {
  const { t } = useTranslation('chat');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl px-4 h-full"
    >
      <h1 className="text-4xl md:text-[56px] font-bold text-base-content mb-4 tracking-tight">
        {t('welcomeTitle')}
      </h1>
      <p className="text-base-content/60 text-[20px] mb-12 max-w-2xl text-center font-medium">
        {t('welcomeSubtitle')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full px-2 max-w-[800px]">
        <ChatActionCard
          label={t('actions.matchRules')}
          Icon={FileText}
          iconBg="#FDE68A"
          iconColor="#D97706"
          iconShape="rounded"
          onClick={() => onPickAction(t('actions.matchRulesPrompt'))}
        />
        <ChatActionCard
          label={t('actions.discrepancies')}
          Icon={AlertCircle}
          iconBg="#BFDBFE"
          iconColor="#2563EB"
          iconShape="rounded"
          onClick={() => onPickAction(t('actions.discrepanciesPrompt'))}
        />
        <ChatActionCard
          label={t('actions.reports')}
          Icon={Bot}
          iconBg="#BBF7D0"
          iconColor="#16A34A"
          iconShape="circle"
          onClick={() => onPickAction(t('actions.reportsPrompt'))}
        />
        <ChatActionCard
          label={t('actions.vendors')}
          Icon={BarChart3}
          iconBg="#FBCFE8"
          iconColor="#DB2777"
          iconShape="squircle"
          onClick={() => onPickAction(t('actions.vendorsPrompt'))}
        />
      </div>
      <ChatSuggestionChips onPick={onPickAction} />
    </motion.div>
  );
};
