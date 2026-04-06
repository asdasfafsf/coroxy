# WON-67: 매칭 로직을 intercept 패키지에 배치

## 문제

matchRequest/matchHost 로직이 modifier, autoresponder, breakpoint 3곳에 복제. rule/engine.go에도 동일 로직 존재. 공용 함수로 추출해야 하는데, 어디에 둘지 결정 필요.

## 검토한 대안

| 대안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. rule/ 패키지 | rule/match.go에 공용 함수 | 매칭 로직의 원래 위치 | intercept → rule 순환 의존 |
| B. intercept/ 패키지 | intercept/match.go에 공용 함수 | 순환 의존 없음, 사용처와 가까움 | rule/engine.go에도 동일 로직 잔류 |
| C. model/ 패키지 | model/match.go | 모든 패키지에서 접근 가능 | model은 데이터 구조체만 두는 규칙 |

## 결정

B. intercept/match.go에 MatchRequest, MatchHost 공용 함수 배치.

## 이유

- intercept → rule 순환 의존을 피함 (modifier.go 주석에 이미 기록됨)
- 3개 인터셉터에서 직접 사용하므로 위치가 자연스러움
- rule/engine.go의 matchRequest는 별도 유지 (rule 패키지 독립성)
- model/에 로직을 넣으면 규칙 위반

## 참고

- WON-67, PR #73
