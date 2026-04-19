import { useState, useEffect } from 'react';
import { ListRules, AddRule, RemoveRule, ToggleRule } from '../../../wailsjs/go/app/App';
import { model } from '../../../wailsjs/go/models';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface RuleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RuleEditor({ open, onOpenChange }: RuleEditorProps) {
  const [rules, setRules] = useState<model.Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const refreshRules = () => {
    ListRules()
      .then((r) => setRules(r || []))
      .catch((e) => setError(String(e)));
  };

  useEffect(() => {
    if (open) refreshRules();
  }, [open]);

  const handleAdd = async (rule: model.Rule) => {
    try {
      await AddRule(rule);
      refreshRules();
      setShowForm(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await RemoveRule(id);
      refreshRules();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await ToggleRule(id);
      refreshRules();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] flex flex-col p-0">
        <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <SheetTitle>Rules</SheetTitle>
          <Button size="sm" onClick={() => setShowForm(true)}>
            Add Rule
          </Button>
        </SheetHeader>

        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs rounded-md">
            {error}
            <button className="ml-2 text-muted-foreground" onClick={() => setError('')}>
              x
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {rules.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">No rules defined</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2 w-8"></th>
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Match</th>
                  <th className="text-left py-2 px-2">Action</th>
                  <th className="text-center py-2 px-2 w-16">Pri</th>
                  <th className="text-center py-2 px-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 px-2">
                      <button
                        className={cn(
                          'w-4 h-4 rounded border',
                          r.enabled
                            ? 'bg-status-success border-status-success'
                            : 'border-muted-foreground',
                        )}
                        onClick={() => handleToggle(r.id)}
                      />
                    </td>
                    <td className="py-2 px-2 text-foreground">{r.name || r.id}</td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {[r.match?.method, r.match?.host, r.match?.path].filter(Boolean).join(' ') ||
                        '*'}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-sm text-[10px] font-medium',
                          actionColor(r.action),
                        )}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{r.priority}</td>
                    <td className="py-2 px-2 text-center">
                      <button
                        className="text-destructive hover:text-destructive/80 text-xs"
                        onClick={() => handleRemove(r.id)}
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showForm && <RuleForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function actionColor(action: string): string {
  switch (action) {
    case 'drop':
      return 'bg-destructive/15 text-destructive';
    case 'modify_header':
      return 'bg-status-info/15 text-status-info';
    case 'auto_respond':
      return 'bg-status-success/15 text-status-success';
    case 'breakpoint':
      return 'bg-status-warning/15 text-status-warning';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function RuleForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (r: model.Rule) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [path, setPath] = useState('');
  const [method, setMethod] = useState('');
  const [action, setAction] = useState('drop');
  const [priority, setPriority] = useState(0);
  const [arStatus, setArStatus] = useState(200);
  const [arBody, setArBody] = useState('');
  const [arContentType, setArContentType] = useState('application/json');

  const handleSubmit = () => {
    const rule = new model.Rule();
    rule.id = crypto.randomUUID();
    rule.name = name;
    rule.enabled = true;
    rule.action = action;
    rule.priority = priority;
    rule.match = new model.MatchCondition();
    rule.match.host = host;
    rule.match.path = path;
    rule.match.method = method === '__any__' ? '' : method;
    if (action === 'auto_respond') {
      rule.auto_response = new model.AutoResponse();
      rule.auto_response.status_code = arStatus;
      rule.auto_response.body = arBody;
      rule.auto_response.content_type = arContentType;
    }
    onSubmit(rule);
  };

  const labelClass = 'text-muted-foreground text-xs font-medium mb-1';

  return (
    <div className="border-t border-border p-4 bg-card">
      <h3 className="text-xs font-semibold text-foreground mb-3">New Rule</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>Name</div>
          <Input
            className="h-7 text-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name"
          />
        </div>
        <div>
          <div className={labelClass}>Action</div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="drop">Drop</SelectItem>
              <SelectItem value="modify_header">Modify Header</SelectItem>
              <SelectItem value="auto_respond">Auto Respond</SelectItem>
              <SelectItem value="breakpoint">Breakpoint</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className={labelClass}>Host (wildcard: *.example.com)</div>
          <Input
            className="h-7 text-xs"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="*.example.com"
          />
        </div>
        <div>
          <div className={labelClass}>Path (prefix)</div>
          <Input
            className="h-7 text-xs"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/api/"
          />
        </div>
        <div>
          <div className={labelClass}>Method</div>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className={labelClass}>Priority (higher = first)</div>
          <Input
            className="h-7 text-xs"
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </div>
      </div>

      {action === 'auto_respond' && (
        <div className="mt-3 p-3 bg-secondary rounded-md border border-border">
          <div className={labelClass}>Auto Response</div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <div className={labelClass}>Status Code</div>
              <Input
                className="h-7 text-xs"
                type="number"
                value={arStatus}
                onChange={(e) => setArStatus(Number(e.target.value))}
              />
            </div>
            <div>
              <div className={labelClass}>Content-Type</div>
              <Input
                className="h-7 text-xs"
                value={arContentType}
                onChange={(e) => setArContentType(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2">
            <div className={labelClass}>Response Body</div>
            <Textarea
              className="h-20 resize-none text-xs font-mono"
              value={arBody}
              onChange={(e) => setArBody(e.target.value)}
              placeholder='{"message": "mocked response"}'
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit}>
          Add
        </Button>
      </div>
    </div>
  );
}
