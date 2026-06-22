import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List } from 'react-window';
import { model } from '../../../wailsjs/go/models';
import { TagSession, CommentSession } from '../../../wailsjs/go/app/App';
import { cn } from '@/lib/utils';
import { formatTime, formatDuration, formatBytes, getPath } from '@/lib/format';
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
  Filter as FilterIcon,
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

const ROW_HEIGHT = 27;

type ColKey =
  | 'protocol'
  | 'host'
  | 'method'
  | 'url'
  | 'status'
  | 'httpVersion'
  | 'tlsVersion'
  | 'body'
  | 'contentType'
  | 'duration'
  | 'time';

type ColAlign = 'left' | 'center' | 'right';

interface ColDef {
  key: ColKey;
  label: string;
  defaultWidth: number;
  /** label 글자수 + padding + sort icon 여유. drag 최소폭 + CSS min-width 에 동일 적용 */
  minWidth: number;
  align?: ColAlign;
  cellClass?: string;
  render: (session: model.Session) => React.ReactNode;
  rowTitle?: (session: model.Session) => string | undefined;
}

const COL_MIN_WIDTH = 40;

const cellBase =
  'px-2 text-foreground/88 text-[var(--ds-grid-font-size)] font-normal whitespace-nowrap overflow-hidden text-ellipsis';

const COL_DEFS: ColDef[] = [
  {
    key: 'protocol',
    label: 'Protocol',
    defaultWidth: 76,
    minWidth: 72,
    align: 'center',
    render: (s) => {
      const badge = protoBadge(s.protocol);
      return (
        <span
          className={cn(
            'text-[9.5px] font-semibold px-1 py-0.5 rounded-[2px]',
            badge.bg,
            badge.text,
          )}
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
    minWidth: 130,
    cellClass: 'truncate',
    render: (s) => s.target?.host || '-',
    rowTitle: (s) => s.target?.host || undefined,
  },
  {
    key: 'method',
    label: 'Method',
    defaultWidth: 88,
    minWidth: 76,
    align: 'center',
    render: (s) => s.request?.method || '-',
  },
  {
    key: 'url',
    label: 'URL',
    defaultWidth: 520,
    minWidth: 280,
    cellClass: 'truncate',
    render: (s) => {
      const path = getPath(s.request?.url) || '';
      return path || s.request?.url || '-';
    },
    rowTitle: (s) => s.request?.url || undefined,
  },
  {
    key: 'status',
    label: 'Status Code',
    defaultWidth: 116,
    minWidth: 104,
    align: 'center',
    render: (s) => (
      <span className={statusClass(s.response?.status_code)}>{s.response?.status_code || '-'}</span>
    ),
  },
  {
    key: 'httpVersion',
    label: 'HTTP Version',
    defaultWidth: 102,
    minWidth: 94,
    align: 'center',
    cellClass: 'text-muted-foreground',
    render: (s) => s.request?.http_version || s.response?.http_version || '-',
  },
  {
    key: 'tlsVersion',
    label: 'TLS Version',
    defaultWidth: 94,
    minWidth: 88,
    align: 'center',
    cellClass: 'text-muted-foreground',
    render: () => '-',
  },
  {
    key: 'body',
    label: 'Body',
    defaultWidth: 72,
    minWidth: 58,
    align: 'center',
    cellClass: 'text-muted-foreground',
    render: (s) => formatBytes(s.response?.body_size || s.request?.body_size),
  },
  {
    key: 'contentType',
    label: 'Content-Type',
    defaultWidth: 122,
    minWidth: 108,
    align: 'center',
    cellClass: 'text-muted-foreground',
    render: (s) => s.response?.content_type || s.request?.content_type || '-',
  },
  {
    key: 'duration',
    label: 'Duration',
    defaultWidth: 78,
    minWidth: 74,
    align: 'center',
    render: (s) => formatDuration(s.duration),
  },
  {
    key: 'time',
    label: 'Time',
    defaultWidth: 84,
    minWidth: 54,
    align: 'center',
    cellClass: 'text-muted-foreground',
    render: (s) => formatTime(s.created_at),
  },
];

const DEFAULT_ORDER: ColKey[] = [
  'url',
  'httpVersion',
  'tlsVersion',
  'status',
  'method',
  'body',
  'contentType',
  'duration',
  'time',
  'protocol',
  'host',
];

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = COL_DEFS.reduce(
  (acc, c) => {
    acc[c.key] = c.defaultWidth;
    return acc;
  },
  {} as Record<ColKey, number>,
);

const COL_MIN_MAP: Record<ColKey, number> = COL_DEFS.reduce(
  (acc, c) => {
    acc[c.key] = c.minWidth;
    return acc;
  },
  {} as Record<ColKey, number>,
);

function resizeColWidths(
  prev: Record<ColKey, number>,
  key: ColKey,
  startWidth: number,
  delta: number,
  nextKey: ColKey | null,
  startNextWidth: number | null,
): Record<ColKey, number> {
  const colMin = COL_MIN_MAP[key] ?? COL_MIN_WIDTH;
  if (!nextKey || startNextWidth == null) {
    const next = Math.max(colMin, startWidth + delta);
    return prev[key] === next ? prev : { ...prev, [key]: next };
  }

  const nextMin = COL_MIN_MAP[nextKey] ?? COL_MIN_WIDTH;
  const maxShrink = startWidth - colMin;
  const maxGrow = startNextWidth - nextMin;
  const clampedDelta = Math.max(-maxShrink, Math.min(delta, maxGrow));
  const nextWidth = startWidth + clampedDelta;
  const nextNeighborWidth = startNextWidth - clampedDelta;

  return prev[key] === nextWidth && prev[nextKey] === nextNeighborWidth
    ? prev
    : { ...prev, [key]: nextWidth, [nextKey]: nextNeighborWidth };
}

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
      case 'url':
        return (
          m *
          ((a.target?.host || '') + (getPath(a.request?.url) || '')).localeCompare(
            (b.target?.host || '') + (getPath(b.request?.url) || ''),
          )
        );
      case 'status':
        return m * ((a.response?.status_code || 0) - (b.response?.status_code || 0));
      case 'httpVersion':
        return (
          m *
          (a.request?.http_version || a.response?.http_version || '').localeCompare(
            b.request?.http_version || b.response?.http_version || '',
          )
        );
      case 'tlsVersion':
        return 0;
      case 'body':
        return (
          m *
          ((a.response?.body_size || a.request?.body_size || 0) -
            (b.response?.body_size || b.request?.body_size || 0))
        );
      case 'contentType':
        return (
          m *
          (a.response?.content_type || a.request?.content_type || '').localeCompare(
            b.response?.content_type || b.request?.content_type || '',
          )
        );
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
        'session-row relative flex items-center cursor-pointer transition-colors',
        !isSelected && !isActive && rowTintClass(session),
        isSelected && !isActive && 'mac-row-selected',
        isActive && 'mac-row-active text-foreground',
      )}
      onClick={(e) =>
        onSelect(session, { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey })
      }
      onContextMenu={() => onContextSession(session)}
    >
      {isActive && (
        <span className="absolute inset-y-[5px] left-1.5 w-0.5 rounded-full bg-primary pointer-events-none" />
      )}
      <div className={cn(cellBase, 'w-10 text-muted-foreground shrink-0 flex items-center gap-1')}>
        {markColor && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: markColor }} />
        )}
        {index + 1}
      </div>
      {orderedCols.map((col) => {
        return (
          <div
            key={col.key}
            className={cn(cellBase, col.cellClass, alignClass(col.align), 'shrink-0')}
            style={{ width: colWidths[col.key], minWidth: col.minWidth, flexShrink: 0 }}
            title={col.rowTitle?.(session)}
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
  const headerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);
  const [listWidth, setListWidth] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('coroxy-hidden-cols-v6');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try {
      const stored = localStorage.getItem('coroxy-col-order-v6');
      if (!stored) return DEFAULT_ORDER;
      const parsed = JSON.parse(stored) as string[];
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
      const stored = localStorage.getItem('coroxy-col-widths-v6');
      if (!stored) return { ...DEFAULT_COL_WIDTHS };
      const parsed = JSON.parse(stored) as Partial<Record<ColKey, number>>;
      const merged: Record<ColKey, number> = { ...DEFAULT_COL_WIDTHS };
      for (const k of DEFAULT_ORDER) {
        const v = parsed[k];
        if (typeof v === 'number' && Number.isFinite(v)) {
          merged[k] = Math.max(COL_MIN_WIDTH, v);
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
    nextKey: ColKey | null;
    startX: number;
    startWidth: number;
    startNextWidth: number | null;
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
          localStorage.setItem('coroxy-col-widths-v6', JSON.stringify(prev));
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
      setColWidths((prev) => {
        return resizeColWidths(
          prev,
          ctx.key,
          ctx.startWidth,
          delta,
          ctx.nextKey,
          ctx.startNextWidth,
        );
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', endResize);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', endResize);
    };
  }, []);
  const handleColResizePointerDown = useCallback(
    (key: ColKey, nextKey: ColKey | null, e: React.PointerEvent) => {
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
        nextKey,
        startX: e.clientX,
        startWidth: colWidths[key] ?? DEFAULT_COL_WIDTHS[key],
        startNextWidth: nextKey ? (colWidths[nextKey] ?? DEFAULT_COL_WIDTHS[nextKey]) : null,
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
    (key: ColKey, nextKey: ColKey | null, e: React.MouseEvent) => {
      if (resizingCol.current) return;
      e.preventDefault();
      e.stopPropagation();
      resizingCol.current = {
        key,
        nextKey,
        startX: e.clientX,
        startWidth: colWidths[key] ?? DEFAULT_COL_WIDTHS[key],
        startNextWidth: nextKey ? (colWidths[nextKey] ?? DEFAULT_COL_WIDTHS[nextKey]) : null,
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
    setColWidths((prev) => {
      return resizeColWidths(prev, ctx.key, ctx.startWidth, delta, ctx.nextKey, ctx.startNextWidth);
    });
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
        localStorage.setItem('coroxy-col-widths-v6', JSON.stringify(prev));
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
      localStorage.setItem('coroxy-hidden-cols-v6', JSON.stringify([...next]));
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
  const tableContentWidth = useMemo(
    () => 40 + orderedCols.reduce((sum, col) => sum + (colWidths[col.key] ?? col.defaultWidth), 0),
    [colWidths, orderedCols],
  );
  const gridLineOffsets = useMemo(() => {
    let offset = 40;
    return orderedCols.slice(0, -1).map((col) => {
      offset += colWidths[col.key] ?? col.defaultWidth;
      return offset;
    });
  }, [colWidths, orderedCols]);

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
      localStorage.setItem('coroxy-col-order-v6', JSON.stringify(next));
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

  // 세로 리사이즈 시 List height 가 즉시 따라가도록 containerRef(전체 높이)와
  // headerRef(헤더 높이)를 동시에 관찰하여 listHeight = container - header 로 계산.
  // 빈 상태는 가로 스크롤 가능한 전체 테이블 폭이 아니라 사용자가 보는 viewport 폭 기준으로 중앙 정렬.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const recompute = () => {
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 28;
      const h = c.clientHeight - headerH;
      setListHeight(h > 0 ? h : 0);
      setListWidth(c.clientWidth);
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(c);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleContextSession = useCallback((session: model.Session) => {
    setContextSession(session as SessionExt);
  }, []);

  const headerClass =
    'mac-table-header px-2 h-[var(--ds-grid-header-height)] flex items-center text-left text-muted-foreground/86 font-normal text-[var(--ds-grid-font-size)] border-b border-border/70 whitespace-nowrap';

  return (
    <div
      ref={containerRef}
      className="session-table h-full w-full overflow-x-auto overflow-y-hidden flex flex-col"
    >
      {/* inner wrapper: 콘텐츠 최소폭을 min-w-max 로 보장 → 컨테이너보다 넓으면 바깥 overflow-x-auto 가 스크롤 제공 */}
      <div className="flex flex-1 min-h-0 flex-col min-w-max">
        {/* Header — own ContextMenu for column visibility, does not block HTML5 drag */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div ref={headerRef} className="flex shrink-0">
              <div className={cn(headerClass, 'w-10 shrink-0 text-muted-foreground/48')}>#</div>
              {orderedCols.map((col, index) => {
                const nextCol = orderedCols[index + 1] ?? null;
                const isDragging = dragKey === col.key;
                const isDropTarget =
                  dropTargetKey === col.key && dragKey !== null && dragKey !== col.key;
                const isSorted = sortKey === col.key;
                return (
                  <div
                    key={col.key}
                    draggable
                    className={cn(
                      headerClass,
                      alignClass(col.align),
                      'shrink-0',
                      'relative cursor-pointer select-none transition-colors',
                      isSorted && 'text-foreground bg-accent/40',
                      isDragging && 'opacity-40',
                      isDropTarget &&
                        'bg-primary/14 text-foreground ring-1 ring-inset ring-primary/50',
                    )}
                    style={{ width: colWidths[col.key], minWidth: col.minWidth, flexShrink: 0 }}
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
                    <span className="min-w-0 flex-1 truncate">
                      {col.label} <SortIcon col={col.key} />
                    </span>
                    <FilterIcon className="ml-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/82" />
                    {nextCol ? (
                      <span
                        draggable={false}
                        onPointerDown={(e) => handleColResizePointerDown(col.key, nextCol.key, e)}
                        onPointerMove={handleColResizePointerMove}
                        onPointerUp={handleColResizePointerUp}
                        onPointerCancel={handleColResizePointerUp}
                        onMouseDown={(e) => handleColResizeMouseDown(col.key, nextCol.key, e)}
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="session-col-resize absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-10 touch-none"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${col.label} column`}
                      />
                    ) : null}
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
            <div
              className="session-body relative flex-1 min-h-0"
              style={{ width: tableContentWidth, minWidth: tableContentWidth }}
            >
              <div
                className="session-body-grid"
                style={{ width: tableContentWidth }}
                aria-hidden="true"
              >
                {gridLineOffsets.map((offset) => (
                  <span key={offset} style={{ left: offset }} />
                ))}
              </div>
              {sortedSessions.length === 0 ? (
                <div
                  className="empty-table-state sticky left-0 h-full"
                  style={{ width: listWidth || '100%' }}
                />
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
                  style={{ height: listHeight, width: '100%' }}
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
                  onClick={() =>
                    contextSession && copyToClipboard(copyResponseBody(contextSession))
                  }
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
    </div>
  );
}
