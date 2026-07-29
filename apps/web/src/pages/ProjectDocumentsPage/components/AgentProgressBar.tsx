import { useTranslation } from 'react-i18next';
import type { JobStages } from '../../../stores/jobs.store';
import { StageIcon } from './StageIcon';

const STAGE_LABEL_KEYS: Record<string, string> = {
  intake: 'documents.intakeAgent',
  extraction: 'documents.extractionAgent',
  matching: 'documents.matchingAgent',
  saving: 'documents.saving',
  linking: 'documents.linkingAgent',
};

interface AgentProgressBarProps {
  stages: JobStages;
  jobCompleted?: boolean;
}

export const AgentProgressBar = ({ stages, jobCompleted }: AgentProgressBarProps) => {
  const { t } = useTranslation('projects');
  const stageKeys = ['intake', 'extraction', 'matching', 'saving', 'linking'] as const;

  const getStatus = (key: string) => {
    if (key === 'linking') {
      if (jobCompleted) return 'done';
      if (stages.saving === 'done') return 'running';
      return 'pending';
    }
    return stages[key as keyof JobStages];
  };

  return (
    <div className="mb-4 bg-base-100 rounded-xl border border-base-300 p-4">
      <div className="flex items-center gap-6">
        {stageKeys.map((key) => {
          const status = getStatus(key);
          return (
            <div key={key} className="flex items-center gap-2">
              <StageIcon status={status} />
              <span className={`text-sm font-medium ${
                status === 'running' ? 'text-info' :
                status === 'done' ? 'text-success' :
                status === 'failed' ? 'text-error' :
                'text-base-content/40'
              }`}>
                {t(STAGE_LABEL_KEYS[key])}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
