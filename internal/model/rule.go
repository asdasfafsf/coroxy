package model

// RuleAction defines what happens when a rule matches.
type RuleAction string

const (
	RuleActionDrop         RuleAction = "drop"
	RuleActionDelay        RuleAction = "delay"
	RuleActionModifyHeader RuleAction = "modify_header"
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
	Modifications   []HeaderModification `json:"modifications,omitempty"`
}
