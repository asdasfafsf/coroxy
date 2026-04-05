Linear 이슈 기반 작업을 시작한다. 이슈 → 브랜치 → 코드 → 커밋 → PR → 머지 → Linear 상태 업데이트까지 전체 워크플로우를 수행한다.

## 인자

$ARGUMENTS — Linear 이슈 번호 (예: WON-85) 또는 작업 설명

## 워크플로우

### 1. 이슈 확인/생성
- 이슈 번호가 주어지면: `mcp__linear-server__get_issue`로 이슈 내용 확인
- 작업 설명이 주어지면: `mcp__linear-server__save_issue`로 이슈 생성
- Linear 이슈 상태를 **In Progress**로 변경

### 2. 브랜치 생성
- `dev`에서 분기: `git checkout -b {type}/WON-{번호} dev`
- type은 이슈 라벨로 판단:
  - Feature → `feature/`
  - Bug → `fix/`
  - Improvement → `refactor/` 또는 `test/` 또는 `chore/`

### 3. 코드 작성
- 이슈 내용에 따라 코드 작성
- `go build ./...` 빌드 확인
- `go test ./... -race -count=1` 테스트 통과 확인

### 4. 커밋
- 브랜치명에서 이슈 번호 추출
- 커밋 메시지: `[WON-{번호}] {type}: {설명}`
- 관련 파일만 `git add` (git add -A 사용 금지)

### 5. PR 생성 + 머지
- `git push -u origin {브랜치}`
- `gh pr create --base dev` (PR 본문은 git.md 템플릿 사용)
- `gh pr merge --squash --delete-branch`

### 6. Linear 상태 업데이트
- 이슈 상태를 **Done**으로 변경
- 이슈 설명에 결과 섹션 추가 (PR 링크)

## 주의
- 모든 커맨드에 `rtk` 프리픽스 사용
- 빌드/테스트 실패 시 수정 후 재시도
- PR 머지 전 충돌 확인 (dev merge 후 push)
