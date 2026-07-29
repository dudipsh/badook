import { useMemo } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { VirtualRow } from './types';

interface UseActiveGroupResult<TGroup> {
  activeGroup: TGroup | null;
  activeGroupHeaderIndex: number;
  isHeaderRendered: boolean;
}

export const useActiveGroup = <TGroup, TItem>(
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  flatRows: VirtualRow<TGroup, TItem>[],
): UseActiveGroupResult<TGroup> => {
  const virtualItems = virtualizer.getVirtualItems();
  const firstVisibleIndex = virtualItems[0]?.index ?? 0;

  return useMemo(() => {
    if (flatRows.length === 0 || virtualItems.length === 0) {
      return { activeGroup: null, activeGroupHeaderIndex: -1, isHeaderRendered: false };
    }

    let headerIndex = -1;
    for (let i = firstVisibleIndex; i >= 0; i--) {
      if (flatRows[i].type === 'group-header') {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return { activeGroup: null, activeGroupHeaderIndex: -1, isHeaderRendered: false };
    }

    const renderedStart = virtualItems[0]?.index ?? 0;
    const renderedEnd = virtualItems[virtualItems.length - 1]?.index ?? 0;
    const isHeaderRendered = headerIndex >= renderedStart && headerIndex <= renderedEnd;

    return {
      activeGroup: flatRows[headerIndex].group ?? null,
      activeGroupHeaderIndex: headerIndex,
      isHeaderRendered,
    };
  }, [flatRows, firstVisibleIndex, virtualItems]);
};
