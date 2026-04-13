import { useState, useEffect } from 'react';
import { PendingBreakpoints, BreakpointResume, BreakpointDrop, BreakpointResumeWithEdit } from '../../../wailsjs/go/app/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

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
        if (idx > 0) headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
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

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-card border border-status-warning rounded-lg shadow-xl p-4 w-[600px] max-h-[400px] overflow-auto">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-status-warning animate-pulse" />
        <span className="text-xs font-semibold text-status-warning">Breakpoint — {pending.length} request(s) paused</span>
      </div>

      {pending.map((p) => (
        <div key={p.id} className="py-2 border-t border-border">
          {editingId === p.id ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select value={editMethod} onValueChange={setEditMethod}>
                  <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input className="flex-1 h-7 text-xs font-mono" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
              </div>
              <Textarea className="h-12 resize-none font-mono text-xs" value={editHeaders} onChange={(e) => setEditHeaders(e.target.value)} placeholder="Header: Value (one per line)" />
              <Textarea className="h-12 resize-none font-mono text-xs" value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="Request body" />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button size="sm" onClick={submitEdit}>Send Edited</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-foreground truncate">
                  <span className="text-primary font-medium">{p.method}</span> {p.url}
                </div>
                <div className="text-[10px] text-muted-foreground">{p.host}</div>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => startEdit(p)}>Edit</Button>
              <Button size="sm" className="h-6 text-xs" onClick={async () => { await BreakpointResume(p.id); refresh(); }}>Resume</Button>
              <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={async () => { await BreakpointDrop(p.id); refresh(); }}>Drop</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
