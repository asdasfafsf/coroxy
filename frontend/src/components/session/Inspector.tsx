import { useState } from 'react';
import { model } from '../../../wailsjs/go/models';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { decodeBody, formatBytes, tryFormatJson } from '@/lib/format';

interface InspectorProps {
  session: model.Session | null;
}

export function Inspector({ session }: InspectorProps) {
  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a session to inspect
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Request Pane */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-border">
        <PaneHeader title="Request" />
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

      {/* Response Pane */}
      <div className="flex-1 flex flex-col min-h-0">
        <PaneHeader title="Response" />
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
          </TabsList>
          <div className="flex-1 overflow-auto p-3 text-[13px] font-mono">
            <TabsContent value="headers" className="mt-0"><ResponseHeaders session={session} /></TabsContent>
            <TabsContent value="cookies" className="mt-0"><CookieTable cookies={session.response?.cookies} /></TabsContent>
            <TabsContent value="body" className="mt-0"><BodyContent body={session.response?.body} contentType={session.response?.content_type} size={session.response?.body_size} /></TabsContent>
            <TabsContent value="hex" className="mt-0"><HexView body={session.response?.body} /></TabsContent>
            <TabsContent value="raw" className="mt-0"><RawResponse session={session} /></TabsContent>
            <TabsContent value="timing" className="mt-0"><TimingView session={session} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function PaneHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-1 bg-secondary text-primary text-[11px] font-semibold border-b border-border">
      {title}
    </div>
  );
}

function countBadge(items: unknown[] | undefined | null): string {
  if (!items || items.length === 0) return '';
  return ` (${items.length})`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-muted-foreground text-[11px] font-semibold mb-1">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-xs">
      <span className="text-primary w-40 shrink-0 truncate">{label}</span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}

function RequestHeaders({ session }: { session: model.Session }) {
  const req = session.request;
  if (!req) return <Empty />;
  return (
    <div className="space-y-3">
      <Section title="General">
        <Row label="URL" value={req.url || '-'} />
        <Row label="Method" value={req.method || '-'} />
        <Row label="HTTP Version" value={req.http_version || '-'} />
        <Row label="Host" value={session.target?.host || '-'} />
        <Row label="Content-Type" value={req.content_type || '-'} />
      </Section>
      {req.headers && (
        <Section title="Request Headers">
          {Object.entries(req.headers).map(([key, values]) => (
            <Row key={key} label={key} value={(values as string[]).join(', ')} />
          ))}
        </Section>
      )}
    </div>
  );
}

function ResponseHeaders({ session }: { session: model.Session }) {
  const resp = session.response;
  if (!resp) return <Empty />;
  return (
    <div className="space-y-3">
      <Section title="General">
        <Row label="Status" value={resp.status_text || String(resp.status_code)} />
        <Row label="HTTP Version" value={resp.http_version || '-'} />
        <Row label="Content-Type" value={resp.content_type || '-'} />
        <Row label="Content-Encoding" value={resp.content_encoding || 'none'} />
        <Row label="Body Size" value={formatBytes(resp.body_size)} />
      </Section>
      {resp.headers && (
        <Section title="Response Headers">
          {Object.entries(resp.headers).map(([key, values]) => (
            <Row key={key} label={key} value={(values as string[]).join(', ')} />
          ))}
        </Section>
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
  if (contentType?.startsWith('image/') && body) {
    return <ImagePreview body={body} contentType={contentType} size={size} />;
  }
  const decoded = decodeBody(body);
  if (!decoded) return <div className="text-muted-foreground text-xs">No body content</div>;
  return (
    <div>
      <div className="text-muted-foreground text-xs mb-2">
        {formatBytes(size)} {contentType && `· ${contentType}`}
      </div>
      <pre className="whitespace-pre-wrap text-foreground text-xs leading-5 bg-secondary p-3 rounded-md max-h-[400px] overflow-auto">
        {formatBody(decoded, contentType)}
      </pre>
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

  const rows: string[] = [];
  const bytesPerRow = 16;
  const limit = Math.min(bytes.length, 8192);
  for (let offset = 0; offset < limit; offset += bytesPerRow) {
    const chunk = bytes.slice(offset, offset + bytesPerRow);
    const offsetStr = offset.toString(16).padStart(8, '0');
    const hexParts: string[] = [];
    for (let i = 0; i < bytesPerRow; i++) {
      hexParts.push(i < chunk.length ? chunk[i].toString(16).padStart(2, '0') : '  ');
    }
    const hexStr = hexParts.slice(0, 8).join(' ') + '  ' + hexParts.slice(8).join(' ');
    const asciiStr = Array.from(chunk).map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.').join('');
    rows.push(`${offsetStr}  ${hexStr}  |${asciiStr}|`);
  }
  if (bytes.length > limit) rows.push(`... (${bytes.length - limit} more bytes truncated)`);

  return (
    <pre className="text-foreground text-[11px] leading-4 font-mono whitespace-pre">
      <span className="text-muted-foreground">{'Offset    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  |ASCII           |'}</span>
      {'\n'}{rows.join('\n')}
    </pre>
  );
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
