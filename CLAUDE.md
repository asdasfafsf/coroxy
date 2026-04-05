# Coroxy

Fiddler와 유사한 로컬 네트워크 디버깅 프록시. HTTP/HTTPS, TCP, UDP를 지원하는 크로스플랫폼 standalone GUI 프로그램.

프로젝트 설계는 @DESIGN.md 를 참조한다.

## 커맨드

`.claude/commands/` 에 정의됨:
- `/dev-start` — wails dev 실행 + 시스템 프록시 ON
- `/dev-stop` — 시스템 프록시 OFF + wails 종료
- `/work {WON-번호 또는 설명}` — 이슈 → 브랜치 → 코드 → 커밋 → PR → 머지 → Linear Done 전체 워크플로우

## 규칙

`.claude/rules/` 에 자동 로드됨:
- `git.md` — Git 브랜치, 커밋, PR, 머지 규칙
- `linear.md` — Linear 이슈 관리 규칙 + 프로젝트 설정값

## 빠른 참조

```
브랜치: {type}/WON-{번호}
        type: feature, fix, refactor, chore, docs, test, hotfix
```

```
커밋:   [WON-{번호}] {type}: {설명}
        type: feat, fix, refactor, chore, docs, test
```

## 기술 스택

- Go + Wails v2 (GUI)
- React + TypeScript (Frontend)
- goenv로 Go 버전 관리 (.go-version)

## 외부 연동

- **Linear**: `LINEAR_API_KEY` 환경변수로 GraphQL API 호출 (TODO: linear-mcp OAuth 연동)
- **GitHub**: https://github.com/asdasfafsf/coroxy
