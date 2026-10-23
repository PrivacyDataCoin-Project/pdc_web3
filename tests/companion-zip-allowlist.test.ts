/**
 * SEC-004: Companion update zipUrl host allowlist policy.
 * Mirrors extension/update-apply.js (browser non-module — keep hosts in sync).
 */
import { describe, expect, it } from 'vitest';

const ALLOWED_UPDATE_HOSTS = new Set([
  'trade.privacydatacoin.com',
  'github.com',
  'objects.githubusercontent.com',
]);

function absoluteDownloadUrl(url: string | undefined): string {
  if (!url) return 'https://trade.privacydatacoin.com/api/companion/download';
  if (url.startsWith('/')) return `https://trade.privacydatacoin.com${url}`;
  return url;
}

function assertAllowedZipUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Update zip URL must use https');
  }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_UPDATE_HOSTS.has(host)) {
    throw new Error(`Update zip host not allowlisted: ${host}`);
  }
  return url;
}

describe('Companion zipUrl allowlist', () => {
  it('allows trade host and relative paths', () => {
    expect(
      assertAllowedZipUrl(absoluteDownloadUrl('/api/companion/download'))
    ).toBe('https://trade.privacydatacoin.com/api/companion/download');
    expect(
      assertAllowedZipUrl('https://github.com/PrivacyDataCoin-Project/pdc_web3/releases/download/x.zip')
    ).toContain('github.com');
  });

  it('rejects evil hosts', () => {
    expect(() => assertAllowedZipUrl('https://evil.example/x.zip')).toThrow(/not allowlisted/);
    expect(() => assertAllowedZipUrl('http://trade.privacydatacoin.com/x.zip')).toThrow(/https/);
  });
});
