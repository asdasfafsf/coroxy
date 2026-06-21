import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ProxyState, StartProxy, StopProxy } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown,
  CircleDot,
  Eye,
  Filter as FilterIcon,
  Globe,
  Search,
  Server,
  Square,
  Terminal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
}

export function Toolbar({
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

  const isRunning = proxyState === 'running';

  return (
    <div className="flex flex-col">
      <div className="traffic-toolbar flex h-[68px] flex-col border-b-0">
        <div className="traffic-tab-row">
          <div className="traffic-workspace-tab">
            <Eye className="h-3.5 w-3.5" />
            <span>Live Traffic</span>
          </div>
        </div>

        <div className="traffic-command-row">
          <div className="toolbar-control-group fiddler-live-controls">
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[30px] px-3 text-[14px] gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <FilterIcon className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggle}
              disabled={loading}
              className="toolbar-button fiddler-outline-button h-[30px] px-3 text-[14px] gap-2 text-foreground"
            >
              <span
                className={cn(
                  'fiddler-switch',
                  isRunning && 'fiddler-switch-on',
                  loading && 'opacity-60',
                )}
                aria-hidden="true"
              />
              System Proxy
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[30px] px-3 text-[14px] gap-1.5 text-foreground"
            >
              <Server className="h-3.5 w-3.5" />
              Reverse Proxy
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[30px] px-3 text-[14px] gap-1.5 text-foreground"
            >
              {loading ? (
                '...'
              ) : isRunning ? (
                <>
                  <Square className="h-3 w-3" />
                  Stop Capture
                </>
              ) : (
                <>
                  <CircleDot className="h-3.5 w-3.5" />
                  Network Capture
                  <span className="fiddler-beta-badge">BETA</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[30px] px-3 text-[14px] gap-1.5 text-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              Browser
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[30px] px-3 text-[14px] gap-1.5 text-foreground"
            >
              <Terminal className="h-3.5 w-3.5" />
              Terminal
            </Button>
          </div>

          <Separator orientation="vertical" className="toolbar-divider" />

          <div className="quick-search-field relative flex h-[30px] w-[280px] min-w-[190px] max-w-[30vw] items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/72" />
            <Input
              value={quickSearch}
              onChange={(e) => onQuickSearchChange(e.target.value)}
              placeholder="Find sessions"
              className="quick-search-input h-[30px] rounded-[5px] border-border/80 bg-card/50 pl-7 pr-14 text-[13px] shadow-none placeholder:text-muted-foreground/58 focus-visible:ring-1"
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
    </div>
  );
}
