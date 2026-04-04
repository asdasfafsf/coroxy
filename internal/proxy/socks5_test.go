package proxy

import (
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"net"
	"sync"
	"testing"
	"time"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func startSOCKS5Server(t *testing.T, s *SOCKS5Proxy) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go s.HandleConn(conn)
		}
	}()

	t.Cleanup(func() { _ = listener.Close() })
	return listener.Addr().String()
}

func socks5Connect(t *testing.T, proxyAddr, targetAddr string) net.Conn {
	t.Helper()

	conn, err := net.DialTimeout("tcp", proxyAddr, 5*time.Second)
	if err != nil {
		t.Fatalf("dial proxy: %v", err)
	}

	// Handshake: version 5, 1 method (no auth).
	conn.Write([]byte{0x05, 0x01, 0x00})

	resp := make([]byte, 2)
	io.ReadFull(conn, resp)
	if resp[0] != 0x05 || resp[1] != 0x00 {
		t.Fatalf("handshake failed: %v", resp)
	}

	// CONNECT request.
	host, portStr, _ := net.SplitHostPort(targetAddr)
	port := 0
	fmt.Sscanf(portStr, "%d", &port)

	ip := net.ParseIP(host)
	if ip != nil && ip.To4() != nil {
		// IPv4
		req := []byte{0x05, 0x01, 0x00, 0x01}
		req = append(req, ip.To4()...)
		portBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(portBytes, uint16(port))
		req = append(req, portBytes...)
		conn.Write(req)
	} else {
		// Domain
		req := []byte{0x05, 0x01, 0x00, 0x03, byte(len(host))}
		req = append(req, []byte(host)...)
		portBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(portBytes, uint16(port))
		req = append(req, portBytes...)
		conn.Write(req)
	}

	reply := make([]byte, 10)
	io.ReadFull(conn, reply)
	if reply[1] != 0x00 {
		t.Fatalf("connect failed: status %d", reply[1])
	}

	return conn
}

func TestSOCKS5Connect(t *testing.T) {
	// Target TCP server.
	target, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen target: %v", err)
	}
	defer target.Close()

	go func() {
		conn, err := target.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		io.Copy(conn, conn) // echo
	}()

	var mu sync.Mutex
	var captured []*model.Session
	onSession := adapter.SessionCallback(func(s *model.Session) {
		mu.Lock()
		defer mu.Unlock()
		captured = append(captured, s)
	})

	proxy := NewSOCKS5Proxy(slog.Default(), onSession, nil)
	proxyAddr := startSOCKS5Server(t, proxy)

	// Connect through SOCKS5 proxy.
	conn := socks5Connect(t, proxyAddr, target.Addr().String())
	defer conn.Close()

	// Send data and verify echo.
	conn.Write([]byte("hello socks5"))
	buf := make([]byte, 12)
	n, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(buf[:n]) != "hello socks5" {
		t.Fatalf("echo: got %q, want %q", string(buf[:n]), "hello socks5")
	}

	// Close connection and wait for session capture.
	conn.Close()
	time.Sleep(100 * time.Millisecond)

	// Verify session captured.
	mu.Lock()
	defer mu.Unlock()

	if len(captured) != 1 {
		t.Fatalf("captured: got %d, want 1", len(captured))
	}
	if captured[0].Protocol != constant.ProtocolTCP {
		t.Fatalf("protocol: got %s, want TCP", captured[0].Protocol)
	}
}

func TestSOCKS5ConnectDomain(t *testing.T) {
	// Target TCP server.
	target, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen target: %v", err)
	}
	defer target.Close()

	go func() {
		conn, _ := target.Accept()
		if conn != nil {
			defer conn.Close()
			conn.Write([]byte("domain response"))
		}
	}()

	proxy := NewSOCKS5Proxy(slog.Default(), nil, nil)
	proxyAddr := startSOCKS5Server(t, proxy)

	// Connect using domain name (localhost resolves to 127.0.0.1).
	_, portStr, _ := net.SplitHostPort(target.Addr().String())
	conn := socks5Connect(t, proxyAddr, "localhost:"+portStr)
	defer conn.Close()

	buf := make([]byte, 100)
	n, _ := conn.Read(buf)
	if string(buf[:n]) != "domain response" {
		t.Fatalf("response: got %q, want %q", string(buf[:n]), "domain response")
	}
}

func TestSOCKS5TargetUnreachable(t *testing.T) {
	proxy := NewSOCKS5Proxy(slog.Default(), nil, nil)
	proxyAddr := startSOCKS5Server(t, proxy)

	conn, err := net.DialTimeout("tcp", proxyAddr, 5*time.Second)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Handshake.
	conn.Write([]byte{0x05, 0x01, 0x00})
	resp := make([]byte, 2)
	io.ReadFull(conn, resp)

	// CONNECT to unreachable address.
	req := []byte{0x05, 0x01, 0x00, 0x01, 127, 0, 0, 1, 0, 1} // port 1
	conn.Write(req)

	reply := make([]byte, 10)
	io.ReadFull(conn, reply)
	if reply[1] == 0x00 {
		t.Fatal("expected failure connecting to unreachable target")
	}
}
