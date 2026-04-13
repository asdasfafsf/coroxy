import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Copy, Check } from 'lucide-react';

interface JsonTreeViewProps {
  data: unknown;
  rootPath?: string;
}

export function JsonTreeView({ data, rootPath = '$' }: JsonTreeViewProps) {
  return (
    <div className="text-xs font-mono">
      <JsonNode value={data} path={rootPath} depth={0} />
    </div>
  );
}

function JsonNode({ value, path, depth, keyName }: { value: unknown; path: string; depth: number; keyName?: string }) {
  const [open, setOpen] = useState(depth < 2);
  const [copied, setCopied] = useState(false);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (value === null) {
    return <Leaf keyName={keyName} path={path}><span className="text-muted-foreground">null</span></Leaf>;
  }

  if (typeof value === 'boolean') {
    return <Leaf keyName={keyName} path={path}><span className="text-status-purple">{String(value)}</span></Leaf>;
  }

  if (typeof value === 'number') {
    return <Leaf keyName={keyName} path={path}><span className="text-status-info">{value}</span></Leaf>;
  }

  if (typeof value === 'string') {
    const truncated = value.length > 200 ? value.slice(0, 200) + '...' : value;
    return <Leaf keyName={keyName} path={path}><span className="text-status-success">"{truncated}"</span></Leaf>;
  }

  if (Array.isArray(value)) {
    const count = value.length;
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 group"
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
          {keyName !== undefined && <span className="text-primary">{keyName}: </span>}
          <span className="text-muted-foreground">[{count}]</span>
          <button onClick={handleCopyPath} className="opacity-0 group-hover:opacity-100 ml-1">
            {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
          </button>
        </div>
        {open && (
          <div>
            {value.map((item, i) => (
              <JsonNode key={i} value={item} path={`${path}[${i}]`} depth={depth + 1} keyName={String(i)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const count = entries.length;
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 group"
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
          {keyName !== undefined && <span className="text-primary">{keyName}: </span>}
          <span className="text-muted-foreground">{'{' + count + '}'}</span>
          <button onClick={handleCopyPath} className="opacity-0 group-hover:opacity-100 ml-1">
            {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
          </button>
        </div>
        {open && (
          <div>
            {entries.map(([k, v]) => (
              <JsonNode key={k} value={v} path={`${path}.${k}`} depth={depth + 1} keyName={k} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return <Leaf keyName={keyName} path={path}><span className="text-foreground">{String(value)}</span></Leaf>;
}

function Leaf({ keyName, path, children }: { keyName?: string; path: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -mx-1 group" style={{ paddingLeft: 20 }}>
      {keyName !== undefined && <span className="text-primary">{keyName}: </span>}
      {children}
      <button onClick={handleCopyPath} className="opacity-0 group-hover:opacity-100 ml-1 shrink-0">
        {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
      </button>
    </div>
  );
}
