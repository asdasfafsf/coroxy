.PHONY: lint lint-fix fmt

lint:
	golangci-lint run ./...

lint-fix:
	golangci-lint run --fix ./...

fmt:
	gofmt -s -w .
	goimports -local github.com/asdasfafsf/coroxy -w .
