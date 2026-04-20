import { SAVED_FILTER_VERSION } from './types';
import type { SavedFilter } from './types';

const STORAGE_KEY = 'coroxy-filters';

interface VersionedEntry {
  version: number;
}

/**
 * 저장된 filter 목록을 읽는다. 스키마 버전이 올라가면 migrate() 통해 변환.
 * 로드 실패/깨진 데이터는 빈 배열로 fallback.
 */
export function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => migrate(entry as VersionedEntry))
      .filter((f): f is SavedFilter => f !== null);
  } catch {
    return [];
  }
}

export function saveSavedFilters(filters: SavedFilter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // 용량 초과 등 저장 실패는 무시 — 앱 동작은 유지
  }
}

/**
 * 스키마 버전 업그레이드 훅. 현재는 v1이 최신이라 다른 버전은 버린다.
 * 추후 v2 도입 시 v1 → v2 변환 로직을 이 함수에 추가.
 */
function migrate(entry: VersionedEntry): SavedFilter | null {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.version === SAVED_FILTER_VERSION) {
    return entry as unknown as SavedFilter;
  }
  return null;
}
