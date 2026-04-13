import { useState, useEffect, useCallback, useRef } from 'react';
import { List } from 'react-window';
import { model } from '../../../wailsjs/go/models';
import { TagSession, CommentSession } from '../../../wailsjs/go/app/App';
import { cn } from '@/lib/utils';
import { formatTime, formatDuration, formatBytes, shortContentType, getPath } from '@/lib/format';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';

// Session may have runtime-added tags/comment fields from Go backend
type SessionExt = model.Session & { tags?: string[]; comment?: string };

interface SessionListProps {
  sessions: model.Session[];
  selectedId: string | null;
  onSelect: (session: model.Session) => void;
  onReplay?: (session: model.Session) => void;
  onComposerPrefill?: (session: model.Session) => void;
  onDiff?: (session: model.Session) => void;
  diffPending?: boolean;
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
  const status = session.response?.status_code;
  if (status && status >= 400) return 'bg-status-error/[0.04]';
  if (status && status >= 300) return 'bg-status-warning/[0.03]';
  const ct = session.response?.content_type?.toLowerCase() || '';
  if (ct.includes('javascript')) return 'bg-status-success/[0.03]';
  if (ct.includes('css')) return 'bg-status-info/[0.03]';
  if (ct.includes('image')) return 'bg-status-purple/[0.03]';
  if (ct.includes('html')) return 'bg-chart-5/[0.03]';
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

interface RowProps {
  sessions: model.Session[];
  selectedId: string | null;
  onSelect: (session: model.Session) => void;
  onContextSession: (session: model.Session) => void;
}

function SessionRow(props: { index: number; style: React.CSSProperties; ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' } } & RowProps) {
  const { index, style, sessions, selectedId, onSelect, onContextSession } = props;
  const session = sessions[index];
  const badge = protoBadge(session.protocol);
  const cellClass = 'px-2.5 text-foreground text-[13px] whitespace-nowrap overflow-hidden text-ellipsis';

  return (
    <div
      style={style}
      className={cn(
        'flex items-center hover:bg-muted/50 cursor-pointer border-b border-border/30',
        selectedId === session.id ? 'bg-primary/[0.08]' : rowTintClass(session)
      )}
      onClick={() => onSelect(session)}
      onContextMenu={() => onContextSession(session)}
    >
      <div className={cn(cellClass, 'w-10 text-muted-foreground shrink-0')}>{index + 1}</div>
      <div className={cn(cellClass, 'w-15 shrink-0')}>
        <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-sm', badge.bg, badge.text)}>
          {session.protocol}
        </span>
      </div>
      <div className={cn(cellClass, 'w-[180px] shrink-0 truncate')}>{session.target?.host || '-'}</div>
      <div className={cn(cellClass, 'w-15 shrink-0')}>{session.request?.method || '-'}</div>
      <div className={cn(cellClass, 'flex-1 min-w-0 truncate')} title={session.request?.url}>
        {getPath(session.request?.url)}
      </div>
      <div className={cn(cellClass, 'w-14 text-center shrink-0', statusClass(session.response?.status_code))}>
        {session.response?.status_code || '-'}
      </div>
      <div className={cn(cellClass, 'w-14 text-muted-foreground shrink-0')}>{shortContentType(session.response?.content_type)}</div>
      <div className={cn(cellClass, 'w-16 text-right text-muted-foreground shrink-0')}>{formatBytes(session.response?.body_size)}</div>
      <div className={cn(cellClass, 'w-16 text-right shrink-0')}>{formatDuration(session.duration)}</div>
      <div className={cn(cellClass, 'w-16 text-muted-foreground shrink-0')}>{formatTime(session.created_at)}</div>
    </div>
  );
}

export function SessionList({ sessions, selectedId, onSelect, onReplay, onComposerPrefill, onDiff, diffPending }: SessionListProps) {
  const [contextSession, setContextSession] = useState<SessionExt | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

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
          <div className="flex shrink-0">
            <div className={cn(headerClass, 'w-10 shrink-0')}>#</div>
            <div className={cn(headerClass, 'w-15 shrink-0')}>Proto</div>
            <div className={cn(headerClass, 'w-[180px] shrink-0')}>Host</div>
            <div className={cn(headerClass, 'w-15 shrink-0')}>Method</div>
            <div className={cn(headerClass, 'flex-1')}>Path</div>
            <div className={cn(headerClass, 'w-14 text-center shrink-0')}>Status</div>
            <div className={cn(headerClass, 'w-14 shrink-0')}>Type</div>
            <div className={cn(headerClass, 'w-16 text-right shrink-0')}>Size</div>
            <div className={cn(headerClass, 'w-16 text-right shrink-0')}>Duration</div>
            <div className={cn(headerClass, 'w-16 shrink-0')}>Time</div>
          </div>

          {/* Virtualized rows */}
          {sessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">No sessions captured</div>
          ) : (
            <List
              rowHeight={ROW_HEIGHT}
              rowCount={sessions.length}
              rowComponent={SessionRow}
              rowProps={{ sessions, selectedId, onSelect, onContextSession: handleContextSession }}
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
