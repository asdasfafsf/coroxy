import { cn } from '@/lib/utils';
import { Plus, Wifi, FolderOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SessionGroup {
  id: string;
  label: string;
  count: number;
  filterName?: string | null;
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
    <div className="flex flex-col h-full min-w-0">
      {/* macOS traffic lights area + drag region */}
      <div
        className="mac-toolbar h-8 shrink-0 flex items-center pl-[78px] pr-3"
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      >
        <span className="text-[12px] font-semibold text-sidebar-foreground/70">Sessions</span>
      </div>

      {/* Session group list */}
      <ScrollArea className="flex-1">
        <div className="py-2 px-2">
          {groups.map((group) => (
            <button
              key={group.id}
              className={cn(
                'relative w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-left transition-colors rounded-md',
                activeGroupId === group.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-[inset_0_0_0_0.5px_var(--sidebar-border)]'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground',
              )}
              onClick={() => onGroupChange(group.id)}
            >
              {activeGroupId === group.id ? (
                <Wifi className="h-3.5 w-3.5 text-primary shrink-0" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="truncate">{group.label}</span>
                {group.filterName && (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {group.filterName}
                  </span>
                )}
              </span>
              {group.count > 0 && (
                <span
                  className={cn(
                    'text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full',
                    activeGroupId === group.id
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-muted-foreground',
                  )}
                >
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
          className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 rounded-md transition-colors"
          onClick={onGroupAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          New Session
        </button>
      </div>
    </div>
  );
}
