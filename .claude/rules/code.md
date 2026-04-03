---
paths:
  - "**/*.go"
  - "go.mod"
  - "go.sum"
---

# Go 코딩 규칙

Go 코드를 작성할 때 반드시 따르는 규칙. Effective Go, Google/Uber Go Style Guide, Go Code Review Comments 기반.

---

## 1. 설계 원칙

### 단순함을 우선한다

- 추상화는 필요할 때만 도입한다. 미래를 위한 설계를 하지 않는다.
- 같은 패턴이 3번 반복되기 전에는 추상화하지 않는다.
- 코드를 읽는 사람이 5초 안에 의도를 파악할 수 있어야 한다.

### Composition over Inheritance

- 구조체 임베딩과 인터페이스 조합을 사용한다.
- 큰 인터페이스보다 작은 인터페이스(1~3개 메서드)를 조합한다.

### Accept Interfaces, Return Structs

- 함수의 매개변수는 인터페이스를 받는다.
- 함수의 반환값은 구체 타입을 반환한다.

### 의존성 방향

- 의존성은 항상 안쪽(도메인)을 향한다.
- 도메인 모델은 외부 패키지에 의존하지 않는다.
- 외부 의존(DB, 네트워크)은 인터페이스로 추상화하고 주입한다.

---

## 2. 파일 구조

### 파일 내 코드 순서

파일 내 코드는 반드시 아래 순서를 따른다:

```
1. package 선언
2. import
3. 상수 (const)
4. 패키지 레벨 변수 (var)
5. 타입 정의 (type)
6. 생성자 (New...)
7. 공개 메서드 (대문자)
8. 비공개 메서드 (소문자)
```

### import 순서

반드시 3개 그룹으로 나누고, 빈 줄로 구분한다:

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

### 파일 크기

- 한 파일은 300줄을 넘기지 않는다. 넘기면 분리한다.
- 한 파일에는 하나의 주요 타입과 관련 메서드만 둔다.

---

## 3. 패키지

### 이름

- 짧고, 소문자, 한 단어. 복수형 사용하지 않는다.
- 목적을 나타낸다. 내용물 이름이 아니다.

```go
// 좋은 예
package proxy
package session
package cert

// 나쁜 예
package models
package utils
package helpers
package common
package types
```

### 캡슐화

- `internal/`을 사용하여 외부 노출을 차단한다.
- 내보낼 필요 없으면 소문자로 시작한다. 공개 API는 최소화한다.

### 순환 의존 금지

- 패키지 간 순환 의존이 발생하면 설계가 잘못된 것이다.
- 인터페이스를 소비자 측에 정의하거나 별도 패키지로 분리하여 해결한다.

### init() 함수

- `init()` 함수를 사용하지 않는다. 명시적 초기화를 사용한다.
- 예외: 패키지 레벨에서 반드시 필요한 등록(예: `database/sql` 드라이버 등록)만 허용.

### 전역 변수

- 가변 전역 변수를 사용하지 않는다.
- 센티널 에러, 상수만 패키지 레벨에 둔다.
- 설정값은 구조체에 넣고 주입한다.

---

## 4. 타입 정의

### 구조체 필드 순서

```go
type Session struct {
    // 1. 식별자
    ID        string
    Protocol  string

    // 2. 핵심 데이터 (논리적 그룹으로 묶고 빈 줄로 구분)
    Request   *HTTPMessage
    Response  *HTTPMessage

    // 3. 메타데이터
    CreatedAt time.Time
    Duration  time.Duration
    State     string

    // 4. 내부 상태 (비공개)
    mu        sync.Mutex
    closed    bool
}
```

- 공개 필드를 먼저, 비공개 필드를 나중에.
- 관련 필드끼리 묶고 빈 줄로 구분한다.
- `sync.Mutex`는 보호하는 필드 바로 위에 둔다.

### 구조체 초기화

- `new(T)` 대신 `&T{}`를 사용한다.
- 필드 이름을 항상 명시한다.

```go
// 좋은 예
s := &Session{
    ID:       "abc",
    Protocol: "http",
}

// 나쁜 예
s := &Session{"abc", "http", nil, nil, time.Now(), 0, "", sync.Mutex{}, false}
```

### 생성자

- `New` + 타입명으로 이름 짓는다.
- 에러가 발생할 수 있으면 `(T, error)`를 반환한다.
- 옵션이 3개 이상이면 Functional Options 패턴을 사용한다.

```go
// 기본
func NewProxy(addr string) *Proxy { ... }

// 에러 가능
func NewStore(path string) (*Store, error) { ... }

// Functional Options
func NewProxy(opts ...Option) *Proxy { ... }
```

---

## 5. 함수

### 크기

- 하나의 함수는 하나의 일만 한다.
- 30줄을 넘기면 분리를 고려한다.

### 매개변수

- 5개 이하로 유지한다. 많아지면 옵션 구조체를 사용한다.
- `context.Context`는 항상 첫 번째 매개변수. `ctx`로 이름 짓는다.
- Context는 구조체 필드에 저장하지 않는다.

```go
func (p *Proxy) HandleRequest(ctx context.Context, req *http.Request) error { ... }
```

### 반환값

- 에러를 반환하는 함수는 에러를 마지막 반환값으로 둔다.
- Named return은 사용하지 않는다. 예외: defer에서 에러를 수정해야 할 때만.

```go
// 좋은 예
func (s *Store) Get(id string) (*Session, error) { ... }

// 나쁜 예
func (s *Store) Get(id string) (session *Session, err error) { ... }
```

### Early Return

- 에러 조건을 먼저 검사하고 조기 반환한다. 들여쓰기를 줄인다.

```go
// 좋은 예
func (p *Proxy) Start() error {
    if p.running {
        return ErrAlreadyRunning
    }
    // 정상 로직
}

// 나쁜 예
func (p *Proxy) Start() error {
    if !p.running {
        // 정상 로직 (깊은 들여쓰기)
    } else {
        return ErrAlreadyRunning
    }
}
```

---

## 6. 리시버

### 이름

- 타입의 첫 글자 1~2자. `self`, `this` 사용하지 않는다.
- 한 타입의 모든 메서드에서 동일한 이름을 사용한다.

```go
func (p *Proxy) Start() error { ... }
func (p *Proxy) Stop() error { ... }  // 같은 'p'
```

### 포인터 vs 값 리시버

아래 기준을 따른다. 한 타입에서 포인터와 값 리시버를 섞지 않는다.

**포인터 리시버를 사용하는 경우:**
- 메서드가 리시버를 수정할 때
- 구조체가 `sync.Mutex` 등 복사하면 안 되는 필드를 포함할 때
- 구조체가 클 때 (필드 5개 이상)
- 판단이 어려울 때

**값 리시버를 사용하는 경우:**
- 리시버가 map, func, chan일 때
- 리시버가 변경되지 않는 작은 구조체일 때
- 리시버가 기본 타입(int, string 등)일 때

---

## 7. 에러 처리

### 에러는 반드시 처리한다

```go
// _ 로 에러를 무시하지 않는다
result, err := doSomething()
if err != nil {
    return fmt.Errorf("작업 실패: %w", err)
}
```

### 에러 메시지 포맷

- 소문자로 시작한다. 마침표를 붙이지 않는다.
- 동사로 시작한다: `"listen on %s: %w"`, `"parse config: %w"`
- 패키지/함수 이름을 반복하지 않는다.

```go
// 좋은 예
return fmt.Errorf("listen on %s: %w", addr, err)
return fmt.Errorf("parse request body: %w", err)

// 나쁜 예
return fmt.Errorf("Error in Proxy.Start(): failed to listen: %w", err)
return fmt.Errorf("리스닝 실패: %w", err)
```

### 에러 래핑

- `%w`로 래핑하여 호출 체인에서 출처를 추적할 수 있게 한다.
- 래핑할 때 현재 수준의 맥락만 추가한다.

### 센티널 에러

- 패키지 레벨 고정 에러는 `Err` 접두사를 사용한다.
- 호출자가 에러 종류를 구분해야 할 때만 정의한다.

```go
var (
    ErrNotFound    = errors.New("not found")
    ErrNotRunning  = errors.New("not running")
)
```

### 커스텀 에러 타입

- 추가 정보(ID, 코드 등)가 필요할 때만 정의한다.
- `Error()` 메서드를 구현한다.

---

## 8. 네이밍

### 변수

- 범위가 좁을수록 짧게. 범위가 넓을수록 명확하게.
- 반복자: `i`, `j`, `k`
- 리더/라이터: `r`, `w`
- 컨텍스트: `ctx`
- 에러: `err`

```go
// 좋은 예
for i, s := range sessions { ... }
r := bytes.NewReader(data)

// 나쁜 예
for sessionIndex, currentSession := range allSessions { ... }
reader := bytes.NewReader(data)
```

### 약어

- 업계 표준 약어는 전체 대문자: `HTTP`, `URL`, `ID`, `TLS`, `TCP`, `UDP`, `API`.
- 필드/변수에서: `HTTPServer`, `userID`, `tlsConfig`

### 불리언

- `is`, `has`, `can`, `should` 접두사를 사용하지 않는다. Go답게 짧게.

```go
// 좋은 예
running bool
closed  bool
enabled bool

// 나쁜 예
isRunning bool
hasClosed bool
```

### 인터페이스

- 메서드가 하나면 `-er` 접미사: `Reader`, `Writer`, `Closer`
- 그 외에는 목적을 나타내는 이름.

---

## 9. 동시성

### goroutine 관리

- goroutine의 시작과 종료가 코드에서 보여야 한다.
- `sync.WaitGroup` 또는 `errgroup.Group`으로 완료를 기다린다.
- 누수(leak)를 방지한다: 채널 닫기, context 취소.

### 채널 vs 뮤텍스

- 데이터 전달: 채널
- 상태 보호: `sync.Mutex` 또는 `sync.RWMutex`
- 버퍼 채널 크기에는 이유가 있어야 한다.

### Graceful Shutdown

- `context.Context` 취소로 종료 신호를 전파한다.
- `defer`로 리소스 정리를 보장한다.
- shutdown 시 진행 중인 요청을 완료한 후 종료한다.

---

## 10. 테스트

### Table-Driven Tests

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

### 테스트 원칙

- 공개 API를 테스트한다. 내부 구현을 테스트하지 않는다.
- 외부 의존은 인터페이스로 모킹한다.
- 테스트 헬퍼는 `t.Helper()`를 호출한다.
- 테스트 파일명: `xxx_test.go`
- 테스트 함수명: `TestXxx`, `TestXxx_SubCase`
- 에러 메시지: `got X, want Y` 포맷

### TDD

1. 실패하는 테스트를 먼저 작성한다.
2. 테스트를 통과하는 최소한의 코드를 작성한다.
3. 리팩터링한다.

### 테스트 데이터

- `testdata/` 디렉터리에 테스트 fixture를 둔다.
- 테스트 데이터 파일은 `.golden` 접미사를 사용한다.

---

## 11. 주석

### 공개 API

- 모든 공개 타입, 함수, 상수에 주석을 단다.
- 주석은 대상의 이름으로 시작한다.

```go
// Proxy is an HTTP proxy server that captures and relays traffic.
type Proxy struct { ... }

// Start begins listening for incoming connections on the configured address.
func (p *Proxy) Start(ctx context.Context) error { ... }
```

### 비공개 코드

- "왜(why)"를 설명할 때만 주석을 단다.
- "무엇(what)"은 코드 자체가 설명해야 한다.

### TODO

- `// TODO(작성자): 설명` 포맷을 사용한다.
- 관련 이슈가 있으면 번호를 포함한다: `// TODO(wonkeun): WON-XX 구현 시 제거`

---

## 12. 프로젝트 구조

```
cmd/                    # 엔트리포인트 (main.go만)
internal/
  app/                  # 조립, Wails 바인딩
  proxy/                # 프록시 엔진
  session/              # 세션 모델, 저장소
  cert/                 # 인증서 관리
  intercept/            # 인터셉터 파이프라인
  rule/                 # 룰 엔진
  config/               # 설정
```

- `cmd/`에는 `main.go`만 둔다. 로직을 넣지 않는다.
- `internal/`에 모든 비즈니스 로직을 둔다.
- `pkg/`는 사용하지 않는다.
- `utils/`, `helpers/`, `common/` 패키지를 만들지 않는다.

---

## 13. 변수 선언

### var vs :=

- 제로값을 의도할 때: `var`
- 초기값이 있을 때: `:=`

```go
// 제로값 의도
var buf bytes.Buffer
var mu sync.Mutex
var sessions []Session

// 초기값 있음
port := 8080
name := "proxy"
config := loadConfig()
```

### 패키지 레벨 변수

- `var` 블록으로 그룹핑한다.
- 가변 전역 변수는 사용하지 않는다. 상수와 센티널 에러만 허용.

```go
var (
    ErrNotFound   = errors.New("not found")
    ErrNotRunning = errors.New("not running")
)
```

---

## 14. 슬라이스와 맵

### nil 슬라이스 vs 빈 슬라이스

- 선언만 할 때: `var s []T` (nil, JSON `null`)
- 빈 결과를 명시적으로 반환할 때: `[]T{}` (JSON `[]`)
- `len(s) == 0`으로 체크한다. `s == nil`로 체크하지 않는다.

```go
// 좋은 예: 나중에 append할 슬라이스
var filtered []int
for _, v := range items {
    if v > 0 {
        filtered = append(filtered, v)
    }
}

// 나쁜 예
filtered := []int{}  // 불필요한 할당
```

### 용량 힌트

- 크기를 알거나 추정할 수 있으면 `make`에 용량을 지정한다.

```go
results := make([]Result, 0, len(items))
```

### 맵

- 맵은 반드시 `make`로 초기화한 후 사용한다.
- 크기를 알면 힌트를 준다.

```go
m := make(map[string]int, len(keys))
```

---

## 15. 문자열

- 루프 내 문자열 연결: `strings.Builder`를 사용한다.
- 포맷팅이 필요할 때: `fmt.Sprintf`
- 단순 연결 2~3개: `+` 연산자 허용.
- `[]byte` ↔ `string` 변환은 복사를 발생시킨다. 불필요한 변환을 피한다.

```go
// 루프 내 연결
var b strings.Builder
for _, s := range parts {
    b.WriteString(s)
}
result := b.String()

// 단순 포맷팅
msg := fmt.Sprintf("listen on %s:%d", host, port)

// 단순 연결
path := dir + "/" + file
```

---

## 16. defer

- 리소스 획득 직후에 `defer`를 배치한다.
- 루프 안에서 `defer`를 사용하지 않는다. 별도 함수로 분리한다.
- `defer`는 LIFO 순서로 실행된다.
- `defer` 내에서 에러를 반환해야 할 때만 named return을 사용한다.

```go
// 좋은 예
f, err := os.Open(path)
if err != nil {
    return err
}
defer f.Close()

// 나쁜 예: 루프 안 defer
for _, path := range paths {
    f, err := os.Open(path)
    defer f.Close()  // 루프 끝날 때까지 안 닫힘
}

// 좋은 예: 루프에서 함수로 분리
for _, path := range paths {
    if err := processFile(path); err != nil { ... }
}
func processFile(path string) error {
    f, err := os.Open(path)
    if err != nil { return err }
    defer f.Close()
    // ...
}
```

---

## 17. panic과 recover

- `panic`은 프로그램 초기화 실패(필수 의존성 누락)에만 허용한다.
- 라이브러리 코드에서 `panic`을 사용하지 않는다. 에러를 반환한다.
- `recover`는 최상위 goroutine 경계(서버의 요청 핸들러 등)에서만 사용한다.
- `log.Fatal`도 `os.Exit`을 호출하므로 main 또는 init에서만 사용한다.

---

## 18. 타입 단언

- 반드시 comma-ok 패턴을 사용한다. 실패 시 panic을 방지한다.

```go
// 좋은 예
v, ok := x.(string)
if !ok {
    return fmt.Errorf("expected string, got %T", x)
}

// 나쁜 예
v := x.(string)  // 실패 시 panic
```

- 여러 타입을 검사할 때는 type switch를 사용한다.

```go
switch v := x.(type) {
case string:
    handleString(v)
case int:
    handleInt(v)
default:
    return fmt.Errorf("unsupported type: %T", x)
}
```

---

## 19. 상수와 Enum

### 상수 그룹핑

- 관련 상수끼리 별도 `const` 블록으로 묶는다.

### iota

- enum의 제로값은 Unknown/Invalid로 두어 미초기화를 감지한다.
- 타입 있는 상수를 사용한다.
- `String()` 메서드를 반드시 구현한다.

```go
type Protocol int

const (
    ProtocolUnknown Protocol = iota
    ProtocolHTTP
    ProtocolTLS
    ProtocolRaw
)

func (p Protocol) String() string {
    switch p {
    case ProtocolHTTP:
        return "http"
    case ProtocolTLS:
        return "tls"
    case ProtocolRaw:
        return "raw"
    default:
        return "unknown"
    }
}
```

---

## 20. 로깅

### 로거

- 전역 로거를 사용하지 않는다. 구조체 필드로 주입한다.
- `log/slog`(표준 라이브러리)를 사용한다.

```go
type Proxy struct {
    logger *slog.Logger
}

func NewProxy(logger *slog.Logger) *Proxy {
    return &Proxy{logger: logger}
}
```

### 로그 레벨

| 레벨 | 사용 기준 |
|------|----------|
| Error | 운영 개입이 필요한 오류. 요청 처리 실패, 리소스 고갈 |
| Warn | 주의가 필요하지만 동작은 계속되는 상황 |
| Info | 주요 상태 변경. 서버 시작/중지, 설정 로드 |
| Debug | 개발/디버깅용. 요청 상세, 내부 상태 |

### 규칙

- 구조화된 키-값 쌍을 사용한다.
- 민감 정보(비밀번호, 토큰, 개인정보)를 로깅하지 않는다.
- 에러 로깅 후 에러를 반환하지 않는다 (둘 중 하나만).

```go
// 좋은 예
p.logger.Info("proxy started", "addr", addr, "port", port)
p.logger.Error("request failed", "err", err, "method", req.Method)

// 나쁜 예
log.Printf("Proxy started on %s:%d", addr, port)  // 전역 로거
p.logger.Error("failed", "err", err)
return err  // 에러 로깅 + 반환 = 중복
```

---

## 21. JSON 태그

- 필드 태그는 snake_case를 사용한다.
- 선택 필드는 `omitempty`를 사용한다.
- 내보내지 않을 필드는 `json:"-"`를 사용한다.

```go
type Session struct {
    ID        string    `json:"id"`
    Protocol  string    `json:"protocol"`
    CreatedAt time.Time `json:"created_at"`
    Duration  int       `json:"duration,omitempty"`
    internal  string    `json:"-"`
}
```

---

## 22. 에러 비교

- `==` 대신 `errors.Is`를 사용한다.
- 타입 단언 대신 `errors.As`를 사용한다.

```go
// 좋은 예
if errors.Is(err, ErrNotFound) { ... }

var nfErr *NotFoundError
if errors.As(err, &nfErr) { ... }

// 나쁜 예
if err == ErrNotFound { ... }
if nfErr, ok := err.(*NotFoundError); ok { ... }
```

---

## 23. 리소스 관리

- `io.Closer`를 구현하는 타입은 `Close()` 에러도 처리한다.
- HTTP 응답 바디는 반드시 닫는다.

```go
resp, err := http.Get(url)
if err != nil {
    return err
}
defer resp.Body.Close()
```

---

## 24. time 처리

- 테스트 용이성을 위해 `time.Now()` 직접 호출 대신 clock 인터페이스를 주입한다.

```go
type Clock interface {
    Now() time.Time
}

type realClock struct{}
func (realClock) Now() time.Time { return time.Now() }
```

- `time.Duration`으로 시간 간격을 표현한다. 초 단위 int를 사용하지 않는다.

---

## 25. Getter/Setter

- Getter: `GetXxx()` 대신 `Xxx()`를 사용한다.
- Setter: `SetXxx()`를 사용한다.

```go
// 좋은 예
func (s *Session) Protocol() string { return s.protocol }
func (s *Session) SetProtocol(p string) { s.protocol = p }

// 나쁜 예
func (s *Session) GetProtocol() string { return s.protocol }
```

---

## 26. else 최소화

- `if-else`에서 else를 줄인다. 에러/예외를 먼저 처리하고 반환한다.
- `if` 블록이 `return`으로 끝나면 `else`를 쓰지 않는다.

```go
// 좋은 예
if err != nil {
    return err
}
// 정상 로직

// 나쁜 예
if err != nil {
    return err
} else {
    // 정상 로직
}
```

---

## 27. 인라인 에러 체크

- 변수가 `if` 블록 안에서만 쓰이면 인라인 선언을 사용한다.

```go
// 좋은 예
if err := validate(req); err != nil {
    return err
}

// 나쁜 예 (err가 if 밖에서 안 쓰이는 경우)
err := validate(req)
if err != nil {
    return err
}
```

---

## 28. HTTP 클라이언트

- `http.DefaultClient`를 사용하지 않는다. 타임아웃을 명시적으로 설정한다.

```go
client := &http.Client{
    Timeout: 30 * time.Second,
}
```

---

## 29. goroutine 안전성 문서화

- 동시성 안전한 타입은 godoc에 명시한다.

```go
// Store is safe for concurrent use by multiple goroutines.
type Store struct { ... }
```

---

## 30. 벤치마크

- 성능 민감 코드(핫 패스, 프록시 요청 처리 등)에 벤치마크를 작성한다.
- `b.ReportAllocs()`를 사용하여 할당 수를 추적한다.

```go
func BenchmarkDetectProtocol(b *testing.B) {
    data := []byte("GET / HTTP/1.1\r\n")
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        DetectProtocol(data)
    }
}
```
