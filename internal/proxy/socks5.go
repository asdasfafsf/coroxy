package proxy

import (
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/intercept"
	"coroxy/internal/model"
)

// SOCKS5 protocol constants.
const (
	socks5Version    = 0x05
	socks5NoAuth     = 0x00
	socks5CmdConnect = 0x01
	socks5AddrIPv4   = 0x01
	socks5AddrDomain = 0x03
	socks5AddrIPv6   = 0x04
	socks5Success    = 0x00
	socks5Failure    = 0x01
)

// SOCKS5Proxy handles SOCKS5 proxy connections.
type SOCKS5Proxy struct {
	logger    *slog.Logger
	onSession adapter.SessionCallback
	pipeline  *intercept.Pipeline
}

// NewSOCKS5Proxy creates a new SOCKS5 proxy handler.
func NewSOCKS5Proxy(logger *slog.Logger, onSession adapter.SessionCallback, pipeline *intercept.Pipeline) *SOCKS5Proxy {
	return &SOCKS5Proxy{
		logger:    logger,
		onSession: onSession,
		pipeline:  pipeline,
	}
}

// HandleConn processes a single SOCKS5 connection.
func (s *SOCKS5Proxy) HandleConn(clientConn net.Conn) {
	defer func() { _ = clientConn.Close() }()

	if err := s.handshake(clientConn); err != nil {
		s.logger.Error("socks5 handshake", slog.String("error", err.Error()))
		return
	}

	targetAddr, err := s.readRequest(clientConn)
	if err != nil {
		s.logger.Error("socks5 read request", slog.String("error", err.Error()))
		return
	}

	targetConn, err := net.DialTimeout("tcp", targetAddr, 30*time.Second)
	if err != nil {
		s.sendReply(clientConn, socks5Failure)
		s.logger.Error("socks5 connect target",
			slog.String("addr", targetAddr),
			slog.String("error", err.Error()),
		)
		return
	}
	defer func() { _ = targetConn.Close() }()

	s.sendReply(clientConn, socks5Success)

	start := time.Now()

	// Relay bidirectional traffic.
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = io.Copy(targetConn, clientConn)
		if tc, ok := targetConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()
	go func() {
		defer wg.Done()
		_, _ = io.Copy(clientConn, targetConn)
		if tc, ok := clientConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()
	wg.Wait()

	s.captureSession(targetAddr, time.Since(start))
}

// handshake performs SOCKS5 version and auth method negotiation.
func (s *SOCKS5Proxy) handshake(conn net.Conn) error {
	// Read version and number of methods.
	header := make([]byte, 2)
	if _, err := io.ReadFull(conn, header); err != nil {
		return fmt.Errorf("read handshake header: %w", err)
	}
	if header[0] != socks5Version {
		return fmt.Errorf("unsupported SOCKS version: %d", header[0])
	}

	// Read methods.
	methods := make([]byte, header[1])
	if _, err := io.ReadFull(conn, methods); err != nil {
		return fmt.Errorf("read auth methods: %w", err)
	}

	// Check if no-auth is supported.
	var hasNoAuth bool
	for _, m := range methods {
		if m == socks5NoAuth {
			hasNoAuth = true
			break
		}
	}
	if !hasNoAuth {
		_, _ = conn.Write([]byte{socks5Version, 0xFF}) // no acceptable method
		return fmt.Errorf("no acceptable auth method")
	}

	// Respond with no-auth selected.
	_, err := conn.Write([]byte{socks5Version, socks5NoAuth})
	return err
}

// readRequest reads the SOCKS5 CONNECT request and returns the target address.
func (s *SOCKS5Proxy) readRequest(conn net.Conn) (string, error) {
	// Read VER, CMD, RSV, ATYP.
	header := make([]byte, 4)
	if _, err := io.ReadFull(conn, header); err != nil {
		return "", fmt.Errorf("read request header: %w", err)
	}
	if header[1] != socks5CmdConnect {
		return "", fmt.Errorf("unsupported command: %d (only CONNECT supported)", header[1])
	}

	var host string
	switch header[3] {
	case socks5AddrIPv4:
		addr := make([]byte, 4)
		if _, err := io.ReadFull(conn, addr); err != nil {
			return "", fmt.Errorf("read ipv4 addr: %w", err)
		}
		host = net.IP(addr).String()

	case socks5AddrDomain:
		lenBuf := make([]byte, 1)
		if _, err := io.ReadFull(conn, lenBuf); err != nil {
			return "", fmt.Errorf("read domain length: %w", err)
		}
		domain := make([]byte, lenBuf[0])
		if _, err := io.ReadFull(conn, domain); err != nil {
			return "", fmt.Errorf("read domain: %w", err)
		}
		host = string(domain)

	case socks5AddrIPv6:
		addr := make([]byte, 16)
		if _, err := io.ReadFull(conn, addr); err != nil {
			return "", fmt.Errorf("read ipv6 addr: %w", err)
		}
		host = net.IP(addr).String()

	default:
		return "", fmt.Errorf("unsupported address type: %d", header[3])
	}

	// Read port (2 bytes, big-endian).
	portBuf := make([]byte, 2)
	if _, err := io.ReadFull(conn, portBuf); err != nil {
		return "", fmt.Errorf("read port: %w", err)
	}
	port := binary.BigEndian.Uint16(portBuf)

	return net.JoinHostPort(host, strconv.Itoa(int(port))), nil
}

// sendReply sends a SOCKS5 reply to the client.
func (s *SOCKS5Proxy) sendReply(conn net.Conn, status byte) {
	// VER, REP, RSV, ATYP(IPv4), BND.ADDR(0.0.0.0), BND.PORT(0)
	reply := []byte{socks5Version, status, 0x00, socks5AddrIPv4, 0, 0, 0, 0, 0, 0}
	_, _ = conn.Write(reply)
}

// captureSession creates a completed TCP session record.
func (s *SOCKS5Proxy) captureSession(targetAddr string, duration time.Duration) {
	if s.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(targetAddr, 0)

	session := &model.Session{
		ID:        uuid.NewString(),
		Protocol:  constant.ProtocolTCP,
		Target:    model.Endpoint{Host: targetHost, Port: targetPort},
		State:     constant.SessionStateCompleted,
		CreatedAt: time.Now().Add(-duration),
		Duration:  duration,
	}

	s.onSession(session)
}
