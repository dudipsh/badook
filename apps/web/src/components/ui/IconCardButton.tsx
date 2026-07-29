import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface IconCardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label?: ReactNode;
  count?: number | string | null;
  iconOnly?: boolean;
}

export const IconCardButton = ({
  icon: Icon,
  label,
  count,
  iconOnly = false,
  className = '',
  ...props
}: IconCardButtonProps) => {
  const hasCount = count !== null && count !== undefined && count !== 0 && count !== '0';
  const isCompactCount = hasCount && String(count).length >= 3;

  return (
    <button
      className={`inline-flex items-center gap-2 h-10 ${iconOnly ? 'w-10 justify-center p-0' : 'px-4'} rounded-xl bg-base-100 border border-base-300 hover:bg-base-200 shadow-sm font-medium text-base-content transition-colors focus:outline-none focus:ring-1 ${className}`}
      {...props}
    >
      <Icon className="w-[18px] h-[18px]" />
      {!iconOnly && label && <span className="whitespace-nowrap">{label}</span>}
      {!iconOnly && hasCount && (
        <span
          className={`min-w-7 h-6 px-2 font-semibold rounded-lg leading-none bg-error text-error-content flex items-center justify-center ms-1 tabular-nums ${
            isCompactCount ? 'text-[11px]' : 'text-sm'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};
