# Coroxy

Fiddler와 유사한 로컬 네트워크 디버깅 프록시. HTTP/HTTPS(MITM), TCP, UDP 트래픽을 캡처·감시·수정할 수 있는 크로스플랫폼 standalone GUI 프로그램.

## 기술 스택

- **Backend**: Go (goroutine 기반 프록시 엔진)
- **GUI**: Wails v2 (OS 네이티브 WebView)
- **Frontend**: React + TypeScript + Vite
- **데이터**: SQLite (세션 저장)

## 요구 사항

- Go 1.26+ ([goenv](https://github.com/go-nv/goenv) 권장, `.go-version` 참조)
- Node.js 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2

## 설치

```bash
# 리포지토리 클론
git clone https://github.com/asdasfafsf/coroxy.git
cd coroxy

# Go 버전 확인 (goenv 사용 시 자동 적용)
go version

# Wails CLI 설치
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 프론트엔드 의존성 설치
cd frontend && npm install && cd ..

# Git hooks 활성화
git config core.hooksPath .githooks
```

## 개발

```bash
# 개발 서버 실행 (Hot Reload)
wails dev

# 프론트엔드만 개발 (브라우저에서 http://localhost:34115)
cd frontend && npm run dev
```

## 빌드

```bash
# 프로덕션 빌드
wails build
```

## 린트

```bash
# Go
make lint
make lint-fix
make fmt

# Frontend
cd frontend
npm run lint
npm run lint:fix
npm run format
```

## 라이선스

[MIT](./LICENSE)
