import { useState, useMemo } from 'react';
import { model } from '../../../wailsjs/go/models';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
import { tryFormatJson } from '@/lib/format';

interface WebSocketViewerProps {
  frames: model.WSFrame[];
}

type FilterDir = 'all' | 'send' | 'recv';

function decodePayload(payload: number[] | undefined): string {
  if (!payload || payload.length === 0) return '';
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(payload));
  } catch {
    return '';
  }
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return '';
  const d = new Date(ts as string);
  return d.toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
}

export function WebSocketViewer({ frames }: WebSocketViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filterDir, setFilterDir] = useState<FilterDir>('all');
  const [searchText, setSearchText] = useState('');

  const filteredFrames = useMemo(() => {
    let result = frames;
    if (filterDir !== 'all') {
      result = result.filter((f) =>
        filterDir === 'send' ? f.direction === 'send' : f.direction === 'recv',
      );
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((f) => {
        const text = decodePayload(f.payload).toLowerCase();
        return text.includes(q);
      });
    }
    return result;
  }, [frames, filterDir, searchText]);

  const selectedFrame = selectedIdx !== null ? filteredFrames[selectedIdx] : null;
  const selectedText = selectedFrame ? decodePayload(selectedFrame.payload) : '';
  const isJson = selectedText.startsWith('{') || selectedText.startsWith('[');

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border shrink-0">
        <div className="flex gap-0.5">
          {(['all', 'send', 'recv'] as const).map((dir) => (
            <Button
              key={dir}
              size="sm"
              variant={filterDir === dir ? 'secondary' : 'ghost'}
              className="h-5 px-1.5 text-[10px]"
              onClick={() => setFilterDir(dir)}
            >
              {dir === 'all' ? 'All' : dir === 'send' ? '↑ Send' : '↓ Recv'}
            </Button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            className="h-5 pl-6 text-[10px]"
            placeholder="Search messages..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{filteredFrames.length} frames</span>
      </div>

      {/* Split: list + preview */}
      <div className="flex flex-1 min-h-0">
        {/* Frame list */}
        <div className="w-1/2 overflow-auto border-r border-border">
          {filteredFrames.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 text-xs">
              No WebSocket frames
            </div>
          ) : (
            filteredFrames.map((frame, idx) => {
              const isSend = frame.direction === 'send';
              const text = decodePayload(frame.payload);
              const preview = text.length > 80 ? text.slice(0, 80) + '...' : text;
              const isBinary = frame.opcode === 2;

              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-start gap-1.5 px-2 py-1 border-b border-border/30 cursor-pointer text-[11px]',
                    selectedIdx === idx ? 'bg-primary/[0.08]' : 'hover:bg-muted/50',
                  )}
                  onClick={() => setSelectedIdx(idx)}
                >
                  {isSend ? (
                    <ArrowUp className="h-3 w-3 text-status-info shrink-0 mt-0.5" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-status-success shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground truncate font-mono">
                      {isBinary ? `[binary ${frame.payload?.length || 0} bytes]` : preview}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex gap-2">
                      <span>{formatTimestamp(frame.timestamp)}</span>
                      <span>{frame.payload?.length || 0} B</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message preview */}
        <div className="w-1/2 overflow-auto p-2">
          {selectedFrame ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                {selectedFrame.direction === 'send' ? (
                  <span className="text-status-info flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" /> Sent
                  </span>
                ) : (
                  <span className="text-status-success flex items-center gap-1">
                    <ArrowDown className="h-3 w-3" /> Received
                  </span>
                )}
                <span className="text-muted-foreground">opcode: {selectedFrame.opcode}</span>
                <span className="text-muted-foreground">
                  {selectedFrame.payload?.length || 0} bytes
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-foreground text-[11px] leading-4 bg-secondary p-2 rounded-md max-h-[300px] overflow-auto font-mono">
                {isJson ? tryFormatJson(selectedText) : selectedText || '[empty]'}
              </pre>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4 text-xs">
              Select a frame to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
