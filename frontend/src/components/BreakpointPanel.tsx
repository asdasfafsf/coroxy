import { useState, useEffect } from 'react';
import { GetPendingBreakpoints, BreakpointResume, BreakpointDrop } from '../../wailsjs/go/app/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface PendingRequest {
  id: string;
  method: string;
  url: string;
  host: string;
  rule_id: string;
}

export function BreakpointPanel() {
  const [pending, setPending] = useState<PendingRequest[]>([]);

  const refresh = () => {
    GetPendingBreakpoints().then((p) => setPending(p || []));
  };

  useEffect(() => {
    refresh();
    const cancel = EventsOn('coroxy:breakpoint:hit', refresh);
    return cancel;
  }, []);

  if (pending.length === 0) return null;

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e2e] border border-[#f9e2af] rounded-lg shadow-xl p-4 w-[500px] max-h-[300px] overflow-auto">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-[#f9e2af] animate-pulse" />
        <span className="text-xs font-semibold text-[#f9e2af]">Breakpoint — {pending.length} request(s) paused</span>
      </div>

      {pending.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2 border-t border-[#313244]">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[#cdd6f4] truncate">
              <span className="text-[#89b4fa] font-medium">{p.method}</span> {p.url}
            </div>
            <div className="text-[10px] text-[#6c7086]">{p.host}</div>
          </div>
          <button
            className="px-3 py-1 rounded text-xs font-medium bg-[#a6e3a1] text-[#1e1e2e] hover:bg-[#94d68e]"
            onClick={async () => { await BreakpointResume(p.id); refresh(); }}
          >
            Resume
          </button>
          <button
            className="px-3 py-1 rounded text-xs font-medium bg-[#f38ba8] text-[#1e1e2e] hover:bg-[#e67a96]"
            onClick={async () => { await BreakpointDrop(p.id); refresh(); }}
          >
            Drop
          </button>
        </div>
      ))}
    </div>
  );
}
