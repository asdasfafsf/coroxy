Coroxy 개발 서버를 실행하고 시스템 프록시를 설정한다.

## 실행 순서

1. 기존 wails 프로세스와 점유 포트(8673, 8674, 5173, 34115) 정리
2. `wails dev` 백그라운드 실행
3. 앱 시작 대기 (proxy engine started 로그 확인)
4. macOS 시스템 프록시를 Coroxy로 설정:
   - HTTP 프록시: 127.0.0.1:8673
   - HTTPS 프록시: 127.0.0.1:8673
5. 사용자에게 프록시 ON 상태 알림

## 종료 시

사용자가 종료를 요청하거나 wails 프로세스가 종료되면:
1. 시스템 프록시 OFF: `networksetup -setwebproxystate "Wi-Fi" off && networksetup -setsecurewebproxystate "Wi-Fi" off`
2. wails 프로세스 정리

## 주의

- 프록시 해제를 잊으면 인터넷이 안 되므로 반드시 해제할 것
- Wi-Fi가 아닌 다른 네트워크 서비스를 쓸 수 있으므로 `networksetup -listallnetworkservices`로 확인
