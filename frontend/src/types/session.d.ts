// Monaco editor에 주입할 Session 타입. 사용자가 JS predicate 작성 시
// `(s: Session) => boolean` 시그니처에서 자동완성이 동작하도록 한다.
// Wails 바인딩 실제 타입(frontend/wailsjs/go/models.ts)에서 JS predicate
// 관점에서 의미 있는 필드만 추려서 기록. 추가 필드가 필요하면 여기에 반영.

interface Endpoint {
  host: string;
  port: number;
}

interface HTTPMessage {
  method?: string;
  url?: string;
  status_code?: number;
  status_text?: string;
  http_version?: string;
  headers?: Record<string, string[]>;
  content_type?: string;
  content_encoding?: string;
  body?: number[];
  body_size: number;
}

interface Timing {
  dns: number;
  connect: number;
  tls: number;
  ttfb: number;
  transfer: number;
}

interface Session {
  id: string;
  protocol: string;
  source: Endpoint;
  target: Endpoint;
  request?: HTTPMessage;
  response?: HTTPMessage;
  timing?: Timing;
  state: string;
  created_at: string;
  duration: number;
  tags?: string[];
  comment?: string;
}
