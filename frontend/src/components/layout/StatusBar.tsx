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
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
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
  const nextTheme = theme ? THEME_NEXT[theme] : 'system';
  const requestBytes = totalRequestBytes > 0 ? formatBytes(totalRequestBytes) : '0 B';
  const responseBytes = totalResponseBytes > 0 ? formatBytes(totalResponseBytes) : '0 B';

  return (
    <div className="statusbar flex h-6 shrink-0 items-center gap-0 overflow-hidden text-[11px] text-muted-foreground">
      {/* Proxy status */}
      <span className="statusbar-segment min-w-[96px]">
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

      <Separator orientation="vertical" className="h-full bg-border/75" />

      {/* Session count */}
      <span className="statusbar-segment min-w-[92px]">
        <Activity className="h-3 w-3" />
        <span className="text-foreground font-medium">{sessionCount}</span>
        <span>sessions</span>
        {selectedCount > 1 && <span className="text-primary">({selectedCount} sel)</span>}
      </span>

      <Separator orientation="vertical" className="h-full bg-border/75" />

      {/* Traffic stats */}
      <span className="statusbar-segment gap-3">
        <span className="flex items-center gap-1 tabular-nums">
          <span className="text-muted-foreground/75">Req</span>
          <ArrowUp className="h-3 w-3 text-status-info" />
          <span>{requestBytes}</span>
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <span className="text-muted-foreground/75">Res</span>
          <ArrowDown className="h-3 w-3 text-status-success" />
          <span>{responseBytes}</span>
        </span>
      </span>

      <span className="flex-1" />

      {theme && onThemeChange && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="toolbar-button mr-1 h-5 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
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
      )}
    </div>
  );
}
