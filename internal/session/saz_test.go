package session

import (
	"bytes"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func TestSAZExportImportRoundTrip(t *testing.T) {
	sessions := []*model.Session{
		{
			ID:       "saz-test-1",
			Protocol: constant.ProtocolHTTP,
			Source:   model.Endpoint{Host: "127.0.0.1", Port: 54321},
			Target:   model.Endpoint{Host: "example.com", Port: 80},
			Request: &model.HTTPMessage{
				Method:      "GET",
				URL:         "http://example.com/path?q=1",
				HTTPVersion: "HTTP/1.1",
				Headers:     http.Header{"Host": []string{"example.com"}, "User-Agent": []string{"test"}},
			},
			Response: &model.HTTPMessage{
				StatusCode:  200,
				StatusText:  "200 OK",
				HTTPVersion: "HTTP/1.1",
				Headers:     http.Header{"Content-Type": []string{"text/html"}},
				Body:        []byte("<html>hello</html>"),
				BodySize:    18,
			},
			State:     constant.SessionStateCompleted,
			CreatedAt: time.Date(2026, 4, 5, 12, 0, 0, 0, time.UTC),
			Duration:  150 * time.Millisecond,
		},
		{
			ID:       "saz-test-2",
			Protocol: constant.ProtocolTLS,
			Target:   model.Endpoint{Host: "secure.example.com", Port: 443},
			Request: &model.HTTPMessage{
				Method:      "POST",
				URL:         "https://secure.example.com/api",
				HTTPVersion: "HTTP/1.1",
				Headers:     http.Header{"Host": []string{"secure.example.com"}, "Content-Type": []string{"application/json"}},
				Body:        []byte(`{"data":"test"}`),
				BodySize:    15,
			},
			Response: &model.HTTPMessage{
				StatusCode:  201,
				HTTPVersion: "HTTP/1.1",
				Headers:     http.Header{"Content-Type": []string{"application/json"}},
				Body:        []byte(`{"id":1}`),
				BodySize:    8,
			},
			State:     constant.SessionStateCompleted,
			CreatedAt: time.Date(2026, 4, 5, 12, 1, 0, 0, time.UTC),
			Duration:  200 * time.Millisecond,
		},
		{
			// TCP session — should be skipped in SAZ export
			ID:       "saz-test-tcp",
			Protocol: constant.ProtocolTCP,
			Target:   model.Endpoint{Host: "db.local", Port: 5432},
			State:    constant.SessionStateCompleted,
		},
	}

	path := filepath.Join(t.TempDir(), "test.saz")

	if err := ExportSAZ(path, sessions); err != nil {
		t.Fatalf("export SAZ: %v", err)
	}

	loaded, err := ImportSAZ(path)
	if err != nil {
		t.Fatalf("import SAZ: %v", err)
	}

	// TCP session should be excluded.
	if len(loaded) != 2 {
		t.Fatalf("count: got %d, want 2", len(loaded))
	}

	// Session 1: GET
	s1 := loaded[0]
	if s1.Request == nil {
		t.Fatal("s1 request is nil")
	}
	if s1.Request.Method != "GET" {
		t.Errorf("s1 method: got %s, want GET", s1.Request.Method)
	}
	if s1.Response == nil {
		t.Fatal("s1 response is nil")
	}
	if s1.Response.StatusCode != 200 {
		t.Errorf("s1 status: got %d, want 200", s1.Response.StatusCode)
	}
	if !bytes.Equal(s1.Response.Body, []byte("<html>hello</html>")) {
		t.Errorf("s1 response body: got %q", s1.Response.Body)
	}
	if s1.Target.Host != "example.com" {
		t.Errorf("s1 host: got %s, want example.com", s1.Target.Host)
	}

	// Session 2: POST with body
	s2 := loaded[1]
	if s2.Request == nil {
		t.Fatal("s2 request is nil")
	}
	if s2.Request.Method != "POST" {
		t.Errorf("s2 method: got %s, want POST", s2.Request.Method)
	}
	if !bytes.Equal(s2.Request.Body, []byte(`{"data":"test"}`)) {
		t.Errorf("s2 request body: got %q", s2.Request.Body)
	}
	if s2.Response == nil {
		t.Fatal("s2 response is nil")
	}
	if s2.Response.StatusCode != 201 {
		t.Errorf("s2 status: got %d, want 201", s2.Response.StatusCode)
	}
	// HTTPS detection from URL scheme.
	if s2.Protocol != constant.ProtocolTLS {
		t.Errorf("s2 protocol: got %s, want TLS", s2.Protocol)
	}
}

func TestSAZTimingRoundTrip(t *testing.T) {
	start := time.Date(2026, 4, 5, 12, 0, 0, 0, time.UTC)
	sessions := []*model.Session{
		{
			ID:       "timing-1",
			Protocol: constant.ProtocolHTTP,
			Target:   model.Endpoint{Host: "example.com", Port: 80},
			Request: &model.HTTPMessage{
				Method:  "GET",
				URL:     "/",
				Headers: http.Header{"Host": []string{"example.com"}},
			},
			Response: &model.HTTPMessage{
				StatusCode: 200,
			},
			State:     constant.SessionStateCompleted,
			CreatedAt: start,
			Duration:  500 * time.Millisecond,
		},
	}

	path := filepath.Join(t.TempDir(), "timing.saz")

	if err := ExportSAZ(path, sessions); err != nil {
		t.Fatalf("export: %v", err)
	}

	loaded, err := ImportSAZ(path)
	if err != nil {
		t.Fatalf("import: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("count: got %d, want 1", len(loaded))
	}

	s := loaded[0]
	if s.CreatedAt.IsZero() {
		t.Error("created_at should not be zero")
	}
	if s.Duration < 400*time.Millisecond || s.Duration > 600*time.Millisecond {
		t.Errorf("duration: got %v, want ~500ms", s.Duration)
	}
}

func TestSAZEmptySessions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "empty.saz")

	if err := ExportSAZ(path, nil); err != nil {
		t.Fatalf("export: %v", err)
	}

	loaded, err := ImportSAZ(path)
	if err != nil {
		t.Fatalf("import: %v", err)
	}

	if len(loaded) != 0 {
		t.Fatalf("count: got %d, want 0", len(loaded))
	}
}
