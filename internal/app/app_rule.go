package app

import (
	"coroxy/internal/model"
)

// ListRules returns all rules.
func (a *App) ListRules() []*model.Rule {
	return a.ruleEngine.Rules()
}

// AddRule adds a new rule.
func (a *App) AddRule(r *model.Rule) {
	a.ruleEngine.AddRule(r)
}

// RemoveRule removes a rule by ID.
func (a *App) RemoveRule(id string) {
	a.ruleEngine.RemoveRule(id)
}

// ToggleRule enables or disables a rule.
func (a *App) ToggleRule(id string) {
	a.ruleEngine.ToggleRule(id)
}
