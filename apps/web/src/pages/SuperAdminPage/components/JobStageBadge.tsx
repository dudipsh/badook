export const StageBadge = ({ stage, stageStatus }: { stage: string | null; stageStatus: string | null }) => {
  if (!stage) return <span className="text-gray-400">-</span>;
  const color = stageStatus === 'failed' ? 'text-red-600' : stageStatus === 'done' ? 'text-green-600' : 'text-blue-600';
  return <span className={`text-xs font-medium ${color}`}>{stage}</span>;
};
