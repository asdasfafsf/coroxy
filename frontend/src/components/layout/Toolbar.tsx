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
      <div className="traffic-toolbar flex h-[62px] flex-col border-b-0">
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
              className="toolbar-button fiddler-outline-button h-[28px] px-2.5 text-[14px] gap-1.5 text-foreground"
            >
              <FilterIcon className="h-4 w-4 text-[#2f6fff]" />
              Filters
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button fiddler-split-button h-[28px] w-[32px] px-0 text-foreground"
              title="Filter options"
            >
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </div>

          <div className="fiddler-capture-mode-group">
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button h-[30px] px-2.5 text-[15px] gap-2 text-foreground"
            >
              <span className="fiddler-toggle-dot" />
              System Proxy
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button fiddler-mode-button-active h-[30px] px-2.5 text-[15px] gap-2 text-foreground"
            >
              <span className="fiddler-beta-badge">BETA</span>
              <Network className="h-4 w-4 text-[#2f6fff]" />
              Network Capture
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button h-[30px] px-2.5 text-[15px] gap-2 text-foreground"
            >
              <Globe className="h-4 w-4 text-[#2f6fff]" />
              Browser
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-mode-button h-[30px] px-2.5 text-[15px] gap-2 text-foreground"
            >
              <Terminal className="h-4 w-4 text-[#2f6fff]" />
              Terminal
            </Button>
          </div>

          <div className="flex-1" />

          <div className="quick-search-field relative flex h-[30px] w-[34px] items-center focus-within:w-[190px]">
            <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground/78" />
            <Input
              value={quickSearch}
              onChange={(e) => onQuickSearchChange(e.target.value)}
              placeholder=""
              aria-label="Quick Search"
              className="quick-search-input h-[28px] rounded-[3px] border-transparent bg-transparent pl-8 pr-2 text-[12px] shadow-none placeholder:text-muted-foreground/58 focus-visible:border-border/80 focus-visible:bg-white focus-visible:ring-1"
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
              className="toolbar-button fiddler-icon-button h-[30px] w-[36px] px-0 text-foreground"
              title="Clear"
            >
              <Trash2 className="h-4 w-4 text-[#ef3f56]" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-icon-button h-[30px] w-[32px] px-0 text-foreground"
              title="Clear options"
            >
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-icon-button h-[30px] w-[36px] px-0 text-foreground"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4 opacity-75" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
