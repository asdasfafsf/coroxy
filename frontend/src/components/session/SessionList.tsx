import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List } from 'react-window';
import { model } from '../../../wailsjs/go/models';
import { TagSession, CommentSession } from '../../../wailsjs/go/app/App';
import { cn } from '@/lib/utils';
import { formatTime, formatDuration, formatBytes, shortContentType, getPath } from '@/lib/format';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import {
  copyToClipboard,
  copyUrl,
  copyRequestHeaders,
  copyResponseHeaders,
  copyCurl,
  copyResponseBody,
} from '@/lib/copy';
import {
  ChevronUp,
  ChevronDown,
  Play,
  PenLine,
  GitCompare,
  Copy,
  Tag,
  MessageSquare,
  Inbox,
} from 'lucide-react';

// Session may have runtime-added tags/comment fields from Go backend
type SessionExt = model.Session & { tags?: string[]; comment?: string };

interface SessionListProps {
  sessions: model.Session[];
  selectedIds: Set<string>;
  activeId: string | null;
  onSelect: (
    session: model.Session,
    e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ) => void;
  onReplay?: (session: model.Session) => void;
  onComposerPrefill?: (session: model.Session) => void;
  onDiff?: (session: model.Session) => void;
  diffPending?: boolean;
  marks?: Map<string, string>;
}

function statusClass(code: number | undefined): string {
  if (!code) return '';
  if (code >= 200 && code < 300) return 'text-status-success';
  if (code >= 300 && code < 400) return 'text-status-info';
  if (code >= 400 && code < 500) return 'text-status-warning';
  if (code >= 500) return 'text-status-error';
  return '';
}

function rowTintClass(session: model.Session): string {
  // State-based (highest priority)
  if (session.state === 'error') return 'bg-status-error/[0.06]';

  // Status code
  const status = session.response?.status_code;
  if (status && status >= 500) return 'bg-status-error/[0.05]';
  if (status && status >= 400) return 'bg-status-warning/[0.04]';
  if (status && status >= 300) return 'bg-status-info/[0.03]';

  // Content-Type (Fiddler-style coloring)
  const ct = session.response?.content_type?.toLowerCase() || '';
  if (ct.includes('json')) return 'bg-primary/[0.03]';
  if (ct.includes('javascript')) return 'bg-status-success/[0.03]';
  if (ct.includes('css')) return 'bg-status-info/[0.03]';
  if (ct.includes('image')) return 'bg-status-purple/[0.03]';
  if (ct.includes('html')) return 'bg-chart-5/[0.03]';
  if (ct.includes('xml')) return 'bg-chart-4/[0.03]';
  if (ct.includes('font')) return 'bg-muted/30';

  return '';
}

function protoBadge(protocol: string): { bg: string; text: string } {
  switch (protocol.toUpperCase()) {
    case 'HTTP':
      return { bg: 'bg-status-info/15', text: 'text-status-info' };
    case 'TLS':
      return { bg: 'bg-status-success/15', text: 'text-status-success' };
    case 'TCP':
      return { bg: 'bg-status-warning/15', text: 'text-status-warning' };
    case 'UDP':
      return { bg: 'bg-status-purple/15', text: 'text-status-purple' };
    default:
      return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

const ROW_HEIGHT = 28;

type ColKey =
  | 'protocol'
  | 'host'
  | 'method'
  | 'path'
  | 'status'
  | 'type'
  | 'size'
  | 'duration'
  | 'time';

type ColAlign = 'left' | 'center' | 'right';

interface ColDef {
  key: ColKey;
  label: string;
  /** Default pixel width for fixed columns. Ignored for `path` (flex-1). */
  defaultWidth: number;
  align?: ColAlign;
  cellClass?: string;
  render: (session: model.Session) => React.ReactNode;
}

const COL_MIN_WIDTH = 40;
const COL_MAX_WIDTH = 500;

const cellBase =
  'px-2.5 text-foreground text-[13px] whitespace-nowrap overflow-hidden text-ellipsis';

const COL_DEFS: ColDef[] = [
  {
    key: 'protocol',
    label: 'Proto',
    defaultWidth: 60,
    render: (s) => {
      const badge = protoBadge(s.protocol);
      return (
        <span
          className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-sm', badge.bg, badge.text)}
        >
          {s.protocol}
        </span>
      );
    },
  },
  {
    key: 'host',
    label: 'Host',
    defaultWidth: 180,
    cellClass: 'truncate',
    render: (s) => s.target?.host || '-',
  },
  {
    key: 'method',
    label: 'Method',
    defaultWidth: 60,
    render: (s) => s.request?.method || '-',
  },
  {
    key: 'path',
    label: 'Path',
    defaultWidth: 0,
    cellClass: 'truncate',
    render: (s) => getPath(s.request?.url),
  },
  {
    key: 'status',
    label: 'Status',
    defaultWidth: 56,
    align: 'center',
    render: (s) => (
      <span className={statusClass(s.response?.status_code)}>{s.response?.status_code || '-'}</span>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    defaultWidth: 56,
    cellClass: 'text-muted-foreground',
    render: (s) => shortContentType(s.response?.content_type),
  },
  {
    key: 'size',
    label: 'Size',
    defaultWidth: 64,
    align: 'right',
    cellClass: 'text-muted-foreground',
    render: (s) => formatBytes(s.response?.body_size),
  },
  {
    key: 'duration',
    label: 'Duration',
    defaultWidth: 64,
    align: 'right',
    render: (s) => formatDuration(s.duration),
  },
  {
    key: 'time',
    label: 'Time',
    defaultWidth: 64,
    cellClass: 'text-muted-foreground',
    render: (s) => formatTime(s.created_at),
  },
];

const DEFAULT_ORDER: ColKey[] = COL_DEFS.map((c) => c.key);

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = COL_DEFS.reduce(
  (acc, c) => {
    acc[c.key] = c.defaultWidth;
    return acc;
  },
  {} as Record<ColKey, number>,
);

function alignClass(a?: ColAlign): string {
  if (a === 'center') return 'text-center';
  if (a === 'right') return 'text-right';
  return '';
}

type SortKey = ColKey;
type SortDir = 'asc' | 'desc';

function sortSessions(sessions: model.Session[], key: SortKey, dir: SortDir): model.Session[] {
  const sorted = [...sessions];
  const m = dir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (key) {
      case 'protocol':
        return m * (a.protocol || '').localeCompare(b.protocol || '');
      case 'host':
        return m * (a.target?.host || '').localeCompare(b.target?.host || '');
      case 'method':
        return m * (a.request?.method || '').localeCompare(b.request?.method || '');
      case 'path':
        return m * (a.request?.url || '').localeCompare(b.request?.url || '');
      case 'status':
        return m * ((a.response?.status_code || 0) - (b.response?.status_code || 0));
      case 'type':
        return m * (a.response?.content_type || '').localeCompare(b.response?.content_type || '');
      case 'size':
        return m * ((a.response?.body_size || 0) - (b.response?.body_size || 0));
      case 'duration':
        return m * ((a.duration || 0) - (b.duration || 0));
      case 'time':
        return m * String(a.created_at || '').localeCompare(String(b.created_at || ''));
      default:
        return 0;
    }
  });
  return sorted;
}

interface RowProps {
  sessions: model.Session[];
  selectedIds: Set<string>;
  activeId: string | null;
  onSelect: (
    session: model.Session,
    e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ) => void;
  onContextSession: (session: model.Session) => void;
  marks: Map<string, string>;
  orderedCols: ColDef[];
  colWidths: Record<ColKey, number>;
}

function SessionRow(
  props: {
    index: number;
    style: React.CSSProperties;
    ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  } & RowProps,
) {
  const {
    index,
    style,
    sessions,
    selectedIds,
    activeId,
    onSelect,
    onContextSession,
    marks,
    orderedCols,
    colWidths,
  } = props;
  const session = sessions[index];
  const markColor = marks.get(session.id);

  const isSelected = selectedIds.has(session.id);
  const isActive = activeId === session.id;
  return (
    <div
      style={style}
      className={cn(
        'relative flex items-center cursor-pointer border-b border-border/20 transition-colors',
        !isSelected && !isActive && 'hover:bg-muted/60',
        !isSelected && !isActive && rowTintClass(session),
        isSelected && !isActive && 'bg-primary/20 hover:bg-primary/25',
        isActive && 'bg-primary/30 hover:bg-primary/35 text-foreground',
      )}
      onClick={(e) =>
        onSelect(session, { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey })
      }
      onContextMenu={() => onContextSession(session)}
    >
      {isActive && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-primary pointer-events-none" />
      )}
      <div className={cn(cellBase, 'w-10 text-muted-foreground shrink-0 flex items-center gap-1')}>
        {markColor && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: markColor }} />
        )}
        {index + 1}
      </div>
      {orderedCols.map((col) => {
        const isPath = col.key === 'path';
        return (
          <div
            key={col.key}
            className={cn(cellBase, col.cellClass, alignClass(col.align), !isPath && 'shrink-0')}
            style={isPath ? { flex: 1, minWidth: 0 } : { width: colWidths[col.key], flexShrink: 0 }}
            title={isPath ? session.request?.url : undefined}
          >
            {col.render(session)}
          </div>
        );
      })}
    </div>
  );
}

export function SessionList({
  sessions,
  selectedIds,
  activeId,
  onSelect,
  onReplay,
  onComposerPrefill,
  onDiff,
  diffPending,
  marks = new Map(),
}: SessionListProps) {
  const [contextSession, setContextSession] = useState<SessionExt | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('coroxy-hidden-cols');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try {
      const stored = localStorage.getItem('coroxy-col-order');
      if (!stored) return DEFAULT_ORDER;
      const parsed = JSON.parse(stored) as string[];
      // Filter to known keys, then append any missing keys (forward compatibility)
      const known = new Set(DEFAULT_ORDER);
      const valid = parsed.filter((k): k is ColKey => known.has(k as ColKey));
      const missing = DEFAULT_ORDER.filter((k) => !valid.includes(k));
      return [...valid, ...missing];
    } catch {
      return DEFAULT_ORDER;
    }
  });
  const [dragKey, setDragKey] = useState<ColKey | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<ColKey | null>(null);
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(() => {
    try {
      const stored = localStorage.getItem('coroxy-col-widths');
      if (!stored) return { ...DEFAULT_COL_WIDTHS };
      const parsed = JSON.parse(stored) as Partial<Record<ColKey, number>>;
      const merged: Record<ColKey, number> = { ...DEFAULT_COL_WIDTHS };
      for (const k of DEFAULT_ORDER) {
        const v = parsed[k];
        if (typeof v === 'number' && Number.isFinite(v)) {
          merged[k] = Math.max(COL_MIN_WIDTH, Math.min(COL_MAX_WIDTH, v));
        }
      }
      return merged;
    } catch {
      return { ...DEFAULT_COL_WIDTHS };
    }
  });
  // Pointer events + setPointerCapture → parent's HTML5 drag(draggable)를 우회하여
  // resize 동작이 컬럼 순서 재정렬 드래그에 선점되지 않도록 함. 구형/비표준 환경에
  // 대비해 window-level mousemove/mouseup fallback도 함께 설치.
  const resizingCol = useRef<{
    key: ColKey;
    startX: number;
    startWidth: number;
    el: HTMLElement | null;
    pointerId: number | null;
  } | null>(null);
  useEffect(() => {
    const endResize = () => {
      const ctx = resizingCol.current;
      if (!ctx) return;
      if (ctx.el && ctx.pointerId != null) {
        try {
          ctx.el.releasePointerCapture(ctx.pointerId);
        } catch {
          // ignore
        }
      }
      resizingCol.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setColWidths((prev) => {
        try {
          localStorage.setItem('coroxy-col-widths', JSON.stringify(prev));
        } catch {
          // ignore quota/storage errors
        }
        return prev;
      });
    };
    const onMove = (e: MouseEvent) => {
      const ctx = resizingCol.current;
      if (!ctx) return;
      const delta = e.clientX - ctx.startX;
      const next = Math.max(COL_MIN_WIDTH, Math.min(COL_MAX_WIDTH, ctx.startWidth + delta));
      setColWidths((prev) => (prev[ctx.key] === next ? prev : { ...prev, [ctx.key]: next }));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', endResize);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', endResize);
    };
  }, []);
  const handleColResizePointerDown = useCallback(
    (key: ColKey, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore — capture may fail in unusual contexts but handler still works
      }
      resizingCol.current = {
        key,
        startX: e.clientX,
        startWidth: colWidths[key] ?? DEFAULT_COL_WIDTHS[key],
        el,
        pointerId: e.pointerId,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [colWidths],
  );
  // Mouse event fallback — pointer 이벤트가 발화되지 않는 환경용. window mouseup에
  // 등록된 endResize가 저장/정리까지 처리.
  const handleColResizeMouseDown = useCallback(
    (key: ColKey, e: React.MouseEvent) => {
      if (resizingCol.current) return;
      e.preventDefault();
      e.stopPropagation();
      resizingCol.current = {
        key,
        startX: e.clientX,
        startWidth: colWidths[key] ?? DEFAULT_COL_WIDTHS[key],
        el: null,
        pointerId: null,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [colWidths],
  );
  const handleColResizePointerMove = useCallback((e: React.PointerEvent) => {
    const ctx = resizingCol.current;
    if (!ctx) return;
    const delta = e.clientX - ctx.startX;
    const next = Math.max(COL_MIN_WIDTH, Math.min(COL_MAX_WIDTH, ctx.startWidth + delta));
    setColWidths((prev) => (prev[ctx.key] === next ? prev : { ...prev, [ctx.key]: next }));
  }, []);
  const handleColResizePointerUp = useCallback((e: React.PointerEvent) => {
    const ctx = resizingCol.current;
    if (!ctx) return;
    if (ctx.el && ctx.pointerId != null) {
      try {
        ctx.el.releasePointerCapture(ctx.pointerId);
      } catch {
        // ignore
      }
    }
    resizingCol.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setColWidths((prev) => {
      try {
        localStorage.setItem('coroxy-col-widths', JSON.stringify(prev));
      } catch {
        // ignore quota/storage errors
      }
      return prev;
    });
    // suppress click after resize so sort doesn't toggle
    e.stopPropagation();
  }, []);

  const toggleCol = (col: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      localStorage.setItem('coroxy-hidden-cols', JSON.stringify([...next]));
      return next;
    });
  };

  const colMap = useMemo(() => {
    const m = new Map<ColKey, ColDef>();
    COL_DEFS.forEach((c) => m.set(c.key, c));
    return m;
  }, []);

  const orderedCols = useMemo(() => {
    return colOrder
      .map((k) => colMap.get(k))
      .filter((c): c is ColDef => !!c && !hiddenCols.has(c.key));
  }, [colOrder, hiddenCols, colMap]);

  const sortedSessions = useMemo(() => {
    if (!sortKey) return sessions;
    return sortSessions(sessions, sortKey, sortDir);
  }, [sessions, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const moveCol = (from: ColKey, to: ColKey) => {
    if (from === to) return;
    setColOrder((prev) => {
      const next = prev.filter((k) => k !== from);
      const toIdx = next.indexOf(to);
      if (toIdx < 0) return prev;
      next.splice(toIdx, 0, from);
      localStorage.setItem('coroxy-col-order', JSON.stringify(next));
      return next;
    });
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 inline" />
    ) : (
      <ChevronDown className="h-3 w-3 inline" />
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height - 28);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleContextSession = useCallback((session: model.Session) => {
    setContextSession(session as SessionExt);
  }, []);

  const headerClass =
    'px-2.5 py-1.5 text-left bg-card/90 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider border-b border-border whitespace-nowrap';

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-background flex flex-col">
      {/* Header — own ContextMenu for column visibility, does not block HTML5 drag */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex shrink-0">
            <div className={cn(headerClass, 'w-10 shrink-0')}>#</div>
            {orderedCols.map((col) => {
              const isDragging = dragKey === col.key;
              const isDropTarget =
                dropTargetKey === col.key && dragKey !== null && dragKey !== col.key;
              const isSorted = sortKey === col.key;
              const isPath = col.key === 'path';
              return (
                <div
                  key={col.key}
                  draggable
                  className={cn(
                    headerClass,
                    alignClass(col.align),
                    !isPath && 'shrink-0',
                    'relative cursor-pointer select-none transition-colors',
                    isSorted && 'text-foreground bg-accent/60',
                    isDragging && 'opacity-40',
                    isDropTarget && 'bg-primary/25 text-foreground ring-1 ring-inset ring-primary',
                  )}
                  style={
                    isPath ? { flex: 1, minWidth: 0 } : { width: colWidths[col.key], flexShrink: 0 }
                  }
                  onClick={() => handleSort(col.key)}
                  onDragStart={(e) => {
                    setDragKey(col.key);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', col.key);
                  }}
                  onDragOver={(e) => {
                    if (!dragKey || dragKey === col.key) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dropTargetKey !== col.key) setDropTargetKey(col.key);
                  }}
                  onDragLeave={() => {
                    if (dropTargetKey === col.key) setDropTargetKey(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragKey) moveCol(dragKey, col.key);
                    setDragKey(null);
                    setDropTargetKey(null);
                  }}
                  onDragEnd={() => {
                    setDragKey(null);
                    setDropTargetKey(null);
                  }}
                >
                  {col.label} <SortIcon col={col.key} />
                  {!isPath && (
                    <span
                      draggable={false}
                      onPointerDown={(e) => handleColResizePointerDown(col.key, e)}
                      onPointerMove={handleColResizePointerMove}
                      onPointerUp={handleColResizePointerUp}
                      onPointerCancel={handleColResizePointerUp}
                      onMouseDown={(e) => handleColResizeMouseDown(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 active:bg-primary z-10 touch-none"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${col.label} column`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {COL_DEFS.map((col) => (
            <ContextMenuCheckboxItem
              key={col.key}
              checked={!hiddenCols.has(col.key)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggleCol(col.key)}
            >
              {col.label}
            </ContextMenuCheckboxItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>

      {/* Rows — own ContextMenu for per-row actions */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 min-h-0">
            {sortedSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground gap-3">
                <Inbox className="h-10 w-10 opacity-30" />
                <span className="text-sm">No sessions captured</span>
                <span className="text-xs opacity-60">
                  Start the proxy to begin capturing traffic
                </span>
              </div>
            ) : (
              <List
                rowHeight={ROW_HEIGHT}
                rowCount={sortedSessions.length}
                rowComponent={SessionRow}
                rowProps={{
                  sessions: sortedSessions,
                  selectedIds,
                  activeId,
                  onSelect,
                  onContextSession: handleContextSession,
                  marks,
                  orderedCols,
                  colWidths,
                }}
                style={{ height: containerHeight, width: '100%' }}
              />
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-52">
          {contextSession?.request && (
            <>
              <ContextMenuItem onClick={() => contextSession && onReplay?.(contextSession)}>
                <Play className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Replay Request
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => contextSession && onComposerPrefill?.(contextSession)}
              >
                <PenLine className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Edit in Composer
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem onClick={() => contextSession && onDiff?.(contextSession)}>
            <GitCompare className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            {diffPending ? 'Compare with this' : 'Compare...'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Copy className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              Copy
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                onClick={() => contextSession && copyToClipboard(copyUrl(contextSession))}
              >
                URL
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  contextSession && copyToClipboard(copyRequestHeaders(contextSession))
                }
              >
                Request Headers
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  contextSession && copyToClipboard(copyResponseHeaders(contextSession))
                }
              >
                Response Headers
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => contextSession && copyToClipboard(copyCurl(contextSession))}
              >
                cURL Command
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => contextSession && copyToClipboard(copyResponseBody(contextSession))}
              >
                Response Body
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              Tags
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {['important', 'bug', 'review', 'done'].map((tag) => {
                const hasTag = contextSession?.tags?.includes(tag);
                return (
                  <ContextMenuItem
                    key={tag}
                    onClick={() => contextSession && TagSession(contextSession.id, tag, !!hasTag)}
                  >
                    <span
                      className={cn(
                        'mr-2',
                        hasTag ? 'text-status-success' : 'text-muted-foreground',
                      )}
                    >
                      {hasTag ? '\u2713' : '\u25CB'}
                    </span>
                    {tag}
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              if (!contextSession) return;
              const comment = prompt('Comment:', contextSession.comment || '');
              if (comment !== null) CommentSession(contextSession.id, comment);
            }}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            {contextSession?.comment ? 'Edit Comment' : 'Add Comment'}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
