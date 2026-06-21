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
      <div className="traffic-toolbar flex h-[62px] flex-col border-b-0">
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
              className="toolbar-button fiddler-outline-button h-[25px] px-2.5 text-[13px] gap-1.5 text-foreground"
            >
              <FilterIcon className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[25px] px-2.5 text-[13px] gap-1.5 text-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              Browser
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[25px] px-2.5 text-[13px] gap-1.5 text-foreground"
            >
              <Terminal className="h-3.5 w-3.5" />
              Terminal
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="toolbar-button fiddler-outline-button h-[25px] px-2.5 text-[13px] gap-1.5 text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </div>

          <Separator orientation="vertical" className="toolbar-divider" />

          <div className="quick-search-field relative flex h-[25px] w-[286px] min-w-[190px] max-w-[30vw] items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/72" />
            <Input
              value={quickSearch}
              onChange={(e) => onQuickSearchChange(e.target.value)}
              placeholder="Quick Search"
              className="quick-search-input h-[25px] rounded-[5px] border-border/80 bg-card/50 pl-7 pr-14 text-[13px] shadow-none placeholder:text-muted-foreground/58 focus-visible:ring-1"
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
              className="toolbar-button fiddler-outline-button h-[25px] px-2.5 text-[13px] gap-1.5 text-foreground"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[25px] px-2.5 text-[13px] gap-1.5 text-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[25px] px-2.5 text-[13px] gap-1.5 text-foreground"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="toolbar-button fiddler-outline-button h-[25px] w-[30px] px-0 text-foreground"
              title="Toggle layout"
            >
              <PanelRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
