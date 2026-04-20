import { Suspense, lazy, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { validateJs } from '@/lib/filter';

// Monaco는 번들이 크므로 lazy import
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// Session.d.ts 소스를 런타임에 번들로 가져온다. Vite의 ?raw 쿼리.
import sessionDts from '../../types/session.d.ts?raw';

interface FilterJSEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun?: () => void;
  className?: string;
}

/**
 * JS predicate 에디터. Monaco를 lazy load하고 Session 타입을
 * TypeScript 서비스에 ambient로 주입하여 자동완성/타입 체크를 제공한다.
 */
export function FilterJSEditor({ code, onChange, onRun, className }: FilterJSEditorProps) {
  const monacoRef = useRef<unknown>(null);
  const validation = useMemo(() => validateJs(code), [code]);

  return (
    <div className={className}>
      <Suspense
        fallback={
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-xs gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading editor...
          </div>
        }
      >
        <MonacoEditor
          height="260px"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(v) => onChange(v ?? '')}
          beforeMount={(monaco) => {
            monacoRef.current = monaco;
            // Session.d.ts를 ambient lib으로 주입 → 자동완성 활성
            const libSrc = `${sessionDts}\n// Ambient: (s: Session) => boolean\n`;
            monaco.languages.typescript.javascriptDefaults.addExtraLib(
              libSrc,
              'file:///session.d.ts',
            );
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              libSrc,
              'file:///session.d.ts',
            );
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            tabSize: 2,
            automaticLayout: true,
            wordWrap: 'on',
          }}
        />
      </Suspense>
      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="text-[11px] text-muted-foreground">
          Signature: <code className="font-mono">(s: Session) =&gt; boolean</code>
        </div>
        <div className="flex items-center gap-2">
          {!validation.ok && (
            <span
              className="text-[11px] text-status-error max-w-[320px] truncate"
              title={validation.error}
            >
              {validation.error}
            </span>
          )}
          {validation.ok && <span className="text-[11px] text-status-success">syntax OK</span>}
          {onRun && (
            <Button size="sm" variant="secondary" onClick={onRun} disabled={!validation.ok}>
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
