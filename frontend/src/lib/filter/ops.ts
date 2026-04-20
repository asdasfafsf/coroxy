import type { AttrValue, OpKey } from './types';

/**
 * OpDefinition — 비교 연산자 정의. 새 op 추가 시 OP_DEFS에 한 줄만 추가한다.
 *
 * - valueKind: UI가 input을 단일/리스트/없음 중 무엇으로 렌더할지 결정
 * - evaluate: 필드에서 추출된 값과 사용자 입력을 비교하여 boolean 반환
 * - fieldTypes: 이 op가 의미 있는 필드 타입 (FIELD_DEFS의 type과 매칭)
 */
export interface OpDefinition {
  key: OpKey;
  label: string;
  valueKind: 'single' | 'list' | 'none';
  fieldTypes: Array<'string' | 'number' | 'array'>;
  evaluate: (fieldValue: unknown, input: AttrValue | undefined) => boolean;
}

const s = (v: unknown): string => (v == null ? '' : String(v));
const n = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};

export const OP_DEFS: Record<OpKey, OpDefinition> = {
  '==': {
    key: '==',
    label: 'equals',
    valueKind: 'single',
    fieldTypes: ['string', 'number'],
    evaluate: (a, b) => {
      if (typeof a === 'number' || typeof b === 'number') {
        return n(a) !== null && n(a) === n(b);
      }
      return s(a).toLowerCase() === s(b).toLowerCase();
    },
  },
  '!=': {
    key: '!=',
    label: 'not equals',
    valueKind: 'single',
    fieldTypes: ['string', 'number'],
    evaluate: (a, b) => !OP_DEFS['=='].evaluate(a, b),
  },
  contains: {
    key: 'contains',
    label: 'contains',
    valueKind: 'single',
    fieldTypes: ['string', 'array'],
    evaluate: (a, b) => {
      const needle = s(b).toLowerCase();
      if (Array.isArray(a)) return a.some((x) => s(x).toLowerCase().includes(needle));
      return s(a).toLowerCase().includes(needle);
    },
  },
  startsWith: {
    key: 'startsWith',
    label: 'starts with',
    valueKind: 'single',
    fieldTypes: ['string'],
    evaluate: (a, b) => s(a).toLowerCase().startsWith(s(b).toLowerCase()),
  },
  endsWith: {
    key: 'endsWith',
    label: 'ends with',
    valueKind: 'single',
    fieldTypes: ['string'],
    evaluate: (a, b) => s(a).toLowerCase().endsWith(s(b).toLowerCase()),
  },
  regex: {
    key: 'regex',
    label: 'matches regex',
    valueKind: 'single',
    fieldTypes: ['string'],
    evaluate: (a, b) => {
      try {
        return new RegExp(s(b), 'i').test(s(a));
      } catch {
        return false;
      }
    },
  },
  '>=': {
    key: '>=',
    label: '≥',
    valueKind: 'single',
    fieldTypes: ['number'],
    evaluate: (a, b) => {
      const x = n(a);
      const y = n(b);
      return x !== null && y !== null && x >= y;
    },
  },
  '<=': {
    key: '<=',
    label: '≤',
    valueKind: 'single',
    fieldTypes: ['number'],
    evaluate: (a, b) => {
      const x = n(a);
      const y = n(b);
      return x !== null && y !== null && x <= y;
    },
  },
  '>': {
    key: '>',
    label: '>',
    valueKind: 'single',
    fieldTypes: ['number'],
    evaluate: (a, b) => {
      const x = n(a);
      const y = n(b);
      return x !== null && y !== null && x > y;
    },
  },
  '<': {
    key: '<',
    label: '<',
    valueKind: 'single',
    fieldTypes: ['number'],
    evaluate: (a, b) => {
      const x = n(a);
      const y = n(b);
      return x !== null && y !== null && x < y;
    },
  },
  in: {
    key: 'in',
    label: 'in list',
    valueKind: 'list',
    fieldTypes: ['string', 'number'],
    evaluate: (a, b) => {
      const list = Array.isArray(b) ? b : [];
      const target = s(a).toLowerCase();
      return list.some((x) => s(x).toLowerCase() === target);
    },
  },
  exists: {
    key: 'exists',
    label: 'exists',
    valueKind: 'none',
    fieldTypes: ['string', 'number', 'array'],
    evaluate: (a) => {
      if (a == null) return false;
      if (typeof a === 'string') return a.length > 0;
      if (Array.isArray(a)) return a.length > 0;
      return true;
    },
  },
};
