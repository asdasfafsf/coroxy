# WON-40: dev→main 머지 전략을 merge commit으로 변경

## 문제

Phase 1 릴리스 시 dev→main PR을 "Rebase and merge"로 머지했더니 커밋 해시가 변경되어 dev와 main이 diverge됐다. 이후 dev→main 머지 시 충돌이 발생하여 수동 해결이 필요했다.

## 검토한 대안

| 대안 | 장점 | 단점 |
|------|------|------|
| Rebase and merge | 선형 히스토리, 깔끔 | 커밋 해시 변경 → diverge 유발 |
| Squash merge | main에 깔끔한 단일 커밋 | 커밋 해시 변경 → diverge 유발 |
| Merge commit | dev-main 공유 히스토리 유지, diverge 없음 | main에 머지 커밋 추가 |

## 결정

dev→main, hotfix→main 머지 방식을 "PR merge commit"으로 변경한다.

## 이유

- **Rebase/squash는 새로운 커밋 해시를 생성**하여 dev와 main이 같은 내용을 가지고 있어도 Git이 서로 다른 커밋으로 인식. 이후 머지 시 매번 충돌 발생.
- **Merge commit은 공유 조상(common ancestor)을 유지**하여 다음 머지에서 Git이 변경 사항을 정확히 추적 가능.
- main의 선형 히스토리보다 **운영 안정성(diverge 방지)이 우선**.
- 기능 브랜치→dev는 여전히 squash merge (dev의 히스토리는 깔끔하게 유지).

## 참고

- Linear: WON-40
- 발생한 문제: PR #36 머지 실패, PR #37로 수동 동기화
