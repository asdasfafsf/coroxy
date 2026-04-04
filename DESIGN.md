# Coroxy - 로컬 프록시 프로그램 설계

## Context

Fiddler와 유사한 네트워크 디버깅 프록시 프로그램을 새로 만든다. HTTP/HTTPS뿐 아니라 TCP 스트림, UDP 패킷까지 중계·감시·수정할 수 있어야 하며, 크로스플랫폼 standalone GUI를 제공한다.

---

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| Core | **Go** | goroutine 기반 고성능 네트워크 처리, 크로스 컴파일 용이 |
| GUI Framework | **Wails v2** | Go 백엔드 + OS 네이티브 WebView로 standalone 바이너리 생성. Electron보다 가볍고, 복잡한 UI(hex viewer, inspector 등) 구현에 웹 기술 활용 가능 |
| Frontend | **React + TypeScript** | 컴포넌트 생태계가 풍부하여 복잡한 inspector UI 구현에 적합 |
| 데이터 저장 | **SQLite** (via go-sqlite3) | 세션 저장, 검색, 필터링. 파일 기반이라 설치 불필요 |
| TLS | **crypto/tls + x509** (Go 표준 라이브러리) | HTTPS MITM용 동적 인증서 생성 |

> **Wails 참고**: WebUI가 아님. OS 네이티브 WebView를 내장한 단일 실행 파일로 빌드됨 (macOS: WebKit, Windows: WebView2, Linux: WebKitGTK). Tauri의 Go 버전이라고 생각하면 됨.

---

## 아키텍처 개요

```
┌──────────────────────────────────────────────────────┐
│                    Coroxy App                        │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              GUI (Wails + React)               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │ Session  │ │Inspector │ │  Hex Viewer   │  │  │
│  │  │  List    │ │(Req/Res) │ │ (TCP/UDP raw) │  │  │
│  │  └──────────┘ └──────────┘ └───────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │  Rule    │ │Timeline/ │ │   Settings    │  │  │
│  │  │ Editor   │ │  Stats   │ │  & Certs      │  │  │
│  │  └──────────┘ └──────────┘ └───────────────┘  │  │
│  └──────────────────┬─────────────────────────────┘  │
│                     │ Wails Bindings (IPC)            │
│  ┌──────────────────┴─────────────────────────────┐  │
│  │              Core Engine (Go)                   │  │
│  │                                                 │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │           Listener Layer                │   │  │
│  │  │  ┌─────────┐ ┌──────────┐ ┌─────────┐  │   │  │
│  │  │  │HTTP(S)  │ │ SOCKS5   │ │  UDP    │  │   │  │
│  │  │  │Listener │ │ Listener │ │Listener │  │   │  │
│  │  │  └────┬────┘ └────┬─────┘ └────┬────┘  │   │  │
│  │  └───────┼───────────┼────────────┼────────┘   │  │
│  │          ▼           ▼            ▼            │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │        Protocol Detector                │   │  │
│  │  │  (TLS ClientHello / HTTP Method /       │   │  │
│  │  │   SOCKS handshake / raw bytes)          │   │  │
│  │  └──────────────────┬──────────────────────┘   │  │
│  │                     ▼                          │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │        Interceptor Pipeline             │   │  │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐  │   │  │
│  │  │  │Match │→│Modify│→│Break │→│ Log   │  │   │  │
│  │  │  │Filter│ │ Rule │ │Point │ │Record │  │   │  │
│  │  │  └──────┘ └──────┘ └──────┘ └───────┘  │   │  │
│  │  └──────────────────┬──────────────────────┘   │  │
│  │                     ▼                          │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │          Proxy Handlers                 │   │  │
│  │  │  ┌──────┐ ┌───────┐ ┌─────┐ ┌───────┐  │   │  │
│  │  │  │ HTTP │ │HTTPS  │ │ TCP │ │  UDP  │  │   │  │
│  │  │  │Proxy │ │MITM   │ │Relay│ │  Fwd  │  │   │  │
│  │  │  └──────┘ └───────┘ └─────┘ └───────┘  │   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  │                                                 │  │
│  │  ┌──────────────┐  ┌───────────────────────┐   │  │
│  │  │  CA Manager  │  │   Session Store       │   │  │
│  │  │ (Root CA +   │  │   (SQLite + Memory)   │   │  │
│  │  │  Dynamic)    │  │                       │   │  │
│  │  └──────────────┘  └───────────────────────┘   │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 핵심 모듈 상세 설계

### 1. Listener Layer (진입점)

| Listener | 포트 | 역할 |
|----------|------|------|
| **HTTP(S) Proxy** | 기본 8673 | 브라우저/앱이 HTTP 프록시로 설정하면 여기로 연결. CONNECT 메서드로 HTTPS 터널링 |
| **SOCKS5 Proxy** | 기본 8674 | 임의의 TCP 연결을 중계. DB, gRPC, 커스텀 프로토콜 등 HTTP가 아닌 TCP 트래픽 캡처 |
| **UDP Listener** | 설정 가능 | 특정 포트별 UDP 패킷 포워딩. DNS(53), 게임 트래픽 등 |

### 2. Protocol Detector

첫 수 바이트를 읽어 프로토콜을 자동 감지:

```go
func DetectProtocol(peek []byte) Protocol {
    // TLS: 0x16 0x03 (ClientHello)
    // HTTP: GET, POST, PUT, DELETE, HEAD, OPTIONS, PATCH, CONNECT
    // SOCKS5: 0x05
    // 그 외: Raw TCP
}
```

### 3. Proxy Handlers

#### HTTP Proxy
- HTTP/1.1, HTTP/2 지원
- 요청/응답 헤더·바디 캡처
- 요청 수정 후 전달, 응답 수정 후 반환
- 청크 인코딩, gzip 디코딩 자동 처리

#### HTTPS MITM Proxy
- CONNECT 요청 수신 → 대상 도메인 확인
- CA Manager에서 해당 도메인용 인증서 동적 생성
- 클라이언트와 TLS 핸드셰이크 (가짜 인증서)
- 대상 서버와 실제 TLS 연결
- 복호화된 평문 HTTP 트래픽을 HTTP Proxy와 동일하게 처리

```go
func (p *HTTPSProxy) handleConnect(clientConn net.Conn, host string) {
    // 1. 200 Connection Established 응답
    // 2. CA Manager로 host용 인증서 생성
    // 3. 클라이언트와 TLS 핸드셰이크
    // 4. 대상 서버와 TLS 연결
    // 5. 양방향 평문 HTTP 트래픽 중계 (interceptor pipeline 경유)
}
```

#### TCP Relay
- SOCKS5를 통해 들어온 비-HTTP TCP 연결 중계
- 양방향 바이트 스트림을 chunk 단위로 캡처
- Hex + ASCII 뷰어로 표시
- 바이트 단위 수정 가능 (breakpoint 시)

#### UDP Forwarder
- 설정된 로컬 포트에서 UDP 패킷 수신
- 대상 주소로 포워딩
- 패킷별 캡처 및 표시
- 패킷 내용 수정 가능

### 4. Interceptor Pipeline

모든 트래픽은 Interceptor Pipeline을 거침:

```go
type Interceptor interface {
    // HTTP 트래픽용
    OnRequest(req *http.Request, ctx *SessionContext) Action
    OnResponse(resp *http.Response, ctx *SessionContext) Action
    // TCP 스트림용
    OnTCPData(data []byte, direction Direction, ctx *SessionContext) Action
    // UDP 패킷용
    OnUDPPacket(packet []byte, ctx *SessionContext) Action
}

type Action int
const (
    ActionForward  Action = iota  // 그대로 전달
    ActionModify                   // 수정 후 전달
    ActionDrop                     // 드롭
    ActionBreak                    // GUI에서 사용자 판단 대기
)
```

### 5. Rule Engine

```go
type Rule struct {
    ID        string
    Name      string
    Enabled   bool
    Match     MatchCondition  // 어떤 트래픽에 적용할지
    Action    RuleAction      // 무엇을 할지
    Priority  int
}

type MatchCondition struct {
    Protocol  []string   // http, https, tcp, udp
    Host      string     // 와일드카드: *.example.com
    Port      int
    Path      string     // HTTP 경로 패턴
    Method    string     // HTTP 메서드
    BodyRegex string     // 바디 매칭
}

type RuleAction struct {
    Type       string    // modify_header, modify_body, auto_respond, delay, drop, breakpoint
    Parameters map[string]interface{}
}
```

### 6. CA Manager

```go
type CAManager struct {
    rootCA    *x509.Certificate
    rootKey   *rsa.PrivateKey
    certCache *lru.Cache  // host → *tls.Certificate (LRU, 최대 256개)
    dataDir   string      // ~/.coroxy/
}

// 생성: NewCAManager(dataDir) — CA 파일 존재 시 로드, 없으면 생성
//   로드 시 유효성 검증: PEM 파싱, 공개키-개인키 쌍 일치, 만료 여부 확인
//   검증 실패 시 에러 반환 → GUI에서 "Regenerate CA" 안내
// 인증서: IssueCert(host, originalCert) — 원본 인증서의 CN/SAN(와일드카드 포함) 복제하여 Leaf 생성
//   동일 호스트 동시 요청은 singleflight로 중복 생성 방지
//   캐시 키는 요청된 host 그대로 사용 (예: api.example.com)
// 신뢰: InstallCA() / UninstallCA() / IsCAInstalled() — smallstep/truststore 활용
// Firefox: InstallCA 시 Firefox 프로필 자동 탐지 + NSS certutil로 설치
// Export: ExportCA() — ca.crt(인증서)만 export. 개인키는 절대 export하지 않는다
```

**adapter 인터페이스** (`adapter/cert.go`에 정의):
```go
type CAManager interface {
    IssueCert(host string, originalCert *x509.Certificate) (*tls.Certificate, error)
    InstallCA() error
    UninstallCA() error
    IsCAInstalled() (bool, error)
    CAInfo() model.CAInfo
    ExportCA(path string) error
}
```

**CA 파일 구조:**
```
~/.coroxy/
├── ca.crt          # Root CA 인증서 (PEM)
├── ca.key          # Root CA 개인키 (PEM, 파일 권한 0600)
└── ca-meta.json    # 생성일, 만료일, 지문 등 메타데이터
```

**Certificate Pinning**: pinning을 사용하는 앱은 MITM 불가. TLS 핸드셰이크 실패 시 에러 세션으로 기록.

**HTTP/2**: Phase 2는 HTTP/1.1만 지원. HTTP/2 MITM은 ALPN 협상 복잡성으로 별도 이슈 분리.

### 7. Session Store

```go
type Session struct {
    ID         string
    Protocol   string        // http, https, tcp, udp
    Timestamp  time.Time
    Source     Endpoint       // client ip:port
    Target     Endpoint       // server host:port

    // HTTP 전용
    Request    *HTTPMessage
    Response   *HTTPMessage

    // TCP 전용
    TCPFrames  []TCPFrame     // 양방향 데이터 청크들

    // UDP 전용
    UDPPackets []UDPPacket

    Duration   time.Duration
    State      string         // active, completed, error
    Tags       []string       // 사용자 태그
}
```

- **메모리**: 활성 세션은 메모리에 유지
- **SQLite**: 세션 영속 저장, 검색/필터링 쿼리
- **Export**: HAR (HTTP), PCAP-like (TCP/UDP), JSON

---

## GUI 화면 구성

### 메인 레이아웃 (3-패널)

```
┌─────────────────────────────────────────────────────────┐
│ [Menu] File  Edit  Rules  Tools  Help        [Settings] │
├─────────────────────────────────────────────────────────┤
│ Toolbar: [Start/Stop] [Clear] [Filter▼] [Search...]    │
├────────────────────────────────┬────────────────────────┤
│                                │                        │
│      Session List (좌측)       │    Inspector (우측)     │
│                                │                        │
│  # │ Proto │ Host     │Status │  ┌──────────────────┐  │
│  1 │ HTTPS │ api.ex.. │ 200   │  │ [Headers] [Body] │  │
│  2 │ HTTP  │ cdn.ex.. │ 304   │  │ [Raw] [Hex] [WS] │  │
│  3 │ TCP   │ db.lo..  │ ──    │  │                  │  │
│  4 │ UDP   │ dns.go.. │ ──    │  │ Request ────────│  │
│  5 │ HTTPS │ api.ex.. │ 500   │  │ GET /api/users  │  │
│  ..│       │          │       │  │ Host: api.ex... │  │
│                                │  │ Auth: Bearer... │  │
│                                │  │                  │  │
│                                │  │ Response ───────│  │
│                                │  │ 200 OK          │  │
│                                │  │ {"data": [...]} │  │
│                                │  │                  │  │
│                                │  └──────────────────┘  │
├────────────────────────────────┴────────────────────────┤
│ Status: Listening on :8673 (HTTP) :8674 (SOCKS5)  │ 42 │
└─────────────────────────────────────────────────────────┘
```

### Inspector 탭 구성

| 탭 | 용도 |
|----|------|
| **Headers** | HTTP 요청/응답 헤더 트리뷰 |
| **Body** | 포맷된 바디 (JSON 하이라이팅, 이미지 미리보기, XML 등) |
| **Raw** | 원시 HTTP 메시지 텍스트 |
| **Hex** | TCP/UDP 바이트 hex dump + ASCII (Wireshark 스타일) |
| **WebSocket** | WS 프레임 목록 |
| **Timeline** | 요청/응답 타이밍 워터폴 차트 |

---

## 프로젝트 디렉터리 구조

```
coroxy/
├── main.go                          # Wails 엔트리포인트 (조립만, 로직 없음)
├── go.mod
├── go.sum
├── wails.json                       # Wails 빌드 설정
├── build/                           # 빌드 에셋 (아이콘 등)
│
├── internal/
│   ├── app/
│   │   └── app.go                   # Wails 바인딩 구조체, GUI↔Core 브릿지
│   │
│   ├── adapter/                     # 공유 인터페이스 (의존성 역전 계층)
│   │   ├── proxy.go                 # ProxyEngine 인터페이스
│   │   ├── session.go               # SessionStore 인터페이스
│   │   └── intercept.go             # Interceptor 인터페이스
│   │
│   ├── model/                       # 공유 데이터 구조체
│   │   ├── session.go               # Session, HTTPMessage
│   │   ├── rule.go                  # Rule, MatchCondition
│   │   └── endpoint.go              # Endpoint, TCPFrame, UDPPacket
│   │
│   ├── constant/                    # enum, 프로토콜 상수
│   │   ├── protocol.go              # Protocol (HTTP, HTTPS, TCP, UDP)
│   │   └── state.go                 # SessionState, Action
│   │
│   ├── errdefs/                     # 공유 에러 (도메인별 파일 분리)
│   │   ├── session.go               # 세션 관련 에러
│   │   └── proxy.go                 # 프록시 관련 에러
│   │
│   ├── proxy/
│   │   ├── engine.go                # 프록시 엔진 (시작/중지/설정)
│   │   ├── listener.go              # 리스너 관리
│   │   ├── http.go                  # HTTP 프록시 핸들러
│   │   ├── https.go                 # HTTPS MITM 핸들러
│   │   ├── tcp.go                   # TCP 릴레이 핸들러
│   │   ├── udp.go                   # UDP 포워더 핸들러
│   │   ├── websocket.go             # WebSocket 프록시
│   │   └── detector.go              # 프로토콜 감지
│   │
│   ├── intercept/
│   │   ├── pipeline.go              # 인터셉터 파이프라인
│   │   ├── breakpoint.go            # 브레이크포인트 (GUI 연동)
│   │   ├── modifier.go              # 트래픽 수정기
│   │   └── autoresponder.go         # 자동 응답기
│   │
│   ├── rule/
│   │   ├── engine.go                # 룰 매칭 엔진
│   │   └── store.go                 # 룰 저장/로드
│   │
│   ├── cert/
│   │   ├── ca.go                    # Root CA 생성/관리
│   │   ├── dynamic.go               # 동적 인증서 생성
│   │   └── trust.go                 # OS 신뢰 저장소 설치
│   │
│   ├── session/
│   │   ├── store.go                 # 세션 저장소 (메모리 + SQLite)
│   │   └── export.go                # HAR/JSON/PCAP 내보내기
│   │
│   └── config/
│       └── config.go                # 앱 설정 (YAML)
│
├── frontend/                        # React + TypeScript
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── SessionList/         # 세션 목록 테이블
│   │   │   ├── Inspector/           # 요청/응답 인스펙터
│   │   │   ├── HexViewer/           # Hex dump 뷰어
│   │   │   ├── RuleEditor/          # 룰 편집기
│   │   │   ├── Timeline/            # 타이밍 차트
│   │   │   ├── Toolbar/             # 상단 툴바
│   │   │   └── Settings/            # 설정 화면
│   │   ├── hooks/                   # Wails 바인딩 hooks
│   │   ├── stores/                  # Zustand 상태 관리
│   │   └── types/                   # TypeScript 타입 정의
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── configs/
│   └── default.yaml                 # 기본 설정 파일
│
└── scripts/
    ├── install-ca.sh                # macOS/Linux CA 설치
    └── install-ca.ps1               # Windows CA 설치
```

---

## 데이터 흐름 시나리오

### 시나리오 1: HTTPS 요청 캡처

```
Browser                 Coroxy                    Server
   │                      │                         │
   │── CONNECT api.ex ──→ │                         │
   │←── 200 Established ──│                         │
   │                      │                         │
   │── TLS ClientHello ──→│                         │
   │   (Coroxy가 가짜     │── TLS ClientHello ────→│
   │    인증서로 응답)     │←── TLS ServerHello ────│
   │←── TLS ServerHello ──│                         │
   │                      │                         │
   │── GET /api/users ──→ │                         │
   │   [Interceptor Pipeline 실행]                  │
   │   - Rule 매칭                                  │
   │   - Breakpoint 체크                            │
   │   - 수정 적용                                  │
   │   - Session 기록                               │
   │                      │── GET /api/users ─────→│
   │                      │←── 200 OK ─────────────│
   │   [Interceptor Pipeline 실행]                  │
   │←── 200 OK ───────────│                         │
```

### 시나리오 2: TCP 스트림 캡처 (SOCKS5)

```
App                     Coroxy (SOCKS5)             DB Server
   │                      │                            │
   │── SOCKS5 Handshake ─→│                            │
   │←── Auth OK ──────────│                            │
   │── Connect db:5432 ──→│                            │
   │                      │── TCP Connect ───────────→│
   │←── Connected ────────│←── Connected ─────────────│
   │                      │                            │
   │── [PostgreSQL wire  ─→│  [캡처 + Hex 표시]        │
   │    protocol bytes]   │── [forward] ─────────────→│
   │                      │←── [response bytes] ──────│
   │←── [response] ───────│  [캡처 + Hex 표시]        │
```

---

## 전체 로드맵

### Phase 1: Foundation
- 1-1. 프록시 엔진 스켈레톤 (`internal/proxy/engine.go` - Start/Stop/Config)
- 1-2. HTTP 리스너 + 기본 포워드 프록시 (`internal/proxy/http.go`)
- 1-3. 세션 모델 정의 (`internal/session/session.go`)
- 1-4. 메모리 세션 스토어 (`internal/session/store.go`)
- 1-5. Wails 바인딩 - 프록시 제어 API (`internal/app/app.go`)
- 1-6. Wails 이벤트 - 실시간 세션 푸시
- 1-7. GUI: 메인 레이아웃 (좌측 세션 목록 + 우측 빈 패널)
- 1-8. GUI: 세션 목록 테이블 (프로토콜, 호스트, 상태코드, 시간)
- 1-9. GUI: 툴바 (Start/Stop, Clear)
- 1-10. GUI: 상태바

### Phase 2: HTTPS MITM & CA 관리

#### CA 인증서 관리

**CA 생성:**
- 첫 실행 시 Root CA 자동 생성 (RSA 3072-bit, SHA256, 유효기간 3년)
- 저장 위치: `~/.coroxy/ca.crt` (인증서), `~/.coroxy/ca.key` (개인키)
- 설치별 고유 CA (보안상 다른 기기와 공유 금지)
- CA 만료 시 재생성 + 기존 CA 자동 제거 후 새 CA 설치 안내

**Leaf 인증서 (동적 생성):**
- CONNECT 요청 시 대상 서버에 먼저 연결하여 원본 인증서 정보(CN, SAN) 획득
- 해당 정보로 Leaf 인증서 생성 (RSA 2048-bit), Root CA로 서명
- 인메모리 LRU 캐시 (최대 256개)

**OS 신뢰 저장소 등록:**
- `smallstep/truststore` 라이브러리 활용 (mkcert 기반)
- macOS: `security add-trusted-cert` — 관리자 비밀번호 프롬프트 불가피
- Windows: `crypt32.dll` API 직접 호출 — UAC 프롬프트
- Linux: `/usr/local/share/ca-certificates/` + `update-ca-certificates` (Debian/Ubuntu), `/etc/pki/ca-trust/source/anchors/` + `update-ca-trust` (RHEL/Fedora)

**Firefox 별도 처리:**
- Firefox는 OS 신뢰 저장소를 무시하고 자체 NSS cert9.db 사용
- NSS `certutil`로 각 Firefox 프로필에 CA 설치
- 프로필 경로 자동 탐지: `~/Library/Application Support/Firefox/Profiles/*` (macOS), `~/.mozilla/firefox/*` (Linux), `%APPDATA%\Mozilla\Firefox\Profiles` (Windows)

**CA 상태 관리:**
- 앱 시작 시 CA 존재 여부 + OS 신뢰 여부 자동 탐지
- GUI에 CA 상태 표시: "미설치" / "설치됨" / "만료됨"
- 원클릭 설치/제거 버튼
- 앱 제거 시 CA 정리 로직 제공 (다른 프록시 도구들이 안 하는 차별점)

**CA 관리 화면 (Settings > Certificates):**
- Root CA 상태 (생성일, 만료일, 지문)
- "Install CA" / "Uninstall CA" 버튼
- "Export CA" (다른 기기/브라우저용 수동 설치)
- "Regenerate CA" (강제 재생성)

#### HTTPS MITM 흐름

```
Browser                 Coroxy                    Server
   │── CONNECT host ──→ │                         │
   │←── 200 Established ──│                       │
   │                      │── TLS ClientHello ──→ │
   │                      │←── TLS ServerHello ──│
   │                      │   (원본 인증서 정보 획득)│
   │                      │                       │
   │   (Coroxy가 host용   │                       │
   │    Leaf 인증서 생성)  │                       │
   │── TLS ClientHello ──→│                       │
   │←── TLS ServerHello ──│ (Leaf 인증서로 응답)   │
   │                      │                       │
   │── GET /api/users ──→ │── GET /api/users ──→ │
   │   [복호화된 평문 캡처] │                      │
   │                      │←── 200 OK ──────────│
   │←── 200 OK ──────────│ [복호화된 평문 캡처]   │
```

#### 작업 항목

- 2-1. CA Manager: Root CA 생성/로드/저장 (`internal/cert/ca.go`)
- 2-2. CA Manager: OS 신뢰 저장소 등록/제거/상태 확인 (`internal/cert/trust.go`)
- 2-3. CA Manager: Firefox NSS 처리 (`internal/cert/trust.go` 내 Firefox 분기)
- 2-4. 동적 Leaf 인증서 생성 + LRU 캐시 (`internal/cert/dynamic.go`)
- 2-5. HTTPS MITM 핸들러 — CONNECT 가로채기 → TLS 핸드셰이크 → 복호화 캡처 (`internal/proxy/https.go`)
- 2-6. 프로토콜 디텍터 (`internal/proxy/detector.go`)
- 2-7. Wails 바인딩: CA 관리 API (InstallCA/UninstallCA/GetCAStatus)
- 2-8. GUI: Settings > Certificates 화면
- 2-9. GUI: Inspector - Headers 탭 (기능 우선, UI 후순위)
- 2-10. GUI: Inspector - Body 탭 (기능 우선, UI 후순위)
- 2-11. GUI: Inspector - Raw 탭 (기능 우선, UI 후순위)

### Phase 3: TCP & UDP
- 3-1. SOCKS5 핸드셰이크 구현 (`internal/proxy/socks5.go`)
- 3-2. TCP 릴레이 + 바이트 캡처 (`internal/proxy/tcp.go`)
- 3-3. UDP 포워더 (`internal/proxy/udp.go`)
- 3-4. TCP/UDP 세션 모델 확장
- 3-5. GUI: Hex Viewer 컴포넌트
- 3-6. GUI: TCP/UDP 세션 표시 통합

### Phase 4: Rules & Interception
- 4-1. Interceptor 인터페이스 + 파이프라인 (`internal/intercept/pipeline.go`)
- 4-2. Rule 모델 + 매칭 엔진 (`internal/rule/`)
- 4-3. 트래픽 수정기 (`internal/intercept/modifier.go`)
- 4-4. 자동 응답기 (`internal/intercept/autoresponder.go`)
- 4-5. 브레이크포인트 (GUI 연동) (`internal/intercept/breakpoint.go`)
- 4-6. GUI: Rule Editor
- 4-7. GUI: Breakpoint 편집 다이얼로그

### Phase 5: Polish
- 5-1. SQLite 세션 영속 저장
- 5-2. HAR Export/Import
- 5-3. JSON Export
- 5-4. GUI: Timeline 워터폴 차트
- 5-5. WebSocket 프록시 (`internal/proxy/websocket.go`)
- 5-6. GUI: WebSocket 프레임 뷰어
- 5-7. 시스템 프록시 자동 설정 (macOS/Windows/Linux)
- 5-8. GUI: 필터 + 검색
- 5-9. 설정 파일 (YAML) 로드/저장
- 5-10. 성능 최적화 + 대량 세션 가상 스크롤
