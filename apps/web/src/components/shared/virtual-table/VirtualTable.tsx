import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useVirtualRows } from './useVirtualRows';
import { useActiveGroup } from './useActiveGroup';
import type { VirtualTableProps, VirtualTableRef } from './types';

const VirtualTableInner = <TGroup, TItem>(
  props: VirtualTableProps<TGroup, TItem>,
  ref: React.ForwardedRef<VirtualTableRef>,
) => {
  const {
    groups,
    groupKey,
    groupItems,
    groupHasFooter,
    itemKey,
    trailingItems,
    separatorBeforeTrailing,
    renderTrailingRow,
    trailingEmptyState,
    renderTableHeader,
    renderGroupHeader,
    renderGroupSpacer,
    renderGroupFooter,
    renderRow,
    colCount,
    rowHeights,
    overscan = 10,
    minWidth = 1000,
    highlightGroupKey,
    onHighlightComplete,
    className,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);

  const flatRows = useVirtualRows({
    groups,
    groupKey,
    groupItems,
    groupHasFooter,
    itemKey,
    trailingItems,
    hasSeparator: !!separatorBeforeTrailing,
    hasTrailingEmptyState: !!trailingEmptyState,
    rowHeights,
  });

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => flatRows[index].estimatedHeight,
    overscan,
  });

  const { activeGroup, isHeaderRendered } = useActiveGroup(virtualizer, flatRows);
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalSize - virtualItems[virtualItems.length - 1].end
    : 0;

  // Highlight & scroll-to-group
  useEffect(() => {
    if (!highlightGroupKey) return;
    const idx = flatRows.findIndex(
      (r) => r.type === 'group-header' && r.group && groupKey(r.group as TGroup) === highlightGroupKey,
    );
    if (idx === -1) return;

    const timer = setTimeout(() => {
      virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
      setTimeout(() => onHighlightComplete?.(), 2000);
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightGroupKey, flatRows, groupKey, virtualizer, onHighlightComplete]);

  // Imperative ref
  const scrollToGroup = useCallback(
    (key: string) => {
      const idx = flatRows.findIndex(
        (r) => r.type === 'group-header' && r.group && groupKey(r.group as TGroup) === key,
      );
      if (idx !== -1) virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
    },
    [flatRows, groupKey, virtualizer],
  );

  useImperativeHandle(ref, () => ({ scrollToGroup }), [scrollToGroup]);

  const renderVirtualRow = (index: number) => {
    const row = flatRows[index];
    switch (row.type) {
      case 'group-header':
        return renderGroupHeader(row.group as TGroup);
      case 'group-spacer':
        return renderGroupSpacer
          ? renderGroupSpacer(row.group as TGroup)
          : <tr key={row.key} className="h-2" aria-hidden="true"><td colSpan={colCount} /></tr>;
      case 'group-footer':
        return renderGroupFooter?.(row.group as TGroup) ?? null;
      case 'separator':
        return separatorBeforeTrailing;
      case 'item':
        if (row.isTrailing && !row.item && trailingEmptyState) return trailingEmptyState;
        if (row.isTrailing && row.item && renderTrailingRow) return renderTrailingRow(row.item);
        if (row.item) return renderRow(row.item);
        return null;
      default:
        return null;
    }
  };

  const showPinned = !!activeGroup && !isHeaderRendered;

  return (
    <div
      ref={scrollRef}
      className={`flex-1 min-h-0 overflow-auto p-0 relative z-0 ${className ?? ''}`}
    >
      {/* Pinned group header — outside the <table> so it never triggers column recalc */}
      <div
        aria-hidden={!showPinned}
        style={{
          position: 'sticky',
          top: 34,
          zIndex: 19,
          height: 0,
          overflow: 'visible',
          visibility: showPinned ? 'visible' : 'hidden',
          pointerEvents: showPinned ? 'auto' : 'none',
        }}
      >
        {activeGroup && (
          <table className="table table-sm w-full text-xs" style={{ minWidth: `${minWidth}px` }}>
            <tbody>{renderGroupHeader(activeGroup)}</tbody>
          </table>
        )}
      </div>

      <table
        className="table table-sm w-full text-xs relative"
        style={{ minWidth: `${minWidth}px` }}
      >
        {renderTableHeader()}
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={colCount} style={{ height: paddingTop, padding: 0, border: 'none', lineHeight: 0 }} />
            </tr>
          )}

          {virtualItems.map((vi) => (
            <VirtualRowWrapper key={flatRows[vi.index].key}>
              {renderVirtualRow(vi.index)}
            </VirtualRowWrapper>
          ))}

          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={colCount} style={{ height: paddingBottom, padding: 0, border: 'none', lineHeight: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const VirtualRowWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export const VirtualTable = forwardRef(VirtualTableInner) as <TGroup, TItem>(
  props: VirtualTableProps<TGroup, TItem> & { ref?: React.Ref<VirtualTableRef> },
) => React.ReactElement | null;
