import { cn } from '@/lib/utils';
import { Globe, Plus, Wifi, FolderOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SessionGroup {
  id: string;
  label: string;
  count: number;
}

interface SessionSidebarProps {
  groups: SessionGroup[];
  activeGroupId: string;
  onGroupChange: (groupId: string) => void;
  onGroupAdd: () => void;
}

export function SessionSidebar({
  groups,
  activeGroupId,
  onGroupChange,
  onGroupAdd,
}: SessionSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar min-w-[180px]">
      {/* macOS traffic lights area + drag region */}
      <div
        className="h-9 shrink-0 border-b border-border bg-card flex items-center pl-[78px] pr-3"
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      >
        <span className="text-xs font-medium text-muted-foreground">
          Sessions
        </span>
      </div>

      {/* Session group list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {groups.map((group) => (
            <button
              key={group.id}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors',
                activeGroupId === group.id
                  ? 'bg-sidebar-accent text-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-foreground'
              )}
              onClick={() => onGroupChange(group.id)}
            >
              {activeGroupId === group.id ? (
                <Wifi className="h-3.5 w-3.5 text-primary shrink-0" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate flex-1">{group.label}</span>
              {group.count > 0 && (
                <span className={cn(
                  'text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full',
                  activeGroupId === group.id
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground'
                )}>
                  {group.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Add session button */}
      <div className="border-t border-sidebar-border p-2">
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 rounded transition-colors"
          onClick={onGroupAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          New Session
        </button>
      </div>
    </div>
  );
}
