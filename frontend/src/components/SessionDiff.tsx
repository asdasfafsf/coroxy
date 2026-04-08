import { model } from '../../wailsjs/go/models';

interface SessionDiffProps {
  sessionA: model.Session;
  sessionB: model.Session;
  onClose: () => void;
}

export function SessionDiff({ sessionA, sessionB, onClose }: SessionDiffProps) {
  const reqA = sessionA.request;
  const reqB = sessionB.request;
  const respA = sessionA.response;
  const respB = sessionB.response;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e2e] rounded-lg shadow-xl w-[900px] max-h-[85vh] flex flex-col border border-[#313244]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244]">
          <h2 className="text-sm font-semibold text-[#cdd6f4]">Session Diff</h2>
          <button className="text-[#6c7086] hover:text-[#cdd6f4] text-lg" onClick={onClose}>x</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {/* General */}
          <Section title="General">
            <DiffRow label="Method" a={reqA?.method} b={reqB?.method} />
            <DiffRow label="URL" a={reqA?.url} b={reqB?.url} />
            <DiffRow label="Protocol" a={sessionA.protocol} b={sessionB.protocol} />
            <DiffRow label="Host" a={sessionA.target?.host} b={sessionB.target?.host} />
            <DiffRow label="Status" a={String(respA?.status_code || '-')} b={String(respB?.status_code || '-')} />
          </Section>

          {/* Request Headers */}
          <Section title="Request Headers">
            <HeadersDiff headersA={reqA?.headers} headersB={reqB?.headers} />
          </Section>

          {/* Response Headers */}
          <Section title="Response Headers">
            <HeadersDiff headersA={respA?.headers} headersB={respB?.headers} />
          </Section>

          {/* Request Body */}
          {(reqA?.body || reqB?.body) && (
            <Section title="Request Body">
              <BodyDiff a={decodeBody(reqA?.body)} b={decodeBody(reqB?.body)} />
            </Section>
          )}

          {/* Response Body */}
          {(respA?.body || respB?.body) && (
            <Section title="Response Body">
              <BodyDiff a={decodeBody(respA?.body)} b={decodeBody(respB?.body)} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-[#89b4fa] mb-2">{title}</div>
      {children}
    </div>
  );
}

function DiffRow({ label, a, b }: { label: string; a?: string; b?: string }) {
  const same = a === b;
  return (
    <div className="flex text-xs py-0.5">
      <span className="w-20 text-[#6c7086] shrink-0">{label}</span>
      <span className={`flex-1 ${same ? 'text-[#cdd6f4]' : 'text-[#f38ba8] bg-[#f38ba810]'} px-1 rounded`}>{a || '-'}</span>
      <span className="w-4 text-center text-[#6c7086]">{same ? '=' : '\u2260'}</span>
      <span className={`flex-1 ${same ? 'text-[#cdd6f4]' : 'text-[#a6e3a1] bg-[#a6e3a110]'} px-1 rounded`}>{b || '-'}</span>
    </div>
  );
}

function HeadersDiff({ headersA, headersB }: { headersA?: Record<string, string[]>; headersB?: Record<string, string[]> }) {
  const allKeys = new Set([
    ...Object.keys(headersA || {}),
    ...Object.keys(headersB || {}),
  ]);

  if (allKeys.size === 0) return <div className="text-xs text-[#6c7086]">No headers</div>;

  return (
    <div className="space-y-0.5">
      {[...allKeys].sort().map((key) => {
        const va = (headersA as Record<string, string[]>)?.[key]?.join(', ') || '';
        const vb = (headersB as Record<string, string[]>)?.[key]?.join(', ') || '';
        return <DiffRow key={key} label={key} a={va} b={vb} />;
      })}
    </div>
  );
}

function BodyDiff({ a, b }: { a: string; b: string }) {
  if (a === b) {
    return <pre className="text-xs text-[#6c7086] bg-[#11111b] p-2 rounded max-h-[200px] overflow-auto">{a || '(empty)'}</pre>;
  }

  return (
    <div className="flex gap-2">
      <pre className="flex-1 text-xs text-[#f38ba8] bg-[#f38ba808] p-2 rounded max-h-[200px] overflow-auto whitespace-pre-wrap break-all">{a || '(empty)'}</pre>
      <pre className="flex-1 text-xs text-[#a6e3a1] bg-[#a6e3a108] p-2 rounded max-h-[200px] overflow-auto whitespace-pre-wrap break-all">{b || '(empty)'}</pre>
    </div>
  );
}

function decodeBody(body: string | number[] | undefined): string {
  if (!body) return '';
  if (typeof body === 'string') {
    try { return atob(body); } catch { return body; }
  }
  return '';
}
