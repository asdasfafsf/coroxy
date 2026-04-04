package model

// ProxyConfig holds the configuration for the proxy engine.
type ProxyConfig struct {
	HTTPAddr  string `json:"http_addr"`
	SOCKSAddr string `json:"socks_addr"`
}

// DefaultProxyConfig returns a ProxyConfig with sensible defaults.
func DefaultProxyConfig() ProxyConfig {
	return ProxyConfig{
		HTTPAddr:  ":8673",
		SOCKSAddr: ":8674",
	}
}
