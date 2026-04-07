import { useState, useEffect } from 'react';
import { PendingBreakpoints, BreakpointResume, BreakpointDrop, BreakpointResumeWithEdit } from '../../wailsjs/go/app/App';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editHeaders, setEditHeaders] = useState('');
  const [editBody, setEditBody] = useState('');

  const refresh = () => {
    PendingBreakpoints().then((p) => setPending(p || []));
  };

  useEffect(() => {
    refresh();
    const cancel = EventsOn('coroxy:breakpoint:hit', refresh);
    return cancel;
  }, []);

  const startEdit = (p: PendingRequest) => {
    setEditingId(p.id);
    setEditMethod(p.method);
    setEditUrl(p.url);
    setEditHeaders('');
    setEditBody('');
  };

  const submitEdit = async () => {
    if (!editingId) return;
    const headerMap: Record<string, string> = {};
    if (editHeaders.trim()) {
      for (const line of editHeaders.split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
    }
    await BreakpointResumeWithEdit(editingId, {
      method: editMethod,
      url: editUrl,
      headers: Object.keys(headerMap).length > 0 ? headerMap : {},
      body: editBody,
    });
    setEditingId(null);
    refresh();
  };

  if (pending.length === 0) return null;

  const inputClass = 'w-full px-2 py-1 rounded text-xs bg-[#11111b] text-[#cdd6f4] border border-[#313244] focus:outline-none focus:border-[#f9e2af]';

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e2e] border border-[#f9e2af] rounded-lg shadow-xl p-4 w-[600px] max-h-[400px] overflow-auto">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-[#f9e2af] animate-pulse" />
        <span className="text-xs font-semibold text-[#f9e2af]">Breakpoint — {pending.length} request(s) paused</span>
      </div>

      {pending.map((p) => (
        <div key={p.id} className="py-2 border-t border-[#313244]">
          {editingId === p.id ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select className={`${inputClass} w-20`} value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
                  <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option>
                </select>
                <input className={`${inputClass} flex-1`} value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
              </div>
              <textarea className={`${inputClass} h-12 resize-none font-mono`} value={editHeaders} onChange={(e) => setEditHeaders(e.target.value)} placeholder="Header: Value (one per line)" />
              <textarea className={`${inputClass} h-12 resize-none font-mono`} value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="Request body" />
              <div className="flex gap-2 justify-end">
                <button className="px-3 py-1 rounded text-xs font-medium bg-[#6c7086] text-[#1e1e2e] hover:bg-[#585b70]" onClick={() => setEditingId(null)}>Cancel</button>
                <button className="px-3 py-1 rounded text-xs font-medium bg-[#a6e3a1] text-[#1e1e2e] hover:bg-[#94d68e]" onClick={submitEdit}>Send Edited</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#cdd6f4] truncate">
                  <span className="text-[#89b4fa] font-medium">{p.method}</span> {p.url}
                </div>
                <div className="text-[10px] text-[#6c7086]">{p.host}</div>
              </div>
              <button
                className="px-3 py-1 rounded text-xs font-medium bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#7ba3e8]"
                onClick={() => startEdit(p)}
              >
                Edit
              </button>
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
          )}
        </div>
      ))}
    </div>
  );
}
