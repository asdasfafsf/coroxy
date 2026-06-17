import { Sun, Moon, Monitor, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

type Theme = 'system' | 'dark' | 'light';

const THEME_LABEL: Record<Theme, string> = { dark: 'Dark', light: 'Light', system: 'Auto' };
const THEME_NEXT: Record<Theme, Theme> = { dark: 'light', light: 'system', system: 'dark' };

interface StatusBarProps {
  sessionCount: number;
  selectedCount: number;
  isRunning: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  totalRequestBytes: number;
  totalResponseBytes: number;
}

export function StatusBar({
  sessionCount,
  selectedCount,
  isRunning,
  theme,
  onThemeChange,
  totalRequestBytes,
  totalResponseBytes,
}: StatusBarProps) {
  const nextTheme = THEME_NEXT[theme];

  return (
    <div className="statusbar flex items-center px-3 py-0.5 text-[11px] text-muted-foreground gap-2 h-6 shrink-0">
      {/* Proxy status */}
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            isRunning ? 'bg-status-success animate-pulse-dot' : 'bg-muted-foreground/50',
          )}
        />
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

      {/* Theme toggle — simple cycle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="toolbar-button h-5 px-1.5 gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onThemeChange(nextTheme)}
          >
            {theme === 'light' ? (
              <Sun className="h-3 w-3" />
            ) : theme === 'dark' ? (
              <Moon className="h-3 w-3" />
            ) : (
              <Monitor className="h-3 w-3" />
            )}
            <span>{THEME_LABEL[theme]}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Click to switch to {THEME_LABEL[nextTheme]}</TooltipContent>
      </Tooltip>
    </div>
  );
}
