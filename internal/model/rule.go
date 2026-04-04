package model

// RuleAction defines what happens when a rule matches.
type RuleAction string

const (
	RuleActionDrop  RuleAction = "drop"
	RuleActionDelay RuleAction = "delay"
)

// MatchCondition defines criteria for matching HTTP traffic.
type MatchCondition struct {
	Host   string `json:"host,omitempty"`   // exact or wildcard (*.example.com)
	Path   string `json:"path,omitempty"`   // prefix match
	Method string `json:"method,omitempty"` // exact match (GET, POST, etc.)
}

// Rule defines a traffic matching rule and its action.
type Rule struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Enabled  bool           `json:"enabled"`
	Match    MatchCondition `json:"match"`
	Action   RuleAction     `json:"action"`
	Priority int            `json:"priority"`
}
