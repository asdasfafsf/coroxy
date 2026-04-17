package model

import "coroxy/internal/constant"

// SessionFilter defines criteria for filtering sessions.
// All fields are optional — empty/zero values mean "no filter".
type SessionFilter struct {
	Protocol   constant.Protocol     `json:"protocol,omitempty"`
	Host       string                `json:"host,omitempty"`        // substring match
	Method     string                `json:"method,omitempty"`      // exact match
	StatusCode int                   `json:"status_code,omitempty"` // exact match
	Query      string                `json:"query,omitempty"`       // text search (host, URL, method)
	State      constant.SessionState `json:"state,omitempty"`
	Tag        string                `json:"tag,omitempty"` // exact match on session tags
}
