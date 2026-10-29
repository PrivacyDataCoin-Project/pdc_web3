/**
 * MessageSender.origin is the page origin. Older paths only set sender.url,
 * which includes path and query and will never match an origin allowlist.
 * @param {unknown} sender
 * @returns {string}
 */
export function messageOrigin(sender) {
  if (!sender || typeof sender !== 'object') return 'unknown';
  const origin = /** @type {{ origin?: unknown, url?: unknown }} */ (sender).origin;
  if (typeof origin === 'string' && origin) return origin;
  const url = /** @type {{ url?: unknown }} */ (sender).url;
  if (typeof url === 'string' && url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
      // Node's URL.origin is the string "null" for extension schemes.
      const match = /^(chrome-extension|moz-extension):\/\/[^/]+/i.exec(parsed.href);
      if (match) return match[0];
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}
