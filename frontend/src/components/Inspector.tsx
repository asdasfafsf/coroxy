import { useState } from 'react';
import { model } from '../../wailsjs/go/models';

interface InspectorProps {
  session: model.Session | null;
}

type Tab = 'headers' | 'body' | 'raw';

export function Inspector({ session }: InspectorProps) {
  const [tab, setTab] = useState<Tab>('headers');

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-[#6c7086] text-sm">
        Select a session to inspect
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'headers', label: 'Headers' },
    { key: 'body', label: 'Body' },
    { key: 'raw', label: 'Raw' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-[#313244] bg-[#181825]">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'text-[#cdd6f4] border-b-2 border-[#89b4fa]'
                : 'text-[#6c7086] hover:text-[#a6adc8]'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 text-[13px] font-mono">
        {tab === 'headers' && <HeadersView session={session} />}
        {tab === 'body' && <BodyView session={session} />}
        {tab === 'raw' && <RawView session={session} />}
      </div>
    </div>
  );
}

function HeadersView({ session }: { session: model.Session }) {
  return (
    <div className="space-y-4">
      <Section title="General">
        <Row label="URL" value={session.request?.url || '-'} />
        <Row label="Method" value={session.request?.method || '-'} />
        <Row label="Status" value={session.response?.status_text || '-'} />
        <Row label="Protocol" value={session.protocol} />
      </Section>

      {session.request?.headers && (
        <Section title="Request Headers">
          {Object.entries(session.request.headers).map(([key, values]) => (
            <Row key={key} label={key} value={(values as string[]).join(', ')} />
          ))}
        </Section>
      )}

      {session.response?.headers && (
        <Section title="Response Headers">
          {Object.entries(session.response.headers).map(([key, values]) => (
            <Row key={key} label={key} value={(values as string[]).join(', ')} />
          ))}
        </Section>
      )}
    </div>
  );
}

function BodyView({ session }: { session: model.Session }) {
  const bodySize = session.response?.body_size || 0;

  return (
    <div className="text-[#6c7086]">
      <p>Response body: {bodySize} bytes</p>
      <p className="mt-2 text-xs">Body content capture will be available in a future update.</p>
    </div>
  );
}

function RawView({ session }: { session: model.Session }) {
  const lines: string[] = [];

  if (session.request) {
    lines.push(`${session.request.method} ${session.request.url}`);
    if (session.request.headers) {
      for (const [key, values] of Object.entries(session.request.headers)) {
        for (const v of values as string[]) {
          lines.push(`${key}: ${v}`);
        }
      }
    }
    lines.push('');
  }

  if (session.response) {
    lines.push(`${session.response.status_text}`);
    if (session.response.headers) {
      for (const [key, values] of Object.entries(session.response.headers)) {
        for (const v of values as string[]) {
          lines.push(`${key}: ${v}`);
        }
      }
    }
  }

  return (
    <pre className="whitespace-pre-wrap text-[#cdd6f4] text-xs leading-5">
      {lines.join('\n') || 'No data available'}
    </pre>
  );
}

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
      <span className="text-[#cdd6f4] truncate">{value}</span>
    </div>
  );
}
