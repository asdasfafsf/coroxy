package model

// RuleAction defines what happens when a rule matches.
type RuleAction string

const (
	RuleActionDrop         RuleAction = "drop"
	RuleActionModifyHeader RuleAction = "modify_header"
	RuleActionAutoRespond  RuleAction = "auto_respond"
	RuleActionBreakpoint   RuleAction = "breakpoint"
)

// MatchCondition defines criteria for matching HTTP traffic.
type MatchCondition struct {
	Host   string `json:"host,omitempty"`   // exact or wildcard (*.example.com)
	Path   string `json:"path,omitempty"`   // prefix match
	Method string `json:"method,omitempty"` // exact match (GET, POST, etc.)
}

// HeaderModification defines a single header modification.
type HeaderModification struct {
	Operation string `json:"operation"` // "set", "add", "delete"
	Name      string `json:"name"`
	Value     string `json:"value,omitempty"` // not needed for delete
	Target    string `json:"target"`          // "request" or "response"
}

// Rule defines a traffic matching rule and its action.
type Rule struct {
	ID              string               `json:"id"`
	Name            string               `json:"name"`
	Enabled         bool                 `json:"enabled"`
	Match           MatchCondition       `json:"match"`
	Action          RuleAction           `json:"action"`
	Priority        int                  `json:"priority"`
	Modifications []HeaderModification `json:"modifications,omitempty"`
	AutoResponse  *AutoResponse        `json:"auto_response,omitempty"`
}

// AutoResponse defines a canned response to return instead of forwarding to the server.
type AutoResponse struct {
	StatusCode  int               `json:"status_code"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        string            `json:"body,omitempty"`
	ContentType string            `json:"content_type,omitempty"`
}
