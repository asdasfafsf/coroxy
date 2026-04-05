import { StartProxy, StopProxy, ClearSessions, GetProxyState, ExportSessionsHAR, ExportSessionsJSON, EnableSystemProxy, DisableSystemProxy, IsSystemProxyActive } from '../../wailsjs/go/app/App';
import { useState, useEffect } from 'react';

interface ToolbarProps {
  onSessionsClear: () => void;
  onSettingsClick: () => void;
  onRulesClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Toolbar({ onSessionsClear, onSettingsClick, onRulesClick, searchQuery, onSearchChange }: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sysProxy, setSysProxy] = useState(false);

  useEffect(() => {
    IsSystemProxyActive().then(setSysProxy);
  }, []);

  useEffect(() => {
    GetProxyState().then(setProxyState);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    setError('');
    try {
      if (proxyState === 'running') {
        await StopProxy();
      } else {
        await StartProxy();
      }
      const state = await GetProxyState();
      setProxyState(state);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    await ClearSessions();
    onSessionsClear();
  };

  const isRunning = proxyState === 'running';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e2e] border-b border-[#313244]">
        <button
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isRunning
              ? 'bg-[#f38ba8] text-[#1e1e2e] hover:bg-[#e67a96]'
              : 'bg-[#a6e3a1] text-[#1e1e2e] hover:bg-[#94d68e]'
          }`}
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? '...' : isRunning ? 'Stop' : 'Start'}
        </button>
        <button
          className="px-4 py-1.5 rounded text-sm font-medium bg-[#45475a] text-[#cdd6f4] hover:bg-[#585b70] transition-colors"
          onClick={handleClear}
        >
          Clear
        </button>
        <div className="relative">
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-[#45475a] text-[#cdd6f4] hover:bg-[#585b70] transition-colors"
            onClick={() => setShowExportMenu(!showExportMenu)}
          >
            Export
          </button>
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-1 bg-[#313244] rounded shadow-lg z-20 min-w-[120px]">
              <button
                className="block w-full text-left px-3 py-2 text-xs text-[#cdd6f4] hover:bg-[#45475a]"
                onClick={() => { ExportSessionsHAR().catch(e => setError(String(e))); setShowExportMenu(false); }}
              >
                HAR (.har)
              </button>
              <button
                className="block w-full text-left px-3 py-2 text-xs text-[#cdd6f4] hover:bg-[#45475a]"
                onClick={() => { ExportSessionsJSON().catch(e => setError(String(e))); setShowExportMenu(false); }}
              >
                JSON (.json)
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 mx-2">
          <input
            type="text"
            placeholder="Filter (host, url, method...)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded text-sm bg-[#11111b] text-[#cdd6f4] border border-[#313244] placeholder-[#6c7086] focus:outline-none focus:border-[#89b4fa]"
          />
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded ${isRunning ? 'text-[#a6e3a1]' : 'text-[#6c7086]'}`}>
          {isRunning ? 'Listening' : 'Stopped'}
        </span>
        <button
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            sysProxy
              ? 'bg-[#89b4fa33] text-[#89b4fa] border border-[#89b4fa55]'
              : 'bg-[#45475a] text-[#cdd6f4] hover:bg-[#585b70]'
          }`}
          onClick={async () => {
            try {
              if (sysProxy) {
                await DisableSystemProxy();
                setSysProxy(false);
              } else {
                await EnableSystemProxy();
                setSysProxy(true);
              }
            } catch (e) { setError(String(e)); }
          }}
        >
          {sysProxy ? 'Proxy ON' : 'Proxy OFF'}
        </button>
        <button
          className="px-3 py-1.5 rounded text-xs font-medium bg-[#45475a] text-[#cdd6f4] hover:bg-[#585b70] transition-colors"
          onClick={onRulesClick}
        >
          Rules
        </button>
        <button
          className="px-3 py-1.5 rounded text-xs font-medium bg-[#45475a] text-[#cdd6f4] hover:bg-[#585b70] transition-colors"
          onClick={onSettingsClick}
        >
          Settings
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f38ba822] border-b border-[#f38ba844]">
          <span className="text-xs text-[#f38ba8]">{error}</span>
          <button
            className="text-xs text-[#6c7086] hover:text-[#cdd6f4]"
            onClick={() => setError('')}
          >
            x
          </button>
        </div>
      )}
    </div>
  );
}
