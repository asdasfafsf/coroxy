import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List } from 'react-window';
import { model } from '../../../wailsjs/go/models';
import { TagSession, CommentSession } from '../../../wailsjs/go/app/App';
import { cn } from '@/lib/utils';
import { formatTime, formatDuration, formatBytes, shortContentType, getPath } from '@/lib/format';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { copyToClipboard, copyUrl, copyRequestHeaders, copyResponseHeaders, copyCurl, copyResponseBody } from '@/lib/copy';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Session may have runtime-added tags/comment fields from Go backend
type SessionExt = model.Session & { tags?: string[]; comment?: string };

interface SessionListProps {
  sessions: model.Session[];
  selectedIds: Set<string>;
  activeId: string | null;
  onSelect: (session: model.Session, e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
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
    case 'HTTP': return { bg: 'bg-status-info/15', text: 'text-status-info' };
    case 'TLS':  return { bg: 'bg-status-success/15', text: 'text-status-success' };
    case 'TCP':  return { bg: 'bg-status-warning/15', text: 'text-status-warning' };
    case 'UDP':  return { bg: 'bg-status-purple/15', text: 'text-status-purple' };
    default:     return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

const ROW_HEIGHT = 28;

type ColKey = 'protocol' | 'host' | 'method' | 'path' | 'status' | 'type' | 'size' | 'duration' | 'time';

interface ColDef {
  key: ColKey;
  label: string;
  width: string;
  cellClass?: string;
  render: (session: model.Session) => React.ReactNode;
}

const cellBase = 'px-2.5 text-foreground text-[13px] whitespace-nowrap overflow-hidden text-ellipsis';

const COL_DEFS: ColDef[] = [
  {
    key: 'protocol',
    label: 'Proto',
    width: 'w-15',
    render: (s) => {
      const badge = protoBadge(s.protocol);
      return <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-sm', badge.bg, badge.text)}>{s.protocol}</span>;
    },
  },
  { key: 'host',     label: 'Host',     width: 'w-[180px]', cellClass: 'truncate',               render: (s) => s.target?.host || '-' },
  { key: 'method',   label: 'Method',   width: 'w-15',                                             render: (s) => s.request?.method || '-' },
  { key: 'path',     label: 'Path',     width: 'flex-1 min-w-0', cellClass: 'truncate',           render: (s) => getPath(s.request?.url) },
  {
    key: 'status',
    label: 'Status',
    width: 'w-14 text-center',
    render: (s) => <span className={statusClass(s.response?.status_code)}>{s.response?.status_code || '-'}</span>,
  },
  { key: 'type',     label: 'Type',     width: 'w-14',             cellClass: 'text-muted-foreground', render: (s) => shortContentType(s.response?.content_type) },
  { key: 'size',     label: 'Size',     width: 'w-16 text-right',  cellClass: 'text-muted-foreground', render: (s) => formatBytes(s.response?.body_size) },
  { key: 'duration', label: 'Duration', width: 'w-16 text-right',                                      render: (s) => formatDuration(s.duration) },
  { key: 'time',     label: 'Time',     width: 'w-16',             cellClass: 'text-muted-foreground', render: (s) => formatTime(s.created_at) },
];

const DEFAULT_ORDER: ColKey[] = COL_DEFS.map(c => c.key);

type SortKey = ColKey;
type SortDir = 'asc' | 'desc';

function sortSessions(sessions: model.Session[], key: SortKey, dir: SortDir): model.Session[] {
  const sorted = [...sessions];
  const m = dir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (key) {
      case 'protocol': return m * (a.protocol || '').localeCompare(b.protocol || '');
      case 'host': return m * (a.target?.host || '').localeCompare(b.target?.host || '');
      case 'method': return m * (a.request?.method || '').localeCompare(b.request?.method || '');
      case 'path': return m * (a.request?.url || '').localeCompare(b.request?.url || '');
      case 'status': return m * ((a.response?.status_code || 0) - (b.response?.status_code || 0));
      case 'type': return m * (a.response?.content_type || '').localeCompare(b.response?.content_type || '');
      case 'size': return m * ((a.response?.body_size || 0) - (b.response?.body_size || 0));
      case 'duration': return m * ((a.duration || 0) - (b.duration || 0));
      case 'time': return m * (String(a.created_at || '')).localeCompare(String(b.created_at || ''));
      default: return 0;
    }
  });
  return sorted;
}

interface RowProps {
  sessions: model.Session[];
  selectedIds: Set<string>;
  activeId: string | null;
  onSelect: (session: model.Session, e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  onContextSession: (session: model.Session) => void;
  marks: Map<string, string>;
  orderedCols: ColDef[];
}

function SessionRow(props: { index: number; style: React.CSSProperties; ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' } } & RowProps) {
  const { index, style, sessions, selectedIds, activeId, onSelect, onContextSession, marks, orderedCols } = props;
  const session = sessions[index];
  const markColor = marks.get(session.id);

  return (
    <div
      style={style}
      className={cn(
        'flex items-center hover:bg-muted/50 cursor-pointer border-b border-border/30',
        selectedIds.has(session.id) ? 'bg-primary/[0.08]' : rowTintClass(session),
        activeId === session.id && 'ring-1 ring-inset ring-primary/30'
      )}
      onClick={(e) => onSelect(session, { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey })}
      onContextMenu={() => onContextSession(session)}
    >
      <div className={cn(cellBase, 'w-10 text-muted-foreground shrink-0 flex items-center gap-1')}>
        {markColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: markColor }} />}
        {index + 1}
      </div>
      {orderedCols.map(col => (
        <div
          key={col.key}
          className={cn(cellBase, col.width, col.key === 'path' ? '' : 'shrink-0', col.cellClass)}
          title={col.key === 'path' ? session.request?.url : undefined}
        >
          {col.render(session)}
        </div>
      ))}
    </div>
  );
}

export function SessionList({ sessions, selectedIds, activeId, onSelect, onReplay, onComposerPrefill, onDiff, diffPending, marks = new Map() }: SessionListProps) {
  const [contextSession, setContextSession] = useState<SessionExt | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('coroxy-hidden-cols');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try {
      const stored = localStorage.getItem('coroxy-col-order');
      if (!stored) return DEFAULT_ORDER;
      const parsed = JSON.parse(stored) as string[];
      // Filter to known keys, then append any missing keys (forward compatibility)
      const known = new Set(DEFAULT_ORDER);
      const valid = parsed.filter((k): k is ColKey => known.has(k as ColKey));
      const missing = DEFAULT_ORDER.filter(k => !valid.includes(k));
      return [...valid, ...missing];
    } catch { return DEFAULT_ORDER; }
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [dragKey, setDragKey] = useState<ColKey | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<ColKey | null>(null);

  const toggleCol = (col: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      localStorage.setItem('coroxy-hidden-cols', JSON.stringify([...next]));
      return next;
    });
  };

  const colMap = useMemo(() => {
    const m = new Map<ColKey, ColDef>();
    COL_DEFS.forEach(c => m.set(c.key, c));
    return m;
  }, []);

  const orderedCols = useMemo(() => {
    return colOrder
      .map(k => colMap.get(k))
      .filter((c): c is ColDef => !!c && !hiddenCols.has(c.key));
  }, [colOrder, hiddenCols, colMap]);

  const sortedSessions = useMemo(() => {
    if (!sortKey) return sessions;
    return sortSessions(sessions, sortKey, sortDir);
  }, [sessions, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const moveCol = (from: ColKey, to: ColKey) => {
    if (from === to) return;
    setColOrder(prev => {
      const next = prev.filter(k => k !== from);
      const toIdx = next.indexOf(to);
      if (toIdx < 0) return prev;
      next.splice(toIdx, 0, from);
      localStorage.setItem('coroxy-col-order', JSON.stringify(next));
      return next;
    });
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />;
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

  const headerClass = 'px-2.5 py-1.5 text-left bg-card text-muted-foreground font-medium text-[11px] border-b border-border whitespace-nowrap';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={containerRef} className="flex-1 overflow-hidden bg-background flex flex-col">
          {/* Header */}
          <DropdownMenu open={showColMenu} onOpenChange={setShowColMenu}>
            <DropdownMenuTrigger asChild>
              <div className="flex shrink-0" onContextMenu={(e) => { e.preventDefault(); setShowColMenu(true); }}>
                <div className={cn(headerClass, 'w-10 shrink-0')}>#</div>
                {orderedCols.map(col => {
                  const isDragging = dragKey === col.key;
                  const isDropTarget = dropTargetKey === col.key && dragKey !== null && dragKey !== col.key;
                  return (
                    <div
                      key={col.key}
                      draggable
                      className={cn(
                        headerClass,
                        col.width,
                        col.key === 'path' ? '' : 'shrink-0',
                        'cursor-pointer select-none transition-colors',
                        isDragging && 'opacity-40',
                        isDropTarget && 'bg-primary/15 text-foreground'
                      )}
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
                    </div>
                  );
                })}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {COL_DEFS.map(col => (
                <DropdownMenuCheckboxItem key={col.key} checked={!hiddenCols.has(col.key)} onCheckedChange={() => toggleCol(col.key)}>
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Virtualized rows */}
          {sortedSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">No sessions captured</div>
          ) : (
            <List
              rowHeight={ROW_HEIGHT}
              rowCount={sortedSessions.length}
              rowComponent={SessionRow}
              rowProps={{ sessions: sortedSessions, selectedIds, activeId, onSelect, onContextSession: handleContextSession, marks, orderedCols }}
              style={{ height: containerHeight, width: '100%' }}
            />
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        {contextSession?.request && (
          <>
            <ContextMenuItem onClick={() => contextSession && onReplay?.(contextSession)}>
              Replay Request
            </ContextMenuItem>
            <ContextMenuItem onClick={() => contextSession && onComposerPrefill?.(contextSession)}>
              Edit in Composer
            </ContextMenuItem>
          </>
        )}
        <ContextMenuItem onClick={() => contextSession && onDiff?.(contextSession)}>
          {diffPending ? 'Compare with this' : 'Compare...'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Copy</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => contextSession && copyToClipboard(copyUrl(contextSession))}>URL</ContextMenuItem>
            <ContextMenuItem onClick={() => contextSession && copyToClipboard(copyRequestHeaders(contextSession))}>Request Headers</ContextMenuItem>
            <ContextMenuItem onClick={() => contextSession && copyToClipboard(copyResponseHeaders(contextSession))}>Response Headers</ContextMenuItem>
            <ContextMenuItem onClick={() => contextSession && copyToClipboard(copyCurl(contextSession))}>cURL Command</ContextMenuItem>
            <ContextMenuItem onClick={() => contextSession && copyToClipboard(copyResponseBody(contextSession))}>Response Body</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Tags</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {['important', 'bug', 'review', 'done'].map((tag) => {
              const hasTag = contextSession?.tags?.includes(tag);
              return (
                <ContextMenuItem
                  key={tag}
                  onClick={() => contextSession && TagSession(contextSession.id, tag, !!hasTag)}
                >
                  <span className={cn('mr-2', hasTag ? 'text-status-success' : 'text-muted-foreground')}>
                    {hasTag ? '\u2713' : '\u25CB'}
                  </span>
                  {tag}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => {
          if (!contextSession) return;
          const comment = prompt('Comment:', contextSession.comment || '');
          if (comment !== null) CommentSession(contextSession.id, comment);
        }}>
          {contextSession?.comment ? 'Edit Comment' : 'Add Comment'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
