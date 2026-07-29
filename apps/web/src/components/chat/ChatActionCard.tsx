import { Plus, type LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  iconShape?: 'rounded' | 'circle' | 'squircle';
  onClick: () => void;
}

const SHAPE_CLASS: Record<NonNullable<Props['iconShape']>, string> = {
  rounded: 'rounded-xl',
  circle: 'rounded-full',
  squircle: 'rounded-[14px]',
};

export const ChatActionCard = ({
  label,
  Icon,
  iconBg,
  iconColor,
  iconShape = 'rounded',
  onClick,
}: Props) => (
  <button
    onClick={onClick}
    className="flex items-center justify-between p-4 px-6 rounded-2xl border border-base-200 outline outline-1 outline-transparent bg-base-100 hover:outline-primary/20 hover:shadow-lg transition-all group text-start"
  >
    <div className="flex items-center gap-5">
      <div
        className={`w-[42px] h-[42px] ${SHAPE_CLASS[iconShape]} flex items-center justify-center shadow-sm`}
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <span className="font-bold text-[17px] text-base-content/90 group-hover:text-primary transition-colors">
        {label}
      </span>
    </div>
    <div className="w-8 h-8 rounded-full border border-base-200 flex items-center justify-center text-base-content/40 bg-base-100 group-hover:bg-primary group-hover:text-primary-content group-hover:border-primary transition-all duration-300">
      <Plus className="w-4 h-4" />
    </div>
  </button>
);
