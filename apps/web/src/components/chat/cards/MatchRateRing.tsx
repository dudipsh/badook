import { motion } from 'framer-motion';

interface Props {
  rate: number;
  label: string;
}

const SIZE = 76;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const colorForRate = (rate: number): string => {
  if (rate >= 80) return 'text-success';
  if (rate >= 50) return 'text-warning';
  return 'text-error';
};

export const MatchRateRing = ({ rate, label }: Props) => {
  const clamped = Math.max(0, Math.min(100, rate));
  const color = colorForRate(clamped);

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-base-200"
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            className={`${color} stroke-current`}
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: CIRC - (clamped / 100) * CIRC }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[18px] font-bold tabular-nums ${color}`}>{clamped}%</span>
        </div>
      </div>
      <span className="text-[11px] text-base-content/50 font-medium">{label}</span>
    </div>
  );
};
