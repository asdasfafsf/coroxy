import { cn } from '@/lib/utils';
import { Cloud, FolderOpen, FolderPlus, Radio, Share2 } from 'lucide-react';
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
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="snapshots-header">
        <span>Snapshots</span>
        <FolderPlus className="h-3.5 w-3.5" />
      </div>
      <ScrollArea className="flex-1">
        <div className="snapshot-tree">
          <button className="snapshot-tree-item snapshot-tree-item-open" type="button">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>My Snapshots</span>
          </button>
          <button className="snapshot-tree-item snapshot-tree-child" type="button">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>New Folder</span>
          </button>
          <button className="snapshot-tree-item" type="button">
            <Share2 className="h-3.5 w-3.5" />
            <span>Shared with Me</span>
          </button>
        </div>

        <div className="px-2 pb-2 pt-1">
          <div className="source-section-header">
            <span>Live Traffic</span>
            <span className="source-section-count">{totalCount}</span>
          </div>

          {groups.map((group) => (
            <button
              key={group.id}
              className={cn(
                'source-list-item relative w-full flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] text-left transition-colors',
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
                    'text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded',
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

      <div className="source-sidebar-footer">
        <button
          className="source-footer-command w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground transition-colors"
          onClick={onGroupAdd}
        >
          <Cloud className="h-3.5 w-3.5" />
          AutoSaved
        </button>
      </div>
    </div>
  );
}
