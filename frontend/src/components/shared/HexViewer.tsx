import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface HexViewerProps {
  data: Uint8Array;
  maxRows?: number;
}

const BYTES_PER_ROW = 16;

function interpretBytes(bytes: Uint8Array): string[] {
  const results: string[] = [];
  if (bytes.length === 0) return results;

  // uint8
  if (bytes.length >= 1) results.push(`uint8: ${bytes[0]}`);
  // int8
  if (bytes.length >= 1) results.push(`int8: ${bytes[0] > 127 ? bytes[0] - 256 : bytes[0]}`);
  // uint16 LE
  if (bytes.length >= 2) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    results.push(`uint16 LE: ${view.getUint16(0, true)}`);
  }
  // uint32 LE
  if (bytes.length >= 4) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    results.push(`uint32 LE: ${view.getUint32(0, true)}`);
  }
  // float32 LE
  if (bytes.length >= 4) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    results.push(`float32: ${view.getFloat32(0, true).toFixed(6)}`);
  }
  // string (UTF-8)
  try {
    const str = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (str.length <= 100) results.push(`string: "${str}"`);
  } catch { /* not valid UTF-8 */ }

  return results;
}

export function HexViewer({ data, maxRows = 512 }: HexViewerProps) {
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);
  const [searchHex, setSearchHex] = useState('');

  const totalRows = Math.ceil(data.length / BYTES_PER_ROW);
  const displayRows = Math.min(totalRows, maxRows);

  // Search matches
  const searchMatches = useMemo(() => {
    if (!searchHex.trim()) return new Set<number>();
    const matches = new Set<number>();
    const needle = searchHex.replace(/\s/g, '').toLowerCase();
    if (needle.length < 2 || needle.length % 2 !== 0) return matches;
    const bytes: number[] = [];
    for (let i = 0; i < needle.length; i += 2) {
      const val = parseInt(needle.slice(i, i + 2), 16);
      if (isNaN(val)) return matches;
      bytes.push(val);
    }
    for (let i = 0; i <= data.length - bytes.length; i++) {
      let found = true;
      for (let j = 0; j < bytes.length; j++) {
        if (data[i + j] !== bytes[j]) { found = false; break; }
      }
      if (found) {
        for (let j = 0; j < bytes.length; j++) matches.add(i + j);
      }
    }
    return matches;
  }, [data, searchHex]);

  const isSelected = (offset: number) => {
    if (selectedStart === null) return false;
    const end = selectedEnd ?? selectedStart;
    const lo = Math.min(selectedStart, end);
    const hi = Math.max(selectedStart, end);
    return offset >= lo && offset <= hi;
  };

  const selectedBytes = useMemo(() => {
    if (selectedStart === null) return null;
    const end = selectedEnd ?? selectedStart;
    const lo = Math.min(selectedStart, end);
    const hi = Math.max(selectedStart, end);
    return data.slice(lo, hi + 1);
  }, [data, selectedStart, selectedEnd]);

  const handleByteClick = (offset: number, e: React.MouseEvent) => {
    if (e.shiftKey && selectedStart !== null) {
      setSelectedEnd(offset);
    } else {
      setSelectedStart(offset);
      setSelectedEnd(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative w-48">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          className="h-6 pl-7 text-[11px] font-mono"
          placeholder="Search hex (e.g. 48 54 54 50)"
          value={searchHex}
          onChange={(e) => setSearchHex(e.target.value)}
        />
      </div>

      {/* Hex dump */}
      <div className="font-mono text-[11px] leading-4 select-none">
        <div className="text-muted-foreground mb-1">
          {'Offset    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  |ASCII           |'}
        </div>
        {Array.from({ length: displayRows }, (_, rowIdx) => {
          const rowOffset = rowIdx * BYTES_PER_ROW;
          const chunk = data.slice(rowOffset, rowOffset + BYTES_PER_ROW);

          return (
            <div key={rowIdx} className="flex">
              <span className="text-muted-foreground w-[72px] shrink-0">
                {rowOffset.toString(16).padStart(8, '0')}
              </span>
              <span className="w-[400px] shrink-0">
                {Array.from({ length: BYTES_PER_ROW }, (_, i) => {
                  const byteOffset = rowOffset + i;
                  const sep = i === 8 ? '  ' : ' ';
                  if (i >= chunk.length) return <span key={i}>{sep}  </span>;
                  const byte = chunk[i];
                  const sel = isSelected(byteOffset);
                  const match = searchMatches.has(byteOffset);
                  return (
                    <span key={i}>
                      {i > 0 && sep}
                      <span
                        className={cn(
                          'cursor-pointer rounded-sm px-[1px]',
                          sel && 'bg-primary/30 text-primary',
                          match && !sel && 'bg-status-warning/30',
                          !sel && !match && 'hover:bg-muted'
                        )}
                        onClick={(e) => handleByteClick(byteOffset, e)}
                      >
                        {byte.toString(16).padStart(2, '0')}
                      </span>
                    </span>
                  );
                })}
              </span>
              <span className="text-muted-foreground mx-1">|</span>
              <span>
                {Array.from(chunk).map((b, i) => {
                  const byteOffset = rowOffset + i;
                  const sel = isSelected(byteOffset);
                  const ch = b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
                  return (
                    <span
                      key={i}
                      className={cn(sel && 'bg-primary/30 text-primary')}
                      onClick={(e) => handleByteClick(byteOffset, e)}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
              <span className="text-muted-foreground">|</span>
            </div>
          );
        })}
        {totalRows > maxRows && (
          <div className="text-muted-foreground mt-1">... ({data.length - maxRows * BYTES_PER_ROW} more bytes)</div>
        )}
      </div>

      {/* Selection interpretation */}
      {selectedBytes && selectedBytes.length > 0 && (
        <div className="bg-secondary rounded-md p-2 text-[11px] space-y-0.5">
          <div className="text-muted-foreground font-medium">
            Selected: {selectedBytes.length} byte(s) at offset 0x{(Math.min(selectedStart!, selectedEnd ?? selectedStart!)).toString(16)}
          </div>
          {interpretBytes(selectedBytes).map((line, i) => (
            <div key={i} className="text-foreground font-mono">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
