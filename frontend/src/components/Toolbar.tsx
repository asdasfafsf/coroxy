import { StartProxy, StopProxy, ClearSessions, GetProxyState } from '../../wailsjs/go/app/App';
import { useState, useEffect } from 'react';

interface ToolbarProps {
  onSessionsClear: () => void;
  onSettingsClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Toolbar({ onSessionsClear, onSettingsClick, searchQuery, onSearchChange }: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
