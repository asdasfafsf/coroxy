package session

import (
	"bytes"
	"crypto/rand"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func TestArchiveRoundTrip(t *testing.T) {
	sessions := []*model.Session{
		{
			ID:       "s1",
			Protocol: constant.ProtocolHTTP,
			Source:   model.Endpoint{Host: "127.0.0.1", Port: 54321},
			Target:   model.Endpoint{Host: "example.com", Port: 80},
			Request: &model.HTTPMessage{
				Method:      "POST",
				URL:         "http://example.com/api",
				HTTPVersion: "HTTP/1.1",
				Headers:     http.Header{"Content-Type": []string{"application/json"}},
				Body:        []byte(`{"key":"value"}`),
				BodySize:    15,
			},
			Response: &model.HTTPMessage{
				StatusCode:  200,
				StatusText:  "OK",
				HTTPVersion: "HTTP/1.1",
				Headers:     http.Header{"Content-Type": []string{"application/json"}},
				Body:        []byte(`{"ok":true}`),
				BodySize:    11,
			},
			Timing: &model.Timing{
				DNS:      1.5,
				Connect:  3.2,
				TLS:      0,
				TTFB:     10.1,
				Transfer: 5.0,
			},
			State:     constant.SessionStateCompleted,
			CreatedAt: time.Date(2026, 4, 5, 12, 0, 0, 0, time.UTC),
			Duration:  100 * time.Millisecond,
		},
		{
			ID:        "s2",
			Protocol:  constant.ProtocolTCP,
			Target:    model.Endpoint{Host: "db.local", Port: 5432},
			State:     constant.SessionStateCompleted,
			CreatedAt: time.Date(2026, 4, 5, 12, 1, 0, 0, time.UTC),
		},
	}

	path := filepath.Join(t.TempDir(), "test.csaz")

	if err := WriteArchive(path, sessions); err != nil {
		t.Fatalf("write archive: %v", err)
	}

	loaded, err := ReadArchive(path)
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}

	if len(loaded) != 2 {
		t.Fatalf("count: got %d, want 2", len(loaded))
	}

	// Find s1 in loaded.
	var s1 *model.Session
	for _, s := range loaded {
		if s.ID == "s1" {
			s1 = s
			break
		}
	}
	if s1 == nil {
		t.Fatal("session s1 not found")
	}

	if s1.Protocol != constant.ProtocolHTTP {
		t.Errorf("protocol: got %s, want %s", s1.Protocol, constant.ProtocolHTTP)
	}
	if s1.Target.Host != "example.com" {
		t.Errorf("host: got %s, want example.com", s1.Target.Host)
	}
	if s1.Request == nil {
		t.Fatal("s1 request is nil")
	}
	if s1.Request.Method != "POST" {
		t.Errorf("method: got %s, want POST", s1.Request.Method)
	}
	if !bytes.Equal(s1.Request.Body, []byte(`{"key":"value"}`)) {
		t.Errorf("request body: got %q", s1.Request.Body)
	}
	if s1.Response == nil {
		t.Fatal("s1 response is nil")
	}
	if s1.Response.StatusCode != 200 {
		t.Errorf("status: got %d, want 200", s1.Response.StatusCode)
	}
	if !bytes.Equal(s1.Response.Body, []byte(`{"ok":true}`)) {
		t.Errorf("response body: got %q", s1.Response.Body)
	}
	if s1.Timing == nil || s1.Timing.DNS != 1.5 {
		t.Errorf("timing DNS: got %v", s1.Timing)
	}
	if s1.State != constant.SessionStateCompleted {
		t.Errorf("state: got %s, want completed", s1.State)
	}
}

func TestArchiveEmptySessions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "empty.csaz")

	if err := WriteArchive(path, nil); err != nil {
		t.Fatalf("write: %v", err)
	}

	loaded, err := ReadArchive(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	if len(loaded) != 0 {
		t.Fatalf("count: got %d, want 0", len(loaded))
	}
}

func TestArchiveLargeBody(t *testing.T) {
	// 32MB body
	body := make([]byte, 32<<20)
	if _, err := rand.Read(body); err != nil {
		t.Fatal(err)
	}

	sessions := []*model.Session{
		{
			ID:       "big",
			Protocol: constant.ProtocolTLS,
			Target:   model.Endpoint{Host: "big.example.com", Port: 443},
			Response: &model.HTTPMessage{
				StatusCode: 200,
				Body:       body,
				BodySize:   int64(len(body)),
			},
			State:     constant.SessionStateCompleted,
			CreatedAt: time.Now(),
		},
	}

	path := filepath.Join(t.TempDir(), "large.csaz")

	if err := WriteArchive(path, sessions); err != nil {
		t.Fatalf("write: %v", err)
	}

	loaded, err := ReadArchive(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("count: got %d, want 1", len(loaded))
	}

	if loaded[0].Response == nil {
		t.Fatal("response is nil")
	}

	if len(loaded[0].Response.Body) != 32<<20 {
		t.Fatalf("body size: got %d, want %d", len(loaded[0].Response.Body), 32<<20)
	}

	if !bytes.Equal(loaded[0].Response.Body, body) {
		t.Fatal("body content mismatch")
	}
}

func TestArchiveIndex(t *testing.T) {
	sessions := []*model.Session{
		{
			ID:       "idx1",
			Protocol: constant.ProtocolHTTP,
			Target:   model.Endpoint{Host: "a.com", Port: 80},
			Response: &model.HTTPMessage{StatusCode: 200},
			State:    constant.SessionStateCompleted,
		},
		{
			ID:       "idx2",
			Protocol: constant.ProtocolTLS,
			Target:   model.Endpoint{Host: "b.com", Port: 443},
			Response: &model.HTTPMessage{StatusCode: 404},
			State:    constant.SessionStateError,
		},
	}

	path := filepath.Join(t.TempDir(), "index.csaz")

	if err := WriteArchive(path, sessions); err != nil {
		t.Fatalf("write: %v", err)
	}

	index, err := ReadArchiveIndex(path)
	if err != nil {
		t.Fatalf("read index: %v", err)
	}

	if len(index) != 2 {
		t.Fatalf("count: got %d, want 2", len(index))
	}

	idxMap := make(map[string]indexEntry)
	for _, e := range index {
		idxMap[e.ID] = e
	}

	if e, ok := idxMap["idx1"]; !ok {
		t.Fatal("idx1 not found")
	} else {
		if e.Host != "a.com" {
			t.Errorf("host: got %s, want a.com", e.Host)
		}
		if e.Status != 200 {
			t.Errorf("status: got %d, want 200", e.Status)
		}
	}

	if e, ok := idxMap["idx2"]; !ok {
		t.Fatal("idx2 not found")
	} else {
		if e.Status != 404 {
			t.Errorf("status: got %d, want 404", e.Status)
		}
	}
}
