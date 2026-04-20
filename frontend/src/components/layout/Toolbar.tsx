import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { StartProxy, StopProxy, ClearSessions, ProxyState } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Square,
  Trash2,
  Filter as FilterIcon,
  Pencil,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedFilter } from '@/lib/filter';

interface ToolbarProps {
  onSessionsClear: () => void;
  savedFilters: SavedFilter[];
  activeFilterId: string | null;
  onSelectFilter: (id: string | null) => void;
  onNewFilter: () => void;
  onEditActiveFilter: () => void;
}

export function Toolbar({
  onSessionsClear,
  savedFilters,
  activeFilterId,
  onSelectFilter,
  onNewFilter,
  onEditActiveFilter,
}: ToolbarProps) {
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
      toast.error('프록시 토글 실패', { description: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    await ClearSessions();
    onSessionsClear();
  };

  const isRunning = proxyState === 'running';
  const activeFilter = savedFilters.find((f) => f.id === activeFilterId) ?? null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={isRunning ? 'destructive' : 'default'}
            onClick={handleToggle}
            disabled={loading}
            className="h-7 px-3 text-xs gap-1.5 font-medium"
          >
            {loading ? (
              '...'
            ) : isRunning ? (
              <>
                <Square className="h-3 w-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Start
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        </div>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Filter switcher */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <FilterIcon className="h-3.5 w-3.5" />
                <span className="text-foreground font-medium">
                  {activeFilter ? activeFilter.name : 'All Traffic'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
              <DropdownMenuItem
                onClick={() => onSelectFilter(null)}
                className={cn('text-xs', activeFilterId === null && 'bg-primary/10 text-primary')}
              >
                <FilterIcon className="h-3.5 w-3.5 mr-2" />
                All Traffic (no filter)
              </DropdownMenuItem>
              {savedFilters.length > 0 && <DropdownMenuSeparator />}
              {savedFilters.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onClick={() => onSelectFilter(f.id)}
                  className={cn('text-xs', activeFilterId === f.id && 'bg-primary/10 text-primary')}
                >
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase">
                    {f.kind}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onNewFilter} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-2" />
                New filter...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {activeFilter && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onEditActiveFilter}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Edit filter"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex-1" />

        <div
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ml-1',
            isRunning
              ? 'text-status-success bg-status-success/10 border border-status-success/20'
              : 'text-muted-foreground bg-muted/50',
          )}
        >
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse-dot" />
          )}
          <span>{isRunning ? 'Capturing' : 'Stopped'}</span>
        </div>
      </div>
    </div>
  );
}
