# WON-32: HTTP 포워드 프록시 구현 시 의사결정

## 문제

HTTP 포워드 프록시를 구현하면서 코드 리뷰에서 여러 설계/구현 이슈가 발견되었다. 각 이슈에 대해 표준 패턴을 선택해야 했다.

## 의사결정 목록

### 1. CONNECT 응답 방식: WriteHeader vs Hijack 후 직접 write

- **문제**: `w.WriteHeader(200)` 후 `Hijack()`하면 응답이 flush되지 않을 수 있다
- **결정**: Hijack 먼저 하고, raw connection에 `HTTP/1.1 200 Connection Established\r\n\r\n`을 직접 write
- **이유**: 표준 CONNECT 프록시 구현 패턴. 모든 주요 Go 프록시 라이브러리(goproxy, martian)가 이 방식 사용

### 2. TCP relay 종료 시 conn 정리

- **문제**: 양방향 relay에서 한쪽이 끝나도 다른 쪽이 io.Copy에서 블로킹
- **결정**: 각 goroutine에서 양쪽 conn 모두 defer Close
- **이유**: 한쪽 conn.Close() 시 상대방 io.Copy가 에러로 즉시 종료됨. 별도 신호 채널 없이 깔끔하게 정리

### 3. Engine context 전파

- **문제**: `context.WithCancel`에서 파생 context를 버리고 cancel만 저장하면 취소 신호가 전파되지 않음
- **결정**: `http.Server.BaseContext`에 파생 context를 설정하여 모든 HTTP 핸들러에 전파
- **이유**: Engine.Stop() → cancel() → 핸들러의 r.Context() 취소 → 진행 중 요청 정리. graceful shutdown의 핵심 경로

### 4. goroutine 완료 대기

- **문제**: `go func()`으로 서버를 실행하지만 Stop에서 goroutine 종료를 기다리지 않음
- **결정**: `sync.WaitGroup` 추가. Stop에서 mu.Unlock() → wg.Wait() → mu.Lock() 패턴
- **이유**: code.md 규칙 9 "goroutine 시작과 종료가 코드에서 보여야 한다" 준수. Shutdown 후 Serve goroutine이 완전히 종료될 때까지 대기

### 5. CONNECT Host 포트 기본값

- **문제**: 클라이언트가 포트 없이 `CONNECT example.com`을 보내면 연결 실패
- **결정**: `net.SplitHostPort` 실패 시 포트 443을 기본값으로 추가
- **이유**: HTTPS 터널링 용도의 CONNECT는 443이 사실상 표준. 모든 주요 프록시가 이렇게 동작

## 참고

- Linear: WON-32
- PR: https://github.com/asdasfafsf/coroxy/pull/30
