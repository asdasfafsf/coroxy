# WON-31: 모듈명 변경 + string enum 채택

## 문제

### 모듈명
`go.mod`에 `module github.com/asdasfafsf/coroxy`로 설정되어 있어, 모든 import 경로에 GitHub URL이 노출된다. Coroxy는 standalone 데스크탑 앱으로 외부에서 import할 일이 없다.

### Enum 타입
code.md 규칙(섹션 18)이 `int` + `iota`를 MUST로 강제하고 있었다. 로그, JSON, 디버깅에서 값이 숫자(0, 1, 2)로 표시되어 사람이 바로 알아볼 수 없다.

## 검토한 대안

### 모듈명

| 대안 | 장점 | 단점 |
|------|------|------|
| `github.com/asdasfafsf/coroxy` | Go 관행, `go get` 가능 | 코드에 GitHub URL 노출, 외부 import 불필요 |
| `coroxy` | 깔끔한 import 경로, 프로젝트 적합 | `go get` 불가 (필요 없음) |

### Enum 타입

| 대안 | 장점 | 단점 |
|------|------|------|
| `int` + `iota` + `String()` | Go 표준 관행, 메모리 효율 | 값만 봐서는 의미 파악 불가, String() 별도 구현 필요 |
| `string` | 값만 봐도 의미 파악, JSON/로그에서 바로 읽힘 | Go 관행과 다름, 비교 시 오타 가능성 |

## 결정

- 모듈명을 `coroxy`로 변경한다.
- enum은 `string` 타입을 사용한다. code.md 섹션 18을 이에 맞게 수정한다.

## 이유

프로젝트 적합성 우선 원칙(code.md 0번): 일반 관행보다 프로젝트에 맞는 것을 선택한다.
- 모듈명: 외부 import가 불필요한 standalone 앱이므로 짧은 이름이 적합
- string enum: "값만 봐도 사람이 알아볼 수 있어야 한다"는 사용자 요구. 프록시 프로젝트에서 프로토콜, 상태값은 로그/디버깅에서 자주 확인하므로 가독성이 우선

## 참고

- Linear: WON-31
- PR: https://github.com/asdasfafsf/coroxy/pull/26
