package intercept

import (
	"net/http"
	"strings"

	"coroxy/internal/model"
)

// MatchRequest checks if an HTTP request matches the given rule condition.
func MatchRequest(cond model.MatchCondition, req *http.Request) bool {
	if cond.Method != "" && !strings.EqualFold(cond.Method, req.Method) {
		return false
	}
	if cond.Host != "" && !MatchHost(cond.Host, req.Host) {
		return false
	}
	if cond.Path != "" && !strings.HasPrefix(req.URL.Path, cond.Path) {
		return false
	}
	return true
}

// MatchHost checks if the given host matches the pattern.
// Supports wildcard patterns like "*.example.com".
func MatchHost(pattern, host string) bool {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:]
		return strings.HasSuffix(host, suffix) || host == pattern[2:]
	}
	return strings.EqualFold(pattern, host)
}
