import { useState } from 'react';
import { SendRequest } from '../../wailsjs/go/app/App';

interface ComposerPrefill {
  method: string;
  url: string;
  headers: string;
  body: string;
}

interface ComposerProps {
  onClose: () => void;
  prefill?: ComposerPrefill | null;
}

export function Composer({ onClose, prefill }: ComposerProps) {
  const [method, setMethod] = useState(prefill?.method || 'GET');
  const [url, setUrl] = useState(prefill?.url || 'https://');
  const [headers, setHeaders] = useState(prefill?.headers || '');
  const [body, setBody] = useState(prefill?.body || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<{
    status_code: number;
    status_text: string;
    headers: Record<string, string>;
    body: string;
    body_size: number;
    duration_ms: number;
  } | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    try {
      const headerMap: Record<string, string> = {};
      if (headers.trim()) {
        for (const line of headers.split('\n')) {
          const idx = line.indexOf(':');
          if (idx > 0) {
            headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
        }
      }

      const resp = await SendRequest({ method, url, headers: headerMap, body });
      setResponse(resp);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-2 py-1.5 rounded text-xs bg-[#11111b] text-[#cdd6f4] border border-[#313244] focus:outline-none focus:border-[#89b4fa]';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e2e] rounded-lg shadow-xl w-[700px] max-h-[85vh] flex flex-col border border-[#313244]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244]">
          <h2 className="text-sm font-semibold text-[#cdd6f4]">Composer</h2>
          <button className="text-[#6c7086] hover:text-[#cdd6f4] text-lg" onClick={onClose}>x</button>
        </div>

        <div className="p-4 space-y-3">
          {/* URL bar */}
          <div className="flex gap-2">
            <select className={`${inputClass} w-24`} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
              <option>HEAD</option>
              <option>OPTIONS</option>
            </select>
            <input className={`${inputClass} flex-1`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/endpoint" />
            <button
              className="px-4 py-1.5 rounded text-xs font-medium bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#7ba3e8] disabled:opacity-50"
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? '...' : 'Send'}
            </button>
          </div>

          {/* Headers */}
          <div>
            <div className="text-[#a6adc8] text-xs font-medium mb-1">Headers (one per line: Name: Value)</div>
            <textarea
              className={`${inputClass} h-16 resize-none font-mono`}
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder="Content-Type: application/json&#10;Authorization: Bearer token"
            />
          </div>

          {/* Body */}
          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div>
              <div className="text-[#a6adc8] text-xs font-medium mb-1">Body</div>
              <textarea
                className={`${inputClass} h-20 resize-none font-mono`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
              />
            </div>
          )}

          {error && <div className="text-xs text-[#f38ba8]">{error}</div>}
        </div>

        {/* Response */}
        {response && (
          <div className="border-t border-[#313244] p-4 flex-1 overflow-auto">
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-sm font-semibold ${response.status_code < 400 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                {response.status_text}
              </span>
              <span className="text-xs text-[#6c7086]">{response.duration_ms}ms</span>
              <span className="text-xs text-[#6c7086]">{formatBytes(response.body_size)}</span>
            </div>

            {/* Response headers */}
            <div className="mb-3">
              <div className="text-[#a6adc8] text-xs font-medium mb-1">Response Headers</div>
              <div className="text-xs space-y-0.5">
                {Object.entries(response.headers).map(([k, v]) => (
                  <div key={k} className="flex">
                    <span className="text-[#89b4fa] w-40 shrink-0 truncate">{k}</span>
                    <span className="text-[#cdd6f4] break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response body */}
            <div>
              <div className="text-[#a6adc8] text-xs font-medium mb-1">Response Body</div>
              <pre className="whitespace-pre-wrap text-[#cdd6f4] text-xs leading-5 bg-[#11111b] p-3 rounded max-h-[250px] overflow-auto">
                {tryFormatJson(response.body)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function tryFormatJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
