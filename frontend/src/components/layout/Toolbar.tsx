import { useState, useEffect } from 'react';
import { StartProxy, StopProxy, ClearSessions, ProxyState } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, Trash2, Search } from 'lucide-react';

interface ToolbarProps {
  onSessionsClear: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Toolbar({ onSessionsClear, searchQuery, onSearchChange }: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ProxyState().then(setProxyState);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (proxyState === 'running') {
        await StopProxy();
      } else {
        await StartProxy();
      }
      setProxyState(await ProxyState());
    } catch (err) {
      console.error('proxy toggle failed:', err);
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
    <div className="flex items-center gap-1.5 px-2 py-1 bg-background border-b border-border">
      <Button
        size="sm"
        variant={isRunning ? 'destructive' : 'default'}
        onClick={handleToggle}
        disabled={loading}
        className="h-7 px-3 text-xs gap-1.5"
      >
        {loading ? '...' : isRunning ? (
          <><Square className="h-3 w-3" />Stop</>
        ) : (
          <><Play className="h-3 w-3" />Start</>
        )}
      </Button>

      <Button size="sm" variant="secondary" onClick={handleClear} className="h-7 px-2.5 text-xs gap-1.5">
        <Trash2 className="h-3 w-3" />Clear
      </Button>

      <div className="flex-1 mx-1 relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Filter (host, url, method, status...)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 pl-7 text-xs"
        />
      </div>

      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
        isRunning
          ? 'text-status-success bg-status-success/10'
          : 'text-muted-foreground'
      }`}>
        {isRunning ? 'Capturing' : 'Stopped'}
      </span>
    </div>
  );
}
