# WON-92: HAR Export에서 바이너리 body text 필드 제외

## 문제

HAR 1.2 스펙의 `content.text` 필드에 response body를 문자열로 넣는데, 이미지/동영상 등 바이너리 body를 `string()`으로 변환하면 JSON이 깨지거나 파일 크기가 폭발.

## 검토한 대안

| 대안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 전부 넣기 | 바이너리든 텍스트든 전부 text에 넣기 | 데이터 손실 없음 | JSON 깨짐, 파일 크기 폭발 |
| B. base64 인코딩 | 바이너리는 base64로 넣기 + encoding 필드 설정 | HAR 스펙 준수 | 파일 크기 33% 증가 |
| C. 바이너리 제외 | image/*, audio/*, video/* 등은 text 비움 | 깔끔, 파일 크기 적절 | 바이너리 body 확인 불가 |

## 결정

C. `isBinaryContentType()`으로 판별, 바이너리면 text 필드를 빈 문자열로.

## 이유

- HAR 파일 크기를 현실적으로 유지
- 바이너리 body는 HAR에서 보는 것보다 Inspector에서 직접 보는 게 적합
- base64는 나중에 필요하면 추가 가능 (breaking change 아님)

## 참고

- WON-92, PR #92, #93
