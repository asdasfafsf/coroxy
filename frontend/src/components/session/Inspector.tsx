import { useState } from 'react';
import { model } from '../../../wailsjs/go/models';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { decodeBody, formatBytes, tryFormatJson } from '@/lib/format';
import { ChevronRight, Copy, Check, ArrowUpRight, ArrowDownLeft, MousePointerClick } from 'lucide-react';
import { JsonTreeView } from '@/components/shared/JsonTreeView';
import { HexViewer } from '@/components/shared/HexViewer';
import { WebSocketViewer } from '@/components/shared/WebSocketViewer';

type SessionWithWS = model.Session & { ws_frames?: model.WSFrame[] };

interface InspectorProps {
  session: model.Session | null;
}

export function Inspector({ session }: InspectorProps) {
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <MousePointerClick className="h-10 w-10 opacity-20" />
        <span className="text-sm">Select a session to inspect</span>
        <span className="text-xs opacity-60">Click a row in the session list</span>
      </div>
    );
  }

  return (
    <ResizablePanelGroup orientation="vertical" id="coroxy-inspector" className="h-full">
      {/* Request Pane */}
      <ResizablePanel defaultSize={50} minSize={20}>
        <div className="flex flex-col h-full">
          <PaneHeader title="Request" icon={<ArrowUpRight className="h-3 w-3" />} />
          <Tabs defaultValue="headers" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-card border-b border-border rounded-none h-8 px-1">
              <TabsTrigger value="headers" className="text-[11px] h-6 px-2">Headers</TabsTrigger>
              <TabsTrigger value="query" className="text-[11px] h-6 px-2">
                Query{countBadge(session.request?.query_params)}
              </TabsTrigger>
              <TabsTrigger value="cookies" className="text-[11px] h-6 px-2">
                Cookies{countBadge(session.request?.cookies)}
              </TabsTrigger>
              <TabsTrigger value="webforms" className="text-[11px] h-6 px-2">WebForms</TabsTrigger>
              <TabsTrigger value="body" className="text-[11px] h-6 px-2">Body</TabsTrigger>
              <TabsTrigger value="hex" className="text-[11px] h-6 px-2">Hex</TabsTrigger>
              <TabsTrigger value="raw" className="text-[11px] h-6 px-2">Raw</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-auto p-3 text-[13px] font-mono">
              <TabsContent value="headers" className="mt-0"><RequestHeaders session={session} /></TabsContent>
              <TabsContent value="query" className="mt-0"><QueryView params={session.request?.query_params} /></TabsContent>
              <TabsContent value="cookies" className="mt-0"><CookieTable cookies={session.request?.cookies} /></TabsContent>
              <TabsContent value="webforms" className="mt-0"><WebFormsView body={session.request?.body} contentType={session.request?.content_type} /></TabsContent>
              <TabsContent value="body" className="mt-0"><BodyContent body={session.request?.body} contentType={session.request?.content_type} size={session.request?.body_size} /></TabsContent>
              <TabsContent value="hex" className="mt-0"><HexView body={session.request?.body} /></TabsContent>
              <TabsContent value="raw" className="mt-0"><RawRequest session={session} /></TabsContent>
            </div>
          </Tabs>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Response Pane */}
      <ResizablePanel defaultSize={50} minSize={20}>
        <div className="flex flex-col h-full">
          <PaneHeader title="Response" icon={<ArrowDownLeft className="h-3 w-3" />} />
          <Tabs defaultValue="headers" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-card border-b border-border rounded-none h-8 px-1">
              <TabsTrigger value="headers" className="text-[11px] h-6 px-2">Headers</TabsTrigger>
              <TabsTrigger value="cookies" className="text-[11px] h-6 px-2">
                Cookies{countBadge(session.response?.cookies)}
              </TabsTrigger>
              <TabsTrigger value="body" className="text-[11px] h-6 px-2">Body</TabsTrigger>
              <TabsTrigger value="hex" className="text-[11px] h-6 px-2">Hex</TabsTrigger>
              <TabsTrigger value="raw" className="text-[11px] h-6 px-2">Raw</TabsTrigger>
              <TabsTrigger value="timing" className="text-[11px] h-6 px-2">Timing</TabsTrigger>
              {(session as SessionWithWS).ws_frames && (session as SessionWithWS).ws_frames!.length > 0 && (
                <TabsTrigger value="websocket" className="text-[11px] h-6 px-2">
                  WS ({(session as SessionWithWS).ws_frames!.length})
                </TabsTrigger>
              )}
            </TabsList>
            <div className="flex-1 overflow-auto p-3 text-[13px] font-mono">
              <TabsContent value="headers" className="mt-0"><ResponseHeaders session={session} /></TabsContent>
              <TabsContent value="cookies" className="mt-0"><CookieTable cookies={session.response?.cookies} /></TabsContent>
              <TabsContent value="body" className="mt-0"><BodyContent body={session.response?.body} contentType={session.response?.content_type} size={session.response?.body_size} /></TabsContent>
              <TabsContent value="hex" className="mt-0"><HexView body={session.response?.body} /></TabsContent>
              <TabsContent value="raw" className="mt-0"><RawResponse session={session} /></TabsContent>
              <TabsContent value="timing" className="mt-0"><TimingView session={session} /></TabsContent>
              {(session as SessionWithWS).ws_frames && (
                <TabsContent value="websocket" className="mt-0 -m-3"><WebSocketViewer frames={(session as SessionWithWS).ws_frames!} /></TabsContent>
              )}
            </div>
          </Tabs>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function PaneHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 text-foreground text-[10px] font-semibold uppercase tracking-wider border-b border-border">
      <span className="text-primary">{icon}</span>
      {title}
    </div>
  );
}

function countBadge(items: unknown[] | undefined | null): string {
  if (!items || items.length === 0) return '';
  return ` (${items.length})`;
}

const IMPORTANT_HEADERS = new Set([
  'authorization', 'content-type', 'set-cookie', 'cookie',
  'cache-control', 'location', 'x-forwarded-for', 'origin',
  'access-control-allow-origin', 'content-encoding', 'transfer-encoding',
]);

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground text-[11px] font-semibold mb-1 hover:text-foreground transition-colors w-full">
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 ml-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CopyableRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex text-xs group items-start">
      <span className={cn('w-40 shrink-0 truncate', highlight ? 'text-status-warning font-medium' : 'text-primary')}>{label}</span>
      <span className="text-foreground break-all flex-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" onClick={handleCopy}>
        {value}
      </span>
      <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
        {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
      </button>
    </div>
  );
}

function RequestHeaders({ session }: { session: model.Session }) {
  const req = session.request;
  if (!req) return <Empty />;
  return (
    <div className="space-y-3">
      <CollapsibleSection title="General">
        <CopyableRow label="URL" value={req.url || '-'} />
        <CopyableRow label="Method" value={req.method || '-'} />
        <CopyableRow label="HTTP Version" value={req.http_version || '-'} />
        <CopyableRow label="Host" value={session.target?.host || '-'} />
        <CopyableRow label="Content-Type" value={req.content_type || '-'} />
      </CollapsibleSection>
      {req.headers && (
        <CollapsibleSection title={`Request Headers (${Object.keys(req.headers).length})`}>
          {Object.entries(req.headers).map(([key, values]) => (
            <CopyableRow
              key={key}
              label={key}
              value={(values as string[]).join(', ')}
              highlight={IMPORTANT_HEADERS.has(key.toLowerCase())}
            />
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}

function ResponseHeaders({ session }: { session: model.Session }) {
  const resp = session.response;
  if (!resp) return <Empty />;
  return (
    <div className="space-y-3">
      <CollapsibleSection title="General">
        <CopyableRow label="Status" value={resp.status_text || String(resp.status_code)} />
        <CopyableRow label="HTTP Version" value={resp.http_version || '-'} />
        <CopyableRow label="Content-Type" value={resp.content_type || '-'} />
        <CopyableRow label="Content-Encoding" value={resp.content_encoding || 'none'} />
        <CopyableRow label="Body Size" value={formatBytes(resp.body_size)} />
      </CollapsibleSection>
      {resp.headers && (
        <CollapsibleSection title={`Response Headers (${Object.keys(resp.headers).length})`}>
          {Object.entries(resp.headers).map(([key, values]) => (
            <CopyableRow
              key={key}
              label={key}
              value={(values as string[]).join(', ')}
              highlight={IMPORTANT_HEADERS.has(key.toLowerCase())}
            />
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}

function QueryView({ params }: { params: { name: string; value: string }[] | undefined | null }) {
  if (!params || params.length === 0) return <div className="text-muted-foreground text-xs">No query parameters</div>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b border-border">
          <th className="text-left py-1 px-2 w-1/3">Name</th>
          <th className="text-left py-1 px-2">Value</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p, i) => (
          <tr key={i} className="border-b border-border/50">
            <td className="py-1 px-2 text-primary">{decodeURIComponent(p.name)}</td>
            <td className="py-1 px-2 text-foreground break-all">{decodeURIComponent(p.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CookieTable({ cookies }: { cookies: model.HTTPCookie[] | undefined | null }) {
  if (!cookies || cookies.length === 0) return <div className="text-muted-foreground text-xs">No cookies</div>;
  const hasAttributes = cookies.some(c => c.domain || c.path || c.expires || c.secure || c.http_only || c.same_site);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b border-border">
          <th className="text-left py-1 px-2">Name</th>
          <th className="text-left py-1 px-2">Value</th>
          {hasAttributes && (
            <>
              <th className="text-left py-1 px-2">Domain</th>
              <th className="text-left py-1 px-2">Path</th>
              <th className="text-left py-1 px-2">Expires</th>
              <th className="text-center py-1 px-2">Flags</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {cookies.map((c, i) => (
          <tr key={i} className="border-b border-border/50">
            <td className="py-1 px-2 text-primary">{c.name}</td>
            <td className="py-1 px-2 text-foreground break-all max-w-[200px] truncate" title={c.value}>{c.value}</td>
            {hasAttributes && (
              <>
                <td className="py-1 px-2 text-muted-foreground">{c.domain || '-'}</td>
                <td className="py-1 px-2 text-muted-foreground">{c.path || '-'}</td>
                <td className="py-1 px-2 text-muted-foreground">{c.expires || (c.max_age ? `${c.max_age}s` : '-')}</td>
                <td className="py-1 px-2 text-center text-muted-foreground">
                  {[c.secure && 'Secure', c.http_only && 'HttpOnly', c.same_site].filter(Boolean).join(', ') || '-'}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WebFormsView({ body, contentType }: { body: number[] | Uint8Array | string | undefined | null; contentType?: string }) {
  const decoded = decodeBody(body);
  if (!decoded) return <div className="text-muted-foreground text-xs">No form data</div>;
  if (!contentType?.includes('x-www-form-urlencoded')) {
    return <div className="text-muted-foreground text-xs">Content-Type is not application/x-www-form-urlencoded</div>;
  }
  const params: { name: string; value: string }[] = [];
  for (const pair of decoded.split('&')) {
    const [name, ...rest] = pair.split('=');
    if (name) params.push({ name: decodeURIComponent(name), value: decodeURIComponent(rest.join('=')) });
  }
  if (params.length === 0) return <div className="text-muted-foreground text-xs">Empty form data</div>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b border-border">
          <th className="text-left py-1 px-2 w-1/3">Name</th>
          <th className="text-left py-1 px-2">Value</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p, i) => (
          <tr key={i} className="border-b border-border/50">
            <td className="py-1 px-2 text-primary">{p.name}</td>
            <td className="py-1 px-2 text-foreground break-all">{p.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BodyContent({ body, contentType, size }: { body: number[] | Uint8Array | string | undefined | null; contentType?: string; size?: number }) {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');

  if (contentType?.startsWith('image/') && body) {
    return <ImagePreview body={body} contentType={contentType} size={size} />;
  }
  const decoded = decodeBody(body);
  if (!decoded) return <div className="text-muted-foreground text-xs">No body content</div>;

  const isJson = contentType?.includes('json');
  let parsedJson: unknown = null;
  if (isJson) {
    try { parsedJson = JSON.parse(decoded); } catch { /* not valid json */ }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground text-xs">
          {formatBytes(size)} {contentType && `· ${contentType}`}
        </span>
        {parsedJson !== null && (
          <div className="flex gap-1">
            <button
              className={cn('text-[10px] px-1.5 py-0.5 rounded', viewMode === 'tree' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setViewMode('tree')}
            >
              Tree
            </button>
            <button
              className={cn('text-[10px] px-1.5 py-0.5 rounded', viewMode === 'raw' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setViewMode('raw')}
            >
              Raw
            </button>
          </div>
        )}
      </div>
      {parsedJson !== null && viewMode === 'tree' ? (
        <div className="bg-secondary p-3 rounded-md max-h-[400px] overflow-auto">
          <JsonTreeView data={parsedJson} />
        </div>
      ) : (
        <pre className="whitespace-pre-wrap text-foreground text-xs leading-5 bg-secondary p-3 rounded-md max-h-[400px] overflow-auto">
          {formatBody(decoded, contentType)}
        </pre>
      )}
    </div>
  );
}

function ImagePreview({ body, contentType, size }: { body: number[] | Uint8Array | string; contentType: string; size?: number }) {
  const bytes = typeof body === 'string'
    ? new TextEncoder().encode(body)
    : body instanceof Uint8Array ? body : new Uint8Array(body);
  const mime = contentType.split(';')[0].trim();
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...bytes.slice(i, i + chunkSize)));
  }
  const base64 = btoa(parts.join(''));
  const dataUrl = `data:${mime};base64,${base64}`;
  return (
    <div>
      <div className="text-muted-foreground text-xs mb-2">{formatBytes(size)} · {contentType}</div>
      <div className="bg-secondary p-4 rounded-md flex items-center justify-center">
        <img src={dataUrl} alt="Response body" className="max-w-full max-h-[400px] object-contain" />
      </div>
    </div>
  );
}

function TimingView({ session }: { session: model.Session }) {
  const t = session.timing;
  const dur = session.duration;
  if (!t) return <div className="text-muted-foreground text-xs">No timing data available</div>;

  const phases = [
    { label: 'DNS Lookup', value: t.dns, colorClass: 'bg-chart-1' },
    { label: 'TCP Connect', value: t.connect, colorClass: 'bg-chart-2' },
    { label: 'TLS Handshake', value: t.tls, colorClass: 'bg-chart-3' },
    { label: 'TTFB (Wait)', value: t.ttfb, colorClass: 'bg-chart-4' },
    { label: 'Transfer', value: t.transfer, colorClass: 'bg-chart-5' },
  ];
  const total = phases.reduce((sum, p) => sum + Math.max(0, p.value), 0);
  const totalMs = dur ? dur / 1_000_000 : total;

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground text-xs">Total: {totalMs.toFixed(1)}ms</div>
      <div className="flex h-6 rounded-md overflow-hidden bg-secondary">
        {phases.map((p) => {
          if (p.value <= 0) return null;
          const pct = total > 0 ? (p.value / total) * 100 : 0;
          return (
            <div
              key={p.label}
              style={{ width: `${pct}%` }}
              className={cn(p.colorClass, 'h-full opacity-80 hover:opacity-100 transition-opacity')}
              title={`${p.label}: ${p.value.toFixed(1)}ms`}
            />
          );
        })}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-1 px-2 w-8"></th>
            <th className="text-left py-1 px-2">Phase</th>
            <th className="text-right py-1 px-2">Duration</th>
            <th className="text-right py-1 px-2">%</th>
          </tr>
        </thead>
        <tbody>
          {phases.map((p) => (
            <tr key={p.label} className="border-b border-border/50">
              <td className="py-1 px-2"><div className={cn('w-3 h-3 rounded-sm', p.colorClass)} /></td>
              <td className="py-1 px-2 text-foreground">{p.label}</td>
              <td className="py-1 px-2 text-right text-foreground">{p.value >= 0 ? `${p.value.toFixed(1)}ms` : 'N/A'}</td>
              <td className="py-1 px-2 text-right text-muted-foreground">
                {p.value > 0 && total > 0 ? `${((p.value / total) * 100).toFixed(0)}%` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HexView({ body }: { body: number[] | Uint8Array | string | undefined | null }) {
  if (!body) return <div className="text-muted-foreground text-xs">No data</div>;
  const bytes = typeof body === 'string'
    ? new TextEncoder().encode(body)
    : body instanceof Uint8Array ? body : new Uint8Array(body);
  if (bytes.length === 0) return <div className="text-muted-foreground text-xs">Empty body</div>;
  return <HexViewer data={bytes} />;
}

function RawRequest({ session }: { session: model.Session }) {
  const req = session.request;
  if (!req) return <Empty />;
  const lines: string[] = [];
  const urlPath = (() => { try { return new URL(req.url || '').pathname + new URL(req.url || '').search; } catch { return req.url || '/'; } })();
  lines.push(`${req.method} ${urlPath} ${req.http_version || 'HTTP/1.1'}`);
  lines.push(`Host: ${session.target?.host || '-'}`);
  if (req.headers) {
    for (const [key, values] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'host') continue;
      for (const v of values as string[]) lines.push(`${key}: ${v}`);
    }
  }
  lines.push('');
  const bodyText = decodeBody(req.body);
  if (bodyText) lines.push(bodyText);
  return <pre className="whitespace-pre-wrap text-foreground text-xs leading-5">{lines.join('\r\n')}</pre>;
}

function RawResponse({ session }: { session: model.Session }) {
  const resp = session.response;
  if (!resp) return <Empty />;
  const lines: string[] = [];
  lines.push(`${resp.http_version || 'HTTP/1.1'} ${resp.status_text || resp.status_code}`);
  if (resp.headers) {
    for (const [key, values] of Object.entries(resp.headers)) {
      for (const v of values as string[]) lines.push(`${key}: ${v}`);
    }
  }
  lines.push('');
  const bodyText = decodeBody(resp.body);
  if (bodyText) lines.push(bodyText);
  return <pre className="whitespace-pre-wrap text-foreground text-xs leading-5">{lines.join('\r\n')}</pre>;
}

function Empty() {
  return <div className="text-muted-foreground text-xs">No data available</div>;
}

function formatBody(text: string, contentType?: string): React.ReactNode {
  if (contentType?.includes('json')) {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
  }
  if (contentType?.includes('xml') || contentType?.includes('html')) {
    return highlightMarkup(text);
  }
  return text;
}

function highlightMarkup(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const tagRegex = /(<\/?[\w-]+)((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)(\/?>)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [, tagName, attrs, close] = match;
    parts.push(
      <span key={match.index}>
        <span className="text-status-error">{tagName}</span>
        <span className="text-status-success">{attrs}</span>
        <span className="text-status-error">{close}</span>
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
