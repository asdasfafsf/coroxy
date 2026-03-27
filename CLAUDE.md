# Coroxy

Fiddler와 유사한 로컬 네트워크 디버깅 프록시. HTTP/HTTPS, TCP, UDP를 지원하는 크로스플랫폼 standalone GUI 프로그램.

## 참조 문서

- [설계 문서](./DESIGN.md) - 아키텍처, 모듈 설계, 로드맵
- [워크플로우](./docs/workflow.md) - Linear 이슈 관리, 브랜치/커밋 컨벤션
- [Linear API 지시서](./docs/linear.md) - Linear GraphQL API 호출 규칙과 패턴

## 기술 스택

- Go + Wails v2 (GUI)
- React + TypeScript (Frontend)
- goenv로 Go 버전 관리 (.go-version)

## 외부 연동

- **Linear**: `LINEAR_API_KEY` 환경변수로 GraphQL API 호출 (TODO: linear-mcp OAuth 연동)
- **GitHub**: https://github.com/asdasfafsf/coroxy
