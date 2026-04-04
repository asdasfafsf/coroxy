# WON-28: 공유 타입 패키지 구조 결정

## 문제

여러 패키지가 동일한 타입을 사용해야 한다 (예: `Session`을 proxy, session store, Wails 바인딩에서 모두 참조). 타입이 특정 기능 패키지에 들어가면 순환 의존이 발생할 위험이 있고, 구조 변경이 어려워진다.

## 검토한 대안

| 대안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| 루트 패키지 (Caddy/WTF 스타일) | `package coroxy`에 도메인 타입 배치 | Go 커뮤니티에서 검증됨, Ben Johnson 추천 | Wails 프로젝트라 루트에 `main.go`+`app.go`가 있어 적용 불가 |
| `internal/domain/` 단일 패키지 | DDD 스타일 | 단순함 | 커지면 God package 위험, 실제 Go 프로젝트에서 거의 안 쓰임 |
| 기능 패키지 내 동거 (go-mitmproxy 스타일) | `proxy/` 안에 타입 포함 | 패키지 수 적음 | 순환 의존 위험, 분리 어려움 |
| 역할별 3분리 (sing-box 스타일) | `adapter/`(인터페이스) + `model/`(구조체) + `constant/`(상수/enum) | 역할 명확, 독립 관리, 구조 변경 용이 | 패키지 수 증가 |

## 참고한 프로젝트

- **goproxy** (6.6K stars) — 루트 패키지
- **go-mitmproxy** (1.5K) — 핵심 패키지 동거
- **chisel** (15.8K) — `share/` 분리
- **frp** (105K) — `pkg/msg/`, `pkg/config/` 분리
- **mihomo/Clash** (28K) — `constant/` 단일
- **sing-box** (32K) — `adapter/` + `option/` + `constant/` 3분리 (가장 체계적)

## 결정

sing-box식 역할별 3분리를 채택한다.

```
internal/
├── adapter/     # 인터페이스 (ProxyEngine, SessionStore, Interceptor 등)
├── model/       # 데이터 구조체 (Session, HTTPMessage, Rule 등)
├── constant/    # enum, 프로토콜 상수 (Protocol, SessionState 등)
├── proxy/       # adapter 구현
├── session/     # adapter 구현
├── ...
```

의존 방향: 구현 패키지 → `adapter/`, `model/`, `constant/` (역방향 없음)

## 이유

1. **구조 변경 용이성**: 인터페이스, 데이터, 상수가 분리되어 있으면 각각 독립적으로 리팩터링 가능
2. **순환 의존 원천 차단**: 공유 타입 패키지는 다른 내부 패키지를 import하지 않음 (의존성 트리의 잎)
3. **역할 명확성**: "이 타입이 어디에 있지?" → 인터페이스면 adapter, 구조체면 model, 상수면 constant
4. **실증된 패턴**: sing-box (32K stars)에서 검증됨
5. **Wails 제약 호환**: 루트 패키지 패턴을 쓸 수 없는 Wails 프로젝트에서 가장 자연스러운 대안
6. **code.md `models` 금지 규칙과의 관계**: `models`(복수형, 무분별한 모음)가 문제이지, `model`(단수형, 명확한 역할)은 sing-box의 `option/`과 같은 역할

## 참고

- Linear: WON-28
- [Ben Johnson - Standard Package Layout](https://medium.com/@benbjohnson/standard-package-layout-7cdbc8391fc1)
- [sing-box GitHub](https://github.com/SagerNet/sing-box)
- [Go 공식 모듈 레이아웃](https://go.dev/doc/modules/layout)
