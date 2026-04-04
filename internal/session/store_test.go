package session

import (
	"fmt"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func newTestSession(id string, createdAt time.Time) *model.Session {
	return &model.Session{
		ID:        id,
		Protocol:  constant.ProtocolHTTP,
		State:     constant.SessionStateActive,
		CreatedAt: createdAt,
	}
}

func TestMemoryStoreAddAndGet(t *testing.T) {
	store := NewMemoryStore()

	s := newTestSession("s1", time.Now())
	store.Add(s)

	got := store.Get("s1")
	if got == nil {
		t.Fatal("Get(s1): got nil, want session")
	}
	if got.ID != "s1" {
		t.Fatalf("ID: got %s, want s1", got.ID)
	}
}

func TestMemoryStoreGetNotFound(t *testing.T) {
	store := NewMemoryStore()

	got := store.Get("nonexistent")
	if got != nil {
		t.Fatalf("Get(nonexistent): got %v, want nil", got)
	}
}

func TestMemoryStoreListOrder(t *testing.T) {
	store := NewMemoryStore()
	now := time.Now()

	store.Add(newTestSession("old", now.Add(-2*time.Hour)))
	store.Add(newTestSession("mid", now.Add(-1*time.Hour)))
	store.Add(newTestSession("new", now))

	list := store.List()
	if len(list) != 3 {
		t.Fatalf("List len: got %d, want 3", len(list))
	}

	// Newest first.
	if list[0].ID != "new" {
		t.Fatalf("list[0]: got %s, want new", list[0].ID)
	}
	if list[1].ID != "mid" {
		t.Fatalf("list[1]: got %s, want mid", list[1].ID)
	}
	if list[2].ID != "old" {
		t.Fatalf("list[2]: got %s, want old", list[2].ID)
	}
}

func TestMemoryStoreUpdate(t *testing.T) {
	store := NewMemoryStore()

	s := newTestSession("s1", time.Now())
	store.Add(s)

	updated := newTestSession("s1", s.CreatedAt)
	updated.State = constant.SessionStateCompleted
	store.Update(updated)

	got := store.Get("s1")
	if got.State != constant.SessionStateCompleted {
		t.Fatalf("State: got %s, want completed", got.State)
	}
}

func TestMemoryStoreUpdateNonExistent(t *testing.T) {
	store := NewMemoryStore()

	s := newTestSession("ghost", time.Now())
	store.Update(s) // should not panic or create entry

	if store.Count() != 0 {
		t.Fatalf("Count: got %d, want 0 (update should not create)", store.Count())
	}
}

func TestMemoryStoreDelete(t *testing.T) {
	store := NewMemoryStore()

	store.Add(newTestSession("s1", time.Now()))
	store.Add(newTestSession("s2", time.Now()))

	store.Delete("s1")

	if store.Count() != 1 {
		t.Fatalf("Count after delete: got %d, want 1", store.Count())
	}
	if store.Get("s1") != nil {
		t.Fatal("Get(s1) after delete: got session, want nil")
	}
}

func TestMemoryStoreDeleteNonExistent(t *testing.T) {
	store := NewMemoryStore()
	store.Delete("nonexistent") // should not panic
}

func TestMemoryStoreClear(t *testing.T) {
	store := NewMemoryStore()

	store.Add(newTestSession("s1", time.Now()))
	store.Add(newTestSession("s2", time.Now()))
	store.Add(newTestSession("s3", time.Now()))

	store.Clear()

	if store.Count() != 0 {
		t.Fatalf("Count after clear: got %d, want 0", store.Count())
	}
}

func TestMemoryStoreCount(t *testing.T) {
	store := NewMemoryStore()

	if store.Count() != 0 {
		t.Fatalf("initial Count: got %d, want 0", store.Count())
	}

	store.Add(newTestSession("s1", time.Now()))
	store.Add(newTestSession("s2", time.Now()))

	if store.Count() != 2 {
		t.Fatalf("Count: got %d, want 2", store.Count())
	}
}

func TestMemoryStoreListEmpty(t *testing.T) {
	store := NewMemoryStore()

	list := store.List()
	if list == nil {
		t.Fatal("List() on empty store: got nil, want empty slice")
	}
	if len(list) != 0 {
		t.Fatalf("List() len: got %d, want 0", len(list))
	}
}

func TestMemoryStoreAddNil(t *testing.T) {
	store := NewMemoryStore()
	store.Add(nil) // should not panic

	if store.Count() != 0 {
		t.Fatalf("Count after Add(nil): got %d, want 0", store.Count())
	}
}

func TestMemoryStoreUpdateNil(t *testing.T) {
	store := NewMemoryStore()
	store.Update(nil) // should not panic

	if store.Count() != 0 {
		t.Fatalf("Count after Update(nil): got %d, want 0", store.Count())
	}
}

func TestMemoryStoreConcurrency(t *testing.T) {
	store := NewMemoryStore()
	done := make(chan struct{})

	// Concurrent writers.
	for i := 0; i < 10; i++ {
		go func(id int) {
			defer func() { done <- struct{}{} }()
			s := newTestSession(fmt.Sprintf("s%d", id), time.Now())
			store.Add(s)
			store.Get(s.ID)
			store.List()
			s.State = constant.SessionStateCompleted
			store.Update(s)
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	if store.Count() != 10 {
		t.Fatalf("Count after concurrent adds: got %d, want 10", store.Count())
	}
}

func TestMemoryStoreAddDuplicateID(t *testing.T) {
	store := NewMemoryStore()

	s1 := newTestSession("dup", time.Now())
	s1.Protocol = constant.ProtocolHTTP

	s2 := newTestSession("dup", time.Now())
	s2.Protocol = constant.ProtocolTLS

	store.Add(s1)
	store.Add(s2) // should overwrite

	got := store.Get("dup")
	if got.Protocol != constant.ProtocolTLS {
		t.Fatalf("Protocol after duplicate add: got %s, want TLS", got.Protocol)
	}

	if store.Count() != 1 {
		t.Fatalf("Count: got %d, want 1", store.Count())
	}
}
