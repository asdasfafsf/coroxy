import { model } from '../../../wailsjs/go/models';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SessionDiffProps {
  sessionA: model.Session;
  sessionB: model.Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDiff({ sessionA, sessionB, open, onOpenChange }: SessionDiffProps) {
  const reqA = sessionA.request;
  const reqB = sessionB.request;
  const respA = sessionA.response;
  const respB = sessionB.response;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Session Diff</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          <Section title="General">
            <DiffRow label="Method" a={reqA?.method} b={reqB?.method} />
            <DiffRow label="URL" a={reqA?.url} b={reqB?.url} />
            <DiffRow label="Protocol" a={sessionA.protocol} b={sessionB.protocol} />
            <DiffRow label="Host" a={sessionA.target?.host} b={sessionB.target?.host} />
            <DiffRow label="Status" a={String(respA?.status_code || '-')} b={String(respB?.status_code || '-')} />
          </Section>

          <Section title="Request Headers">
            <HeadersDiff headersA={reqA?.headers} headersB={reqB?.headers} />
          </Section>

          <Section title="Response Headers">
            <HeadersDiff headersA={respA?.headers} headersB={respB?.headers} />
          </Section>

          {(reqA?.body || reqB?.body) && (
            <Section title="Request Body">
              <BodyDiff a={decodeBody(reqA?.body)} b={decodeBody(reqB?.body)} />
            </Section>
          )}

          {(respA?.body || respB?.body) && (
            <Section title="Response Body">
              <BodyDiff a={decodeBody(respA?.body)} b={decodeBody(respB?.body)} />
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-primary mb-2">{title}</div>
      {children}
    </div>
  );
}

function DiffRow({ label, a, b }: { label: string; a?: string; b?: string }) {
  const same = a === b;
  return (
    <div className="flex text-xs py-0.5">
      <span className="w-20 text-muted-foreground shrink-0">{label}</span>
      <span className={cn('flex-1 px-1 rounded-sm', same ? 'text-foreground' : 'text-destructive bg-destructive/[0.06]')}>{a || '-'}</span>
      <span className="w-4 text-center text-muted-foreground">{same ? '=' : '\u2260'}</span>
      <span className={cn('flex-1 px-1 rounded-sm', same ? 'text-foreground' : 'text-status-success bg-status-success/[0.06]')}>{b || '-'}</span>
    </div>
  );
}

function HeadersDiff({ headersA, headersB }: { headersA?: Record<string, string[]>; headersB?: Record<string, string[]> }) {
  const allKeys = new Set([...Object.keys(headersA || {}), ...Object.keys(headersB || {})]);
  if (allKeys.size === 0) return <div className="text-xs text-muted-foreground">No headers</div>;
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
    return <pre className="text-xs text-muted-foreground bg-secondary p-2 rounded-md max-h-[200px] overflow-auto">{a || '(empty)'}</pre>;
  }
  return (
    <div className="flex gap-2">
      <pre className="flex-1 text-xs text-destructive bg-destructive/[0.04] p-2 rounded-md max-h-[200px] overflow-auto whitespace-pre-wrap break-all">{a || '(empty)'}</pre>
      <pre className="flex-1 text-xs text-status-success bg-status-success/[0.04] p-2 rounded-md max-h-[200px] overflow-auto whitespace-pre-wrap break-all">{b || '(empty)'}</pre>
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
