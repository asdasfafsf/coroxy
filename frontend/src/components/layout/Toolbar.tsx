import { ClearSessions } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown,
  Eye,
  Filter as FilterIcon,
  Globe,
  MoreHorizontal,
  Network,
  Search,
  Terminal,
  Trash2,
} from 'lucide-react';

interface ToolbarProps {
  onSessionsClear: () => void;
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
}

export function Toolbar({
  onSessionsClear,
  quickSearch,
  onQuickSearchChange,
  filteredCount,
  totalCount,
}: ToolbarProps) {
  const handleClear = async () => {
    await ClearSessions();
    onSessionsClear();
  };

  return (
    <div className="flex flex-col">
      <div className="traffic-toolbar flex h-[var(--ds-toolbar-height)] flex-col border-b-0">
        <div className="traffic-tab-row">
          <div className="traffic-workspace-tab">
            <Eye className="h-[13px] w-[13px]" />
            <span>Live Traffic</span>
          </div>
        </div>

        <div className="traffic-command-row">
          <div className="fiddler-filter-control">
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[calc(var(--ds-toolbar-control-height)-2px)] px-2 text-[var(--ds-toolbar-font-size)] gap-1.5 text-foreground"
            >
              <FilterIcon className="fiddler-accent-icon h-3.5 w-3.5" />
              Filters
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button fiddler-split-button h-[calc(var(--ds-toolbar-control-height)-2px)] w-[32px] px-0 text-foreground"
              title="Filter options"
            >
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </div>

          <div className="fiddler-capture-mode-group">
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button h-[var(--ds-toolbar-control-height)] px-2 text-[var(--ds-toolbar-mode-font-size)] gap-1.5 text-foreground"
            >
              <span className="fiddler-toggle-dot" />
              System Proxy
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button fiddler-mode-button-active h-[var(--ds-toolbar-control-height)] px-2 text-[var(--ds-toolbar-mode-font-size)] gap-1.5 text-foreground"
            >
              <Network className="fiddler-accent-icon h-3.5 w-3.5" />
              Network Capture
              <span className="fiddler-beta-badge">BETA</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button h-[var(--ds-toolbar-control-height)] px-2 text-[var(--ds-toolbar-mode-font-size)] gap-1.5 text-foreground"
            >
              <Globe className="fiddler-accent-icon h-3.5 w-3.5" />
              Browser
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button h-[var(--ds-toolbar-control-height)] px-2 text-[var(--ds-toolbar-mode-font-size)] gap-1.5 text-foreground"
            >
              <Terminal className="fiddler-accent-icon h-3.5 w-3.5" />
              Terminal
            </Button>
          </div>

          <div className="flex-1" />

          <div className="quick-search-field relative flex h-[var(--ds-toolbar-control-height)] w-[34px] items-center focus-within:w-[190px]">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/78" />
            <Input
              value={quickSearch}
              onChange={(e) => onQuickSearchChange(e.target.value)}
              placeholder=""
              aria-label="Quick Search"
              className="quick-search-input h-[calc(var(--ds-toolbar-control-height)-2px)] rounded-[var(--ds-radius-tight)] border-transparent bg-transparent pl-8 pr-2 text-[var(--ds-grid-font-size)] shadow-none placeholder:text-muted-foreground/58 focus-visible:border-border/80 focus-visible:bg-white focus-visible:ring-1"
            />
            {quickSearch && (
              <span className="absolute right-2 text-[10px] tabular-nums text-muted-foreground/70">
                {filteredCount}/{totalCount}
              </span>
            )}
          </div>

          <Separator orientation="vertical" className="toolbar-divider" />

          <div className="toolbar-control-group fiddler-session-actions">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="toolbar-button fiddler-icon-button h-[var(--ds-toolbar-control-height)] w-[32px] px-0 text-foreground"
              title="Clear"
            >
              <Trash2 className="fiddler-danger-icon h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-icon-button h-[var(--ds-toolbar-control-height)] w-[30px] px-0 text-foreground"
              title="Clear options"
            >
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-icon-button h-[var(--ds-toolbar-control-height)] w-[32px] px-0 text-foreground"
              title="More"
            >
              <MoreHorizontal className="h-3.5 w-3.5 opacity-75" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
