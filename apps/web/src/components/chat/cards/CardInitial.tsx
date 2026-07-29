const TINTS = [
  'bg-primary/15 text-primary',
  'bg-secondary/15 text-secondary',
  'bg-info/15 text-info',
  'bg-success/15 text-success',
  'bg-warning/15 text-warning',
  'bg-error/15 text-error',
];

const tintFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
};

interface Props {
  name: string;
}

export const CardInitial = ({ name }: Props) => {
  const trimmed = name.trim();
  const letter = trimmed ? Array.from(trimmed)[0].toUpperCase() : '?';
  return (
    <div
      className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[15px] font-bold ${tintFor(
        trimmed || '?',
      )}`}
    >
      {letter}
    </div>
  );
};
