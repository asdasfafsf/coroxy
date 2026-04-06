# WON-83: macOS CA 설치를 login keychain으로 변경

## 문제

smallstep/truststore가 `sudo security add-trusted-cert -d`를 실행하는데, GUI 앱에서는 터미널이 없어 sudo 비밀번호 프롬프트를 받을 수 없었다.
osascript로 감싸도 admin domain(`-d`) trust 설정 시 SecTrustSettingsSetTrustSettings 권한 문제로 실패.

## 검토한 대안

| 대안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. truststore 유지 | smallstep/truststore 라이브러리 그대로 사용 | 검증된 라이브러리 | GUI에서 sudo 불가 |
| B. osascript + system keychain | `osascript -e 'do shell script ... with administrator privileges'` | 비밀번호 팝업 | admin domain trust 설정에서 별도 권한 필요, 여전히 실패 |
| C. login keychain 직접 설치 | `security add-trusted-cert -r trustRoot -k login.keychain-db` | admin 권한 불필요, GUI에서 바로 동작 | system-wide가 아닌 user-level 신뢰 |

## 결정

C. login keychain에 user trust로 직접 설치한다.

## 이유

- GUI 앱에서 비밀번호 없이 동작하는 것이 UX 우선
- user-level 신뢰로도 Chrome, Safari 등 주요 브라우저에서 인식
- truststore 의존성 제거로 빌드 단순화

## 참고

- WON-83, PR #82, #83
