# WON-94: 세션 영속 저장을 JSON 파일로

## 문제

세션이 메모리에만 있어서 앱 종료 시 유실. DESIGN.md에서는 SQLite를 계획했으나, 현 시점에서 구현 범위를 결정해야 했다.

## 검토한 대안

| 대안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. SQLite | go-sqlite3로 세션 테이블 관리 | 검색/필터 빠름, 대량 데이터 | CGO 의존, 빌드 복잡, 스키마 관리 |
| B. JSON 파일 | 종료 시 sessions.json에 일괄 저장 | 단순, CGO 불필요, 디버깅 쉬움 | 대량 세션 시 느림, 검색 없음 |
| C. BoltDB/bbolt | 임베디드 KV 스토어 | CGO 불필요, 빠름 | 스키마 없음, 쿼리 불가 |

## 결정

B. JSON 파일. OS별 경로에 sessions.json으로 저장.

## 이유

- 현재 세션 수가 수천 건 이하 → JSON으로 충분
- CGO 의존 없이 크로스 컴파일 유지
- atomic write(tmp → rename)로 파일 손상 방지
- SQLite는 검색/대량 데이터가 필요해질 때 마이그레이션

## OS별 경로

| OS | 경로 |
|----|------|
| macOS | ~/Library/Application Support/Coroxy/sessions/ |
| Windows | %APPDATA%\Coroxy\sessions/ |
| Linux | ~/.local/share/coroxy/sessions/ |

## 참고

- WON-94, PR #95
