# WON-91: HTTP Timing 측정에 httptrace 사용

## 문제

Fiddler는 요청별로 DNS, TCP, TLS, TTFB, Transfer 시간을 분해하여 보여주는데, Coroxy는 총 Duration만 측정하고 있었다.

## 검토한 대안

| 대안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. net/http/httptrace | Go 표준 라이브러리의 ClientTrace hook | 정확한 각 단계 측정, 추가 의존성 없음 | HTTP forward proxy만 적용, MITM은 별도 |
| B. 시작/끝 시간만 측정 | RoundTrip 전후 시간 차이 | 단순 | 단계별 분해 불가 |
| C. 커스텀 Transport | http.Transport를 래핑하여 각 단계 측정 | 유연함 | 구현 복잡, 유지보수 부담 |

## 결정

A. net/http/httptrace.ClientTrace를 사용.

## 이유

- Go 표준 라이브러리로 추가 의존성 없음
- DNSStart/Done, ConnectStart/Done, TLSHandshakeStart/Done, WroteRequest, GotFirstResponseByte 등 정확한 hook 제공
- http.Transport가 keep-alive로 연결을 재사용하면 DNS/Connect/TLS hook이 안 불림 → -1로 표시 (의도적)
- MITM(HTTPS)은 httptrace 적용 불가 → 전체 elapsed를 TTFB로 기록

## 참고

- WON-91, PR #91
