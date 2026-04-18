package app

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"coroxy/internal/model"
)

// Sessions returns all captured sessions.
func (a *App) Sessions() []*model.Session {
	return a.store.List()
}

// SessionsFiltered returns sessions matching the given filter.
func (a *App) SessionsFiltered(filter model.SessionFilter) []*model.Session {
	return a.store.ListWithFilter(filter)
}

// ClearSessions removes all captured sessions.
func (a *App) ClearSessions() {
	a.store.Clear()
	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}
}

// TagSession adds or removes a tag on a session.
func (a *App) TagSession(sessionID string, tag string, remove bool) {
	s := a.store.Get(sessionID)
	if s == nil {
		return
	}
	if remove {
		filtered := make([]string, 0, len(s.Tags))
		for _, t := range s.Tags {
			if t != tag {
				filtered = append(filtered, t)
			}
		}
		s.Tags = filtered
	} else {
		for _, t := range s.Tags {
			if t == tag {
				return // already tagged
			}
		}
		s.Tags = append(s.Tags, tag)
	}
	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}
}

// CommentSession sets a comment on a session.
func (a *App) CommentSession(sessionID string, comment string) {
	s := a.store.Get(sessionID)
	if s == nil {
		return
	}
	s.Comment = comment
	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}
}

// HandleNewSession is called by the proxy when a new session is captured.
func (a *App) HandleNewSession(s *model.Session) {
	a.store.Add(s)

	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "coroxy:session:new", s)
	}
}
