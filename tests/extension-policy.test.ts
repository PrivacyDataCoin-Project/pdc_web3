import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertWalletMethodAllowed } from '../extension/secret-wallet-methods.mjs';
import { messageOrigin } from '../extension/message-origin.mjs';

describe('blocked wallet methods', () => {
  it('forwards ordinary methods and trims them', () => {
    expect(assertWalletMethodAllowed(' getbalance ')).toBe('getbalance');
    expect(assertWalletMethodAllowed('sign_message')).toBe('sign_message');
  });

  it('rejects missing and blank methods', () => {
    expect(() => assertWalletMethodAllowed(undefined)).toThrow(/required/);
    expect(() => assertWalletMethodAllowed('   ')).toThrow(/required/);
    expect(() => assertWalletMethodAllowed(1)).toThrow(/required/);
    try {
      assertWalletMethodAllowed(1);
    } catch (err) {
      expect((err as { code?: number }).code).toBe(-32602);
    }
  });

  it('rejects seed and key export regardless of case', () => {
    expect(() => assertWalletMethodAllowed('get_seed_phrase_info')).toThrow(/not exposed/);
    expect(() => assertWalletMethodAllowed('Get_Restore_Info')).toThrow(/not exposed/);
    try {
      assertWalletMethodAllowed('export_wallet');
    } catch (err) {
      expect((err as { code?: number }).code).toBe(-32010);
    }
  });
});

describe('message origin', () => {
  it('prefers sender.origin over the full url', () => {
    expect(
      messageOrigin({
        origin: 'https://trade.privacydatacoin.com',
        url: 'https://trade.privacydatacoin.com/swap?x=1',
      })
    ).toBe('https://trade.privacydatacoin.com');
  });

  it('derives an origin from sender.url when origin is missing', () => {
    expect(messageOrigin({ url: 'https://trade.privacydatacoin.com/swap?x=1' })).toBe(
      'https://trade.privacydatacoin.com'
    );
    expect(messageOrigin({ origin: '', url: 'chrome-extension://abc/popup.html' })).toBe(
      'chrome-extension://abc'
    );
    expect(messageOrigin({ url: 'http://127.0.0.1:19212/json_rpc' })).toBe(
      'http://127.0.0.1:19212'
    );
    expect(messageOrigin({ url: 'moz-extension://xyz/options.html' })).toBe('moz-extension://xyz');
    expect(messageOrigin({ url: 'foo://bar' })).toBe('unknown');
  });

  it('fails closed on missing or unparseable senders', () => {
    expect(messageOrigin(null)).toBe('unknown');
    expect(messageOrigin(undefined)).toBe('unknown');
    expect(messageOrigin({})).toBe('unknown');
    expect(messageOrigin({ url: 'not a url' })).toBe('unknown');
    expect(messageOrigin({ url: '' })).toBe('unknown');
    expect(messageOrigin('https://trade.privacydatacoin.com')).toBe('unknown');
  });
});

describe('companion reload origin lock', () => {
  it('content script only honors reload from first-party origins', () => {
    const src = readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8');
    expect(src).toContain('https://trade.privacydatacoin.com');
    expect(src).toContain('https://privacydatacoin.com');
    expect(src).toContain('COMPANION_RELOAD_ORIGINS.has(event.origin)');
  });
});
