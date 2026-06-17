import { cn } from '@/lib/utils';
import { Plus, Radio, FolderOpen } from 'lucide-react';
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
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 pt-3">
          <div className="px-2.5 pb-1.5 text-[10px] font-semibold text-sidebar-foreground/45">
            Sessions
          </div>
          {groups.map((group) => (
            <button
              key={group.id}
              className={cn(
                'source-list-item relative w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-left transition-colors',
                activeGroupId === group.id
                  ? 'source-list-item-active text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground',
              )}
              onClick={() => onGroupChange(group.id)}
            >
              {activeGroupId === group.id ? (
                <Radio className="h-3.5 w-3.5 text-primary shrink-0" />
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
                    'text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-md',
                    activeGroupId === group.id
                      ? 'bg-primary/12 text-primary font-semibold'
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

      <div className="border-t border-sidebar-border/80 p-2">
        <button
          className="source-list-item w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
          onClick={onGroupAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          New Session
        </button>
      </div>
    </div>
  );
}
