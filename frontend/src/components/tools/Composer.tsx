import { useState } from 'react';
import { SendRequest } from '../../../wailsjs/go/app/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes, tryFormatJson } from '@/lib/format';

interface ComposerPrefill {
  method: string;
  url: string;
  headers: string;
  body: string;
}

interface ComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: ComposerPrefill | null;
}

export function Composer({ open, onOpenChange, prefill }: ComposerProps) {
  const [method, setMethod] = useState(prefill?.method || 'GET');
  const [url, setUrl] = useState(prefill?.url || 'https://');
  const [headers, setHeaders] = useState(prefill?.headers || '');
  const [body, setBody] = useState(prefill?.body || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<{
    status_code: number;
    status_text: string;
    headers: Record<string, string>;
    body: string;
    body_size: number;
    duration_ms: number;
  } | null>(null);

  const handleSend = async () => {
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
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Composer</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="flex-1 h-8 text-xs font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/endpoint" />
            <Button size="sm" onClick={handleSend} disabled={loading} className="h-8">
              {loading ? '...' : 'Send'}
            </Button>
          </div>

          <div>
            <div className="text-muted-foreground text-xs font-medium mb-1">Headers (one per line: Name: Value)</div>
            <Textarea className="h-16 resize-none font-mono text-xs" value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder={'Content-Type: application/json\nAuthorization: Bearer token'} />
          </div>

          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div>
              <div className="text-muted-foreground text-xs font-medium mb-1">Body</div>
              <Textarea className="h-20 resize-none font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"key": "value"}' />
            </div>
          )}

          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>

        {response && (
          <div className="border-t border-border pt-4 flex-1 overflow-auto space-y-3">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${response.status_code < 400 ? 'text-status-success' : 'text-destructive'}`}>
                {response.status_text}
              </span>
              <span className="text-xs text-muted-foreground">{response.duration_ms}ms</span>
              <span className="text-xs text-muted-foreground">{formatBytes(response.body_size)}</span>
            </div>

            <div>
              <div className="text-muted-foreground text-xs font-medium mb-1">Response Headers</div>
              <div className="text-xs space-y-0.5">
                {Object.entries(response.headers).map(([k, v]) => (
                  <div key={k} className="flex">
                    <span className="text-primary w-40 shrink-0 truncate">{k}</span>
                    <span className="text-foreground break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground text-xs font-medium mb-1">Response Body</div>
              <pre className="whitespace-pre-wrap text-foreground text-xs leading-5 bg-secondary p-3 rounded-md max-h-[250px] overflow-auto">
                {tryFormatJson(response.body)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
