import { StartProxy, StopProxy, ClearSessions, ProxyState, ExportSessionsHAR, ExportSessionsJSON, ImportSessionsHAR, ImportSessionsSAZ, EnableSystemProxy, DisableSystemProxy, IsSystemProxyActive } from '../../../wailsjs/go/app/App';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Play, Square, Trash2, Download, Upload, Globe, Send, Shield, Settings, Search } from 'lucide-react';

interface ToolbarProps {
  onSessionsClear: () => void;
  onSettingsClick: () => void;
  onRulesClick: () => void;
  onComposerClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Toolbar({ onSessionsClear, onSettingsClick, onRulesClick, onComposerClick, searchQuery, onSearchChange }: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sysProxy, setSysProxy] = useState(false);

  useEffect(() => {
    IsSystemProxyActive().then(setSysProxy);
  }, []);

  useEffect(() => {
    ProxyState().then(setProxyState);
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
      const state = await ProxyState();
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
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-background border-b border-border">
        {/* Start/Stop */}
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

        {/* Clear */}
        <Button size="sm" variant="secondary" onClick={handleClear} className="h-7 px-2.5 text-xs gap-1.5">
          <Trash2 className="h-3 w-3" />Clear
        </Button>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs gap-1.5">
              <Download className="h-3 w-3" />Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => ExportSessionsHAR().catch(e => setError(String(e)))}>
              HAR (.har)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => ExportSessionsJSON().catch(e => setError(String(e)))}>
              JSON (.json)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Import */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs gap-1.5">
              <Upload className="h-3 w-3" />Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => ImportSessionsHAR().catch(e => setError(String(e)))}>
              HAR (.har)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => ImportSessionsSAZ().catch(e => setError(String(e)))}>
              SAZ (.saz)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="flex-1 mx-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter (host, url, method...)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>

        {/* Status indicator */}
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
          isRunning
            ? 'text-status-success bg-status-success/10'
            : 'text-muted-foreground'
        }`}>
          {isRunning ? 'Listening' : 'Stopped'}
        </span>

        {/* System Proxy Toggle */}
        <Button
          size="sm"
          variant={sysProxy ? 'outline' : 'secondary'}
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
          className={`h-7 px-2.5 text-xs gap-1.5 ${sysProxy ? 'border-primary/50 text-primary' : ''}`}
        >
          <Globe className="h-3 w-3" />
          {sysProxy ? 'Proxy ON' : 'Proxy OFF'}
        </Button>

        {/* Tools */}
        <Button size="sm" variant="ghost" onClick={onComposerClick} className="h-7 px-2.5 text-xs gap-1.5">
          <Send className="h-3 w-3" />Composer
        </Button>
        <Button size="sm" variant="ghost" onClick={onRulesClick} className="h-7 px-2.5 text-xs gap-1.5">
          <Shield className="h-3 w-3" />Rules
        </Button>
        <Button size="sm" variant="ghost" onClick={onSettingsClick} className="h-7 px-2.5 text-xs gap-1.5">
          <Settings className="h-3 w-3" />Settings
        </Button>
      </div>
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border-b border-destructive/20">
          <span className="text-xs text-destructive">{error}</span>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setError('')}>
            x
          </button>
        </div>
      )}
    </div>
  );
}
