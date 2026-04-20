// Filter 데이터 모델. registry 기반(fields.ts / ops.ts)이므로 새 field/op 추가는
// 레지스트리에 한 줄만 추가하면 되고 이 타입 자체는 바꾸지 않는다.

export type OpKey =
  | '=='
  | '!='
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | '>='
  | '<='
  | '>'
  | '<'
  | 'in'
  | 'exists';

/**
 * FieldKey는 레지스트리에 등록된 key의 문자열. 구조화된 헤더 필드(`reqHeader:X-Foo`)도
 * 문자열로 표현한다. registry 외 임의 문자열도 받을 수 있지만 evaluate 시 미등록은 false.
 */
export type FieldKey = string;

export type AttrValue = string | number | string[];

export interface AttrCondition {
  field: FieldKey;
  op: OpKey;
  value?: AttrValue;
}

export type Combinator = 'and' | 'or';

export const SAVED_FILTER_VERSION = 1 as const;

interface SavedFilterBase {
  version: typeof SAVED_FILTER_VERSION;
  id: string;
  name: string;
}

export interface BuilderFilter extends SavedFilterBase {
  kind: 'builder';
  combinator: Combinator;
  conditions: AttrCondition[];
}

export interface JsFilter extends SavedFilterBase {
  kind: 'js';
  /** (s: Session) => boolean */
  code: string;
}

export type SavedFilter = BuilderFilter | JsFilter;

export function newFilterId(): string {
  // crypto.randomUUID는 secure context 필요 — Wails/Vite에서도 사용 가능
  try {
    return crypto.randomUUID();
  } catch {
    return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
