import { Context, Next } from 'hono';

const EXCALIDRAW_CONTAINER = process.env.EXCALIDRAW_CONTAINER || 'http://localhost:8080';

export function proxyMiddleware() {
  return async (c: Context, next: Next) => {
    const host = c.req.header('host') || '';
    const baseDomain = process.env.BASE_DOMAIN || 'draw.domain.com';
    
    if (host === baseDomain || host === `localhost:${process.env.PORT || 80}`) {
      return next();
    }
    
    if (host.endsWith(`.${baseDomain}`)) {
      const url = new URL(c.req.url);
      const target = `${EXCALIDRAW_CONTAINER}${url.pathname}${url.search}`;
      
      const headers = new Headers(c.req.raw.headers);
      headers.set('host', new URL(EXCALIDRAW_CONTAINER).host);
      
      return fetch(target, {
        method: c.req.method,
        headers,
        body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
      });
    }
    
    return next();
  };
}
