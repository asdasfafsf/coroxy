package model

// RuleAction defines what happens when a rule matches.
type RuleAction string

const (
	// RuleActionUnknown is the zero value for rule action.
	RuleActionUnknown RuleAction = "unknown"
	// RuleActionDrop silently drops the matched request.
	RuleActionDrop RuleAction = "drop"
	// RuleActionModifyHeader modifies request or response headers according to the rule.
	RuleActionModifyHeader RuleAction = "modify_header"
	// RuleActionAutoRespond returns a canned response without forwarding to the server.
	RuleActionAutoRespond RuleAction = "auto_respond"
	// RuleActionBreakpoint pauses the request for manual inspection in the GUI.
	RuleActionBreakpoint RuleAction = "breakpoint"
	// RuleActionModifyBody modifies request or response body using find/replace.
	RuleActionModifyBody RuleAction = "modify_body"
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
	Modifications     []HeaderModification `json:"modifications,omitempty"`
	BodyModifications []BodyModification   `json:"body_modifications,omitempty"`
	AutoResponse      *AutoResponse        `json:"auto_response,omitempty"`
}

// BodyModification defines a find/replace operation on request or response body.
type BodyModification struct {
	Find    string `json:"find"`
	Replace string `json:"replace"`
	IsRegex bool   `json:"is_regex,omitempty"` // treat Find as regex pattern
	Target  string `json:"target"`             // "request" or "response"
}

// AutoResponse defines a canned response to return instead of forwarding to the server.
type AutoResponse struct {
	StatusCode  int               `json:"status_code"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        string            `json:"body,omitempty"`
	ContentType string            `json:"content_type,omitempty"`
}
