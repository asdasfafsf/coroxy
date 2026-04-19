import { useState, useEffect } from 'react';
import {
  PendingBreakpoints,
  BreakpointResume,
  BreakpointDrop,
  BreakpointResumeWithEdit,
} from '../../../wailsjs/go/app/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Play, X, Pencil } from 'lucide-react';

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
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-card border border-status-warning rounded-lg shadow-xl w-[650px] max-h-[450px] overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <AlertCircle className="w-4 h-4 text-status-warning animate-pulse" />
        <span className="text-xs font-semibold text-status-warning flex-1">
          Breakpoint — {pending.length} request(s) paused
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[11px] text-muted-foreground"
          onClick={async () => {
            for (const p of pending) await BreakpointResume(p.id);
            refresh();
          }}
        >
          Resume All
        </Button>
      </div>

      {/* Pending list */}
      <div className="p-3 space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="border border-border rounded-md overflow-hidden">
            {/* Request summary + actions */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground truncate">
                  <span className="text-primary font-medium">{p.method}</span>{' '}
                  <span className="font-mono text-[11px]">{p.url}</span>
                </span>
                <div className="text-[10px] text-muted-foreground">{p.host}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 gap-1 text-[11px]"
                onClick={() => startEdit(p)}
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 gap-1 text-[11px]"
                onClick={async () => {
                  await BreakpointResume(p.id);
                  refresh();
                }}
              >
                <Play className="h-3 w-3" /> Resume
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 px-2 gap-1 text-[11px]"
                onClick={async () => {
                  await BreakpointDrop(p.id);
                  refresh();
                }}
              >
                <X className="h-3 w-3" /> Drop
              </Button>
            </div>

            {/* Edit form */}
            {editingId === p.id && (
              <div className="p-3 space-y-2 border-t border-border">
                <Tabs defaultValue="request">
                  <TabsList className="h-7">
                    <TabsTrigger value="request" className="text-[11px] h-5 px-2">
                      Request
                    </TabsTrigger>
                    <TabsTrigger value="headers" className="text-[11px] h-5 px-2">
                      Headers
                    </TabsTrigger>
                    <TabsTrigger value="body" className="text-[11px] h-5 px-2">
                      Body
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="request" className="mt-2">
                    <div className="flex gap-2">
                      <Select value={editMethod} onValueChange={setEditMethod}>
                        <SelectTrigger className="w-24 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="flex-1 h-7 text-xs font-mono"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="headers" className="mt-2">
                    <Textarea
                      className="h-20 resize-none font-mono text-[11px]"
                      value={editHeaders}
                      onChange={(e) => setEditHeaders(e.target.value)}
                      placeholder="Header: Value (one per line)"
                    />
                  </TabsContent>
                  <TabsContent value="body" className="mt-2">
                    <Textarea
                      className="h-20 resize-none font-mono text-[11px]"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      placeholder="Request body"
                    />
                  </TabsContent>
                </Tabs>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 text-[11px]"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="h-6 text-[11px]" onClick={submitEdit}>
                    Send Edited
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
