import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { StartProxy, StopProxy, ClearSessions, ProxyState } from '../../../wailsjs/go/app/App';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Square, Trash2, Filter as FilterIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  onSessionsClear: () => void;
  activeFilterName: string | null;
}

/**
 * WON-188: 기존 검색창/Protocol 토글/Advanced 패널 전부 제거. 활성 필터 이름만 표시.
 * WON-190에서 필터 스위처 드롭다운 + edit 버튼 추가 예정.
 */
export function Toolbar({ onSessionsClear, activeFilterName }: ToolbarProps) {
  const [proxyState, setProxyState] = useState('stopped');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ProxyState().then(setProxyState);
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

  const handleClear = async () => {
    await ClearSessions();
    onSessionsClear();
  };

  const isRunning = proxyState === 'running';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={isRunning ? 'destructive' : 'default'}
            onClick={handleToggle}
            disabled={loading}
            className="h-7 px-3 text-xs gap-1.5 font-medium"
          >
            {loading ? (
              '...'
            ) : isRunning ? (
              <>
                <Square className="h-3 w-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Start
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        </div>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <div className="flex-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FilterIcon className="h-3.5 w-3.5" />
          <span>Filter:</span>
          <span className="text-foreground font-medium">{activeFilterName ?? 'All Traffic'}</span>
        </div>

        <div
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ml-1',
            isRunning
              ? 'text-status-success bg-status-success/10 border border-status-success/20'
              : 'text-muted-foreground bg-muted/50',
          )}
        >
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse-dot" />
          )}
          <span>{isRunning ? 'Capturing' : 'Stopped'}</span>
        </div>
      </div>
    </div>
  );
}
