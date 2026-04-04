package session

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func TestExportHARBasic(t *testing.T) {
	sessions := []*model.Session{
		{
			ID:        "s1",
			Protocol:  constant.ProtocolHTTP,
			CreatedAt: time.Date(2026, 4, 4, 12, 0, 0, 0, time.UTC),
			Duration:  150 * time.Millisecond,
			Request: &model.HTTPMessage{
				Method:  "GET",
				URL:     "http://example.com/api",
				Headers: http.Header{"Accept": {"application/json"}},
			},
			Response: &model.HTTPMessage{
				StatusCode: 200,
				StatusText: "200 OK",
				Headers:    http.Header{"Content-Type": {"application/json"}},
				BodySize:   42,
			},
		},
	}

	data, err := ExportHAR(sessions)
	if err != nil {
		t.Fatalf("ExportHAR: %v", err)
	}

	var har HAR
	if err := json.Unmarshal(data, &har); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if har.Log.Version != "1.2" {
		t.Fatalf("version: got %s, want 1.2", har.Log.Version)
	}
	if har.Log.Creator.Name != "Coroxy" {
		t.Fatalf("creator: got %s, want Coroxy", har.Log.Creator.Name)
	}
	if len(har.Log.Entries) != 1 {
		t.Fatalf("entries: got %d, want 1", len(har.Log.Entries))
	}

	entry := har.Log.Entries[0]
	if entry.Request.Method != "GET" {
		t.Fatalf("method: got %s, want GET", entry.Request.Method)
	}
	if entry.Response.Status != 200 {
		t.Fatalf("status: got %d, want 200", entry.Response.Status)
	}
	if entry.Time != 150 {
		t.Fatalf("time: got %f, want 150", entry.Time)
	}
	if entry.Response.Content.MimeType != "application/json" {
		t.Fatalf("mime: got %s", entry.Response.Content.MimeType)
	}
}

func TestExportHARSkipsNonHTTP(t *testing.T) {
	sessions := []*model.Session{
		{ID: "tcp1", Protocol: constant.ProtocolTCP, Request: nil},
		{ID: "http1", Protocol: constant.ProtocolHTTP, Request: &model.HTTPMessage{Method: "GET", URL: "http://x.com"}},
	}

	data, err := ExportHAR(sessions)
	if err != nil {
		t.Fatalf("ExportHAR: %v", err)
	}

	var har HAR
	json.Unmarshal(data, &har)

	if len(har.Log.Entries) != 1 {
		t.Fatalf("entries: got %d, want 1 (TCP should be skipped)", len(har.Log.Entries))
	}
}

func TestExportHAREmpty(t *testing.T) {
	data, err := ExportHAR([]*model.Session{})
	if err != nil {
		t.Fatalf("ExportHAR: %v", err)
	}

	var har HAR
	json.Unmarshal(data, &har)

	if len(har.Log.Entries) != 0 {
		t.Fatalf("entries: got %d, want 0", len(har.Log.Entries))
	}
}

func TestExportJSON(t *testing.T) {
	sessions := []*model.Session{
		{
			ID:       "s1",
			Protocol: constant.ProtocolHTTP,
			Request:  &model.HTTPMessage{Method: "GET", URL: "http://example.com"},
		},
	}

	data, err := ExportJSON(sessions)
	if err != nil {
		t.Fatalf("ExportJSON: %v", err)
	}

	var parsed []model.Session
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(parsed) != 1 {
		t.Fatalf("sessions: got %d, want 1", len(parsed))
	}
	if parsed[0].ID != "s1" {
		t.Fatalf("ID: got %s, want s1", parsed[0].ID)
	}
}

func TestExportJSONEmpty(t *testing.T) {
	data, err := ExportJSON([]*model.Session{})
	if err != nil {
		t.Fatalf("ExportJSON: %v", err)
	}

	if string(data) != "[]" {
		t.Fatalf("empty: got %s, want []", string(data))
	}
}
