import { ClearSessions } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown,
  Columns3,
  Eye,
  Filter as FilterIcon,
  Globe,
  PanelRight,
  Save,
  Search,
  Share2,
  Terminal,
  Trash2,
  X,
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
      <div className="traffic-toolbar flex h-[58px] flex-col border-b-0">
        <div className="traffic-tab-row">
          <div className="traffic-workspace-tab">
            <Eye className="h-[13px] w-[13px]" />
            <span>Live Traffic</span>
          </div>
        </div>

        <div className="traffic-command-row">
          <div className="toolbar-control-group fiddler-live-controls">
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[23px] px-2 text-[11px] gap-1.5 text-foreground"
            >
              <FilterIcon className="h-[13px] w-[13px]" />
              Filters
              <ChevronDown className="h-[11px] w-[11px] opacity-60" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[23px] px-2 text-[11px] gap-1.5 text-foreground"
            >
              <Globe className="h-[13px] w-[13px]" />
              Browser
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[23px] px-2 text-[11px] gap-1.5 text-foreground"
            >
              <Terminal className="h-[13px] w-[13px]" />
              Terminal
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="toolbar-button fiddler-outline-button h-[23px] px-2 text-[11px] gap-1.5 text-foreground"
            >
              <Trash2 className="h-[13px] w-[13px]" />
              Clear
              <ChevronDown className="h-[11px] w-[11px] opacity-60" />
            </Button>
          </div>

          <Separator orientation="vertical" className="toolbar-divider" />

          <div className="quick-search-field relative flex h-[23px] w-[260px] min-w-[180px] max-w-[28vw] items-center">
            <Search className="pointer-events-none absolute left-2.5 h-[13px] w-[13px] text-muted-foreground/72" />
            <Input
              value={quickSearch}
              onChange={(e) => onQuickSearchChange(e.target.value)}
              placeholder="Quick Search"
              className="quick-search-input h-[23px] rounded-[2px] border-border/80 bg-card/50 pl-7 pr-12 text-[11px] shadow-none placeholder:text-muted-foreground/58 focus-visible:ring-1"
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

          <Separator orientation="vertical" className="toolbar-divider" />

          <div className="toolbar-control-group fiddler-session-controls">
            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[23px] px-2 text-[11px] gap-1.5 text-foreground"
            >
              <Save className="h-[13px] w-[13px]" />
              Save
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[23px] px-2 text-[11px] gap-1.5 text-foreground"
            >
              <Share2 className="h-[13px] w-[13px]" />
              Share
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[23px] px-2 text-[11px] gap-1.5 text-foreground"
            >
              <Columns3 className="h-[13px] w-[13px]" />
              Columns
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[23px] w-[27px] px-0 text-foreground"
              title="Toggle layout"
            >
              <PanelRight className="h-[13px] w-[13px]" />
            </Button>
          </div>

          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
