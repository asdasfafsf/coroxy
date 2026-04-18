package app

import (
	"coroxy/internal/intercept"
)

// BreakpointResumeWithEdit resumes a paused request with edits applied.
func (a *App) BreakpointResumeWithEdit(pendingID string, edit intercept.EditedRequest) {
	if a.breakpoint != nil {
		a.breakpoint.ResumeWithEdit(pendingID, edit)
	}
}

// BreakpointResume resumes a paused request.
func (a *App) BreakpointResume(pendingID string) {
	if a.breakpoint != nil {
		a.breakpoint.Resume(pendingID)
	}
}

// BreakpointDrop drops a paused request.
func (a *App) BreakpointDrop(pendingID string) {
	if a.breakpoint != nil {
		a.breakpoint.Drop(pendingID)
	}
}

// BreakpointPending represents a paused request for the frontend.
type BreakpointPending struct {
	ID     string `json:"id"`
	Method string `json:"method"`
	URL    string `json:"url"`
	Host   string `json:"host"`
	RuleID string `json:"rule_id"`
}

// PendingBreakpoints returns all currently paused requests.
func (a *App) PendingBreakpoints() []BreakpointPending {
	if a.breakpoint == nil {
		return []BreakpointPending{}
	}
	pending := a.breakpoint.PendingRequests()
	result := make([]BreakpointPending, 0, len(pending))
	for _, p := range pending {
		result = append(result, BreakpointPending{
			ID:     p.ID,
			Method: p.Request.Method,
			URL:    p.Request.URL.String(),
			Host:   p.Request.Host,
			RuleID: p.RuleID,
		})
	}
	return result
}
