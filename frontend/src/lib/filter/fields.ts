import { model } from '../../../wailsjs/go/models';
import type { FieldKey, OpKey } from './types';

type Session = model.Session;

/**
 * FieldDefinition — 세션에서 값을 꺼내는 방법과 가능한 op 목록을 담는다.
 *
 * 새 field 추가는 이 파일 FIELD_DEFS에 한 줄 추가하면 되고 evaluator/UI는 건드릴 필요 없다.
 */
export interface FieldDefinition {
  key: FieldKey;
  label: string;
  type: 'string' | 'number' | 'array';
  /** 세션에서 값 추출. null/undefined 가능. */
  extract: (s: Session) => string | number | string[] | undefined;
  /** UI가 이 필드에서 선택 가능한 op. evaluator는 key-based이므로 참고용. */
  supportedOps: OpKey[];
}

const STRING_OPS: OpKey[] = [
  '==',
  '!=',
  'contains',
  'startsWith',
  'endsWith',
  'regex',
  'in',
  'exists',
];
const NUMBER_OPS: OpKey[] = ['==', '!=', '>=', '<=', '>', '<', 'in', 'exists'];
const ARRAY_OPS: OpKey[] = ['contains', 'exists'];

function urlPath(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    const idx = url.indexOf('/', url.indexOf('://') + 3);
    return idx >= 0 ? url.slice(idx) : url;
  }
}

function lowerHeaderLookup(
  headers: Record<string, string[]> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return Array.isArray(v) ? v.join(', ') : String(v);
  }
  return undefined;
}

function bodyToText(body: number[] | undefined): string | undefined {
  if (!body || body.length === 0) return undefined;
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(body));
  } catch {
    return undefined;
  }
}

/** 정적으로 등록된 FIELD_DEFS. 헤더(`reqHeader:X-Foo` 등)는 동적으로 lookup. */
export const FIELD_DEFS: Record<string, FieldDefinition> = {
  protocol: {
    key: 'protocol',
    label: 'Protocol',
    type: 'string',
    extract: (s) => s.protocol,
    supportedOps: STRING_OPS,
  },
  host: {
    key: 'host',
    label: 'Host',
    type: 'string',
    extract: (s) => s.target?.host,
    supportedOps: STRING_OPS,
  },
  port: {
    key: 'port',
    label: 'Port',
    type: 'number',
    extract: (s) => s.target?.port,
    supportedOps: NUMBER_OPS,
  },
  method: {
    key: 'method',
    label: 'Method',
    type: 'string',
    extract: (s) => s.request?.method,
    supportedOps: STRING_OPS,
  },
  url: {
    key: 'url',
    label: 'URL',
    type: 'string',
    extract: (s) => s.request?.url,
    supportedOps: STRING_OPS,
  },
  path: {
    key: 'path',
    label: 'Path',
    type: 'string',
    extract: (s) => urlPath(s.request?.url),
    supportedOps: STRING_OPS,
  },
  status: {
    key: 'status',
    label: 'Status',
    type: 'number',
    extract: (s) => s.response?.status_code,
    supportedOps: NUMBER_OPS,
  },
  contentType: {
    key: 'contentType',
    label: 'Content-Type',
    type: 'string',
    extract: (s) => s.response?.content_type,
    supportedOps: STRING_OPS,
  },
  durationMs: {
    key: 'durationMs',
    label: 'Duration (ms)',
    type: 'number',
    extract: (s) => s.duration,
    supportedOps: NUMBER_OPS,
  },
  reqSizeBytes: {
    key: 'reqSizeBytes',
    label: 'Request size (bytes)',
    type: 'number',
    extract: (s) => s.request?.body_size,
    supportedOps: NUMBER_OPS,
  },
  respSizeBytes: {
    key: 'respSizeBytes',
    label: 'Response size (bytes)',
    type: 'number',
    extract: (s) => s.response?.body_size,
    supportedOps: NUMBER_OPS,
  },
  tag: {
    key: 'tag',
    label: 'Tag',
    type: 'array',
    extract: (s) => s.tags,
    supportedOps: ARRAY_OPS,
  },
  state: {
    key: 'state',
    label: 'State',
    type: 'string',
    extract: (s) => s.state,
    supportedOps: STRING_OPS,
  },
  reqBody: {
    key: 'reqBody',
    label: 'Request body',
    type: 'string',
    extract: (s) => bodyToText(s.request?.body),
    supportedOps: STRING_OPS,
  },
  resBody: {
    key: 'resBody',
    label: 'Response body',
    type: 'string',
    extract: (s) => bodyToText(s.response?.body),
    supportedOps: STRING_OPS,
  },
};

/**
 * 정적 레지스트리에 없으면 `reqHeader:Foo` / `resHeader:Foo` 동적 필드로 해석한다.
 * 반환값은 evaluator에서 쓰는 string | number | string[] | undefined.
 */
export function resolveField(key: FieldKey): FieldDefinition | null {
  const hit = FIELD_DEFS[key];
  if (hit) return hit;
  const [prefix, rest] = splitFirst(key, ':');
  if (!rest) return null;
  if (prefix === 'reqHeader') {
    return {
      key,
      label: `Request header: ${rest}`,
      type: 'string',
      extract: (s) => lowerHeaderLookup(s.request?.headers, rest),
      supportedOps: STRING_OPS,
    };
  }
  if (prefix === 'resHeader') {
    return {
      key,
      label: `Response header: ${rest}`,
      type: 'string',
      extract: (s) => lowerHeaderLookup(s.response?.headers, rest),
      supportedOps: STRING_OPS,
    };
  }
  return null;
}

function splitFirst(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  if (i < 0) return [s, ''];
  return [s.slice(0, i), s.slice(i + sep.length)];
}

/** FilterPanel에서 dropdown 채울 때 사용. 정적 registry만 반환. 헤더 필드는 수동 입력. */
export function listFields(): FieldDefinition[] {
  return Object.values(FIELD_DEFS);
}
