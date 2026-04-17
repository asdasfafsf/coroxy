package session

import (
	"net/http"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func seedStore(t *testing.T) *MemoryStore {
	t.Helper()
	store := NewMemoryStore()

	store.Add(&model.Session{
		ID: "http-get", Protocol: constant.ProtocolHTTP,
		Target:    model.Endpoint{Host: "api.example.com"},
		Request:   &model.HTTPMessage{Method: "GET", URL: "http://api.example.com/users"},
		Response:  &model.HTTPMessage{StatusCode: 200},
		State:     constant.SessionStateCompleted,
		CreatedAt: time.Now().Add(-3 * time.Second),
	})
	store.Add(&model.Session{
		ID: "http-post", Protocol: constant.ProtocolHTTP,
		Target:    model.Endpoint{Host: "api.example.com"},
		Request:   &model.HTTPMessage{Method: "POST", URL: "http://api.example.com/users"},
		Response:  &model.HTTPMessage{StatusCode: 201},
		State:     constant.SessionStateCompleted,
		CreatedAt: time.Now().Add(-2 * time.Second),
	})
	store.Add(&model.Session{
		ID: "tls", Protocol: constant.ProtocolTLS,
		Target:    model.Endpoint{Host: "secure.example.com"},
		Request:   &model.HTTPMessage{Method: "GET", URL: "https://secure.example.com/secret"},
		Response:  &model.HTTPMessage{StatusCode: 200, Headers: http.Header{"Content-Type": {"application/json"}}},
		State:     constant.SessionStateCompleted,
		CreatedAt: time.Now().Add(-1 * time.Second),
	})
	store.Add(&model.Session{
		ID: "tcp", Protocol: constant.ProtocolTCP,
		Target:    model.Endpoint{Host: "db.internal"},
		State:     constant.SessionStateCompleted,
		CreatedAt: time.Now(),
	})

	return store
}

func TestFilterByProtocol(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{Protocol: constant.ProtocolHTTP})

	if len(result) != 2 {
		t.Fatalf("got %d, want 2", len(result))
	}
}

func TestFilterByHost(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{Host: "secure"})

	if len(result) != 1 {
		t.Fatalf("got %d, want 1", len(result))
	}
	if result[0].ID != "tls" {
		t.Fatalf("got %s, want tls", result[0].ID)
	}
}

func TestFilterByMethod(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{Method: "POST"})

	if len(result) != 1 {
		t.Fatalf("got %d, want 1", len(result))
	}
	if result[0].ID != "http-post" {
		t.Fatalf("got %s, want http-post", result[0].ID)
	}
}

func TestFilterByStatusCode(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{StatusCode: 201})

	if len(result) != 1 {
		t.Fatalf("got %d, want 1", len(result))
	}
}

func TestFilterByQuery(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{Query: "secret"})

	if len(result) != 1 {
		t.Fatalf("got %d, want 1", len(result))
	}
	if result[0].ID != "tls" {
		t.Fatalf("got %s, want tls", result[0].ID)
	}
}

func TestFilterCombined(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{Protocol: constant.ProtocolHTTP, Method: "GET"})

	if len(result) != 1 {
		t.Fatalf("got %d, want 1", len(result))
	}
	if result[0].ID != "http-get" {
		t.Fatalf("got %s, want http-get", result[0].ID)
	}
}

func TestFilterNoMatch(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{Host: "nonexistent"})

	if len(result) != 0 {
		t.Fatalf("got %d, want 0", len(result))
	}
}

func TestFilterEmpty(t *testing.T) {
	store := seedStore(t)
	result := store.ListWithFilter(model.SessionFilter{})

	if len(result) != 4 {
		t.Fatalf("empty filter: got %d, want 4 (all)", len(result))
	}
}
