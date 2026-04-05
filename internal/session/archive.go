package session

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

// archiveVersion is the current .csaz format version.
const archiveVersion = 1

// manifest holds archive-level metadata stored in _manifest.json.
type manifest struct {
	Version   int       `json:"version"`
	Count     int       `json:"count"`
	CreatedAt time.Time `json:"created_at"`
}

// indexEntry holds minimal session info for fast listing.
type indexEntry struct {
	ID       string `json:"id"`
	Protocol string `json:"protocol"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Status   int    `json:"status"`
	State    string `json:"state"`
}

// sessionMeta is a session without body bytes. Bodies are stored separately as raw files.
type sessionMeta struct {
	ID        string               `json:"id"`
	Protocol  string               `json:"protocol"`
	Source    model.Endpoint        `json:"source"`
	Target    model.Endpoint        `json:"target"`
	Request   *httpMessageMeta      `json:"request,omitempty"`
	Response  *httpMessageMeta      `json:"response,omitempty"`
	Timing    *model.Timing         `json:"timing,omitempty"`
	State     string                `json:"state"`
	CreatedAt time.Time             `json:"created_at"`
	Duration  time.Duration         `json:"duration"`
}

// httpMessageMeta is HTTPMessage without Body bytes.
type httpMessageMeta struct {
	Method          string              `json:"method,omitempty"`
	URL             string              `json:"url,omitempty"`
	StatusCode      int                 `json:"status_code,omitempty"`
	StatusText      string              `json:"status_text,omitempty"`
	HTTPVersion     string              `json:"http_version,omitempty"`
	Headers         map[string][]string `json:"headers,omitempty"`
	Cookies         []model.HTTPCookie  `json:"cookies,omitempty"`
	QueryParams     []model.QueryParam  `json:"query_params,omitempty"`
	ContentType     string              `json:"content_type,omitempty"`
	ContentEncoding string              `json:"content_encoding,omitempty"`
	BodySize        int64               `json:"body_size"`
}

// WriteArchive writes sessions to a .csaz file at the given path.
// The write is atomic: data goes to a temp file first, then renamed.
func WriteArchive(path string, sessions []*model.Session) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create archive dir: %w", err)
	}

	tmpPath := path + ".tmp"

	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create temp archive: %w", err)
	}

	writeErr := writeArchiveTo(f, sessions)
	closeErr := f.Close()

	if writeErr != nil {
		_ = os.Remove(tmpPath)
		return writeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("close temp archive: %w", closeErr)
	}

	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("rename archive: %w", err)
	}

	return nil
}

func writeArchiveTo(w io.Writer, sessions []*model.Session) error {
	zw := zip.NewWriter(w)
	defer func() { _ = zw.Close() }()

	// _manifest.json
	m := manifest{
		Version:   archiveVersion,
		Count:     len(sessions),
		CreatedAt: time.Now(),
	}
	if err := writeJSON(zw, "_manifest.json", m); err != nil {
		return fmt.Errorf("write manifest: %w", err)
	}

	// _index.json
	index := make([]indexEntry, 0, len(sessions))
	for _, s := range sessions {
		e := indexEntry{
			ID:       s.ID,
			Protocol: string(s.Protocol),
			Host:     s.Target.Host,
			Port:     s.Target.Port,
			State:    string(s.State),
		}
		if s.Response != nil {
			e.Status = s.Response.StatusCode
		}
		index = append(index, e)
	}
	if err := writeJSON(zw, "_index.json", index); err != nil {
		return fmt.Errorf("write index: %w", err)
	}

	// Per-session: meta + raw bodies
	for _, s := range sessions {
		meta := toSessionMeta(s)
		metaPath := fmt.Sprintf("meta/%s.json", s.ID)
		if err := writeJSON(zw, metaPath, meta); err != nil {
			return fmt.Errorf("write meta %s: %w", s.ID, err)
		}

		// Request body
		if s.Request != nil && len(s.Request.Body) > 0 {
			rawPath := fmt.Sprintf("raw/%s_c.raw", s.ID)
			if err := writeRaw(zw, rawPath, s.Request.Body); err != nil {
				return fmt.Errorf("write request body %s: %w", s.ID, err)
			}
		}

		// Response body
		if s.Response != nil && len(s.Response.Body) > 0 {
			rawPath := fmt.Sprintf("raw/%s_s.raw", s.ID)
			if err := writeRaw(zw, rawPath, s.Response.Body); err != nil {
				return fmt.Errorf("write response body %s: %w", s.ID, err)
			}
		}
	}

	return zw.Close()
}

// ReadArchive reads sessions from a .csaz file.
func ReadArchive(path string) ([]*model.Session, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open archive: %w", err)
	}
	defer func() { _ = f.Close() }()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat archive: %w", err)
	}

	return readArchiveFrom(f, info.Size())
}

func readArchiveFrom(r io.ReaderAt, size int64) ([]*model.Session, error) {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("open zip reader: %w", err)
	}

	// Build file lookup map.
	files := make(map[string]*zip.File, len(zr.File))
	for _, f := range zr.File {
		files[f.Name] = f
	}

	// Read manifest.
	var m manifest
	if err := readJSON(files, "_manifest.json", &m); err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}
	if m.Version > archiveVersion {
		return nil, fmt.Errorf("unsupported archive version %d (max %d)", m.Version, archiveVersion)
	}

	// Find all meta files.
	var metaFiles []*zip.File
	for name, f := range files {
		if strings.HasPrefix(name, "meta/") && strings.HasSuffix(name, ".json") {
			metaFiles = append(metaFiles, f)
		}
	}

	sessions := make([]*model.Session, 0, len(metaFiles))
	for _, mf := range metaFiles {
		var meta sessionMeta
		data, err := readFileBytes(mf)
		if err != nil {
			return nil, fmt.Errorf("read meta %s: %w", mf.Name, err)
		}
		if err := json.Unmarshal(data, &meta); err != nil {
			return nil, fmt.Errorf("unmarshal meta %s: %w", mf.Name, err)
		}

		s := fromSessionMeta(&meta)

		// Restore request body.
		if s.Request != nil {
			rawPath := fmt.Sprintf("raw/%s_c.raw", s.ID)
			if rf, ok := files[rawPath]; ok {
				body, err := readFileBytes(rf)
				if err != nil {
					return nil, fmt.Errorf("read request body %s: %w", s.ID, err)
				}
				s.Request.Body = body
			}
		}

		// Restore response body.
		if s.Response != nil {
			rawPath := fmt.Sprintf("raw/%s_s.raw", s.ID)
			if rf, ok := files[rawPath]; ok {
				body, err := readFileBytes(rf)
				if err != nil {
					return nil, fmt.Errorf("read response body %s: %w", s.ID, err)
				}
				s.Response.Body = body
			}
		}

		sessions = append(sessions, s)
	}

	return sessions, nil
}

// ReadArchiveIndex reads only the index (fast listing without full session data).
func ReadArchiveIndex(path string) ([]indexEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open archive: %w", err)
	}
	defer func() { _ = f.Close() }()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat archive: %w", err)
	}

	zr, err := zip.NewReader(f, info.Size())
	if err != nil {
		return nil, fmt.Errorf("open zip reader: %w", err)
	}

	files := make(map[string]*zip.File, len(zr.File))
	for _, zf := range zr.File {
		files[zf.Name] = zf
	}

	var index []indexEntry
	if err := readJSON(files, "_index.json", &index); err != nil {
		return nil, fmt.Errorf("read index: %w", err)
	}

	return index, nil
}

// --- helpers ---

func writeJSON(zw *zip.Writer, name string, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}

func writeRaw(zw *zip.Writer, name string, data []byte) error {
	// Use Store (no compression) for raw bodies — they're often already compressed.
	header := &zip.FileHeader{
		Name:   name,
		Method: zip.Store,
	}
	w, err := zw.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}

func readJSON(files map[string]*zip.File, name string, v any) error {
	f, ok := files[name]
	if !ok {
		return fmt.Errorf("file %s not found in archive", name)
	}
	data, err := readFileBytes(f)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

func readFileBytes(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer func() { _ = rc.Close() }()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, rc); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func toSessionMeta(s *model.Session) sessionMeta {
	m := sessionMeta{
		ID:        s.ID,
		Protocol:  string(s.Protocol),
		Source:    s.Source,
		Target:    s.Target,
		Timing:    s.Timing,
		State:     string(s.State),
		CreatedAt: s.CreatedAt,
		Duration:  s.Duration,
	}

	if s.Request != nil {
		m.Request = toHTTPMessageMeta(s.Request)
	}
	if s.Response != nil {
		m.Response = toHTTPMessageMeta(s.Response)
	}

	return m
}

func toHTTPMessageMeta(msg *model.HTTPMessage) *httpMessageMeta {
	return &httpMessageMeta{
		Method:          msg.Method,
		URL:             msg.URL,
		StatusCode:      msg.StatusCode,
		StatusText:      msg.StatusText,
		HTTPVersion:     msg.HTTPVersion,
		Headers:         msg.Headers,
		Cookies:         msg.Cookies,
		QueryParams:     msg.QueryParams,
		ContentType:     msg.ContentType,
		ContentEncoding: msg.ContentEncoding,
		BodySize:        msg.BodySize,
	}
}

func fromSessionMeta(m *sessionMeta) *model.Session {
	s := &model.Session{
		ID:        m.ID,
		Protocol:  constant.Protocol(m.Protocol),
		Source:    m.Source,
		Target:    m.Target,
		Timing:    m.Timing,
		State:     constant.SessionState(m.State),
		CreatedAt: m.CreatedAt,
		Duration:  m.Duration,
	}

	if m.Request != nil {
		s.Request = fromHTTPMessageMeta(m.Request)
	}
	if m.Response != nil {
		s.Response = fromHTTPMessageMeta(m.Response)
	}

	return s
}

func fromHTTPMessageMeta(m *httpMessageMeta) *model.HTTPMessage {
	return &model.HTTPMessage{
		Method:          m.Method,
		URL:             m.URL,
		StatusCode:      m.StatusCode,
		StatusText:      m.StatusText,
		HTTPVersion:     m.HTTPVersion,
		Headers:         m.Headers,
		Cookies:         m.Cookies,
		QueryParams:     m.QueryParams,
		ContentType:     m.ContentType,
		ContentEncoding: m.ContentEncoding,
		BodySize:        m.BodySize,
	}
}
