import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type Theme = 'system' | 'dark' | 'light';

interface StatusBarProps {
  sessionCount: number;
  isRunning: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function StatusBar({ sessionCount, isRunning, theme, onThemeChange }: StatusBarProps) {
  return (
    <div className="flex items-center px-3 py-1 bg-card border-t border-border text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-status-success' : 'bg-muted-foreground'}`} />
        {isRunning ? 'Listening on :8673' : 'Stopped'}
      </span>
      <span className="flex-1" />
      <span className="mr-3">{sessionCount} sessions</span>

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
