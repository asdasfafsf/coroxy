import { model } from '../../../wailsjs/go/models';
import { resolveField } from './fields';
import { OP_DEFS } from './ops';
import type { AttrCondition, BuilderFilter, JsFilter, SavedFilter } from './types';

type Session = model.Session;

/** JS predicate 캐시 — 동일 code 문자열이면 재컴파일 회피. */
const jsCache = new Map<string, ((s: Session) => unknown) | null>();

function compileJs(code: string): ((s: Session) => unknown) | null {
  const cached = jsCache.get(code);
  if (cached !== undefined) return cached;
  let fn: ((s: Session) => unknown) | null = null;
  try {
    // 사용자가 작성한 (s) => boolean 또는 (s) => { return boolean; }
    // ES 모듈 환경이므로 Function 생성자를 쓰되 반환형식을 두 가지 모두 수용한다.
    const body = `"use strict"; return (${code});`;

    const factory = new Function(body) as () => (s: Session) => unknown;
    const maybe = factory();
    fn = typeof maybe === 'function' ? maybe : null;
  } catch {
    fn = null;
  }
  jsCache.set(code, fn);
  return fn;
}

export function evalCondition(cond: AttrCondition, s: Session): boolean {
  const fd = resolveField(cond.field);
  if (!fd) return false;
  const od = OP_DEFS[cond.op];
  if (!od) return false;
  const value = fd.extract(s);
  return od.evaluate(value, cond.value);
}

function evalBuilder(f: BuilderFilter, s: Session): boolean {
  if (f.conditions.length === 0) return true; // 빈 빌더 = pass-all
  if (f.combinator === 'and') {
    for (const c of f.conditions) if (!evalCondition(c, s)) return false;
    return true;
  }
  // or
  for (const c of f.conditions) if (evalCondition(c, s)) return true;
  return false;
}

function evalJs(f: JsFilter, s: Session): boolean {
  const fn = compileJs(f.code);
  if (!fn) return false;
  try {
    return Boolean(fn(s));
  } catch {
    return false;
  }
}

/**
 * SavedFilter 전체 평가. null/undefined 이면 pass-all.
 * 예외는 전부 삼켜서 false 처리 — 필터 때문에 앱이 죽지 않도록.
 */
export function evaluate(filter: SavedFilter | null | undefined, s: Session): boolean {
  if (!filter) return true;
  if (filter.kind === 'builder') return evalBuilder(filter, s);
  if (filter.kind === 'js') return evalJs(filter, s);
  return true;
}

/** 에디터에서 syntax 체크용. true/false 반환이 아니라 에러 메시지 제공. */
export function validateJs(code: string): { ok: true } | { ok: false; error: string } {
  try {
    const body = `"use strict"; return (${code});`;

    const factory = new Function(body) as () => unknown;
    const maybe = factory();
    if (typeof maybe !== 'function') {
      return { ok: false, error: 'Expression must evaluate to a function (s) => boolean' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
