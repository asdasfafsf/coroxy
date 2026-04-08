package proxy

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"time"

	"coroxy/internal/model"
)

// maxWSFrames is the maximum number of WebSocket frames to capture per session.
const maxWSFrames = 500

// maxWSPayloadCapture is the maximum payload size to capture per frame (64 KB).
const maxWSPayloadCapture = 64 << 10

// parseWSFrames attempts to parse WebSocket frames from captured raw bytes.
// Returns as many frames as can be parsed; stops at the first parse error.
// The raw bytes may include the initial HTTP upgrade response (for server direction),
// which is skipped by looking for the first valid WS frame header.
func parseWSFrames(data []byte, direction string) []model.WSFrame {
	r := bytes.NewReader(data)
	var frames []model.WSFrame

	// Skip HTTP response header if present (server direction).
	if direction == "server" && len(data) > 4 && string(data[:4]) == "HTTP" {
		// Find end of HTTP headers.
		idx := bytes.Index(data, []byte("\r\n\r\n"))
		if idx >= 0 {
			_, _ = r.Seek(int64(idx+4), io.SeekStart)
		}
	}

	for r.Len() > 2 && len(frames) < maxWSFrames {
		frame, _, err := readWSFrame(r)
		if err != nil {
			break // stop on parse error
		}
		payload := frame.payload
		if len(payload) > maxWSPayloadCapture {
			payload = payload[:maxWSPayloadCapture]
		}
		frames = append(frames, model.WSFrame{
			Direction: direction,
			Opcode:    frame.opcode,
			Payload:   payload,
			Timestamp: time.Now(),
		})
	}
	return frames
}

type wsRawFrame struct {
	opcode  int
	payload []byte
}

// readWSFrame reads a single WebSocket frame and returns the parsed frame + raw bytes.
func readWSFrame(r io.Reader) (*wsRawFrame, []byte, error) {
	// Read first 2 bytes: FIN + opcode + mask + payload length.
	header := make([]byte, 2)
	if _, err := io.ReadFull(r, header); err != nil {
		return nil, nil, err
	}

	opcode := int(header[0] & 0x0F)
	masked := header[1]&0x80 != 0
	length := uint64(header[1] & 0x7F)

	raw := make([]byte, 0, 128)
	raw = append(raw, header...)

	// Extended payload length.
	switch length {
	case 126:
		ext := make([]byte, 2)
		if _, err := io.ReadFull(r, ext); err != nil {
			return nil, nil, fmt.Errorf("read ws extended length: %w", err)
		}
		raw = append(raw, ext...)
		length = uint64(binary.BigEndian.Uint16(ext))
	case 127:
		ext := make([]byte, 8)
		if _, err := io.ReadFull(r, ext); err != nil {
			return nil, nil, fmt.Errorf("read ws extended length: %w", err)
		}
		raw = append(raw, ext...)
		length = binary.BigEndian.Uint64(ext)
	}

	// Masking key (4 bytes if masked).
	var maskKey []byte
	if masked {
		maskKey = make([]byte, 4)
		if _, err := io.ReadFull(r, maskKey); err != nil {
			return nil, nil, fmt.Errorf("read ws mask key: %w", err)
		}
		raw = append(raw, maskKey...)
	}

	// Payload.
	if length > 32<<20 {
		return nil, nil, fmt.Errorf("ws frame too large: %d bytes", length)
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(r, payload); err != nil {
		return nil, nil, fmt.Errorf("read ws payload: %w", err)
	}
	raw = append(raw, payload...)

	// Unmask if needed.
	if masked {
		for i := range payload {
			payload[i] ^= maskKey[i%4]
		}
	}

	return &wsRawFrame{opcode: opcode, payload: payload}, raw, nil
}
