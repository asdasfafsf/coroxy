import { model } from '../../wailsjs/go/models';

interface SessionListProps {
  sessions: model.Session[];
  selectedId: string | null;
  onSelect: (session: model.Session) => void;
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

// Row tint based on Content-Type and status (Fiddler-style).
function rowTintClass(session: model.Session): string {
  const status = session.response?.status_code;
  if (status && status >= 400) return 'bg-[#f38ba810]'; // red tint for errors
  if (status && status >= 300) return 'bg-[#f9e2af08]'; // yellow tint for redirects

  const ct = session.response?.content_type?.toLowerCase() || '';
  if (ct.includes('javascript')) return 'bg-[#a6e3a108]'; // green tint
  if (ct.includes('css')) return 'bg-[#89b4fa08]'; // blue tint
  if (ct.includes('image')) return 'bg-[#cba6f708]'; // purple tint
  if (ct.includes('html')) return 'bg-[#fab38708]'; // orange tint
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
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortContentType(ct: string | undefined): string {
  if (!ct) return '-';
  // "application/json; charset=utf-8" → "json"
  const mime = ct.split(';')[0].trim();
  const sub = mime.split('/')[1];
  if (!sub) return mime;
  // "x-www-form-urlencoded" → "form"
  if (sub.includes('form')) return 'form';
  // "javascript" → "js"
  if (sub === 'javascript') return 'js';
  // "octet-stream" → "binary"
  if (sub === 'octet-stream') return 'binary';
  return sub;
}

export function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
  const headerClass = 'px-2.5 py-1.5 text-left bg-[#181825] text-[#a6adc8] font-medium text-xs border-b border-[#313244] whitespace-nowrap sticky top-0 z-10';
  const cellClass = 'px-2.5 py-1 text-[#cdd6f4] text-[13px] whitespace-nowrap overflow-hidden text-ellipsis';

  return (
    <div className="flex-1 overflow-auto bg-[#1e1e2e]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${headerClass} w-10`}>#</th>
            <th className={`${headerClass} w-15`}>Proto</th>
            <th className={headerClass}>Host</th>
            <th className={`${headerClass} w-15`}>Method</th>
            <th className={headerClass}>Path</th>
            <th className={`${headerClass} w-15 text-center`}>Status</th>
            <th className={`${headerClass} w-16`}>Type</th>
            <th className={`${headerClass} w-18 text-right`}>Size</th>
            <th className={`${headerClass} w-20 text-right`}>Duration</th>
            <th className={`${headerClass} w-20`}>Time</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-center text-[#6c7086] py-10 text-sm">
                No sessions captured
              </td>
            </tr>
          ) : (
            sessions.map((session, index) => (
              <tr
                key={session.id}
                className={`hover:bg-[#313244] cursor-pointer ${selectedId === session.id ? 'bg-[#313244]' : rowTintClass(session)}`}
                onClick={() => onSelect(session)}
              >
                <td className={`${cellClass} w-10 text-[#6c7086]`}>{index + 1}</td>
                <td className={`${cellClass} w-15`}>
                  <span className={protoBadgeClass(session.protocol)}>{session.protocol}</span>
                </td>
                <td className={`${cellClass} max-w-[200px]`}>{session.target?.host || '-'}</td>
                <td className={`${cellClass} w-15`}>{session.request?.method || '-'}</td>
                <td className={`${cellClass} max-w-[300px]`} title={session.request?.url}>
                  {getPath(session.request?.url)}
                </td>
                <td className={`${cellClass} w-15 text-center ${statusClass(session.response?.status_code)}`}>
                  {session.response?.status_code || '-'}
                </td>
                <td className={`${cellClass} w-16 text-[#6c7086]`}>{shortContentType(session.response?.content_type)}</td>
                <td className={`${cellClass} w-18 text-right text-[#6c7086]`}>{formatBytes(session.response?.body_size)}</td>
                <td className={`${cellClass} w-20 text-right`}>{formatDuration(session.duration)}</td>
                <td className={`${cellClass} w-20 text-[#6c7086]`}>{formatTime(session.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
