import { Sun, Moon, Monitor, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

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
    <div className="flex items-center px-3 py-0.5 bg-sidebar border-t border-border text-[11px] text-muted-foreground gap-2 h-6 shrink-0">
      {/* Proxy status */}
      <span className="flex items-center gap-1.5">
        <span className={cn(
          'w-2 h-2 rounded-full',
          isRunning ? 'bg-status-success animate-pulse-dot' : 'bg-muted-foreground/50'
        )} />
        <span className={cn(isRunning && 'text-foreground font-medium')}>
          {isRunning ? 'Listening :8673' : 'Stopped'}
        </span>
      </span>

      <Separator orientation="vertical" className="h-3" />

      {/* Session count */}
      <span className="flex items-center gap-1">
        <Activity className="h-3 w-3" />
        <span className="text-foreground font-medium">{sessionCount}</span>
        <span>sessions</span>
        {selectedCount > 1 && <span className="text-primary">({selectedCount} sel)</span>}
      </span>

      <Separator orientation="vertical" className="h-3" />

      {/* Traffic stats */}
      <span className="flex items-center gap-2.5">
        <span className="flex items-center gap-1">
          <ArrowUp className="h-3 w-3 text-status-info" />
          <span>{formatBytes(totalRequestBytes)}</span>
        </span>
        <span className="flex items-center gap-1">
          <ArrowDown className="h-3 w-3 text-status-success" />
          <span>{formatBytes(totalResponseBytes)}</span>
        </span>
      </span>

      <span className="flex-1" />

      {/* Theme toggle — more visible */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            {theme === 'light' ? (
              <Sun className="h-3 w-3" />
            ) : theme === 'dark' ? (
              <Moon className="h-3 w-3" />
            ) : (
              <Monitor className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}</span>
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
