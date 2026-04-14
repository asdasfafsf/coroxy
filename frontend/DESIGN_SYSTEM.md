# Coroxy Design System

Linear의 정밀한 다크 UI를 베이스로, Warp의 따뜻한 톤을 조합한 Coroxy 전용 디자인 시스템.
데이터 밀도가 높은 네트워크 디버깅 도구에 최적화.

## 1. Design Philosophy

**Precision through Warmth** — 냉정한 정밀함에 따뜻함을 더한다.

- **Dark-native**: 다크 모드가 기본. 어둠 위에 정보가 떠오르는 구조
- **Data-dense**: 개발자 도구답게 한 화면에 최대한 많은 정보를 보여준다
- **Warm precision**: Linear의 정밀함 + Warp의 따뜻한 톤. 장시간 사용해도 눈이 편안하다
- **Semi-transparent layering**: 불투명 색상 대신 반투명 레이어로 깊이를 표현한다
- **Single accent**: 시안(Cyan) 하나만 악센트로 사용. 나머지는 무채색 계열

## 2. Color System

### 2.1 Semantic Tokens (CSS Custom Properties)

shadcn/ui 컨벤션에 맞춰 HSL 값으로 정의. `oklch`는 Tailwind v4 호환.

#### Dark Mode (기본)

```css
:root {
  /* Background layers — 어두운 순서대로 */
  --background: oklch(0.145 0.005 285);          /* #0c0c0e — 따뜻한 near-black */
  --card: oklch(0.170 0.005 285);                 /* #111113 — 패널 배경 */
  --popover: oklch(0.170 0.005 285);              /* card와 동일 */
  --secondary: oklch(0.205 0.005 285);            /* #1a1a1d — 상승 표면 */
  --muted: oklch(0.250 0.005 285);                /* #222225 — 비활성 표면 */
  --accent: oklch(0.250 0.005 285);               /* muted와 동일 */

  /* Foreground (text) */
  --foreground: oklch(0.965 0.005 90);            /* #f5f5f0 — 따뜻한 primary text */
  --card-foreground: oklch(0.965 0.005 90);
  --popover-foreground: oklch(0.965 0.005 90);
  --secondary-foreground: oklch(0.965 0.005 90);
  --muted-foreground: oklch(0.556 0.005 285);     /* #6b6b70 — muted text */
  --accent-foreground: oklch(0.965 0.005 90);

  /* Primary (Cyan accent) */
  --primary: oklch(0.789 0.154 194);              /* #22d3ee — cyan-400 */
  --primary-foreground: oklch(0.145 0.005 285);   /* 다크 bg 위 텍스트 */

  /* Destructive */
  --destructive: oklch(0.637 0.237 15);           /* #ef4444 */
  --destructive-foreground: oklch(0.965 0.005 90);

  /* Border & Input */
  --border: oklch(0.280 0.005 285);               /* rgba(255,255,255,0.08) 대응 */
  --input: oklch(0.280 0.005 285);
  --ring: oklch(0.789 0.154 194);                 /* primary와 동일 */

  /* Chart colors (Timing, Protocol badges 등) */
  --chart-1: oklch(0.789 0.154 194);  /* cyan — DNS */
  --chart-2: oklch(0.723 0.219 149);  /* green — TCP */
  --chart-3: oklch(0.702 0.183 293);  /* purple — TLS */
  --chart-4: oklch(0.795 0.184 86);   /* yellow — TTFB */
  --chart-5: oklch(0.705 0.191 47);   /* orange — Transfer */

  /* Sidebar — 앱 레이아웃용 */
  --sidebar: oklch(0.145 0.005 285);
  --sidebar-foreground: oklch(0.965 0.005 90);
  --sidebar-primary: oklch(0.789 0.154 194);
  --sidebar-primary-foreground: oklch(0.145 0.005 285);
  --sidebar-accent: oklch(0.250 0.005 285);
  --sidebar-accent-foreground: oklch(0.965 0.005 90);
  --sidebar-border: oklch(0.280 0.005 285);
  --sidebar-ring: oklch(0.789 0.154 194);

  /* Radius */
  --radius: 0.5rem;
}
```

#### Light Mode

```css
.light {
  --background: oklch(0.985 0.005 90);            /* #fafaf8 — 따뜻한 off-white */
  --card: oklch(1.000 0 0);                        /* #ffffff */
  --popover: oklch(1.000 0 0);
  --secondary: oklch(0.955 0.005 90);              /* #f0f0ed */
  --muted: oklch(0.930 0.005 90);                  /* #e5e5e2 */
  --accent: oklch(0.930 0.005 90);

  --foreground: oklch(0.205 0.005 285);            /* #1a1a1d */
  --card-foreground: oklch(0.205 0.005 285);
  --popover-foreground: oklch(0.205 0.005 285);
  --secondary-foreground: oklch(0.205 0.005 285);
  --muted-foreground: oklch(0.556 0.005 285);      /* #6b6b70 */
  --accent-foreground: oklch(0.205 0.005 285);

  --primary: oklch(0.609 0.126 199);               /* #0891b2 — cyan-600 (라이트 대비) */
  --primary-foreground: oklch(1.000 0 0);

  --destructive: oklch(0.577 0.245 27);            /* #dc2626 */
  --destructive-foreground: oklch(1.000 0 0);

  --border: oklch(0.880 0.005 90);                 /* #ddddd8 */
  --input: oklch(0.880 0.005 90);
  --ring: oklch(0.609 0.126 199);
}
```

### 2.2 Status Colors

HTTP 상태, 프로토콜, 룰 액션 등에 사용하는 시맨틱 컬러.

| 역할 | 다크 모드 | 라이트 모드 | 용도 |
|------|-----------|------------|------|
| Success | `#4ade80` (green-400) | `#16a34a` (green-600) | 2xx 상태, 활성 표시 |
| Warning | `#fbbf24` (amber-400) | `#d97706` (amber-600) | 3xx/4xx 상태, Breakpoint |
| Error | `#f87171` (red-400) | `#dc2626` (red-600) | 5xx 상태, 에러 |
| Info | `#60a5fa` (blue-400) | `#2563eb` (blue-600) | 링크, 키 이름 |
| Purple | `#c084fc` (purple-400) | `#9333ea` (purple-600) | TLS, 이미지 타입 |
| Cyan | `#22d3ee` (cyan-400) | `#0891b2` (cyan-600) | Primary accent |

### 2.3 Protocol Badge Colors

| Protocol | Background | Text |
|----------|-----------|------|
| HTTP | `primary/15%` | `primary` |
| TLS | `success/15%` | success |
| TCP | `warning/15%` | warning |
| UDP | `purple/15%` | purple |

## 3. Typography

### 3.1 Font Stack

```css
--font-sans: "Inter Variable", "Inter", -apple-system, system-ui, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", "Menlo", "Monaco", monospace;
```

- **Inter Variable**: Linear의 기반 폰트. OpenType `cv01`, `ss03` 활성화하여 기하학적 깔끔함
- **JetBrains Mono**: Hex viewer, 코드, 헤더 값 등 모노스페이스 콘텐츠

### 3.2 Scale

| Token | Size | Weight | Line Height | Letter Spacing | 용도 |
|-------|------|--------|-------------|----------------|------|
| `heading-lg` | 18px | 600 | 1.33 | -0.2px | 모달 제목 |
| `heading` | 14px | 600 | 1.43 | -0.1px | 섹션 제목 |
| `body` | 13px | 400 | 1.54 | normal | 기본 텍스트 |
| `body-medium` | 13px | 500 | 1.54 | normal | 강조 텍스트, Nav |
| `label` | 12px | 500 | 1.33 | normal | 버튼, 라벨 |
| `caption` | 11px | 400 | 1.45 | normal | 메타데이터, 타임스탬프 |
| `mono` | 12px | 400 | 1.50 | normal | 코드, 헤더 값, Hex |
| `mono-sm` | 11px | 400 | 1.36 | normal | Hex viewer, 작은 코드 |

> **원칙**: 데스크톱 도구이므로 작은 폰트(11-13px)가 기본. 데이터 밀도 > 가독성 편의.

## 4. Spacing

8px 기반 그리드. 미세 조정은 2px/4px 허용.

| Token | Value | 용도 |
|-------|-------|------|
| `space-0.5` | 2px | 인라인 요소 간격 |
| `space-1` | 4px | 아이콘-텍스트 간격 |
| `space-1.5` | 6px | 컴팩트 패딩 |
| `space-2` | 8px | 기본 패딩 |
| `space-3` | 12px | 섹션 내 간격 |
| `space-4` | 16px | 섹션 간 간격 |
| `space-6` | 24px | 큰 섹션 간격 |
| `space-8` | 32px | 모달 패딩 |

## 5. Border Radius

| Token | Value | 용도 |
|-------|-------|------|
| `radius-sm` | 4px | Badge, 작은 버튼 |
| `radius` | 6px | 버튼, Input, 드롭다운 |
| `radius-md` | 8px | 카드, 패널 |
| `radius-lg` | 12px | 모달, 큰 컨테이너 |
| `radius-full` | 9999px | Pill badge, 상태 dot |

## 6. Border & Depth

### 6.1 Border

Linear 스타일 — 불투명 색상 대신 반투명 white로 경계를 표현.

```
다크: rgba(255, 255, 255, 0.06)   — 기본 경계
      rgba(255, 255, 255, 0.10)   — 강조 경계 (hover, focus)
      rgba(255, 255, 255, 0.15)   — 최강조

라이트: rgba(0, 0, 0, 0.08)       — 기본 경계
        rgba(0, 0, 0, 0.15)       — 강조 경계
```

### 6.2 Shadow (Elevation)

| Level | Shadow | 용도 |
|-------|--------|------|
| 0 | 없음 | 기본 surface |
| 1 | `0 1px 2px rgba(0,0,0,0.1)` | 버튼 hover |
| 2 | `0 4px 12px rgba(0,0,0,0.15)` | 드롭다운, 컨텍스트 메뉴 |
| 3 | `0 8px 24px rgba(0,0,0,0.2)` | 모달, 다이얼로그 |

## 7. Component Patterns

### 7.1 Buttons

shadcn/ui Button variant 사용:
- `default` (primary cyan): 주요 CTA (Start, Send 등)
- `secondary`: 일반 액션 (Clear, Export 등)
- `outline`: 토글 버튼 (Proxy ON/OFF)
- `ghost`: 툴바/인라인 액션
- `destructive`: 위험한 액션 (Stop, Delete, Drop)

크기: `sm` (28px height, 12px text) 기본. 데이터 밀도를 위해 작게.

### 7.2 Tables

세션 목록 — 데이터 밀도가 가장 높은 핵심 컴포넌트:
- 행 높이: 28px (컴팩트)
- 가상 스크롤 (react-window)
- 행 선택: `accent/10%` 배경
- 행 hover: `muted` 배경
- 헤더: `card` 배경, `muted-foreground` 텍스트, `label` 크기

### 7.3 Tabs

Inspector 탭 — shadcn/ui Tabs:
- 하단 border indicator 스타일
- `caption` 사이즈
- 활성: `foreground` + `primary` border-bottom
- 비활성: `muted-foreground`, hover 시 `foreground`

### 7.4 Modals (Dialog)

Settings, Rules, Composer — shadcn/ui Dialog:
- 최대 너비: 500-700px
- `card` 배경
- `border` 경계
- shadow level 3
- 헤더: border-bottom으로 분리

### 7.5 Inputs

- `card` 배경 (다크 내 약간 밝은 surface)
- `border` 경계
- focus: `ring` (primary) border
- `body` 사이즈
- placeholder: `muted-foreground`

### 7.6 Context Menu

shadcn/ui ContextMenu:
- `card` 배경
- shadow level 2
- `radius-md`
- 항목: `body` 사이즈, `ghost` hover 스타일

### 7.7 Badge

프로토콜, 룰 액션 등:
- `radius-sm`
- `caption` 사이즈
- 시맨틱 색상의 15% 배경 + 100% 텍스트

## 8. Layout

### 8.1 Main Layout

```
┌─────────────────────────────────────────────┐
│ Toolbar (h: 40px)                           │
├─────────────────────────┬───────────────────┤
│ Session List (flex: 1)  │ Inspector (w: 400)│
├─────────────────────────┴───────────────────┤
│ StatusBar (h: 24px)                         │
└─────────────────────────────────────────────┘
```

- Toolbar: `background` 배경, 하단 `border`
- Session List: `background` 배경
- Inspector: `card` 배경, 좌측 `border`
- StatusBar: `card` 배경, 상단 `border`

### 8.2 Resizable Panels

추후 `react-resizable-panels`로 패널 크기 조절 지원 예정.

## 9. Dark/Light Mode

- 기본: 시스템 설정 따름 (`prefers-color-scheme`)
- 토글: StatusBar 또는 Settings에서 수동 전환
- 구현: `<html>` 태그에 `class="dark"` 또는 `class="light"` 적용
- CSS 변수가 자동으로 전환됨

## 10. Do's and Don'ts

### Do
- CSS 변수(`var(--foreground)` 등)만 사용. 하드코딩 HEX 금지
- 반투명 border 사용 (`border` 토큰)
- 작은 폰트(11-13px) 기본. 데이터 밀도 우선
- Inter Variable + OpenType features `"cv01", "ss03"` 활성화
- 시맨틱 색상은 status 용도로만 사용 (success, warning, error)
- shadcn/ui 컴포넌트 우선 사용. 커스텀 컴포넌트는 최소화

### Don't
- 순수 흰색(`#ffffff`)을 다크 모드 텍스트로 사용하지 않음 — 항상 따뜻한 off-white
- 순수 검정(`#000000`)을 배경으로 사용하지 않음 — 항상 warm near-black
- 3개 이상의 악센트 색상 사용 금지 — Cyan 하나 + status 색상만
- 무거운 drop shadow 사용 금지 — 반투명 border + 밝기 단계로 깊이 표현
- Bold (700+) 웨이트 사용 금지 — 최대 600 (semibold)
