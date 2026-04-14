import { Sun, Moon, Monitor, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatBytes } from '@/lib/format';

type Theme = 'system' | 'dark' | 'light';

interface StatusBarProps {
  sessionCount: number;
  selectedCount: number;
  isRunning: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  totalRequestBytes: number;
  totalResponseBytes: number;
}

export function StatusBar({ sessionCount, selectedCount, isRunning, theme, onThemeChange, totalRequestBytes, totalResponseBytes }: StatusBarProps) {
  return (
    <div className="flex items-center px-3 py-1 bg-card border-t border-border text-xs text-muted-foreground gap-3">
      {/* Proxy status */}
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-status-success' : 'bg-muted-foreground'}`} />
        {isRunning ? 'Listening on :8673' : 'Stopped'}
      </span>

      <Separator orientation="vertical" className="h-3" />

      {/* Session count */}
      <span>
        {sessionCount} sessions{selectedCount > 1 && ` (${selectedCount} selected)`}
      </span>

      <Separator orientation="vertical" className="h-3" />

      {/* Traffic stats */}
      <span className="flex items-center gap-1">
        <ArrowUp className="h-3 w-3 text-status-info" />
        {formatBytes(totalRequestBytes)}
      </span>
      <span className="flex items-center gap-1">
        <ArrowDown className="h-3 w-3 text-status-success" />
        {formatBytes(totalResponseBytes)}
      </span>

      <span className="flex-1" />

      {/* Theme toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
            {theme === 'light' ? (
              <Sun className="h-3 w-3" />
            ) : theme === 'dark' ? (
              <Moon className="h-3 w-3" />
            ) : (
              <Monitor className="h-3 w-3" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onClick={() => onThemeChange('light')}>
            <Sun className="h-3.5 w-3.5 mr-2" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onThemeChange('dark')}>
            <Moon className="h-3.5 w-3.5 mr-2" /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onThemeChange('system')}>
            <Monitor className="h-3.5 w-3.5 mr-2" /> System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
