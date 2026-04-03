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
