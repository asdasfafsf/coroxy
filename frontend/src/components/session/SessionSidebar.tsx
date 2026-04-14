import { useState, useEffect, useRef, useCallback } from 'react';
import { model } from '../../../wailsjs/go/models';
import { cn } from '@/lib/utils';
import { formatDuration, formatBytes, getPath } from '@/lib/format';
import { Globe, Shield, Wifi, Radio, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SessionTab {
  id: string;
  label: string;
  filterId: string;
}

interface SessionSidebarProps {
  sessions: model.Session[];
  selectedIds: Set<string>;
  activeId: string | null;
  onSelect: (session: model.Session, e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  marks?: Map<string, string>;
  tabs: SessionTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabAdd: () => void;
  onTabClose: (tabId: string) => void;
}

function protoIcon(protocol: string) {
  switch (protocol.toUpperCase()) {
    case 'HTTP': return <Globe className="h-3 w-3 text-status-info shrink-0" />;
    case 'TLS':  return <Shield className="h-3 w-3 text-status-success shrink-0" />;
    case 'TCP':  return <Wifi className="h-3 w-3 text-status-warning shrink-0" />;
    case 'UDP':  return <Radio className="h-3 w-3 text-status-purple shrink-0" />;
    default:     return <Globe className="h-3 w-3 text-muted-foreground shrink-0" />;
  }
}

function statusDot(code: number | undefined): string {
  if (!code) return 'bg-muted-foreground/40';
  if (code >= 200 && code < 300) return 'bg-status-success';
  if (code >= 300 && code < 400) return 'bg-status-info';
  if (code >= 400 && code < 500) return 'bg-status-warning';
  if (code >= 500) return 'bg-status-error';
  return 'bg-muted-foreground/40';
}

function SidebarRow({ session, isSelected, isActive, onSelect, markColor }: {
  session: model.Session;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (session: model.Session, e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  markColor?: string;
}) {
  const host = session.target?.host || '-';
  const path = getPath(session.request?.url);
  const method = session.request?.method || '';
  const status = session.response?.status_code;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 cursor-pointer border-b border-border/20 transition-colors text-[12px]',
        isSelected ? 'bg-primary/[0.08]' : 'hover:bg-muted/50',
        isActive && 'ring-1 ring-inset ring-primary/30'
      )}
      onClick={(e) => onSelect(session, { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey })}
    >
      {/* Status dot + protocol icon */}
      <div className="flex items-center gap-1.5 shrink-0">
        {markColor ? (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: markColor }} />
        ) : (
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot(status))} />
        )}
        {protoIcon(session.protocol)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-primary/80 shrink-0">{method}</span>
          <span className="text-foreground truncate font-medium">{host}</span>
          {status && (
            <span className={cn(
              'text-[10px] shrink-0 font-medium',
              status >= 500 ? 'text-status-error' :
              status >= 400 ? 'text-status-warning' :
              status >= 300 ? 'text-status-info' :
              'text-status-success'
            )}>{status}</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{path || '/'}</div>
      </div>

      {/* Duration */}
      <span className="text-[10px] text-muted-foreground shrink-0">
        {formatDuration(session.duration)}
      </span>
    </div>
  );
}

export function SessionSidebar({
  sessions,
  selectedIds,
  activeId,
  onSelect,
  marks = new Map(),
  tabs,
  activeTabId,
  onTabChange,
  onTabAdd,
  onTabClose,
}: SessionSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-background min-w-[240px]">
      {/* Session tabs */}
      <div className="flex items-center border-b border-border bg-card shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-[11px] cursor-pointer border-r border-border/50 shrink-0 transition-colors',
              activeTabId === tab.id
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            )}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="truncate max-w-[140px]">{tab.label}</span>
            {tabs.length > 1 && (
              <button
                className="opacity-50 hover:opacity-100 hover:text-destructive ml-0.5"
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
        <button
          className="flex items-center px-2 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={onTabAdd}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Session count header */}
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-border/50 bg-card/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions ({sessions.length})
        </span>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Globe className="h-8 w-8 opacity-20" />
            <span className="text-xs">No sessions</span>
          </div>
        ) : (
          sessions.map((session) => (
            <SidebarRow
              key={session.id}
              session={session}
              isSelected={selectedIds.has(session.id)}
              isActive={activeId === session.id}
              onSelect={onSelect}
              markColor={marks.get(session.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
