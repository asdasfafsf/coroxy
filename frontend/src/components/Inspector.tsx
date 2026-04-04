import { useState } from 'react';
import { model } from '../../wailsjs/go/models';

interface InspectorProps {
  session: model.Session | null;
}

type RequestTab = 'headers' | 'query' | 'cookies' | 'body' | 'raw';
type ResponseTab = 'headers' | 'cookies' | 'body' | 'raw';

export function Inspector({ session }: InspectorProps) {
  const [reqTab, setReqTab] = useState<RequestTab>('headers');
  const [resTab, setResTab] = useState<ResponseTab>('headers');

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-[#6c7086] text-sm">
        Select a session to inspect
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Request Pane */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-[#313244]">
        <PaneHeader title="Request" />
        <TabBar
          tabs={[
            { key: 'headers', label: 'Headers' },
            { key: 'query', label: `Query${countBadge(session.request?.query_params)}` },
            { key: 'cookies', label: `Cookies${countBadge(session.request?.cookies)}` },
            { key: 'body', label: 'Body' },
            { key: 'raw', label: 'Raw' },
          ]}
          active={reqTab}
          onSelect={(t) => setReqTab(t as RequestTab)}
        />
        <div className="flex-1 overflow-auto p-3 text-[13px] font-mono">
          {reqTab === 'headers' && <RequestHeaders session={session} />}
          {reqTab === 'query' && <QueryView params={session.request?.query_params} />}
          {reqTab === 'cookies' && <CookieTable cookies={session.request?.cookies} />}
          {reqTab === 'body' && <BodyContent body={session.request?.body} contentType={session.request?.content_type} size={session.request?.body_size} />}
          {reqTab === 'raw' && <RawRequest session={session} />}
        </div>
      </div>

      {/* Response Pane */}
      <div className="flex-1 flex flex-col min-h-0">
        <PaneHeader title="Response" />
        <TabBar
          tabs={[
            { key: 'headers', label: 'Headers' },
            { key: 'cookies', label: `Cookies${countBadge(session.response?.cookies)}` },
            { key: 'body', label: 'Body' },
            { key: 'raw', label: 'Raw' },
          ]}
          active={resTab}
          onSelect={(t) => setResTab(t as ResponseTab)}
        />
        <div className="flex-1 overflow-auto p-3 text-[13px] font-mono">
          {resTab === 'headers' && <ResponseHeaders session={session} />}
          {resTab === 'cookies' && <CookieTable cookies={session.response?.cookies} />}
          {resTab === 'body' && <BodyContent body={session.response?.body} contentType={session.response?.content_type} size={session.response?.body_size} />}
          {resTab === 'raw' && <RawResponse session={session} />}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function PaneHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-1 bg-[#11111b] text-[#89b4fa] text-xs font-semibold border-b border-[#313244]">
      {title}
    </div>
  );
}

function TabBar({ tabs, active, onSelect }: { tabs: { key: string; label: string }[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div className="flex border-b border-[#313244] bg-[#181825]">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            active === t.key
              ? 'text-[#cdd6f4] border-b-2 border-[#89b4fa]'
              : 'text-[#6c7086] hover:text-[#a6adc8]'
          }`}
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function countBadge(items: unknown[] | undefined | null): string {
  if (!items || items.length === 0) return '';
  return ` (${items.length})`;
}

// --- Request Views ---

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
        <Row label="Body Size" value={formatSize(resp.body_size)} />
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

// --- Query View ---

function QueryView({ params }: { params: { name: string; value: string }[] | undefined | null }) {
  if (!params || params.length === 0) {
    return <div className="text-[#6c7086] text-xs">No query parameters</div>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[#a6adc8] border-b border-[#313244]">
          <th className="text-left py-1 px-2 w-1/3">Name</th>
          <th className="text-left py-1 px-2">Value</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p, i) => (
          <tr key={i} className="border-b border-[#313244]/50">
            <td className="py-1 px-2 text-[#89b4fa]">{decodeURIComponent(p.name)}</td>
            <td className="py-1 px-2 text-[#cdd6f4] break-all">{decodeURIComponent(p.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Cookie View ---

function CookieTable({ cookies }: { cookies: model.HTTPCookie[] | undefined | null }) {
  if (!cookies || cookies.length === 0) {
    return <div className="text-[#6c7086] text-xs">No cookies</div>;
  }

  const hasAttributes = cookies.some(c => c.domain || c.path || c.expires || c.secure || c.http_only || c.same_site);

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[#a6adc8] border-b border-[#313244]">
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
          <tr key={i} className="border-b border-[#313244]/50">
            <td className="py-1 px-2 text-[#89b4fa]">{c.name}</td>
            <td className="py-1 px-2 text-[#cdd6f4] break-all max-w-[200px] truncate" title={c.value}>{c.value}</td>
            {hasAttributes && (
              <>
                <td className="py-1 px-2 text-[#6c7086]">{c.domain || '-'}</td>
                <td className="py-1 px-2 text-[#6c7086]">{c.path || '-'}</td>
                <td className="py-1 px-2 text-[#6c7086]">{c.expires || (c.max_age ? `${c.max_age}s` : '-')}</td>
                <td className="py-1 px-2 text-center text-[#6c7086]">
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

// --- Body View ---

function BodyContent({ body, contentType, size }: { body: number[] | Uint8Array | string | undefined | null; contentType?: string; size?: number }) {
  const decoded = decodeBody(body);

  if (!decoded) {
    return <div className="text-[#6c7086] text-xs">No body content</div>;
  }

  return (
    <div>
      <div className="text-[#6c7086] text-xs mb-2">
        {formatSize(size)} {contentType && `· ${contentType}`}
      </div>
      <pre className="whitespace-pre-wrap text-[#cdd6f4] text-xs leading-5 bg-[#11111b] p-3 rounded max-h-[400px] overflow-auto">
        {formatBody(decoded, contentType)}
      </pre>
    </div>
  );
}

// --- Raw Views ---

function RawRequest({ session }: { session: model.Session }) {
  const req = session.request;
  if (!req) return <Empty />;

  const lines: string[] = [];
  // Request line
  const urlPath = (() => { try { return new URL(req.url || '').pathname + new URL(req.url || '').search; } catch { return req.url || '/'; } })();
  lines.push(`${req.method} ${urlPath} ${req.http_version || 'HTTP/1.1'}`);
  lines.push(`Host: ${session.target?.host || '-'}`);

  if (req.headers) {
    for (const [key, values] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'host') continue;
      for (const v of values as string[]) {
        lines.push(`${key}: ${v}`);
      }
    }
  }
  lines.push('');

  const bodyText = decodeBody(req.body);
  if (bodyText) lines.push(bodyText);

  return (
    <pre className="whitespace-pre-wrap text-[#cdd6f4] text-xs leading-5">
      {lines.join('\r\n')}
    </pre>
  );
}

function RawResponse({ session }: { session: model.Session }) {
  const resp = session.response;
  if (!resp) return <Empty />;

  const lines: string[] = [];
  lines.push(`${resp.http_version || 'HTTP/1.1'} ${resp.status_text || resp.status_code}`);

  if (resp.headers) {
    for (const [key, values] of Object.entries(resp.headers)) {
      for (const v of values as string[]) {
        lines.push(`${key}: ${v}`);
      }
    }
  }
  lines.push('');

  const bodyText = decodeBody(resp.body);
  if (bodyText) lines.push(bodyText);

  return (
    <pre className="whitespace-pre-wrap text-[#cdd6f4] text-xs leading-5">
      {lines.join('\r\n')}
    </pre>
  );
}

// --- Shared components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[#a6adc8] text-xs font-semibold mb-1">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-xs">
      <span className="text-[#89b4fa] w-40 shrink-0 truncate">{label}</span>
      <span className="text-[#cdd6f4] break-all">{value}</span>
    </div>
  );
}

function Empty() {
  return <div className="text-[#6c7086] text-xs">No data available</div>;
}

// --- Helpers ---

function decodeBody(body: number[] | Uint8Array | string | undefined | null): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body;
  try {
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
    if (bytes.length === 0) return null;
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function formatBody(text: string, contentType?: string): string {
  if (contentType?.includes('json')) {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
  }
  return text;
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
