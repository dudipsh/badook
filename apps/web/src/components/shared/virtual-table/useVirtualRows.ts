import { useMemo } from 'react';
import type { VirtualRow, VirtualTableRowHeights } from './types';

const DEFAULT_HEIGHTS: Required<VirtualTableRowHeights> = {
  item: 40,
  groupHeader: 44,
  spacer: 8,
  footer: 44,
  separator: 40,
};

interface UseVirtualRowsOptions<TGroup, TItem> {
  groups?: TGroup[];
  groupKey: (group: TGroup) => string;
  groupItems: (group: TGroup) => TItem[];
  groupHasFooter?: (group: TGroup) => boolean;
  itemKey: (item: TItem) => string;
  trailingItems?: TItem[];
  hasSeparator?: boolean;
  hasTrailingEmptyState?: boolean;
  rowHeights?: VirtualTableRowHeights;
}

export const useVirtualRows = <TGroup, TItem>(
  options: UseVirtualRowsOptions<TGroup, TItem>,
): VirtualRow<TGroup, TItem>[] => {
  const {
    groups,
    groupKey,
    groupItems: getGroupItems,
    groupHasFooter,
    itemKey,
    trailingItems,
    hasSeparator,
    hasTrailingEmptyState,
    rowHeights,
  } = options;

  const heights = { ...DEFAULT_HEIGHTS, ...rowHeights };

  return useMemo(() => {
    const rows: VirtualRow<TGroup, TItem>[] = [];

    if (groups) {
      for (const group of groups) {
        const gKey = groupKey(group);
        const items = getGroupItems(group);

        rows.push({
          key: `gh-${gKey}`,
          type: 'group-header',
          estimatedHeight: heights.groupHeader,
          group,
        });

        rows.push({
          key: `gs-${gKey}`,
          type: 'group-spacer',
          estimatedHeight: heights.spacer,
          group,
        });

        for (const item of items) {
          rows.push({
            key: `item-${itemKey(item)}`,
            type: 'item',
            estimatedHeight: heights.item,
            item,
            group,
          });
        }

        if (groupHasFooter?.(group)) {
          rows.push({
            key: `gf-${gKey}`,
            type: 'group-footer',
            estimatedHeight: heights.footer,
            group,
          });
        }
      }
    }

    if (hasSeparator) {
      rows.push({
        key: 'separator-trailing',
        type: 'separator',
        estimatedHeight: heights.separator,
      });
    }

    if (trailingItems && trailingItems.length > 0) {
      for (const item of trailingItems) {
        rows.push({
          key: `trailing-${itemKey(item)}`,
          type: 'item',
          estimatedHeight: heights.item,
          item,
          isTrailing: true,
        });
      }
    } else if (hasSeparator && hasTrailingEmptyState) {
      rows.push({
        key: 'trailing-empty',
        type: 'item',
        estimatedHeight: heights.item,
        isTrailing: true,
      });
    }

    return rows;
  }, [groups, groupKey, getGroupItems, groupHasFooter, itemKey, trailingItems, hasSeparator, hasTrailingEmptyState, heights.groupHeader, heights.spacer, heights.item, heights.footer, heights.separator]);
};
