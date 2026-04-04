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

- **MUST**: 반드시 지킨다. 규칙 본문에 명시된 허용 범위 내에서만 예외를 인정한다.
- **SHOULD**: 원칙적으로 지킨다. 명확한 이유가 있을 때만 예외 허용.
- **MAY**: 권장. 상황에 따라 판단.

## 최상위 원칙

두 규칙이 충돌하면 아래 순서로 판단한다:

0. **프로젝트 적합성 우선** — 일반 관행/커뮤니티 컨벤션보다 이 프로젝트의 구조와 원칙에 맞는 것을 선택한다. 관행을 따르지 않는 이유는 ADR에 기록한다
1. **쉽고 간단하게** — 복잡한 패턴보다 읽기 쉬운 코드
2. **확장성은 좋게** — 외부 의존(I/O 경계)은 인터페이스로 교체 가능하게. 소비자(caller) 측에서 필요한 인터페이스를 정의한다. 패키지 내부 구현은 YAGNI 우선
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

### 인터페이스 정의 위치 (SHOULD)

- 인터페이스는 소비자(caller) 패키지에서 정의한다.
- 예외: 여러 패키지가 공유하는 계약 인터페이스(`ProxyEngine`, `SessionStore`, `Interceptor` 등)는 `adapter/`에서 정의한다.
- 표준 라이브러리 인터페이스(`io.Reader`, `io.Writer` 등)는 그대로 사용한다.

### 의존성 방향 (MUST)

- 의존성은 항상 안쪽(도메인)을 향한다.
- 도메인 모델은 외부 패키지에 의존하지 않는다.
- 외부 의존(DB, 네트워크)은 인터페이스로 추상화하고 생성자에서 주입한다.

---

## 2. 파일 구조

### 파일 내 코드 순서 (SHOULD)

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
- 500줄 초과 시 분리를 검토한다. 단, 하나의 논리적 단위라면 유지해도 된다.

---

## 3. 패키지

### 이름 (MUST)

- 짧고, 소문자, 한 단어. 목적을 나타낸다.

```go
// 좋은 예: proxy, session, cert, adapter, model, constant
// 나쁜 예: models, utils, helpers, common, types
```

> `model`(단수, 명확한 역할)과 `models`(복수, 무분별한 모음)는 다르다. 역할이 명확한 단수형 패키지명은 허용한다.

### 캡슐화 (MUST)

- `internal/`을 사용하여 외부 노출을 차단한다.
- 공개 API는 최소화한다.

### 순환 의존 금지 (MUST)

- 패키지 간 순환 의존이 발생하면 설계가 잘못된 것이다.

### init() 함수 (MUST)

- `init()` 함수를 사용하지 않는다. 명시적 초기화를 사용한다. 단, 서드파티 드라이버 등록(`import _ "..."`)은 허용.

### 전역 변수 (MUST)

- 가변 전역 변수를 사용하지 않는다.
- 센티널 에러(`var ErrXxx = errors.New(...)`)와 상수만 패키지 레벨에 허용한다.

### unsafe 패키지 (MUST)

- `unsafe` 패키지를 사용하지 않는다.

---

## 4. 타입 정의

### 제로값 유용성 (SHOULD)

- 제로값이 유용하도록 타입을 설계한다. 제로값이 유효하지 않은 타입은 생성자를 통해 초기화하도록 강제한다.

### 구조체 필드 순서 (SHOULD)

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
- `sync.Mutex` 등 복사 불가 타입을 포함하는 구조체는 포인터로 전달한다 (MUST)

### 구조체 초기화 (MUST)

- 포인터가 필요한 경우 `&T{}`를 사용한다. 값으로 충분한 경우 `T{}`를 사용한다. 필드 초기화가 없는 포인터는 `new(T)` 또는 `&T{}` 모두 허용.
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
- **호출자가 제어할 수 있는 설정 항목(매개변수 또는 설정 필드 불문)이 3개 이상(3개 포함)**이면 Functional Options 패턴 또는 옵션 구조체를 사용한다. 필수 매개변수는 일반 매개변수로 받는다. `internal/` 패키지에서는 옵션 구조체가 더 단순하면 그쪽을 선택한다.

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
- Context는 구조체 필드에 저장하지 않는다. 단, Wails 바인딩 구조체의 lifecycle context와 구조체 생성자에서 받은 cancel 전파용 context만 허용한다. 요청별 context는 저장하지 않는다.

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

### 포인터 vs 값 리시버 (SHOULD)

기본은 포인터 리시버를 사용한다. 값 리시버는 아래 조건을 **모두** 만족할 때만 사용한다:

- 메서드가 리시버를 수정하지 않는다
- `sync.Mutex` 등 복사 불가 필드가 없다
- 복사 비용이 무시할 수 있는 작은 타입이다

### 리시버 일관성 (SHOULD)

원칙적으로 한 타입에서 포인터/값 리시버를 섞지 않는다. 복사 불가 필드(`sync.Mutex` 등)가 없는 작은 타입에 한해, `fmt.Stringer` 등 읽기 전용 표준 인터페이스 구현 메서드를 값 리시버로 두는 것을 허용하며, 이 경우 리시버 혼용으로 간주하지 않는다. 커스텀 에러 타입의 `Error()` 메서드는 에러 값을 `*T`로 전달하는 관행에 맞춰 포인터 리시버를 사용한다.

### Getter/Setter (MUST)

- Getter: `Xxx()` (`GetXxx()` 사용하지 않는다)
- Setter: `SetXxx()`

---

## 7. 에러 처리

### 에러는 반드시 처리한다 (MUST)

- `_`로 에러를 무시하지 않는다. 단, 처리가 불가능한 경우(`defer` 내 `Close`, 로그 출력 등)는 `_ =`로 의도적 무시를 명시한다.

### 에러 메시지 포맷 (MUST)

- 영문 소문자로 시작. 마침표 없음.
- `fmt.Errorf` 래핑 메시지는 동사로 시작: `"listen on %s: %w"`, `"parse config: %w"`
- 센티널 에러(`errors.New`)와 커스텀 에러 타입의 `Error()` 메서드는 상태/명사구 허용: `"not found"`, `"connection refused"`
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
- 단순 분기만 필요하면 센티널 에러, 추가 컨텍스트(리소스명, ID 등)가 필요하면 커스텀 에러 타입을 사용한다.

```go
var (
    ErrNotFound   = errors.New("not found")
    ErrNotRunning = errors.New("not running")
)
```

### 커스텀 에러 타입 (SHOULD)

- 추가 정보(ID, 코드 등)가 필요할 때만 정의한다. 단순 분기만 필요하면 센티널 에러를 사용한다.
- `Error` 접미사를 사용한다: `NotFoundError`, `TimeoutError`
- `Error() string` 메서드를 구현한다.
- 래핑된 에러가 있으면 `Unwrap() error` 메서드를 구현한다.
- 에러 타입은 해당 패키지의 `errors.go` 파일에 모아둔다.

```go
type NotFoundError struct {
    Resource string
    ID       string
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s not found: %s", e.Resource, e.ID)
}
```

### 에러 로깅 규칙 (MUST)

- 에러를 로깅한 후 반환하지 않는다. 둘 중 하나만.
- 예외: goroutine 최상위에서 recover한 panic은 반드시 로깅한다. `errgroup` 등 에러를 반환할 수 있는 goroutine에서는 이 경우에 한해 로깅과 에러 반환을 둘 다 허용한다.

---

## 8. 네이밍

### 변수 (MUST)

- 범위가 좁을수록 짧게: `i`, `r`, `ctx`, `err`
- 범위가 넓을수록 명확하게.

### 약어 (MUST)

- 업계 표준 약어는 전체 대문자: `HTTP`, `URL`, `ID`, `TLS`, `TCP`, `UDP`, `API`

### 불리언 필드 (SHOULD)

- 구조체 필드에 `is`, `has` 접두사를 사용하지 않는다: `running`, `closed`, `enabled`
- 함수/메서드명에서는 `IsValid()`, `HasPrefix()` 등 표준 라이브러리 관행을 따른다 (MAY)

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

### Context 전파 (MUST)

- `context.Background()`는 `main()`, 테스트 함수, Wails lifecycle 메서드(`OnStartup` 등)에서만 사용한다.
- `context.TODO()`는 아직 context가 전달되지 않는 코드에서 임시로만 사용. 최종 코드에 남기지 않는다.
- 부모 context에서 파생하여 하위로 전달한다.
- `context.WithCancel` / `context.WithTimeout`을 만든 쪽이 취소 책임을 진다.
- 블로킹 채널 연산에서는 `select`로 `ctx.Done()`을 함께 검사한다.

```go
ctx, cancel := context.WithTimeout(parentCtx, 30*time.Second)
defer cancel()
```

```go
select {
case data := <-ch:
    // 처리
case <-ctx.Done():
    return ctx.Err()
}
```

### goroutine panic 복구 (MUST)

- 요청별 goroutine(서버 핸들러 등)에서는 최상위에 recover를 둬서 한 요청의 panic이 서버 전체를 죽이지 않도록 한다.
- recover 시 에러를 로깅한다.

### Close/Shutdown 패턴 (MUST)

- 리소스를 보유하는 구조체는 `Close() error` 또는 `Shutdown(ctx context.Context) error`를 구현한다.
- 생성한 쪽이 닫을 책임을 진다.

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

### 테스트 필수 규칙 (MUST)

- 모든 PR에 테스트를 포함한다. 테스트 없는 기능 코드 PR은 머지하지 않는다
- 단위 테스트와 통합 테스트를 모두 작성한다
- 통합 테스트는 실제 서버를 띄우고 실제 네트워크 요청을 보낸다. mock 서버 대신 `net/http/httptest.Server` 등 실제 리스너를 사용한다
- 커버리지 수치 목표는 없다. 기능이 의도대로 동작하는지가 기준이다

### 원칙

- 원칙적으로 공개 API를 통해 테스트한다. 복잡한 내부 로직은 별도 패키지로 분리하여 공개 API로 만들거나, 명확한 이유가 있을 때 내부 테스트를 허용한다 (SHOULD)
- 외부 의존은 인터페이스로 모킹하지 않는다. 실제 구현체를 사용하여 통합 테스트한다. 단, 외부 API 등 제어 불가능한 의존은 예외 (MUST)
- 테스트 헬퍼는 `t.Helper()` 호출 (MUST)
- 에러 메시지: `got X, want Y` 포맷 (SHOULD)
- 치명적 실패는 `t.Fatal` / `t.Fatalf` (SHOULD)

### 테스트 데이터 (SHOULD)

- `testdata/` 디렉터리에 fixture를 둔다.

### 벤치마크 (SHOULD)

- 성능 민감 코드에 벤치마크 작성.
- 기존 `for i := 0; i < b.N; i++` 루프 대신 `b.Loop()`을 사용한다 (Go 1.24+).
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

- nil 맵에 쓰지 않는다. 쓰기 전에 반드시 초기화한다: `make(map[K]V)` 또는 리터럴 `map[K]V{"a": 1}`

---

## 14. 문자열

- 루프 내 연결: `strings.Builder` (MUST)
- 포맷팅: `fmt.Sprintf` (SHOULD)
- 단순 연결 2~3개: `+` 허용 (MAY)

---

## 15. defer

- 리소스 획득 직후 배치 (MUST)
- 루프 안에서 사용하지 않는다. 함수로 분리 (MUST)
- defer 순서가 리소스 해제에 영향을 줄 때 LIFO 순서를 고려하여 배치한다 (SHOULD)
- defer에서 `Close()` 에러를 반영해야 하면 named return을 사용한다 (섹션 5 "반환값" 규칙의 허용 예외)

```go
func readFile(path string) (data []byte, err error) {
    f, err := os.Open(path)
    if err != nil {
        return nil, fmt.Errorf("open %s: %w", path, err)
    }
    defer func() {
        if cErr := f.Close(); cErr != nil && err == nil {
            err = fmt.Errorf("close %s: %w", path, cErr)
        }
    }()
    return io.ReadAll(f)
}
```

---

## 16. panic과 recover

- `panic`은 프로그램 초기화 실패에만 허용 (MUST)
- `internal/` 패키지에서도 `panic` 대신 에러를 반환한다 (MUST)
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

- enum은 `string` 타입을 사용한다. 값만 봐도 사람이 알아볼 수 있도록 한다 (MUST)
- 제로값(`""`)과 구분하기 위해 Unknown/Invalid 값을 명시 정의한다 (MUST)
- 타입 있는 상수 사용 (MUST)

```go
type Protocol string

const (
    ProtocolUnknown Protocol = "unknown"
    ProtocolHTTP    Protocol = "HTTP"
    ProtocolTLS     Protocol = "TLS"
    ProtocolRaw     Protocol = "raw"
)
```

---

## 19. 로깅

- 전역 로거 사용하지 않는다. 구조체 필드로 주입 (MUST)
- `log/slog` 사용 (MUST). Wails 자체 로거는 사용하지 않고, slog 핸들러로 통합한다
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

## 23. 네트워크 I/O 안전

- 신뢰할 수 없는 외부 데이터를 읽을 때 `io.LimitReader`로 크기를 제한한다 (MUST)
- `io.ReadAll`은 크기가 보장된 경우에만 사용한다. 외부 응답에 직접 사용하지 않는다 (MUST)
- 바이트 릴레이 시 `io.Copy` 또는 `io.CopyBuffer`를 사용한다 (SHOULD)

---

## 24. HTTP 클라이언트

- `http.DefaultClient` 사용하지 않는다. 타임아웃 명시 설정 (MUST)

```go
client := &http.Client{Timeout: 30 * time.Second}
```

---

## 25. 프로젝트 구조

```
main.go                 # Wails 엔트리포인트 (조립만, 로직 없음)
internal/
├── app/                # Wails 바인딩 구조체 + GUI↔Core 브릿지
├── adapter/            # 공유 인터페이스 (의존성 역전 계층)
├── model/              # 공유 데이터 구조체
├── constant/           # enum, 프로토콜 상수
├── errdefs/            # 공유 에러 (센티널 + 커스텀 에러 타입)
├── proxy/              # 프록시 엔진 구현
├── session/            # 세션 저장소 구현
└── ...                 # 기능별 패키지
```

- Wails 프로젝트이므로 엔트리포인트는 루트 `main.go`에 둔다. `cmd/`는 사용하지 않는다 (MUST)
- `main.go`에 비즈니스 로직을 넣지 않는다. 조립(의존성 주입)만 수행한다 (MUST)
- Wails 바인딩 구조체는 `internal/app/`에 둔다 (MUST)
- 공유 타입은 역할별로 분리한다: 인터페이스(`adapter/`), 구조체(`model/`), 상수/enum(`constant/`), 공유 에러(`errdefs/`) (MUST)
- 공유 패키지 간 import 규칙: `adapter/`는 `model/`, `constant/`, `errdefs/`를 import할 수 있다. `model/`은 `constant/`를 import할 수 있다. 그 외 `internal/` 패키지는 import하지 않는다 (MUST)
- 센티널 에러와 커스텀 에러 타입 중 여러 패키지가 공유하는 것은 `errdefs/`에 둔다. 특정 패키지에서만 쓰는 에러는 해당 패키지의 `errors.go`에 둔다 (MUST)
- `pkg/`는 이 프로젝트에서 사용하지 않는다 (MUST)
- `utils/`, `helpers/`, `common/` 금지 (MUST)

### 컴파일러 디렉티브 위치 (MUST)

- `//go:build` 태그는 `package` 선언 전에 둔다
- `//go:embed`는 대상 변수 바로 위에 둔다
- `//go:generate`는 `import` 블록 직후에 둔다

```go
//go:embed all:frontend/dist
var assets embed.FS
```

### 빌드 태그와 크로스 컴파일 (SHOULD)

- OS별 동작이 다른 코드는 `//go:build` 태그로 파일을 분리한다 (`xxx_darwin.go`, `xxx_windows.go`, `xxx_linux.go`)
- 런타임 `runtime.GOOS` 분기는 단순한 경우에만 허용한다

### Wails 바인딩 규칙 (MUST)

- 바인딩 구조체는 `internal/app/`에 둔다
- 바인딩 메서드는 에러를 반환할 때 `(결과, error)` 형태를 사용한다
- 이벤트 emit은 `runtime.EventsEmit(ctx, "이벤트명", 데이터)` 패턴을 사용한다
- 이벤트 이름은 `coroxy:카테고리:액션` 네임스페이스를 사용한다 (예: `coroxy:session:new`)
