#!/bin/bash

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# main에 직접 push 차단
if echo "$COMMAND" | grep -qE 'git push.*(origin|upstream)\s+main'; then
  echo "main에 직접 push할 수 없습니다. dev → main은 릴리스 시 ff-only 머지만 허용됩니다." >&2
  exit 2
fi

# --no-ff 머지 차단 (main 대상)
if echo "$COMMAND" | grep -qE 'git merge.*--no-ff'; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$BRANCH" = "main" ]; then
    echo "main에서 --no-ff 머지는 금지입니다. --ff-only를 사용하세요." >&2
    exit 2
  fi
fi

# main에서 직접 커밋 차단
if echo "$COMMAND" | grep -qE 'git commit'; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$BRANCH" = "main" ]; then
    echo "main에서 직접 커밋할 수 없습니다. 기능 브랜치에서 작업하세요." >&2
    exit 2
  fi
fi

exit 0
