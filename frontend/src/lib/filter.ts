import { model } from '../../wailsjs/go/models';

export interface SessionFilter {
  text: string;
  method: string;
  statusMin: number;
  statusMax: number;
  contentType: string;
  regex: boolean;
}

export const EMPTY_FILTER: SessionFilter = {
  text: '',
  method: '',
  statusMin: 0,
  statusMax: 0,
  contentType: '',
  regex: false,
};

export function isFilterActive(filter: SessionFilter): boolean {
  return filter.text !== '' || filter.method !== '' || filter.statusMin > 0 || filter.statusMax > 0 || filter.contentType !== '';
}

export function filterSessions(sessions: model.Session[], filter: SessionFilter): model.Session[] {
  return sessions.filter((s) => {
    // Text filter (host, url, path)
    if (filter.text) {
      const host = s.target?.host?.toLowerCase() || '';
      const url = s.request?.url?.toLowerCase() || '';
      const q = filter.text.toLowerCase();

      if (filter.regex) {
        try {
          const re = new RegExp(filter.text, 'i');
          if (!re.test(host) && !re.test(url)) return false;
        } catch {
          if (!host.includes(q) && !url.includes(q)) return false;
        }
      } else {
        if (!host.includes(q) && !url.includes(q)) return false;
      }
    }

    // Method filter
    if (filter.method && s.request?.method?.toUpperCase() !== filter.method.toUpperCase()) {
      return false;
    }

    // Status code range
    const status = s.response?.status_code || 0;
    if (filter.statusMin > 0 && status < filter.statusMin) return false;
    if (filter.statusMax > 0 && status > filter.statusMax) return false;

    // Content-Type filter
    if (filter.contentType) {
      const ct = s.response?.content_type?.toLowerCase() || '';
      if (!ct.includes(filter.contentType.toLowerCase())) return false;
    }

    return true;
  });
}

export function getActiveFilterCount(filter: SessionFilter): number {
  let count = 0;
  if (filter.text) count++;
  if (filter.method) count++;
  if (filter.statusMin > 0 || filter.statusMax > 0) count++;
  if (filter.contentType) count++;
  return count;
}
