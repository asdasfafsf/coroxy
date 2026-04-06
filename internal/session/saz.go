package session

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

// SAZ file structure:
//   raw/00001_c.txt  — raw HTTP request
//   raw/00001_s.txt  — raw HTTP response
//   raw/00001_m.xml  — session metadata (optional)

// --- XML types for _m.xml ---

type sazSession struct {
	XMLName  xml.Name        `xml:"Session"`
	SID      int             `xml:"SID,attr"`
	BitFlags int             `xml:"BitFlags,attr"`
	Timers   sazTimers       `xml:"SessionTimers"`
	Flags    sazSessionFlags `xml:"SessionFlags"`
}

type sazTimers struct {
	ClientConnected    string `xml:"ClientConnected,attr,omitempty"`
	ClientBeginRequest string `xml:"ClientBeginRequest,attr,omitempty"`
	ClientDoneRequest  string `xml:"ClientDoneRequest,attr,omitempty"`
	ServerConnected    string `xml:"ServerConnected,attr,omitempty"`
	ServerBeginResponse string `xml:"ServerBeginResponse,attr,omitempty"`
	ServerDoneResponse string `xml:"ServerDoneResponse,attr,omitempty"`
	ClientDoneResponse string `xml:"ClientDoneResponse,attr,omitempty"`
}

type sazSessionFlags struct {
	Flags []sazFlag `xml:"SessionFlag"`
}

type sazFlag struct {
	N string `xml:"N,attr"`
	V string `xml:"V,attr"`
}

// ExportSAZ writes sessions as a Fiddler-compatible .saz file.
func ExportSAZ(path string, sessions []*model.Session) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}

	tmpPath := path + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}

	writeErr := writeSAZTo(f, sessions)
	closeErr := f.Close()

	if writeErr != nil {
		_ = os.Remove(tmpPath)
		return writeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("close temp file: %w", closeErr)
	}

	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("rename saz: %w", err)
	}

	return nil
}

func writeSAZTo(w io.Writer, sessions []*model.Session) error {
	zw := zip.NewWriter(w)

	idx := 1
	for _, s := range sessions {
		if s.Request == nil {
			continue // SAZ only supports HTTP sessions
		}

		prefix := fmt.Sprintf("raw/%05d", idx)

		// _c.txt — raw HTTP request
		reqBytes := buildRawRequest(s.Request)
		cw, err := zw.Create(prefix + "_c.txt")
		if err != nil {
			return fmt.Errorf("create request file: %w", err)
		}
		if _, err := cw.Write(reqBytes); err != nil {
			return fmt.Errorf("write request: %w", err)
		}

		// _s.txt — raw HTTP response
		if s.Response != nil {
			respBytes := buildRawResponse(s.Response)
			sw, err := zw.Create(prefix + "_s.txt")
			if err != nil {
				return fmt.Errorf("create response file: %w", err)
			}
			if _, err := sw.Write(respBytes); err != nil {
				return fmt.Errorf("write response: %w", err)
			}
		}

		// _m.xml — metadata
		meta := buildSAZMeta(idx, s)
		xmlData, err := xml.MarshalIndent(meta, "", "  ")
		if err != nil {
			return fmt.Errorf("marshal metadata: %w", err)
		}
		xmlData = append([]byte(xml.Header), xmlData...)

		mw, err := zw.Create(prefix + "_m.xml")
		if err != nil {
			return fmt.Errorf("create metadata file: %w", err)
		}
		if _, err := mw.Write(xmlData); err != nil {
			return fmt.Errorf("write metadata: %w", err)
		}

		idx++
	}

	return zw.Close()
}

// ImportSAZ reads a Fiddler .saz file and returns sessions.
func ImportSAZ(path string) ([]*model.Session, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open saz: %w", err)
	}
	defer func() { _ = f.Close() }()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat saz: %w", err)
	}

	return readSAZFrom(f, info.Size())
}

func readSAZFrom(r io.ReaderAt, size int64) ([]*model.Session, error) {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	files := make(map[string]*zip.File, len(zr.File))
	for _, f := range zr.File {
		files[f.Name] = f
	}

	// Find all session numbers from _c.txt files.
	var nums []int
	for name := range files {
		if !strings.HasPrefix(name, "raw/") || !strings.HasSuffix(name, "_c.txt") {
			continue
		}
		base := strings.TrimPrefix(name, "raw/")
		base = strings.TrimSuffix(base, "_c.txt")
		n, err := strconv.Atoi(base)
		if err != nil {
			continue
		}
		nums = append(nums, n)
	}

	sort.Ints(nums)

	sessions := make([]*model.Session, 0, len(nums))
	for _, n := range nums {
		prefix := fmt.Sprintf("raw/%05d", n)

		s := &model.Session{
			ID:       fmt.Sprintf("saz-%05d", n),
			Protocol: constant.ProtocolHTTP,
			State:    constant.SessionStateCompleted,
		}

		// Parse request.
		reqData, err := readZipFile(files, prefix+"_c.txt")
		if err != nil {
			return nil, fmt.Errorf("read request %d: %w", n, err)
		}
		req, reqBody, err := parseRawRequest(reqData)
		if err != nil {
			return nil, fmt.Errorf("parse request %d: %w", n, err)
		}
		s.Request = req
		s.Request.Body = reqBody
		s.Request.BodySize = int64(len(reqBody))

		// Extract target from Host header.
		if host := s.Request.Headers.Get("Host"); host != "" {
			parts := strings.SplitN(host, ":", 2)
			s.Target.Host = parts[0]
			if len(parts) == 2 {
				if p, err := strconv.Atoi(parts[1]); err == nil {
					s.Target.Port = p
				}
			} else {
				s.Target.Port = 80
			}
		}

		// Parse response.
		if rf, ok := files[prefix+"_s.txt"]; ok {
			respData, err := readFileBytes(rf)
			if err != nil {
				return nil, fmt.Errorf("read response %d: %w", n, err)
			}
			resp, respBody, err := parseRawResponse(respData)
			if err != nil {
				return nil, fmt.Errorf("parse response %d: %w", n, err)
			}
			s.Response = resp
			s.Response.Body = respBody
			s.Response.BodySize = int64(len(respBody))
		}

		// Parse metadata for timing.
		if mf, ok := files[prefix+"_m.xml"]; ok {
			xmlData, err := readFileBytes(mf)
			if err == nil {
				parseSAZMeta(xmlData, s)
			}
		}

		// Detect HTTPS from URL scheme.
		if s.Request != nil && strings.HasPrefix(s.Request.URL, "https://") {
			s.Protocol = constant.ProtocolTLS
		}

		sessions = append(sessions, s)
	}

	return sessions, nil
}

// --- raw HTTP builders ---

func buildRawRequest(msg *model.HTTPMessage) []byte {
	var buf bytes.Buffer

	method := msg.Method
	if method == "" {
		method = "GET"
	}
	httpVersion := msg.HTTPVersion
	if httpVersion == "" {
		httpVersion = "HTTP/1.1"
	}
	url := msg.URL
	if url == "" {
		url = "/"
	}

	fmt.Fprintf(&buf, "%s %s %s\r\n", method, url, httpVersion)

	headers := cloneHeaders(msg.Headers)
	if len(msg.Body) > 0 && headers.Get("Content-Length") == "" {
		headers.Set("Content-Length", strconv.Itoa(len(msg.Body)))
	}
	writeHeaders(&buf, headers)

	buf.WriteString("\r\n")

	if len(msg.Body) > 0 {
		buf.Write(msg.Body)
	}

	return buf.Bytes()
}

func buildRawResponse(msg *model.HTTPMessage) []byte {
	var buf bytes.Buffer

	httpVersion := msg.HTTPVersion
	if httpVersion == "" {
		httpVersion = "HTTP/1.1"
	}
	statusCode := msg.StatusCode
	if statusCode == 0 {
		statusCode = 200
	}
	statusText := msg.StatusText
	if statusText == "" {
		statusText = http.StatusText(statusCode)
	} else if i := strings.IndexByte(statusText, ' '); i >= 0 {
		// Strip "200 OK" → "OK" to avoid duplicate code in status line.
		statusText = statusText[i+1:]
	}

	fmt.Fprintf(&buf, "%s %d %s\r\n", httpVersion, statusCode, statusText)

	headers := cloneHeaders(msg.Headers)
	if len(msg.Body) > 0 && headers.Get("Content-Length") == "" {
		headers.Set("Content-Length", strconv.Itoa(len(msg.Body)))
	}
	writeHeaders(&buf, headers)

	buf.WriteString("\r\n")

	if len(msg.Body) > 0 {
		buf.Write(msg.Body)
	}

	return buf.Bytes()
}

func cloneHeaders(h http.Header) http.Header {
	if h == nil {
		return http.Header{}
	}
	return h.Clone()
}

func writeHeaders(buf *bytes.Buffer, headers http.Header) {
	for name, values := range headers {
		for _, v := range values {
			fmt.Fprintf(buf, "%s: %s\r\n", name, v)
		}
	}
}

// --- raw HTTP parsers ---

func parseRawRequest(data []byte) (*model.HTTPMessage, []byte, error) {
	reader := bufio.NewReader(bytes.NewReader(data))
	req, err := http.ReadRequest(reader)
	if err != nil {
		return nil, nil, fmt.Errorf("parse http request: %w", err)
	}
	defer func() { _ = req.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(req.Body, 32<<20))
	if err != nil {
		return nil, nil, fmt.Errorf("read request body: %w", err)
	}

	headers := req.Header
	// Restore Host header — http.ReadRequest moves it to req.Host.
	if req.Host != "" && headers.Get("Host") == "" {
		headers.Set("Host", req.Host)
	}

	msg := &model.HTTPMessage{
		Method:      req.Method,
		URL:         req.RequestURI,
		HTTPVersion: fmt.Sprintf("HTTP/%d.%d", req.ProtoMajor, req.ProtoMinor),
		Headers:     headers,
		ContentType: req.Header.Get("Content-Type"),
	}

	return msg, body, nil
}

func parseRawResponse(data []byte) (*model.HTTPMessage, []byte, error) {
	reader := bufio.NewReader(bytes.NewReader(data))
	resp, err := http.ReadResponse(reader, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("parse http response: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, nil, fmt.Errorf("read response body: %w", err)
	}

	// Strip status code prefix from resp.Status ("200 OK" → "OK").
	// Preserves custom status text from external SAZ files.
	statusText := resp.Status
	if i := strings.IndexByte(statusText, ' '); i >= 0 {
		statusText = statusText[i+1:]
	}

	msg := &model.HTTPMessage{
		StatusCode:  resp.StatusCode,
		StatusText:  statusText,
		HTTPVersion: fmt.Sprintf("HTTP/%d.%d", resp.ProtoMajor, resp.ProtoMinor),
		Headers:     resp.Header,
		ContentType: resp.Header.Get("Content-Type"),
	}

	return msg, body, nil
}

// --- SAZ metadata ---

func buildSAZMeta(sid int, s *model.Session) sazSession {
	ts := s.CreatedAt.UTC().Format(time.RFC3339Nano)
	end := s.CreatedAt.Add(s.Duration).UTC().Format(time.RFC3339Nano)

	meta := sazSession{
		SID: sid,
		Timers: sazTimers{
			ClientConnected:    ts,
			ClientBeginRequest: ts,
			ClientDoneRequest:  ts,
			ServerConnected:    ts,
			ServerBeginResponse: end,
			ServerDoneResponse: end,
			ClientDoneResponse: end,
		},
	}

	if s.Target.Host != "" {
		meta.Flags.Flags = append(meta.Flags.Flags, sazFlag{
			N: "x-hostip",
			V: s.Target.Host,
		})
	}

	return meta
}

func parseSAZMeta(data []byte, s *model.Session) {
	var meta sazSession
	if err := xml.Unmarshal(data, &meta); err != nil {
		return
	}

	start, errS := time.Parse(time.RFC3339Nano, meta.Timers.ClientConnected)
	end, errE := time.Parse(time.RFC3339Nano, meta.Timers.ClientDoneResponse)
	if errS == nil && errE == nil {
		s.CreatedAt = start
		s.Duration = end.Sub(start)
	} else if errS == nil {
		s.CreatedAt = start
	}
}

// --- zip helpers ---

func readZipFile(files map[string]*zip.File, name string) ([]byte, error) {
	f, ok := files[name]
	if !ok {
		return nil, fmt.Errorf("file %s not found", name)
	}
	return readFileBytes(f)
}
