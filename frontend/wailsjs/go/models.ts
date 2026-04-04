export namespace model {
	
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
	export class HTTPMessage {
	    method?: string;
	    url?: string;
	    status_code?: number;
	    status_text?: string;
	    headers?: Record<string, Array<string>>;
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
	        this.headers = source["headers"];
	        this.body_size = source["body_size"];
	    }
	}
	export class Session {
	    id: string;
	    protocol: string;
	    source: Endpoint;
	    target: Endpoint;
	    request?: HTTPMessage;
	    response?: HTTPMessage;
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

}

