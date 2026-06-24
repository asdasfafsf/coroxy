import { Cloud, FolderOpen, FolderPlus, Share2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SessionSidebarProps {
  onGroupAdd: () => void;
}

export function SessionSidebar({ onGroupAdd }: SessionSidebarProps) {
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
          <button className="snapshot-tree-item" type="button" onClick={onGroupAdd}>
            <Cloud className="h-3.5 w-3.5" />
            <span>AutoSaved</span>
          </button>
        </div>
      </ScrollArea>
    </div>
  );
}
