import { useState, useEffect } from 'react';
import { ListRules, AddRule, RemoveRule, ToggleRule } from '../../wailsjs/go/app/App';
import { model } from '../../wailsjs/go/models';

interface RuleEditorProps {
  onClose: () => void;
}

export function RuleEditor({ onClose }: RuleEditorProps) {
  const [rules, setRules] = useState<model.Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const refreshRules = () => {
    ListRules().then((r) => setRules(r || [])).catch((e) => setError(String(e)));
  };

  useEffect(() => { refreshRules(); }, []);

  const handleAdd = async (rule: model.Rule) => {
    try {
      await AddRule(rule);
      refreshRules();
      setShowForm(false);
    } catch (e) { setError(String(e)); }
  };

  const handleRemove = async (id: string) => {
    try {
      await RemoveRule(id);
      refreshRules();
    } catch (e) { setError(String(e)); }
  };

  const handleToggle = async (id: string) => {
    try {
      await ToggleRule(id);
      refreshRules();
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e2e] rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col border border-[#313244]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244]">
          <h2 className="text-sm font-semibold text-[#cdd6f4]">Rules</h2>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded text-xs font-medium bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#7ba3e8]"
              onClick={() => setShowForm(true)}
            >
              Add Rule
            </button>
            <button className="text-[#6c7086] hover:text-[#cdd6f4] text-lg" onClick={onClose}>x</button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-[#f38ba822] text-[#f38ba8] text-xs">
            {error}
            <button className="ml-2 text-[#6c7086]" onClick={() => setError('')}>x</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          {rules.length === 0 ? (
            <div className="text-center text-[#6c7086] py-10 text-sm">No rules defined</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#a6adc8] border-b border-[#313244]">
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
                  <tr key={r.id} className="border-b border-[#313244]/50 hover:bg-[#313244]">
                    <td className="py-2 px-2">
                      <button
                        className={`w-4 h-4 rounded border ${r.enabled ? 'bg-[#a6e3a1] border-[#a6e3a1]' : 'border-[#6c7086]'}`}
                        onClick={() => handleToggle(r.id)}
                      />
                    </td>
                    <td className="py-2 px-2 text-[#cdd6f4]">{r.name || r.id}</td>
                    <td className="py-2 px-2 text-[#6c7086]">
                      {[r.match?.method, r.match?.host, r.match?.path].filter(Boolean).join(' ') || '*'}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${actionColor(r.action)}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-[#6c7086]">{r.priority}</td>
                    <td className="py-2 px-2 text-center">
                      <button
                        className="text-[#f38ba8] hover:text-[#e67a96] text-xs"
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
      </div>
    </div>
  );
}

function actionColor(action: string): string {
  switch (action) {
    case 'drop': return 'bg-[#f38ba822] text-[#f38ba8]';
    case 'modify_header': return 'bg-[#89b4fa22] text-[#89b4fa]';
    case 'auto_respond': return 'bg-[#a6e3a122] text-[#a6e3a1]';
    case 'breakpoint': return 'bg-[#f9e2af22] text-[#f9e2af]';
    default: return 'bg-[#6c708622] text-[#6c7086]';
  }
}

function RuleForm({ onSubmit, onCancel }: { onSubmit: (r: model.Rule) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [path, setPath] = useState('');
  const [method, setMethod] = useState('');
  const [action, setAction] = useState('drop');
  const [priority, setPriority] = useState(0);

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
    rule.match.method = method;
    onSubmit(rule);
  };

  const inputClass = 'w-full px-2 py-1.5 rounded text-xs bg-[#11111b] text-[#cdd6f4] border border-[#313244] focus:outline-none focus:border-[#89b4fa]';
  const labelClass = 'text-[#a6adc8] text-xs font-medium mb-1';

  return (
    <div className="border-t border-[#313244] p-4 bg-[#181825]">
      <h3 className="text-xs font-semibold text-[#cdd6f4] mb-3">New Rule</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>Name</div>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
        </div>
        <div>
          <div className={labelClass}>Action</div>
          <select className={inputClass} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="drop">Drop</option>
            <option value="modify_header">Modify Header</option>
            <option value="auto_respond">Auto Respond</option>
            <option value="breakpoint">Breakpoint</option>
          </select>
        </div>
        <div>
          <div className={labelClass}>Host (wildcard: *.example.com)</div>
          <input className={inputClass} value={host} onChange={(e) => setHost(e.target.value)} placeholder="*.example.com" />
        </div>
        <div>
          <div className={labelClass}>Path (prefix)</div>
          <input className={inputClass} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/api/" />
        </div>
        <div>
          <div className={labelClass}>Method</div>
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Any</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>
        <div>
          <div className={labelClass}>Priority (higher = first)</div>
          <input className={inputClass} type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button className="px-3 py-1.5 rounded text-xs bg-[#45475a] text-[#cdd6f4] hover:bg-[#585b70]" onClick={onCancel}>Cancel</button>
        <button className="px-3 py-1.5 rounded text-xs bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#7ba3e8]" onClick={handleSubmit}>Add</button>
      </div>
    </div>
  );
}
