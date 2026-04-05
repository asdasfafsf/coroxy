export namespace app {
	
	export class BreakpointPending {
	    id: string;
	    method: string;
	    url: string;
	    host: string;
	    rule_id: string;
	
	    static createFrom(source: any = {}) {
	        return new BreakpointPending(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.method = source["method"];
	        this.url = source["url"];
	        this.host = source["host"];
	        this.rule_id = source["rule_id"];
	    }
	}
	export class ComposerRequest {
	    method: string;
	    url: string;
	    headers: Record<string, string>;
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new ComposerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	    }
	}
	export class ComposerResponse {
	    status_code: number;
	    status_text: string;
	    headers: Record<string, string>;
	    body: string;
	    body_size: number;
	    duration_ms: number;
	
	    static createFrom(source: any = {}) {
	        return new ComposerResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status_code = source["status_code"];
	        this.status_text = source["status_text"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.body_size = source["body_size"];
	        this.duration_ms = source["duration_ms"];
	    }
	}

}

export namespace intercept {
	
	export class Breakpoint {
	
	
	    static createFrom(source: any = {}) {
	        return new Breakpoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace model {
	
	export class AutoResponse {
	    status_code: number;
	    headers?: Record<string, string>;
	    body?: string;
	    content_type?: string;
	
	    static createFrom(source: any = {}) {
	        return new AutoResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status_code = source["status_code"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.content_type = source["content_type"];
	    }
	}
	export class CAInfo {
	    common_name: string;
	    fingerprint: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    expires_at: any;
	    installed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CAInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.common_name = source["common_name"];
	        this.fingerprint = source["fingerprint"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.expires_at = this.convertValues(source["expires_at"], null);
	        this.installed = source["installed"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Endpoint {
	    host: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new Endpoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	    }
	}
	export class HTTPCookie {
	    name: string;
	    value: string;
	    domain?: string;
	    path?: string;
	    expires?: string;
	    max_age?: number;
	    secure?: boolean;
	    http_only?: boolean;
	    same_site?: string;
	
	    static createFrom(source: any = {}) {
	        return new HTTPCookie(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.domain = source["domain"];
	        this.path = source["path"];
	        this.expires = source["expires"];
	        this.max_age = source["max_age"];
	        this.secure = source["secure"];
	        this.http_only = source["http_only"];
	        this.same_site = source["same_site"];
	    }
	}
	export class QueryParam {
	    name: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryParam(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	    }
	}
	export class HTTPMessage {
	    method?: string;
	    url?: string;
	    status_code?: number;
	    status_text?: string;
	    http_version?: string;
	    headers?: Record<string, Array<string>>;
	    cookies?: HTTPCookie[];
	    query_params?: QueryParam[];
	    content_type?: string;
	    content_encoding?: string;
	    body?: number[];
	    body_size: number;
	
	    static createFrom(source: any = {}) {
	        return new HTTPMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.status_code = source["status_code"];
	        this.status_text = source["status_text"];
	        this.http_version = source["http_version"];
	        this.headers = source["headers"];
	        this.cookies = this.convertValues(source["cookies"], HTTPCookie);
	        this.query_params = this.convertValues(source["query_params"], QueryParam);
	        this.content_type = source["content_type"];
	        this.content_encoding = source["content_encoding"];
	        this.body = source["body"];
	        this.body_size = source["body_size"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HeaderModification {
	    operation: string;
	    name: string;
	    value?: string;
	    target: string;
	
	    static createFrom(source: any = {}) {
	        return new HeaderModification(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.operation = source["operation"];
	        this.name = source["name"];
	        this.value = source["value"];
	        this.target = source["target"];
	    }
	}
	export class MatchCondition {
	    host?: string;
	    path?: string;
	    method?: string;
	
	    static createFrom(source: any = {}) {
	        return new MatchCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.path = source["path"];
	        this.method = source["method"];
	    }
	}
	
	export class Rule {
	    id: string;
	    name: string;
	    enabled: boolean;
	    match: MatchCondition;
	    action: string;
	    priority: number;
	    modifications?: HeaderModification[];
	    auto_response?: AutoResponse;
	
	    static createFrom(source: any = {}) {
	        return new Rule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.match = this.convertValues(source["match"], MatchCondition);
	        this.action = source["action"];
	        this.priority = source["priority"];
	        this.modifications = this.convertValues(source["modifications"], HeaderModification);
	        this.auto_response = this.convertValues(source["auto_response"], AutoResponse);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Timing {
	    dns: number;
	    connect: number;
	    tls: number;
	    ttfb: number;
	    transfer: number;
	
	    static createFrom(source: any = {}) {
	        return new Timing(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dns = source["dns"];
	        this.connect = source["connect"];
	        this.tls = source["tls"];
	        this.ttfb = source["ttfb"];
	        this.transfer = source["transfer"];
	    }
	}
	export class Session {
	    id: string;
	    protocol: string;
	    source: Endpoint;
	    target: Endpoint;
	    request?: HTTPMessage;
	    response?: HTTPMessage;
	    timing?: Timing;
	    state: string;
	    // Go type: time
	    created_at: any;
	    duration: number;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.protocol = source["protocol"];
	        this.source = this.convertValues(source["source"], Endpoint);
	        this.target = this.convertValues(source["target"], Endpoint);
	        this.request = this.convertValues(source["request"], HTTPMessage);
	        this.response = this.convertValues(source["response"], HTTPMessage);
	        this.timing = this.convertValues(source["timing"], Timing);
	        this.state = source["state"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.duration = source["duration"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionFilter {
	    protocol?: string;
	    host?: string;
	    method?: string;
	    status_code?: number;
	    query?: string;
	    state?: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionFilter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.protocol = source["protocol"];
	        this.host = source["host"];
	        this.method = source["method"];
	        this.status_code = source["status_code"];
	        this.query = source["query"];
	        this.state = source["state"];
	    }
	}

}

export namespace session {
	
	export class AutoSaver {
	
	
	    static createFrom(source: any = {}) {
	        return new AutoSaver(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

