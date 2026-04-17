INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

STAGED_APP=$(git diff --cached --name-only -- 'internal/app/' 2>/dev/null)
STAGED_WAILSJS=$(git diff --cached --name-only -- 'frontend/wailsjs/' 2>/dev/null)

if [ -n "$STAGED_APP" ] && [ -z "$STAGED_WAILSJS" ]; then
  echo "internal/app/ 변경이 staged인데 frontend/wailsjs/ 변경은 staged되지 않았습니다." >&2
  echo "Wails 바인딩 재생성이 누락됐을 수 있습니다. 다음 명령 실행 후 다시 커밋하세요:" >&2
  echo "  wails generate module && git add frontend/wailsjs/" >&2
  echo "" >&2
  echo "바인딩 변경이 정말 불필요한 경우에만 이 커밋을 건너뛰세요." >&2
  exit 2
fi

exit 0
