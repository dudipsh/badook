import type { ReactNode } from 'react';

export type VirtualRowType =
  | 'group-header'
  | 'group-spacer'
  | 'item'
  | 'group-footer'
  | 'separator';

export interface VirtualRow<TGroup = unknown, TItem = unknown> {
  key: string;
  type: VirtualRowType;
  estimatedHeight: number;
  item?: TItem;
  group?: TGroup;
  isTrailing?: boolean;
}

export interface VirtualTableRowHeights {
  item?: number;
  groupHeader?: number;
  spacer?: number;
  footer?: number;
  separator?: number;
}

export interface VirtualTableProps<TGroup = unknown, TItem = unknown> {
  groups?: TGroup[];
  groupKey: (group: TGroup) => string;
  groupItems: (group: TGroup) => TItem[];
  groupHasFooter?: (group: TGroup) => boolean;
  itemKey: (item: TItem) => string;

  trailingItems?: TItem[];
  separatorBeforeTrailing?: ReactNode;
  renderTrailingRow?: (item: TItem) => ReactNode;
  trailingEmptyState?: ReactNode;

  renderTableHeader: () => ReactNode;
  renderGroupHeader: (group: TGroup) => ReactNode;
  renderGroupSpacer?: (group: TGroup) => ReactNode;
  renderGroupFooter?: (group: TGroup) => ReactNode;
  renderRow: (item: TItem) => ReactNode;

  colCount: number;
  rowHeights?: VirtualTableRowHeights;
  overscan?: number;
  minWidth?: number;

  highlightGroupKey?: string | null;
  onHighlightComplete?: () => void;

  className?: string;
}

export interface VirtualTableRef {
  scrollToGroup: (key: string) => void;
}
