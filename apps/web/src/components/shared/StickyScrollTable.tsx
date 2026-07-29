import type { ReactNode } from 'react';

interface StickyScrollTableProps {
  children: ReactNode;
  minWidth?: number;
}

export const StickyScrollTable = ({ children, minWidth = 1000 }: StickyScrollTableProps) => (
  <div className="flex-1 min-h-0 overflow-auto p-0 relative z-0">
    <table
      className="table table-sm w-full text-xs relative"
      style={{ minWidth: `${minWidth}px` }}
    >
      {children}
    </table>
  </div>
);
