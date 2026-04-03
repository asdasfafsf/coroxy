#!/bin/bash

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Go 파일: format + lint
if [[ "$FILE_PATH" == *.go ]]; then
  gofmt -s -w "$FILE_PATH" 2>/dev/null
  goimports -local github.com/asdasfafsf/coroxy -w "$FILE_PATH" 2>/dev/null
  golangci-lint run "$FILE_PATH" 2>&1
  if [ $? -ne 0 ]; then
    echo "Go lint errors in $FILE_PATH" >&2
    exit 2
  fi
fi

# TypeScript/React 파일: lint + format
if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  cd "$CLAUDE_PROJECT_DIR/frontend"
  npx eslint --fix "$FILE_PATH" 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "ESLint errors in $FILE_PATH" >&2
    exit 2
  fi
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi

# CSS 파일: format
if [[ "$FILE_PATH" == *.css ]]; then
  cd "$CLAUDE_PROJECT_DIR/frontend"
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi

exit 0
