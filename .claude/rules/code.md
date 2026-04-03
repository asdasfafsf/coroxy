---
paths:
  - "**/*.go"
  - "go.mod"
  - "go.sum"
---

# Go 코딩 규칙

Go 코드를 작성할 때 반드시 따르는 규칙.
Effective Go, Google Go Style Guide, Uber Go Style Guide, Go Code Review Comments 기반.

## 규칙 강도

- **MUST**: 반드시 지킨다. 예외 없음.
- **SHOULD**: 원칙적으로 지킨다. 명확한 이유가 있을 때만 예외 허용.
- **MAY**: 권장. 상황에 따라 판단.

## 최상위 원칙

두 규칙이 충돌하면 아래 순서로 판단한다:

1. **쉽고 간단하게** — 복잡한 패턴보다 읽기 쉬운 코드
2. **확장성은 좋게** — 인터페이스로 교체 가능한 구조
3. **필요한 것만** — YAGNI. 미래를 위한 코드를 만들지 않음
4. **SOLID 원칙** — 단일 책임, 개방-폐쇄, 리스코프 치환, 인터페이스 분리, 의존성 역전

---

## 1. 설계 원칙

### 단순함 (MUST)

- 추상화는 필요할 때만 도입한다.
- 같은 패턴이 3번 반복되기 전에는 추상화하지 않는다. **예외: 외부 의존(I/O 경계, DB, 네트워크)은 첫 사용부터 인터페이스로 추상화한다.**
- 함수명과 시그니처만으로 의도가 드러나야 한다.

### Composition over Inheritance (MUST)

- 구조체 임베딩과 인터페이스 조합을 사용한다.
- 큰 인터페이스보다 작은 인터페이스(1~3개 메서드)를 조합한다.

### Accept Interfaces, Return Structs (SHOULD)

- 테스트 시 교체가 필요하거나 여러 구현이 존재하는 의존성은 인터페이스로 받는다.
- 단순 값 타입(`string`, `int`, `[]byte` 등)은 인터페이스로 감싸지 않는다.
- 반환값은 구체 타입을 반환한다.

### 의존성 방향 (MUST)

- 의존성은 항상 안쪽(도메인)을 향한다.
- 도메인 모델은 외부 패키지에 의존하지 않는다.
- 외부 의존(DB, 네트워크)은 인터페이스로 추상화하고 생성자에서 주입한다.

---

## 2. 파일 구조

### 파일 내 코드 순서 (MUST)

```
1. package 선언
2. import
3. 상수 (const)
4. 패키지 레벨 변수 (var) — 센티널 에러만 허용
5. 타입 정의 (type)
6. 생성자 (New...)
7. 공개 메서드 (대문자)
8. 비공개 메서드 (소문자)
```

### import 순서 (MUST)

3개 그룹, 빈 줄로 구분:

```go
import (
    // 1. 표준 라이브러리
    "context"
    "fmt"
    "net/http"

    // 2. 서드파티
    "github.com/wailsapp/wails/v2"

    // 3. 로컬 패키지
    "github.com/asdasfafsf/coroxy/internal/session"
)
```

### 파일 크기 (SHOULD)

- 한 파일에는 하나의 주요 타입과 관련 메서드만 둔다.
- 응집도가 유지되면 줄 수는 제한하지 않는다.

---

## 3. 패키지

### 이름 (MUST)

- 짧고, 소문자, 한 단어. 목적을 나타낸다.

```go
// 좋은 예: proxy, session, cert
// 나쁜 예: models, utils, helpers, common, types
```

### 캡슐화 (MUST)

- `internal/`을 사용하여 외부 노출을 차단한다.
- 공개 API는 최소화한다.

### 순환 의존 금지 (MUST)

- 패키지 간 순환 의존이 발생하면 설계가 잘못된 것이다.

### init() 함수 (MUST)

- `init()` 함수를 사용하지 않는다. 명시적 초기화를 사용한다.

### 전역 변수 (MUST)

- 가변 전역 변수를 사용하지 않는다.
- 센티널 에러(`var ErrXxx = errors.New(...)`)와 상수만 패키지 레벨에 허용한다.

---

## 4. 타입 정의

### 구조체 필드 순서 (MUST)

```go
type Session struct {
    // 1. 식별자
    ID       string
    Protocol string

    // 2. 핵심 데이터
    Request  *HTTPMessage
    Response *HTTPMessage

    // 3. 메타데이터
    CreatedAt time.Time
    Duration  time.Duration
    State     string

    // 4. 동기화 + 보호 대상 (빈 줄로 구분)
    mu     sync.Mutex
    closed bool
}
```

- 공개 필드 먼저, 비공개 필드 나중에.
- 관련 필드끼리 묶고 빈 줄로 구분.
- `sync.Mutex`는 보호하는 필드 바로 위에 두고, 빈 줄로 비보호 필드와 구분한다.

### 구조체 초기화 (MUST)

- `new(T)` 대신 `&T{}`를 사용한다.
- 필드 이름을 항상 명시한다.

```go
s := &Session{
    ID:       "abc",
    Protocol: "http",
}
```

### 생성자 (MUST)

- `New` + 타입명: `NewProxy`, `NewStore`
- 에러 가능하면 `(T, error)` 반환.
- **선택적 매개변수가 3개 이상**이면 Functional Options 패턴. 필수 매개변수는 일반 매개변수로 받는다.

```go
// 필수 1개 + 선택 여러 개
func NewProxy(addr string, opts ...Option) *Proxy { ... }

// Option 네이밍: With 접두사
func WithPort(port int) Option { ... }
func WithLogger(l *slog.Logger) Option { ... }
```

---

## 5. 함수

### 크기 (SHOULD)

- 하나의 함수는 하나의 일만 한다.
- 크기보다 응집도가 기준이다. 하나의 논리적 흐름이면 길어도 괜찮다.

### 매개변수 (SHOULD)

- 5개 이하로 유지. 많아지면 옵션 구조체를 사용한다.
- `context.Context`는 항상 첫 번째 매개변수. `ctx`로 이름 짓는다.
- Context는 구조체 필드에 저장하지 않는다. 단, Wails 바인딩 구조체의 lifecycle context는 허용한다.

### 반환값 (MUST)

- 에러는 마지막 반환값.
- Named return은 사용하지 않는다. 단, `defer`에서 에러를 수정해야 할 때만 허용한다.

### Early Return (MUST)

- 에러/예외를 먼저 검사하고 반환한다.
- `if` 블록이 `return`으로 끝나면 `else`를 쓰지 않는다.

```go
if err != nil {
    return err
}
// 정상 로직
```

### 인라인 에러 체크 (SHOULD)

- 변수가 `if` 블록 안에서만 쓰이면 인라인 선언을 선호한다.

```go
if err := validate(req); err != nil {
    return err
}
```

---

## 6. 리시버

### 이름 (MUST)

- 타입의 첫 글자 1~2자. `self`, `this` 사용하지 않는다.
- 한 타입의 모든 메서드에서 동일한 이름.

### 포인터 vs 값 리시버 (MUST)

한 타입에서 섞지 않는다.

**포인터 리시버:**
- 메서드가 리시버를 수정할 때
- `sync.Mutex` 등 복사하면 안 되는 필드가 있을 때
- 구조체가 클 때 (필드 5개 이상)
- 판단이 어려울 때

**값 리시버:**
- 변경되지 않는 작은 구조체
- 기본 타입 (int, string 등)

### Getter/Setter (MUST)

- Getter: `Xxx()` (`GetXxx()` 사용하지 않는다)
- Setter: `SetXxx()`

---

## 7. 에러 처리

### 에러는 반드시 처리한다 (MUST)

- `_`로 에러를 무시하지 않는다.

### 에러 메시지 포맷 (MUST)

- 영문 소문자로 시작. 마침표 없음.
- 동사로 시작: `"listen on %s: %w"`, `"parse config: %w"`
- 패키지/함수 이름을 반복하지 않는다.

### 에러 래핑 (MUST)

- `fmt.Errorf("동사구: %w", err)`로 래핑. 영문 동사로 시작.

```go
return fmt.Errorf("parse config: %w", err)
return fmt.Errorf("listen on %s: %w", addr, err)
```

### 에러 비교 (MUST)

- `==` 대신 `errors.Is`, 타입 단언 대신 `errors.As` 사용.

### 센티널 에러 (SHOULD)

- `Err` 접두사. 호출자가 구분해야 할 때만 정의.

```go
var (
    ErrNotFound   = errors.New("not found")
    ErrNotRunning = errors.New("not running")
)
```

### 에러 로깅 규칙 (MUST)

- 에러를 로깅한 후 반환하지 않는다. 둘 중 하나만.

---

## 8. 네이밍

### 변수 (MUST)

- 범위가 좁을수록 짧게: `i`, `r`, `ctx`, `err`
- 범위가 넓을수록 명확하게.

### 약어 (MUST)

- 업계 표준 약어는 전체 대문자: `HTTP`, `URL`, `ID`, `TLS`, `TCP`, `UDP`, `API`

### 불리언 (MUST)

- `is`, `has` 접두사를 사용하지 않는다: `running`, `closed`, `enabled`

### 인터페이스 (SHOULD)

- 메서드 하나면 `-er` 접미사: `Reader`, `Writer`, `Closer`

---

## 9. 동시성

### goroutine (MUST)

- 시작과 종료가 코드에서 보여야 한다.
- `sync.WaitGroup` 또는 `errgroup.Group`으로 완료를 기다린다.
- 누수를 방지한다.
- goroutine 안전한 타입은 godoc에 명시한다.

### 채널 vs 뮤텍스 (SHOULD)

- 데이터 전달: 채널
- 상태 보호: `sync.Mutex` / `sync.RWMutex`
- 버퍼 채널 크기에는 이유가 있어야 한다.

### Graceful Shutdown (MUST)

- `context.Context` 취소로 종료 신호 전파.
- `defer`로 리소스 정리 보장.
- 진행 중 요청 완료 후 종료.

---

## 10. 테스트

### Table-Driven Tests (SHOULD — 입력-출력 조합 2개 이상인 단위 테스트에 적용)

```go
func TestXxx(t *testing.T) {
    tests := []struct {
        name     string
        input    InputType
        expected OutputType
        wantErr  bool
    }{
        {"정상 케이스", input1, expected1, false},
        {"에러 케이스", input2, nil, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Function(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if !tt.wantErr && got != tt.expected {
                t.Errorf("got %v, want %v", got, tt.expected)
            }
        })
    }
}
```

### 원칙 (MUST)

- 공개 API를 테스트한다. 내부 구현을 테스트하지 않는다.
- 외부 의존은 인터페이스로 모킹한다.
- 테스트 헬퍼는 `t.Helper()` 호출.
- 에러 메시지: `got X, want Y` 포맷.
- 치명적 실패는 `t.Fatal` / `t.Fatalf`.

### 테스트 데이터 (SHOULD)

- `testdata/` 디렉터리에 fixture를 둔다.

### 벤치마크 (SHOULD)

- 성능 민감 코드에 벤치마크 작성.
- `b.Loop()` 사용 (Go 1.24+).
- `b.ReportAllocs()` 사용.

```go
func BenchmarkXxx(b *testing.B) {
    data := []byte("GET / HTTP/1.1\r\n")
    b.ReportAllocs()
    for b.Loop() {
        DetectProtocol(data)
    }
}
```

---

## 11. 주석

### 공개 API (MUST)

- 모든 공개 타입, 함수, 상수에 영문 주석을 단다.
- 주석은 대상의 이름으로 시작한다.

```go
// Proxy is an HTTP proxy server that captures and relays traffic.
type Proxy struct { ... }

// Start begins listening on the configured address.
func (p *Proxy) Start(ctx context.Context) error { ... }
```

### 비공개 코드 (SHOULD)

- "왜(why)"를 설명할 때만 주석. 영문 또는 한글 허용.

### TODO (MUST)

- `// TODO(작성자): 설명` 포맷.

---

## 12. 변수 선언

### var vs := (MUST)

- 제로값을 의도할 때: `var`
- 초기값이 있을 때: `:=`

```go
var buf bytes.Buffer    // 제로값 의도
var mu sync.Mutex       // 제로값 유효
port := 8080            // 초기값 있음
```

---

## 13. 슬라이스와 맵

### 슬라이스 (MUST)

- 선언만 할 때: `var s []T` (nil)
- 빈 결과 명시 반환: `[]T{}` (JSON `[]`)
- 크기 알면 용량 힌트: `make([]T, 0, len(items))`
- 비어있는지 체크: `len(s) == 0` (`s == nil` 아님)

### 맵 (MUST)

- 반드시 `make`로 초기화 후 사용: `m := make(map[string]int)`

---

## 14. 문자열

- 루프 내 연결: `strings.Builder` (MUST)
- 포맷팅: `fmt.Sprintf` (SHOULD)
- 단순 연결 2~3개: `+` 허용 (MAY)

---

## 15. defer

- 리소스 획득 직후 배치 (MUST)
- 루프 안에서 사용하지 않는다. 함수로 분리 (MUST)
- LIFO 순서 인지 (MUST)

---

## 16. panic과 recover

- `panic`은 프로그램 초기화 실패에만 허용 (MUST)
- 라이브러리 코드에서 `panic` 금지 (MUST)
- `recover`는 최상위 goroutine 경계에서만 (MUST)

---

## 17. 타입 단언

- 반드시 comma-ok 패턴 사용 (MUST)
- 여러 타입: type switch (SHOULD)

```go
v, ok := x.(string)
if !ok { ... }
```

---

## 18. 상수와 Enum

- enum 제로값은 Unknown/Invalid (MUST)
- 타입 있는 상수 사용 (MUST)
- `String()` 메서드 구현 (MUST)

```go
type Protocol int

const (
    ProtocolUnknown Protocol = iota
    ProtocolHTTP
    ProtocolTLS
    ProtocolRaw
)
```

---

## 19. 로깅

- 전역 로거 사용하지 않는다. 구조체 필드로 주입 (MUST)
- `log/slog` 사용 (MUST)
- 구조화된 키-값 쌍 사용 (MUST)
- 민감 정보 로깅 금지 (MUST)

| 레벨 | 기준 |
|------|------|
| Error | 운영 개입 필요 |
| Warn | 주의 필요, 동작 계속 |
| Info | 주요 상태 변경 (시작/중지) |
| Debug | 개발/디버깅용 |

---

## 20. JSON 태그

- snake_case 사용 (MUST — 프로젝트 컨벤션)
- 선택 필드: `omitempty` (SHOULD)
- 비노출: `json:"-"` (MUST)

---

## 21. 리소스 관리

- HTTP 응답 바디는 반드시 `defer resp.Body.Close()` (MUST)
- `io.Closer` 구현 타입의 `Close()` 에러도 처리 (SHOULD)

---

## 22. time 처리

- `time.Duration`으로 시간 간격 표현 (MUST). 초 단위 int 금지.
- clock 인터페이스는 테스트에서 시간 제어가 필요한 타입에만 적용 (MAY)

---

## 23. HTTP 클라이언트

- `http.DefaultClient` 사용하지 않는다. 타임아웃 명시 설정 (MUST)

```go
client := &http.Client{Timeout: 30 * time.Second}
```

---

## 24. 프로젝트 구조

```
main.go                 # Wails 엔트리포인트 (조립만, 로직 없음)
app.go                  # Wails 바인딩 구조체
internal/               # 모든 비즈니스 로직
```

- Wails 프로젝트이므로 엔트리포인트는 루트 `main.go`에 둔다. `cmd/`는 사용하지 않는다 (MUST)
- `main.go`와 `app.go`에 비즈니스 로직을 넣지 않는다 (MUST)
- `pkg/`는 이 프로젝트에서 사용하지 않는다 (MUST)
- `utils/`, `helpers/`, `common/` 금지 (MUST)

### 컴파일러 디렉티브 위치 (MUST)

- `//go:build` 태그는 `package` 선언 전에 둔다
- `//go:embed`는 대상 변수 바로 위에 둔다
- `//go:generate`는 파일 상단 `import` 아래에 둔다

```go
//go:embed all:frontend/dist
var assets embed.FS
```

### Wails 바인딩 규칙 (MUST)

- 바인딩 구조체는 루트 `app.go` 또는 `internal/app/`에 둔다
- 바인딩 메서드는 에러를 반환할 때 `(결과, error)` 형태를 사용한다
- 이벤트 emit은 `runtime.EventsEmit(ctx, "이벤트명", 데이터)` 패턴을 사용한다
- 이벤트 이름은 `coroxy:카테고리:액션` 네임스페이스를 사용한다 (예: `coroxy:session:new`)
