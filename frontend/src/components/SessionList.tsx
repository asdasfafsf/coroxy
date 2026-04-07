import { useState, useEffect, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { model } from '../../wailsjs/go/models';
import { TagSession, CommentSession } from '../../wailsjs/go/app/App';

interface SessionListProps {
  sessions: model.Session[];
  selectedId: string | null;
  onSelect: (session: model.Session) => void;
  onReplay?: (session: model.Session) => void;
  onComposerPrefill?: (session: model.Session) => void;
}

function formatTime(createdAt: string | number | Date): string {
  const date = new Date(createdAt);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function formatDuration(ns: number): string {
  if (ns <= 0) return '-';
  const ms = ns / 1_000_000;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusClass(code: number | undefined): string {
  if (!code) return '';
  if (code >= 200 && code < 300) return 'text-[#a6e3a1]';
  if (code >= 300 && code < 400) return 'text-[#89b4fa]';
  if (code >= 400 && code < 500) return 'text-[#f9e2af]';
  if (code >= 500) return 'text-[#f38ba8]';
  return '';
}

function rowTintClass(session: model.Session): string {
  const status = session.response?.status_code;
  if (status && status >= 400) return 'bg-[#f38ba810]';
  if (status && status >= 300) return 'bg-[#f9e2af08]';
  const ct = session.response?.content_type?.toLowerCase() || '';
  if (ct.includes('javascript')) return 'bg-[#a6e3a108]';
  if (ct.includes('css')) return 'bg-[#89b4fa08]';
  if (ct.includes('image')) return 'bg-[#cba6f708]';
  if (ct.includes('html')) return 'bg-[#fab38708]';
  return '';
}

function protoBadgeClass(protocol: string): string {
  const base = 'text-[11px] font-semibold px-1.5 py-0.5 rounded';
  switch (protocol.toUpperCase()) {
    case 'HTTP': return `${base} bg-[#89b4fa22] text-[#89b4fa]`;
    case 'TLS':  return `${base} bg-[#a6e3a122] text-[#a6e3a1]`;
    case 'TCP':  return `${base} bg-[#f9e2af22] text-[#f9e2af]`;
    case 'UDP':  return `${base} bg-[#cba6f722] text-[#cba6f7]`;
    default:     return `${base} bg-[#6c708622] text-[#6c7086]`;
  }
}

function getPath(url: string | undefined): string {
  if (!url) return '-';
  try { return new URL(url).pathname; } catch { return url; }
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortContentType(ct: string | undefined): string {
  if (!ct) return '-';
  const mime = ct.split(';')[0].trim();
  const sub = mime.split('/')[1];
  if (!sub) return mime;
  if (sub.includes('form')) return 'form';
  if (sub === 'javascript') return 'js';
  if (sub === 'octet-stream') return 'binary';
  return sub;
}

const ROW_HEIGHT = 28;

export function SessionList({ sessions, selectedId, onSelect, onReplay, onComposerPrefill }: SessionListProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: model.Session } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Measure container height.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height - 28); // subtract header height
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, session: model.Session) => {
    e.preventDefault();
    onSelect(session);
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  }, [onSelect]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  const headerClass = 'px-2.5 py-1.5 text-left bg-[#181825] text-[#a6adc8] font-medium text-xs border-b border-[#313244] whitespace-nowrap';
  const cellClass = 'px-2.5 text-[#cdd6f4] text-[13px] whitespace-nowrap overflow-hidden text-ellipsis';

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const session = sessions[index];
    return (
      <div
        style={style}
        className={`flex items-center hover:bg-[#313244] cursor-pointer border-b border-[#313244]/30 ${selectedId === session.id ? 'bg-[#313244]' : rowTintClass(session)}`}
        onClick={() => onSelect(session)}
        onContextMenu={(e) => handleContextMenu(e, session)}
      >
        <div className={`${cellClass} w-10 text-[#6c7086] shrink-0`}>{index + 1}</div>
        <div className={`${cellClass} w-15 shrink-0`}>
          <span className={protoBadgeClass(session.protocol)}>{session.protocol}</span>
        </div>
        <div className={`${cellClass} w-[180px] shrink-0 truncate`}>{session.target?.host || '-'}</div>
        <div className={`${cellClass} w-15 shrink-0`}>{session.request?.method || '-'}</div>
        <div className={`${cellClass} flex-1 min-w-0 truncate`} title={session.request?.url}>
          {getPath(session.request?.url)}
        </div>
        <div className={`${cellClass} w-14 text-center shrink-0 ${statusClass(session.response?.status_code)}`}>
          {session.response?.status_code || '-'}
        </div>
        <div className={`${cellClass} w-14 text-[#6c7086] shrink-0`}>{shortContentType(session.response?.content_type)}</div>
        <div className={`${cellClass} w-16 text-right text-[#6c7086] shrink-0`}>{formatBytes(session.response?.body_size)}</div>
        <div className={`${cellClass} w-16 text-right shrink-0`}>{formatDuration(session.duration)}</div>
        <div className={`${cellClass} w-16 text-[#6c7086] shrink-0`}>{formatTime(session.created_at)}</div>
      </div>
    );
  }, [sessions, selectedId, onSelect, handleContextMenu]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-[#1e1e2e] flex flex-col">
      {/* Header */}
      <div className="flex shrink-0">
        <div className={`${headerClass} w-10 shrink-0`}>#</div>
        <div className={`${headerClass} w-15 shrink-0`}>Proto</div>
        <div className={`${headerClass} w-[180px] shrink-0`}>Host</div>
        <div className={`${headerClass} w-15 shrink-0`}>Method</div>
        <div className={`${headerClass} flex-1`}>Path</div>
        <div className={`${headerClass} w-14 text-center shrink-0`}>Status</div>
        <div className={`${headerClass} w-14 shrink-0`}>Type</div>
        <div className={`${headerClass} w-16 text-right shrink-0`}>Size</div>
        <div className={`${headerClass} w-16 text-right shrink-0`}>Duration</div>
        <div className={`${headerClass} w-16 shrink-0`}>Time</div>
      </div>

      {/* Virtualized rows */}
      {sessions.length === 0 ? (
        <div className="text-center text-[#6c7086] py-10 text-sm">No sessions captured</div>
      ) : (
        <List
          height={containerHeight}
          itemCount={sessions.length}
          itemSize={ROW_HEIGHT}
          width="100%"
        >
          {Row}
        </List>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#181825] border border-[#313244] rounded shadow-xl py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.session.request && (
            <>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#313244]"
                onClick={() => { onReplay?.(contextMenu.session); setContextMenu(null); }}
              >
                Replay Request
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#313244]"
                onClick={() => { onComposerPrefill?.(contextMenu.session); setContextMenu(null); }}
              >
                Edit in Composer
              </button>
            </>
          )}
          <div className="border-t border-[#313244] my-1" />
          <div className="px-3 py-1 text-[10px] text-[#6c7086] font-medium">Tags</div>
          {['important', 'bug', 'review', 'done'].map((tag) => {
            const hasTag = contextMenu.session.tags?.includes(tag);
            return (
              <button
                key={tag}
                className="w-full text-left px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#313244] flex items-center gap-2"
                onClick={() => { TagSession(contextMenu.session.id, tag, !!hasTag); setContextMenu(null); }}
              >
                <span className={hasTag ? 'text-[#a6e3a1]' : 'text-[#6c7086]'}>{hasTag ? '\u2713' : '\u25CB'}</span>
                {tag}
              </button>
            );
          })}
          <div className="border-t border-[#313244] my-1" />
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#313244]"
            onClick={() => {
              const comment = prompt('Comment:', contextMenu.session.comment || '');
              if (comment !== null) CommentSession(contextMenu.session.id, comment);
              setContextMenu(null);
            }}
          >
            {contextMenu.session.comment ? 'Edit Comment' : 'Add Comment'}
          </button>
        </div>
      )}
    </div>
  );
}
