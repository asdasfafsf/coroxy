# Go 코딩 규칙

Go 코드를 작성할 때 반드시 따르는 규칙. Effective Go, Google/Uber Go Style Guide 기반.

## 설계 원칙

### 단순함을 우선한다

- 추상화는 필요할 때만 도입한다. 미래를 위한 설계를 하지 않는다.
- 같은 패턴이 3번 반복되기 전에는 추상화하지 않는다.
- 코드를 읽는 사람이 5초 안에 의도를 파악할 수 있어야 한다.

### Composition over Inheritance

- Go에는 상속이 없다. 구조체 임베딩과 인터페이스 조합을 사용한다.
- 큰 인터페이스보다 작은 인터페이스를 조합한다.

```go
// 좋은 예: 작은 인터페이스
type Reader interface { Read(p []byte) (n int, err error) }
type Writer interface { Write(p []byte) (n int, err error) }
type ReadWriter interface { Reader; Writer }

// 나쁜 예: 큰 인터페이스
type Everything interface {
    Read(p []byte) (n int, err error)
    Write(p []byte) (n int, err error)
    Close() error
    Flush() error
    Reset()
}
```

### Accept Interfaces, Return Structs

- 함수의 매개변수는 인터페이스를 받는다 (유연성).
- 함수의 반환값은 구체 타입을 반환한다 (명확성).

```go
// 좋은 예
func NewProxy(listener net.Listener, logger Logger) *Proxy { ... }

// 나쁜 예
func NewProxy(listener net.Listener, logger Logger) ProxyInterface { ... }
```

### 의존성 방향

```
cmd/ (엔트리포인트)
  → internal/app/ (조립, 바인딩)
    → internal/proxy/ (비즈니스 로직)
      → internal/session/ (도메인 모델)
```

- 의존성은 항상 안쪽(도메인)을 향한다.
- 도메인 모델은 외부 패키지에 의존하지 않는다.
- 외부 의존(DB, 네트워크)은 인터페이스로 추상화하고 주입한다.

---

## 패키지 설계

### 이름

- 패키지 이름은 짧고, 소문자, 한 단어로 한다.
- 패키지 이름은 내용물이 아닌 목적을 나타낸다.

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
```

### 캡슐화

- `internal/`을 사용하여 패키지를 외부에 노출하지 않는다.
- 공개 API는 최소화한다. 내보낼 필요 없으면 소문자로 시작한다.

### 순환 의존 금지

- 패키지 간 순환 의존이 발생하면 설계가 잘못된 것이다.
- 인터페이스를 상위 패키지에 정의하거나 별도 패키지로 분리하여 해결한다.

---

## 인터페이스 설계

### 작게 유지한다

- 인터페이스는 1~3개 메서드가 이상적이다.
- 인터페이스가 커지면 분리한다.

### 소비자 측에서 정의한다

- 인터페이스는 그것을 사용하는 쪽에서 정의한다.
- 구현하는 쪽에서 미리 정의하지 않는다.

```go
// proxy 패키지에서 session 저장소가 필요할 때
// proxy/handler.go
type SessionStore interface {
    Save(s *session.Session) error
    Get(id string) (*session.Session, error)
}

// session 패키지는 인터페이스를 모른다. 구체 타입만 구현한다.
// session/store.go
type MemoryStore struct { ... }
func (m *MemoryStore) Save(s *Session) error { ... }
func (m *MemoryStore) Get(id string) (*Session, error) { ... }
```

---

## 에러 처리

### 에러는 항상 처리한다

```go
// 좋은 예
if err != nil {
    return fmt.Errorf("프록시 시작 실패: %w", err)
}

// 나쁜 예
result, _ := doSomething()
```

### 에러 래핑

- `fmt.Errorf("컨텍스트: %w", err)`로 래핑하여 맥락을 추가한다.
- 호출 체인에서 에러의 출처를 추적할 수 있어야 한다.

### 커스텀 에러 타입

- 호출자가 에러 종류에 따라 다른 처리를 해야 할 때만 커스텀 에러를 정의한다.

```go
type NotFoundError struct {
    Resource string
    ID       string
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s not found: %s", e.Resource, e.ID)
}
```

### 센티널 에러

- 패키지 수준에서 고정된 에러 값이 필요할 때 사용한다.

```go
var (
    ErrSessionNotFound = errors.New("session not found")
    ErrProxyNotRunning = errors.New("proxy is not running")
)
```

---

## 함수 설계

### 작게 유지한다

- 하나의 함수는 하나의 일만 한다.
- 30줄을 넘기면 분리를 고려한다.

### 매개변수

- 매개변수는 5개 이하로 유지한다.
- 많아지면 옵션 구조체나 Functional Options 패턴을 사용한다.

```go
// Functional Options 패턴
type Option func(*Proxy)

func WithPort(port int) Option {
    return func(p *Proxy) { p.port = port }
}

func WithLogger(l Logger) Option {
    return func(p *Proxy) { p.logger = l }
}

func NewProxy(opts ...Option) *Proxy {
    p := &Proxy{port: 8080} // 기본값
    for _, opt := range opts {
        opt(p)
    }
    return p
}
```

### Context 전파

- 외부 I/O를 수행하는 함수는 첫 번째 매개변수로 `context.Context`를 받는다.
- Context는 구조체에 저장하지 않는다 (요청 범위로만 사용).

```go
func (p *Proxy) HandleRequest(ctx context.Context, req *http.Request) error { ... }
```

---

## 동시성

### goroutine

- goroutine의 생명주기를 명확히 관리한다. 시작과 종료가 보여야 한다.
- `sync.WaitGroup` 또는 `errgroup.Group`으로 goroutine 완료를 기다린다.

### 채널

- 채널은 goroutine 간 통신에 사용한다. 동기화에는 `sync.Mutex`를 사용한다.
- 버퍼 채널의 크기에는 이유가 있어야 한다.

### 종료 처리

- `context.Context`의 취소를 통해 graceful shutdown을 구현한다.
- 리소스 정리는 `defer`로 보장한다.

```go
func (p *Proxy) Start(ctx context.Context) error {
    g, ctx := errgroup.WithContext(ctx)

    g.Go(func() error {
        return p.httpServer.Serve(ctx)
    })

    g.Go(func() error {
        <-ctx.Done()
        return p.httpServer.Shutdown(context.Background())
    })

    return g.Wait()
}
```

---

## 테스트

### Table-Driven Tests

- 테스트는 테이블 기반으로 작성한다.

```go
func TestDetectProtocol(t *testing.T) {
    tests := []struct {
        name     string
        input    []byte
        expected Protocol
    }{
        {"HTTP GET", []byte("GET / HTTP/1.1"), ProtocolHTTP},
        {"TLS ClientHello", []byte{0x16, 0x03}, ProtocolTLS},
        {"Unknown", []byte{0x00, 0x01}, ProtocolRaw},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := DetectProtocol(tt.input)
            if got != tt.expected {
                t.Errorf("got %v, want %v", got, tt.expected)
            }
        })
    }
}
```

### 테스트 원칙

- 공개 API를 테스트한다. 내부 구현을 테스트하지 않는다.
- 외부 의존(네트워크, DB)은 인터페이스로 모킹한다.
- 테스트 헬퍼는 `t.Helper()`를 호출한다.
- 테스트 파일은 `_test.go` 접미사를 사용한다.

### TDD 사이클

1. 실패하는 테스트를 먼저 작성한다.
2. 테스트를 통과하는 최소한의 코드를 작성한다.
3. 리팩터링한다.

---

## 네이밍

### 변수/함수

- 짧고 명확하게. Go는 짧은 이름을 선호한다.
- 범위가 좁을수록 이름도 짧게.

```go
// 좋은 예
func (s *Store) Get(id string) (*Session, error)
for i, v := range items { ... }

// 나쁜 예
func (sessionStore *SessionStore) GetSessionByID(sessionID string) (*Session, error)
for index, value := range itemsList { ... }
```

### 약어

- 업계 표준 약어는 대문자로 유지한다: `HTTP`, `URL`, `ID`, `TLS`, `TCP`.
- `httpServer` (X) → `HTTPServer` (O)

### 리시버

- 리시버 이름은 타입의 첫 글자 1~2자로 한다.
- `self`, `this`를 사용하지 않는다.

```go
func (p *Proxy) Start() error { ... }
func (s *Session) Duration() time.Duration { ... }
```

---

## 프로젝트 구조

```
cmd/                    # 엔트리포인트
internal/
  app/                  # Wails 바인딩, 조립
  proxy/                # 프록시 엔진 (핵심 비즈니스 로직)
  session/              # 세션 모델, 저장소
  cert/                 # 인증서 관리
  intercept/            # 인터셉터 파이프라인
  rule/                 # 룰 엔진
  config/               # 설정
```

### 규칙

- `cmd/`에는 `main.go`만 둔다. 로직을 넣지 않는다.
- `internal/`에 모든 비즈니스 로직을 둔다.
- `pkg/`는 사용하지 않는다 (외부에 공개할 라이브러리가 없으므로).
- `utils/`, `helpers/`, `common/` 패키지를 만들지 않는다.
