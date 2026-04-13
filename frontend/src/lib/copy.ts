import { model } from '../../wailsjs/go/models';
import { decodeBody } from './format';

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function copyUrl(session: model.Session): string {
  return session.request?.url || '';
}

export function copyRequestHeaders(session: model.Session): string {
  const req = session.request;
  if (!req?.headers) return '';
  return Object.entries(req.headers)
    .map(([key, values]) => `${key}: ${(values as string[]).join(', ')}`)
    .join('\n');
}

export function copyResponseHeaders(session: model.Session): string {
  const resp = session.response;
  if (!resp?.headers) return '';
  return Object.entries(resp.headers)
    .map(([key, values]) => `${key}: ${(values as string[]).join(', ')}`)
    .join('\n');
}

export function copyResponseBody(session: model.Session): string {
  return decodeBody(session.response?.body) || '';
}

export function copyCurl(session: model.Session): string {
  const req = session.request;
  if (!req) return '';

  const parts = ['curl'];

  if (req.method && req.method !== 'GET') {
    parts.push(`-X ${req.method}`);
  }

  parts.push(`'${req.url}'`);

  if (req.headers) {
    for (const [key, values] of Object.entries(req.headers)) {
      for (const v of values as string[]) {
        parts.push(`-H '${key}: ${v}'`);
      }
    }
  }

  const body = decodeBody(req.body);
  if (body && ['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
  }

  return parts.join(' \\\n  ');
}
