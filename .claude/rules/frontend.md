# Frontend Rules

Effective TypeScript + React 프론트엔드 원칙. 모든 프론트엔드 코드는 이 규칙을 따른다.

## Wails 바인딩 동기화

Go 백엔드(`internal/app/`)에 메서드·타입을 추가하거나 시그니처를 변경했다면, 동일 커밋에 재생성된 바인딩을 반드시 포함한다.

```bash
wails generate module
git add frontend/wailsjs/
```

`frontend/wailsjs/` 는 자동 생성물이지만 repo에 커밋한다. Go 변경과 바인딩 재생성을 한 커밋에 묶어 `main`/`dev`가 언제나 빌드 가능한 상태를 유지한다.

실수 방지로 `.claude/hooks/wails-sync-check.sh` 가 PreToolUse(Bash)에서 `git commit` 명령을 가로채어, `internal/app/` 만 staged 이고 `frontend/wailsjs/` 는 staged 되지 않았으면 차단한다.

## UI 프레임워크

- **shadcn/ui** 컴포넌트 우선 사용. 직접 `<button>`, `<input>`, `<select>` 등을 스타일링하지 않는다
- **Tailwind CSS v4** + CSS 변수로 스타일링. 하드코딩 색상값 금지
- 디자인 토큰은 `frontend/DESIGN_SYSTEM.md` 참조

## TypeScript 원칙 (Effective TypeScript 기반)

### 타입 안전성

- `strict: true` 필수. `any` 사용 금지
- 타입 단언(`as`) 대신 타입 가드 사용. `as`는 Go 바인딩 타입 변환 등 불가피한 경우에만 허용
- `unknown`을 `any` 대신 사용. 외부 데이터는 반드시 타입 검증 후 사용

```typescript
// Bad
const data = response as SessionData;

// Good
function isSessionData(v: unknown): v is SessionData {
  return typeof v === 'object' && v !== null && 'id' in v;
}
```

### 타입 설계

- **Discriminated Union**으로 상태를 표현. 불가능한 상태를 타입으로 차단

```typescript
// Bad
interface State {
  loading: boolean;
  error: string | null;
  data: Session[] | null;
}

// Good
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: Session[] };
```

- **Interface**는 컴포넌트 Props에 사용. **Type alias**는 유니온, 유틸리티 타입에 사용

```typescript
interface ToolbarProps {  // Props → interface
  onClear: () => void;
}

type RequestTab = 'headers' | 'query' | 'body';  // Union → type
```

- 타입 추론이 충분하면 명시적 타입 주석 생략. 함수 반환 타입은 공개 API에만 명시

### 불변성

- `readonly` 적극 사용. Props는 기본적으로 readonly
- 배열/객체를 직접 mutate하지 않는다. spread 또는 `Array.prototype` 메서드 사용

```typescript
// Bad
sessions.push(newSession);

// Good
setSessions(prev => [newSession, ...prev]);
```

## React 원칙

### 컴포넌트 구조

- **함수 컴포넌트 + Hooks** only. 클래스 컴포넌트 금지
- 하나의 파일에 하나의 exported 컴포넌트. 내부 서브 컴포넌트는 같은 파일에 허용
- 컴포넌트 파일명은 PascalCase (`SessionList.tsx`)

### 파일 구조

```
frontend/src/
├── components/
│   ├── ui/               ← shadcn/ui 컴포넌트 (자동 생성)
│   ├── layout/           ← 레이아웃 컴포넌트 (Toolbar, StatusBar 등)
│   ├── session/          ← 세션 관련 (SessionList, Inspector 등)
│   ├── tools/            ← 도구 (Composer, RuleEditor 등)
│   └── shared/           ← 공유 컴포넌트 (Badge, EmptyState 등)
├── hooks/                ← 커스텀 훅
├── lib/                  ← 유틸리티 (cn, formatters 등)
├── types/                ← 공유 타�� 정의
├── App.tsx
├── main.tsx
└── index.css
```

### 상태 관리

- **로컬 상태**: `useState` — 해당 컴포넌트에서만 필요한 상태
- **파생 상태**: `useMemo` — 계산된 값은 상태가 아니라 메모
- **전역 상태**: Props drilling이 3단계 이상이면 Context 또는 Zustand 도입 검토
- **서버 상태**: Wails 바인딩 호출 결과는 effect에서 관리

### 이벤트 핸들러

- `useCallback`은 자식 컴포넌트에 전달되는 콜백에만 사용
- 이벤트 핸들러명은 `handle` 접두사: `handleClick`, `handleSelect`
- Props 콜백명은 `on` 접두사: `onClick`, `onSelect`

### Performance

- **가상 스크롤**: 100개 이상 렌더링되는 리스트는 `react-window` 사용
- **메모이제이션**: 비용이 큰 필터링/정렬은 `useMemo`. 단순 계산은 매번 수행해도 됨
- **코드 스플리팅**: 모달(Settings, RuleEditor 등)은 `React.lazy` 고려

## 스타일링 규칙

### Tailwind 사용

- `className`에 Tailwind 유틸리티 클래스 사용
- `cn()` 유틸리티로 조건부 클래스 결합 (`clsx` + `tailwind-merge`)
- 인라인 `style`은 동적 계산값(width %, position 등)에만 사용

### 색상

- **절대 하드코딩 금지**. CSS 변수 기반 Tailwind 클래스만 사용

```typescript
// Bad
className="bg-[#1e1e2e] text-[#cdd6f4]"

// Good
className="bg-background text-foreground"
```

### 반응형

- Coroxy는 데스크탑 앱이므로 반응형 breakpoint 불필요
- 단, 패널 리사이즈에 대응하는 유연한 레이아웃 사용 (flex, min-w, truncate)

## 에러 처리

- Wails 바인딩 호출은 try-catch로 ���싸고, 에러를 사용자에게 표시
- `catch (e: unknown)` 사용. `String(e)` 또는 에러 메시지 추출
- Toast(shadcn/ui Sonner)로 에러 알림 표시

## Import 순서

1. React / React hooks
2. 외부 라이브러리
3. shadcn/ui 컴포넌트 (`@/components/ui/`)
4. 내부 컴포넌트
5. Hooks
6. 유틸리티, 타입
7. Wails 바인딩

```typescript
import { useState, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import { Button } from '@/components/ui/button';
import { SessionRow } from './SessionRow';
import { useProxyState } from '@/hooks/useProxyState';
import { cn, formatDuration } from '@/lib/utils';
import type { RequestTab } from '@/types';
import { Sessions } from '../../wailsjs/go/app/App';
```
