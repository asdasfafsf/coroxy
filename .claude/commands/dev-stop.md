시스템 프록시를 해제하고 wails 프로세스를 정리한다.

## 핵심 원칙

**프록시 해제가 최우선.** wails가 이미 죽어있어도 프록시는 반드시 해제한다.

## 실행 순서

1. **즉시** 시스템 프록시 OFF (wails 상태와 무관하게 먼저 실행):
   ```
   networksetup -setwebproxystate "Wi-Fi" off
   networksetup -setsecurewebproxystate "Wi-Fi" off
   ```
2. 프록시 해제 확인: `networksetup -getwebproxy "Wi-Fi"` 로 Enabled: No 확인
3. wails dev 프로세스 종료
4. 점유 포트 정리 (8673, 8674, 5173, 34115)
5. 감시 루프가 돌고 있으면 정리
