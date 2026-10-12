/**
 * Environment-matrix coverage for hex.ts base64/random fallback paths.
 * Uses vi.stubGlobal + vi.resetModules + dynamic import to force each branch.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

 

const g = globalThis as any;

import type * as HexUtils from '../src/utils/hex';

type HexModule = typeof HexUtils;
async function importFresh(): Promise<HexModule> {
  vi.resetModules();
  return import('../src/utils/hex');
}

describe('hex.ts environment matrix', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('btoa branch: bytesToBase64 uses browser API when btoa defined', async () => {
    vi.stubGlobal(
      'btoa',
      vi.fn((binary: string) => Buffer.from(binary, 'binary').toString('base64'))
    );
    const { bytesToBase64 } = await importFresh();
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const b64 = bytesToBase64(data);
    expect(b64).toBe(Buffer.from(data).toString('base64'));
    expect(g.btoa).toHaveBeenCalled();
  });

  it('atob branch: base64ToBytes uses browser API when atob defined', async () => {
    vi.stubGlobal(
      'btoa',
      vi.fn((binary: string) => Buffer.from(binary, 'binary').toString('base64'))
    );
    vi.stubGlobal(
      'atob',
      vi.fn((b64: string) => Buffer.from(b64, 'base64').toString('binary'))
    );
    const { base64ToBytes, bytesToBase64, hexToBase64, base64ToHex, hexToBytes } =
      await importFresh();

    const data = new Uint8Array([0x00, 0xff, 0x10, 0xaf]);
    const b64 = bytesToBase64(data);
    const restored = base64ToBytes(b64);
    expect(Array.from(restored)).toEqual([0x00, 0xff, 0x10, 0xaf]);

    // hexToBase64 + base64ToHex roundtrip via atob branch
    const hex = 'deadbeef00ff';
    const rt = base64ToHex(hexToBase64(hex));
    expect(hexToBytes(rt)).toEqual(hexToBytes(hex));

    expect(g.atob).toHaveBeenCalled();
  });

  it('Node branch: bytesToBase64 uses Buffer when btoa undefined', async () => {
    // Node 18+ defines btoa; remove it to force the Buffer fallback
    const saved = g.btoa;
    delete g.btoa;
    try {
      const { bytesToBase64 } = await importFresh();
      const data = new Uint8Array([1, 2, 3]);
      const b64 = bytesToBase64(data);
      expect(b64).toBe(Buffer.from(data).toString('base64'));
    } finally {
      if (saved !== undefined) g.btoa = saved;
    }
  });

  it('Node branch: base64ToBytes uses Buffer when atob undefined', async () => {
    const saved = g.atob;
    delete g.atob;
    try {
      const { base64ToBytes } = await importFresh();
      const b64 = Buffer.from([9, 8, 7]).toString('base64');
      expect(Array.from(base64ToBytes(b64))).toEqual([9, 8, 7]);
    } finally {
      if (saved !== undefined) g.atob = saved;
    }
  });

  it('crypto branch: randomHex uses crypto.getRandomValues when present', async () => {
    const spy = vi.fn((arr: Uint8Array) => arr.fill(0xab));
    vi.stubGlobal('crypto', { getRandomValues: spy });
    const { randomHex } = await importFresh();
    const hex = randomHex(16);
    expect(hex).toBe('ab'.repeat(16));
    expect(spy).toHaveBeenCalled();
  });

  it('fallback branch: randomHex uses Math.random when crypto absent', async () => {
    const savedCrypto = g.crypto;
    delete g.crypto;
    try {
      const { randomHex } = await importFresh();
      const hex = randomHex(8);
      expect(hex.length).toBe(16);
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
    } finally {
      if (savedCrypto !== undefined) {
        Object.defineProperty(g, 'crypto', {
          value: savedCrypto,
          configurable: true,
          writable: true
        });
      }
    }
  });
});
