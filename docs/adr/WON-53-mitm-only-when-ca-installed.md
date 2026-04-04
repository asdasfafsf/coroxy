# WON-53: CA 미설치 시 MITM 비활성화 (Fiddler 방식)

## 문제

CA 인증서가 OS 신뢰 저장소에 설치되지 않은 상태에서 MITM을 시도하면 브라우저에서 인증서 오류가 발생한다. 사용자 경험이 나쁘고, 일반 HTTPS 브라우징이 불가능해진다.

## 검토한 대안

| 대안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| 항상 MITM 시도 | CA 존재만 확인 | 단순 | 미설치 시 인증서 오류 |
| CA 설치 여부 확인 후 MITM | IsCAInstalled() 체크 | 사용자 경험 좋음, Fiddler 방식 | 매 CONNECT마다 체크 비용 |

## 결정

Fiddler 방식을 따른다. CA가 OS 신뢰 저장소에 설치된 경우에만 MITM을 수행하고, 미설치 시 passthrough(바이패스)만 한다.

## 이유

- Fiddler, Charles 등 상용 프록시 도구가 동일한 방식을 사용
- CA 미설치 상태에서 MITM을 시도하면 사용자가 정상적으로 웹을 사용할 수 없음
- "프록시를 켰는데 인터넷이 안 된다"는 최악의 사용자 경험
- IsCAInstalled() 비용은 SystemCertPool 로드지만, CONNECT 빈도 대비 무시할 수준

## 참고

- Linear: WON-53
- Fiddler 동작: CA 미설치 시 HTTPS decode를 하지 않고 passthrough
