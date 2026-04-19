import { useState, useCallback } from 'react';
import { SendRequest } from '../../../wailsjs/go/app/App';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatBytes, tryFormatJson } from '@/lib/format';
import { cn } from '@/lib/utils';
import { X, Send, History, Clock } from 'lucide-react';

interface ComposerPrefill {
  method: string;
  url: string;
  headers: string;
  body: string;
}

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  prefill?: ComposerPrefill | null;
}

interface HistoryEntry {
  method: string;
  url: string;
  status: number;
  duration: number;
  timestamp: Date;
}

export function Composer({ open, onClose, prefill }: ComposerProps) {
  const [method, setMethod] = useState(prefill?.method || 'GET');
  const [url, setUrl] = useState(prefill?.url || 'https://');
  const [headers, setHeaders] = useState(prefill?.headers || '');
  const [body, setBody] = useState(prefill?.body || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [response, setResponse] = useState<{
    status_code: number;
    status_text: string;
    headers: Record<string, string>;
    body: string;
    body_size: number;
    duration_ms: number;
  } | null>(null);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    try {
      const headerMap: Record<string, string> = {};
      if (headers.trim()) {
        for (const line of headers.split('\n')) {
          const idx = line.indexOf(':');
          if (idx > 0) headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
      const resp = await SendRequest({ method, url, headers: headerMap, body });
      setResponse(resp);
      setHistory((prev) => [
        {
          method,
          url,
          status: resp.status_code,
          duration: resp.duration_ms,
          timestamp: new Date(),
        },
        ...prev.slice(0, 49),
      ]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [method, url, headers, body]);

  const loadFromHistory = (entry: HistoryEntry) => {
    setMethod(entry.method);
    setUrl(entry.url);
    setShowHistory(false);
  };

  if (!open) return null;

  return (
    <div className="border-t border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Send className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Composer</span>
          {history.length > 0 && (
            <Button
              size="sm"
              variant={showHistory ? 'secondary' : 'ghost'}
              className="h-5 px-1.5 text-[10px] gap-1"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-3 w-3" />
              {history.length}
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex">
        {/* History sidebar */}
        {showHistory && (
          <ScrollArea className="w-48 border-r border-border h-48">
            <div className="p-1">
              {history.map((entry, i) => (
                <button
                  key={i}
                  className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-muted/50 flex flex-col"
                  onClick={() => loadFromHistory(entry)}
                >
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-medium">{entry.method}</span>
                    <span
                      className={cn(
                        'text-[10px]',
                        entry.status < 400 ? 'text-status-success' : 'text-destructive',
                      )}
                    >
                      {entry.status}
                    </span>
                    <span className="text-muted-foreground text-[10px]">{entry.duration}ms</span>
                  </span>
                  <span className="text-muted-foreground truncate">{entry.url}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Main content */}
        <div className="flex-1 p-3 space-y-2 max-h-48 overflow-auto">
          <div className="flex gap-2">
            <Select value={method} onValueChange={setMethod}>
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
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint"
            />
            <Button size="sm" onClick={handleSend} disabled={loading} className="h-7">
              {loading ? '...' : 'Send'}
            </Button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-muted-foreground text-[10px] font-medium mb-0.5">Headers</div>
              <Textarea
                className="h-12 resize-none font-mono text-[11px]"
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                placeholder={'Content-Type: application/json'}
              />
            </div>
            {['POST', 'PUT', 'PATCH'].includes(method) && (
              <div className="flex-1">
                <div className="text-muted-foreground text-[10px] font-medium mb-0.5">Body</div>
                <Textarea
                  className="h-12 resize-none font-mono text-[11px]"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                />
              </div>
            )}
          </div>

          {error && <div className="text-[11px] text-destructive">{error}</div>}

          {response && (
            <div className="bg-secondary rounded-md p-2 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-semibold',
                    response.status_code < 400 ? 'text-status-success' : 'text-destructive',
                  )}
                >
                  {response.status_text}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {response.duration_ms}ms
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatBytes(response.body_size)}
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-foreground text-[11px] leading-4 max-h-20 overflow-auto">
                {tryFormatJson(response.body)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
