import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { StartProxy, StopProxy, ClearSessions, ProxyState } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search,
  X,
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
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
}

export function Toolbar({
  onSessionsClear,
  savedFilters,
  activeFilterId,
  onSelectFilter,
  onNewFilter,
  onEditActiveFilter,
  quickSearch,
  onQuickSearchChange,
  filteredCount,
  totalCount,
}: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.resolve()
      .then(() => ProxyState())
      .then(setProxyState)
      .catch(() => {});
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
      <div className="mac-toolbar flex h-8 items-center gap-1.5 border-b-0 px-2 py-0.5">
        <div className="toolbar-control-group">
          <Button
            size="sm"
            variant={isRunning ? 'destructive' : 'default'}
            onClick={handleToggle}
            disabled={loading}
            className={cn(
              'toolbar-button capture-button h-6 px-2.5 text-[11.5px] gap-1.5 font-medium',
              !isRunning && 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
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
            className="toolbar-button h-6 px-2 text-[11.5px] gap-1 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        </div>

        <Separator orientation="vertical" className="h-5 bg-border/70" />

        <div className="toolbar-section-label">
          <span className={cn('toolbar-section-dot', isRunning && 'toolbar-section-dot-live')} />
          <span>Traffic</span>
        </div>

        {/* Filter switcher */}
        <div className="toolbar-control-group">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="toolbar-button h-6 px-2 text-[11.5px] gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <FilterIcon className="h-3.5 w-3.5" />
                <span className="text-foreground font-normal">
                  {activeFilter ? activeFilter.name : 'All Traffic'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
              <DropdownMenuItem
                onSelect={() => onSelectFilter(null)}
                className={cn('text-xs', activeFilterId === null && 'bg-primary/10 text-primary')}
              >
                <FilterIcon className="h-3.5 w-3.5 mr-2" />
                All Traffic (no filter)
              </DropdownMenuItem>
              {savedFilters.length > 0 && <DropdownMenuSeparator />}
              {savedFilters.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onSelect={() => onSelectFilter(f.id)}
                  className={cn('text-xs', activeFilterId === f.id && 'bg-primary/10 text-primary')}
                >
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase">
                    {f.kind}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onNewFilter} className="text-xs">
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
              className="toolbar-button h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title="Edit filter"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="quick-search-field relative flex h-6 w-[260px] min-w-[180px] max-w-[34vw] items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/72" />
          <Input
            value={quickSearch}
            onChange={(e) => onQuickSearchChange(e.target.value)}
            placeholder="Find sessions"
            className="h-6 rounded-[5px] border-border/80 bg-card/50 pl-7 pr-14 text-[11.5px] shadow-none placeholder:text-muted-foreground/58 focus-visible:ring-1"
          />
          <div className="absolute right-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
            {quickSearch && (
              <span className="tabular-nums">
                {filteredCount}/{totalCount}
              </span>
            )}
            {quickSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="toolbar-button h-5 w-5 p-0"
                onClick={() => onQuickSearchChange('')}
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1" />
      </div>
    </div>
  );
}
