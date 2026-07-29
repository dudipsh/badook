interface MatchingPhaseDisplayProps {
  phases: string[];
  phaseIndex: number;
  displayProgress: number;
}

export const MatchingPhaseDisplay = ({ phases, phaseIndex, displayProgress }: MatchingPhaseDisplayProps) => (
  <div className="w-full flex flex-col items-center mt-2 space-y-5">
    <div className="h-8 flex items-center justify-center relative w-full overflow-hidden">
      {phases.map((phase, idx) => (
        <div
          key={idx}
          className={`absolute text-lg font-medium text-base-content transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            idx === phaseIndex
              ? 'opacity-100 translate-y-0'
              : idx < phaseIndex
                ? 'opacity-0 -translate-y-8'
                : 'opacity-0 translate-y-8'
          }`}
        >
          {phase}
        </div>
      ))}
    </div>

    <div className="w-72 flex flex-col items-center">
      <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent relative"
          style={{ width: `${displayProgress}%` }}
        >
          <div className="absolute inset-0 bg-base-100/30 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);
