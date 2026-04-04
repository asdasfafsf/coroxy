import { StartProxy, StopProxy, ClearSessions, GetProxyState } from '../../wailsjs/go/app/App';
import { useState, useEffect } from 'react';

interface ToolbarProps {
  onSessionsClear: () => void;
}

export function Toolbar({ onSessionsClear }: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GetProxyState().then(setProxyState);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (proxyState === 'running') {
        await StopProxy();
      } else {
        await StartProxy();
      }
      const state = await GetProxyState();
      setProxyState(state);
    } catch (err) {
      console.error('proxy toggle error:', err);
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
      <div className="flex-1" />
      <span className={`text-xs font-medium px-2 py-1 rounded ${isRunning ? 'text-[#a6e3a1]' : 'text-[#6c7086]'}`}>
        {isRunning ? 'Listening' : 'Stopped'}
      </span>
    </div>
  );
}
