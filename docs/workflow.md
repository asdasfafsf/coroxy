# Coroxy 워크플로우

## Linear 프로젝트 설정

- **팀**: Coroxy (ID: `9fc9eb3e-42fc-4e53-9438-af09b78da78e`)
- **이슈 접두어**: CRX (CRX-1, CRX-2...)
- **연동**: 환경변수 `LINEAR_API_KEY`로 Linear GraphQL API (`https://api.linear.app/graphql`) 직접 호출
- **TODO**: `linear-mcp` MCP 서버 OAuth 인증 연동 (세션 재시작 시 처리)
- **이슈 규칙**: [linear.md](./linear.md) 참조

### 상태 ID

| 상태 | ID |
|------|----|
| Backlog | `7a2c90b1-0673-41b5-9518-08888d7655dc` |
| Todo | `8197ea3d-ccc3-4923-8f56-22b642cf480d` |
| In Progress | `853f1b04-d2e7-4349-966b-4a38a72bb3bf` |
| In Review | `8c36b06b-3fb4-4477-94c3-62d4e1c05231` |
| Done | `3b21c7e2-ce7c-472d-84fe-abb89efde2c4` |
| Canceled | `7870dc04-6e71-42ee-914a-5583676a2586` |
| Duplicate | `15b95744-ed3f-45ee-8d4b-9858eda58b32` |

### 라벨 ID

| 라벨 | ID |
|------|----|
| Bug | `98df7788-38cf-437c-ac2a-cb86d71568ef` |
| Feature | `1eac428f-d034-4f32-893a-68b8ab722299` |
| Improvement | `19cabe3a-1292-47d1-b107-7c6e382ddb32` |

## 브랜치 전략

```
feat/CRX-{번호}-{간단한-설명}
fix/CRX-{번호}-{간단한-설명}
```

- Linear 이슈 ID를 브랜치명에 포함
- main 브랜치에서 분기, PR로 머지

## 커밋 컨벤션

```
[CRX-{번호}] {type}: {설명}
```

**type 종류**: feat, fix, refactor, chore, docs, test

예시:
```
[CRX-5] feat: HTTP forward proxy 구현
[CRX-5] fix: chunked encoding 처리 오류 수정
[CRX-12] chore: go.mod 의존성 업데이트
```
