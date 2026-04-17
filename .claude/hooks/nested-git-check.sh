INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  exit 0
fi

NESTED=$(find "$REPO_ROOT" -type d -name .git -not -path "$REPO_ROOT/.git" -not -path "$REPO_ROOT/.git/*" -not -path "*/node_modules/*" 2>/dev/null | head -5)

if [ -n "$NESTED" ]; then
  echo "중첩 .git 디렉터리가 발견되었습니다:" >&2
  echo "$NESTED" | sed 's/^/  /' >&2
  echo "" >&2
  echo "서브모듈이 아니라면 제거 후 커밋하세요:" >&2
  echo "  rm -rf {경로}" >&2
  exit 2
fi

exit 0
