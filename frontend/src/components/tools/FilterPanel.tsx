import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  OP_DEFS,
  listFields,
  newFilterId,
  SAVED_FILTER_VERSION,
  type AttrCondition,
  type BuilderFilter,
  type FieldDefinition,
  type JsFilter,
  type OpKey,
  type SavedFilter,
} from '@/lib/filter';
import { Trash2, Plus, Code2, Copy, Save } from 'lucide-react';
import { FilterJSEditor } from './FilterJSEditor';

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: SavedFilter | null;
  onSave: (filter: SavedFilter) => void;
  onDelete?: (id: string) => void;
}

function newBuilder(name = 'Untitled filter'): BuilderFilter {
  return {
    version: SAVED_FILTER_VERSION,
    kind: 'builder',
    id: newFilterId(),
    name,
    combinator: 'and',
    conditions: [],
  };
}

function toJsSkeleton(filter: SavedFilter): string {
  if (filter.kind === 'js') return filter.code;
  // builder → JS 주석화된 스캐폴드로 export
  const header = '// (s: Session) => boolean\n// Eject된 builder 조건은 아래 주석에 기록됨\n';
  const combinator = filter.combinator.toUpperCase();
  const body = filter.conditions
    .map((c) => `//   ${c.field} ${c.op} ${JSON.stringify(c.value ?? '')}`)
    .join('\n');
  return `${header}// Combinator: ${combinator}\n${body}\n\n(s) => true`;
}

export function FilterPanel(props: FilterPanelProps) {
  // id 기반 remount: 서로 다른 필터를 이어서 편집할 때 draft가 확실히 초기화되도록.
  // open 전환으로는 outer Dialog가 remount되지 않게 하여 Radix portal 타이밍 이슈를 피한다.
  const formKey = props.initial?.id ?? 'new';
  return <FilterPanelInner key={formKey} {...props} />;
}

function FilterPanelInner({ open, onOpenChange, initial, onSave, onDelete }: FilterPanelProps) {
  const [draft, setDraft] = useState<SavedFilter>(() => initial ?? newBuilder());

  // open이 false→true로 바뀌는 순간 draft를 최신 initial로 재설정.
  // dep를 initial?.id로 한정하여 savedFilters reference 변경만으로는 draft가 리셋되지 않게 한다.
  useEffect(() => {
    if (open) {
      setDraft(initial ?? newBuilder());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const isBuilder = draft.kind === 'builder';

  const handleNameChange = (name: string) => setDraft({ ...draft, name });

  const handleCombinator = (c: 'and' | 'or') => {
    if (!isBuilder) return;
    setDraft({ ...(draft as BuilderFilter), combinator: c });
  };

  const handleAddCondition = () => {
    if (!isBuilder) return;
    const b = draft as BuilderFilter;
    const field = listFields()[0];
    const op = field.supportedOps[0];
    const cond: AttrCondition = { field: field.key, op, value: '' };
    setDraft({ ...b, conditions: [...b.conditions, cond] });
  };

  const handleRemoveCondition = (idx: number) => {
    if (!isBuilder) return;
    const b = draft as BuilderFilter;
    setDraft({ ...b, conditions: b.conditions.filter((_, i) => i !== idx) });
  };

  const handleUpdateCondition = (idx: number, patch: Partial<AttrCondition>) => {
    if (!isBuilder) return;
    const b = draft as BuilderFilter;
    setDraft({
      ...b,
      conditions: b.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  };

  const handleSwitchToJs = () => {
    const code = toJsSkeleton(draft);
    const js: JsFilter = {
      version: SAVED_FILTER_VERSION,
      kind: 'js',
      id: draft.id,
      name: draft.name,
      code,
    };
    setDraft(js);
  };

  const handleSave = () => {
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filter editor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={draft.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Filter name"
              className="flex-1"
            />
            <span className="text-[11px] text-muted-foreground">
              {isBuilder ? 'Builder mode' : 'JS mode'}
            </span>
          </div>

          {isBuilder ? (
            <BuilderBody
              filter={draft as BuilderFilter}
              onCombinator={handleCombinator}
              onAdd={handleAddCondition}
              onRemove={handleRemoveCondition}
              onUpdate={handleUpdateCondition}
            />
          ) : (
            <FilterJSEditor
              code={(draft as JsFilter).code}
              onChange={(code) => setDraft({ ...(draft as JsFilter), code })}
            />
          )}

          {isBuilder && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSwitchToJs}
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                title="Builder를 JS로 옮김. 복귀 불가."
              >
                <Code2 className="h-3.5 w-3.5" />
                Switch to JS mode
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {onDelete && initial && (
            <Button
              variant="destructive"
              size="sm"
              className="mr-auto gap-1.5"
              onClick={() => {
                onDelete(initial.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const clone: SavedFilter = {
                ...draft,
                id: newFilterId(),
                name: `${draft.name} copy`,
              };
              setDraft(clone);
            }}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Save as
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BuilderBodyProps {
  filter: BuilderFilter;
  onCombinator: (c: 'and' | 'or') => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, patch: Partial<AttrCondition>) => void;
}

function BuilderBody({ filter, onCombinator, onAdd, onRemove, onUpdate }: BuilderBodyProps) {
  const fields = useMemo(() => listFields(), []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">Match</span>
        <div className="flex items-center gap-1 bg-muted/40 rounded-md p-0.5">
          {(['and', 'or'] as const).map((c) => (
            <button
              key={c}
              onClick={() => onCombinator(c)}
              className={
                'px-2 py-0.5 text-[11px] font-medium uppercase rounded ' +
                (filter.combinator === c
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {c}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground">of the following conditions</span>
      </div>

      <div className="space-y-1.5">
        {filter.conditions.length === 0 && (
          <div className="text-[11px] text-muted-foreground py-4 text-center border border-dashed border-border rounded">
            No conditions. Add one below (empty filter passes all sessions).
          </div>
        )}
        {filter.conditions.map((cond, idx) => (
          <ConditionRow
            key={idx}
            cond={cond}
            fields={fields}
            onRemove={() => onRemove(idx)}
            onUpdate={(patch) => onUpdate(idx, patch)}
          />
        ))}
      </div>

      <Button size="sm" variant="ghost" onClick={onAdd} className="gap-1.5 text-xs">
        <Plus className="h-3.5 w-3.5" />
        Add condition
      </Button>
    </div>
  );
}

interface ConditionRowProps {
  cond: AttrCondition;
  fields: FieldDefinition[];
  onRemove: () => void;
  onUpdate: (patch: Partial<AttrCondition>) => void;
}

function ConditionRow({ cond, fields, onRemove, onUpdate }: ConditionRowProps) {
  const fd = fields.find((f) => f.key === cond.field);
  const opDef = OP_DEFS[cond.op];
  const supportedOps = fd ? fd.supportedOps : (Object.keys(OP_DEFS) as OpKey[]);
  const valueKind = opDef?.valueKind ?? 'single';

  return (
    <div className="flex items-center gap-1.5">
      <Select value={cond.field} onValueChange={(v) => onUpdate({ field: v })}>
        <SelectTrigger className="h-7 w-[160px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key} className="text-xs">
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={cond.op} onValueChange={(v) => onUpdate({ op: v as OpKey })}>
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {supportedOps.map((k) => (
            <SelectItem key={k} value={k} className="text-xs">
              {OP_DEFS[k].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {valueKind === 'single' && (
        <Input
          value={stringValue(cond.value)}
          onChange={(e) =>
            onUpdate({
              value: fd?.type === 'number' ? numberValue(e.target.value) : e.target.value,
            })
          }
          placeholder="Value"
          className="h-7 flex-1 text-xs"
        />
      )}
      {valueKind === 'list' && (
        <Input
          value={Array.isArray(cond.value) ? cond.value.join(',') : ''}
          onChange={(e) =>
            onUpdate({
              value: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Comma-separated"
          className="h-7 flex-1 text-xs"
        />
      )}
      {valueKind === 'none' && <div className="flex-1" />}

      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-status-error"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function stringValue(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(',');
  return String(v);
}

function numberValue(s: string): number | string {
  if (s === '') return '';
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}
