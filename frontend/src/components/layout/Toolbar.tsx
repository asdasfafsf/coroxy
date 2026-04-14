import { useState, useEffect } from 'react';
import { StartProxy, StopProxy, ClearSessions, ProxyState } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Trash2, Search, Filter, X, Regex } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionFilter } from '@/lib/filter';
import { getActiveFilterCount } from '@/lib/filter';

interface ToolbarProps {
  onSessionsClear: () => void;
  filter: SessionFilter;
  onFilterChange: (filter: SessionFilter) => void;
}

export function Toolbar({ onSessionsClear, filter, onFilterChange }: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
  const activeCount = getActiveFilterCount(filter);

  return (
    <div className="flex flex-col">
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

        {/* Search with regex toggle */}
        <div className="flex-1 mx-1 relative flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={filter.regex ? "Regex filter..." : "Filter (host, url, path...)"}
              value={filter.text}
              onChange={(e) => onFilterChange({ ...filter, text: e.target.value })}
              className="h-7 pl-7 pr-7 text-xs"
            />
            {filter.text && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => onFilterChange({ ...filter, text: '' })}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Button
            size="sm"
            variant={filter.regex ? 'default' : 'ghost'}
            className="h-7 w-7 p-0"
            title="Toggle regex"
            onClick={() => onFilterChange({ ...filter, regex: !filter.regex })}
          >
            <Regex className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Advanced filter toggle */}
        <Button
          size="sm"
          variant={showAdvanced ? 'secondary' : 'ghost'}
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="h-7 px-2 text-xs gap-1"
        >
          <Filter className="h-3 w-3" />
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-primary/15 text-primary">
              {activeCount}
            </Badge>
          )}
        </Button>

        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
          isRunning
            ? 'text-status-success bg-status-success/10'
            : 'text-muted-foreground'
        }`}>
          {isRunning ? 'Capturing' : 'Stopped'}
        </span>
      </div>

      {/* Advanced filter bar */}
      {showAdvanced && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-card border-b border-border">
          <span className="text-[11px] text-muted-foreground shrink-0">Method:</span>
          <Select value={filter.method || '__any__'} onValueChange={(v) => onFilterChange({ ...filter, method: v === '__any__' ? '' : v })}>
            <SelectTrigger className="h-6 w-20 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-[11px] text-muted-foreground shrink-0">Status:</span>
          <Input
            className="h-6 w-14 text-[11px]"
            type="number"
            placeholder="min"
            value={filter.statusMin || ''}
            onChange={(e) => onFilterChange({ ...filter, statusMin: Number(e.target.value) || 0 })}
          />
          <span className="text-[11px] text-muted-foreground">-</span>
          <Input
            className="h-6 w-14 text-[11px]"
            type="number"
            placeholder="max"
            value={filter.statusMax || ''}
            onChange={(e) => onFilterChange({ ...filter, statusMax: Number(e.target.value) || 0 })}
          />

          <span className="text-[11px] text-muted-foreground shrink-0">Type:</span>
          <Select value={filter.contentType || '__any__'} onValueChange={(v) => onFilterChange({ ...filter, contentType: v === '__any__' ? '' : v })}>
            <SelectTrigger className="h-6 w-24 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="javascript">JS</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
            </SelectContent>
          </Select>

          {activeCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-muted-foreground"
              onClick={() => onFilterChange({ text: filter.text, method: '', statusMin: 0, statusMax: 0, contentType: '', regex: filter.regex })}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
