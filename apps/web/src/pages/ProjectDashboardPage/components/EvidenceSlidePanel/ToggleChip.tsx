const CHIP_COLORS = {
  secondary: 'var(--color-secondary)',
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
} as const;

type ChipColor = keyof typeof CHIP_COLORS;

export const ToggleChip = ({ label, active, onClick, color }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: ChipColor;
}) => {
  const cssColor = CHIP_COLORS[color];

  return (
    <button
      onClick={onClick}
      className="toggle-chip"
      style={active ? {
        background: cssColor,
        color: 'white',
        borderColor: cssColor,
      } : {
        background: 'white',
        color: cssColor,
        borderColor: cssColor,
      }}
    >
      {label}
    </button>
  );
};
