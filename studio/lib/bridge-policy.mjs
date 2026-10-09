export const DATTA_ORIGIN = 'https://boggiomichael.github.io';
export function allowedOrigin(origin, development = false) {
  return origin === DATTA_ORIGIN || (development && /^http:\/\/(localhost|127\.0\.0\.1):4321$/.test(origin));
}
export function validChannel(channel) {
  return typeof channel === 'string' && /^[a-f0-9-]{36}$/.test(channel);
}
export function validRequest(data, channel) {
  if (!data || data.type !== 'datta-request' || data.channel !== channel || !validChannel(data.id)) return false;
  if (!['GET', 'POST'].includes(data.method)) return false;
  if (typeof data.path !== 'string' || data.path.length > 1500) return false;
  if (!/^\/api\/studio(?:\?[^#\\]*)?$/.test(data.path) && !/^\/api\/media(?:\/[a-f0-9-]{36}\.(?:png|jpg|webp))?$/.test(data.path)) return false;
  if (!['', 'application/json', 'image/png', 'image/jpeg', 'image/webp'].includes(data.contentType)) return false;
  if (data.method === 'GET') return data.body == null;
  if (data.path === '/api/studio') return data.contentType === 'application/json' && typeof data.body === 'string' && new TextEncoder().encode(data.body).length <= 650000;
  return data.path === '/api/media' && ['image/png', 'image/jpeg', 'image/webp'].includes(data.contentType) && data.body instanceof ArrayBuffer && data.body.byteLength <= 4 * 1024 * 1024;
}
