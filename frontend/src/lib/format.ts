export function formatTime(createdAt: string | number | Date): string {
  const date = new Date(createdAt);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

export function formatDuration(ns: number): string {
  if (ns <= 0) return '-';
  const ms = ns / 1_000_000;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortContentType(ct: string | undefined): string {
  if (!ct) return '-';
  const mime = ct.split(';')[0].trim();
  const sub = mime.split('/')[1];
  if (!sub) return mime;
  if (sub.includes('form')) return 'form';
  if (sub === 'javascript') return 'js';
  if (sub === 'octet-stream') return 'binary';
  return sub;
}

export function getPath(url: string | undefined): string {
  if (!url) return '-';
  try { return new URL(url).pathname; } catch { return url; }
}

export function decodeBody(body: number[] | Uint8Array | string | undefined | null): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body;
  try {
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
    if (bytes.length === 0) return null;
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

export function tryFormatJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}
