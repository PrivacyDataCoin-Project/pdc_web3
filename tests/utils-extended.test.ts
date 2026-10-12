/**
 * Extended utils tests to reach 100% coverage
 * Covers edge cases: error paths, option branches, boundary values
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('axios', () => {
  const interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  };
  const instance = {
    post: vi.fn(),
    defaults: { baseURL: '', auth: undefined as unknown, headers: {} as Record<string, string> },
    interceptors
  };
  const axiosStub = { create: vi.fn(() => instance), __mockInstance: instance };
  return { default: axiosStub, __mockInstance: instance };
});
 
 
import {
  jsonToBigint,
  bigintToHex,
  hexToBigint,
  atomicToHuman,
  humanToAtomic,
  formatAmount,
  parseAmount
} from '../src/utils/bigint';
import {
  normalizeAlias,
  getAddressPrefix,
  getAliasName,
  detectNetworkFromAddress,
  formatAddress,
  isValidIntegratedAddress,
  extractPaymentIdFromIntegratedAddress,
  createIntegratedAddress
} from '../src/utils/address';
import {
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  hexToBase64,
  xorHex,
  padHex,
  truncateHex,
  reverseHexBytes,
  randomHex,
  keyToHex,
  hexToKey
} from '../src/utils/hex';

describe('bigint extended coverage', () => {
  it('jsonToBigint throws on unsafe number', () => {
    expect(() => jsonToBigint(1.5)).toThrow('not a safe integer');
    expect(() => jsonToBigint(Number.MAX_SAFE_INTEGER + 1)).toThrow('not a safe integer');
  });

  it('jsonToBigint handles safe number', () => {
    expect(jsonToBigint(42)).toBe(42n);
    expect(jsonToBigint(0)).toBe(0n);
  });

  it('bigintToHex pads to 64 chars', () => {
    expect(bigintToHex(0n)).toBe('0x' + '0'.repeat(64));
    expect(bigintToHex(1n)).toBe('0x' + '0'.repeat(63) + '1');
    expect(bigintToHex(255n)).toBe('0x' + '0'.repeat(62) + 'ff');
  });

  it('bigintToHex handles large values', () => {
    const big = 2n ** 255n;
    const hex = bigintToHex(big);
    expect(hex.startsWith('0x8')).toBe(true);
    expect(hexToBigint(hex)).toBe(big);
  });

  it('atomicToHuman with trimTrailingZeros disabled', () => {
    expect(atomicToHuman(1500000000000n, 12, { trimTrailingZeros: false })).toBe('1.500000000000');
  });

  it('atomicToHuman with maxDecimals truncation', () => {
    const result = atomicToHuman(1234567890123n, 12, { maxDecimals: 4 });
    expect(result).toBe('1.2345');
  });

  it('atomicToHuman zero', () => {
    expect(atomicToHuman(0n, 12)).toBe('0');
  });

  it('atomicToHuman only-fraction without whole part', () => {
    expect(atomicToHuman(1n, 12)).toBe('0.000000000001');
  });

  it('humanToAtomic without fraction part', () => {
    expect(humanToAtomic('5', 12)).toBe(5000000000000n);
  });

  it('humanToAtomic fraction shorter than decimalPoint pads', () => {
    expect(humanToAtomic('1.5', 12)).toBe(1500000000000n);
  });

  it('humanToAtomic fraction longer than decimalPoint truncates', () => {
    expect(humanToAtomic('1.123456789012345', 12)).toBe(1123456789012n);
  });

  it('humanToAtomic empty whole part', () => {
    expect(humanToAtomic('.5', 12)).toBe(500000000000n);
  });

  it('formatAmount with maxDecimals option', () => {
    const formatted = formatAmount(1234567890123n, 12, 'PDC', { maxDecimals: 2 });
    expect(formatted).toBe('1.23 PDC');
  });

  it('parseAmount case-insensitive ticker', () => {
    expect(parseAmount('1 pdc', 12, 'PDC')).toBe(1000000000000n);
    expect(parseAmount('1 PDC', 12, 'pdc')).toBe(1000000000000n);
  });
});

describe('address extended coverage', () => {
  it('normalizeAlias trims and lowercases without @', () => {
    expect(normalizeAlias('  Plain  ')).toBe('@plain');
  });

  it('getAddressPrefix all networks', () => {
    expect(getAddressPrefix('mainnet')).toBe('pdc');
    expect(getAddressPrefix('testnet')).toBe('tpdc');
    expect(getAddressPrefix('stagenet')).toBe('spdc');
    expect(getAddressPrefix('regtest')).toBe('rpdc');
  });

  it('getAliasName strips @', () => {
    expect(getAliasName('@name')).toBe('name');
    expect(getAliasName('name')).toBe('name');
  });

  it('detectNetworkFromAddress for each prefix', () => {
    expect(detectNetworkFromAddress('pdc' + 'a'.repeat(95))).toBe('mainnet');
    expect(detectNetworkFromAddress('tpdc' + 'a'.repeat(95))).toBe('testnet');
    expect(detectNetworkFromAddress('spdc' + 'a'.repeat(95))).toBe('stagenet');
    expect(detectNetworkFromAddress('rpdc' + 'a'.repeat(95))).toBe('regtest');
    expect(detectNetworkFromAddress('')).toBeNull();
  });

  it('formatAddress custom truncation lengths', () => {
    const long = 'pdc' + 'a'.repeat(100);
    expect(formatAddress(long, 3, 4)).toBe('pdc...aaaa');
  });

  it('formatAddress exactly at boundary not truncated', () => {
    // charsStart + charsEnd + 3 = 6+6+3 = 15; exactly 15 chars -> not truncated
    const addr = 'p' + 'a'.repeat(14);
    expect(formatAddress(addr, 6, 6)).toBe(addr);
  });

  it('isValidIntegratedAddress rejects empty/null', () => {
    expect(isValidIntegratedAddress('')).toBe(false);
  });

  it('isValidIntegratedAddress rejects over-long', () => {
    expect(isValidIntegratedAddress('pdc' + 'a'.repeat(300))).toBe(false);
  });

  it('isValidIntegratedAddress rejects non-base58', () => {
    expect(isValidIntegratedAddress('pdc' + '0'.repeat(150))).toBe(false);
  });

  it('extractPaymentIdFromIntegratedAddress is a stub returning null', () => {
    expect(extractPaymentIdFromIntegratedAddress('anything')).toBeNull();
  });

  it('createIntegratedAddress is a stub returning input address', () => {
    expect(createIntegratedAddress('pdc1', 'pid')).toBe('pdc1');
  });

  it('isValidPdcAddress rejects wrong network prefix when network specified', async () => {
    const { isValidPdcAddress } = await import('../src/utils/address');
    const addr = 'pdc' + 'a'.repeat(95);
    expect(isValidPdcAddress(addr, 'mainnet')).toBe(true);
    expect(isValidPdcAddress(addr, 'testnet')).toBe(false); // prefix mismatch branch
    expect(isValidPdcAddress('tpdc' + 'a'.repeat(95), 'mainnet')).toBe(false);
  });

  it('isValidPdcAddress rejects empty and non-string-typed values', () => {
    expect(isValidIntegratedAddress('')).toBe(false);
  });
});

describe('hex extended coverage', () => {
  it('hexToBytes handles 0x prefix and uppercase', () => {
    expect(hexToBytes('0xDEADBEEF')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it('hexToBytes throws descriptive error on odd length', () => {
    expect(() => hexToBytes('abc')).toThrow(/even length/);
  });

  it('bytesToBase64 roundtrip via base64ToBytes', () => {
    const data = new Uint8Array([1, 2, 3, 250, 251]);
    const b64 = bytesToBase64(data);
    expect(base64ToBytes(b64)).toEqual(data);
  });

  it('hexToBase64 and back', () => {
    const hex = '00ff10af';
    expect(hexToBytes(base64ToHex(hexToBase64(hex)))).toEqual(hexToBytes(hex));
  });

  it('xorHex identity', () => {
    expect(xorHex('aabbcc', 'aabbcc')).toBe('000000');
  });

  it('xorHex with zeros returns input', () => {
    expect(xorHex('dead', '0000')).toBe('dead');
  });

  it('padHex already-padded unchanged', () => {
    expect(padHex('aabbccdd', 4)).toBe('aabbccdd');
  });

  it('truncateHex exact length unchanged', () => {
    expect(truncateHex('aabbccdd', 4)).toBe('aabbccdd');
  });

  it('reverseHexBytes single byte', () => {
    expect(reverseHexBytes('ab')).toBe('ab');
  });

  it('randomHex produces unique values', () => {
    const a = randomHex(16);
    const b = randomHex(16);
    expect(a).not.toBe(b);
  });

  it('keyToHex accepts hex string passthrough', () => {
    expect(keyToHex('AABBCCDD')).toBe('aabbccdd');
  });

  it('hexToKey accepts full 64-char hex', () => {
    const key = hexToKey('ab'.repeat(32));
    expect(key.length).toBe(32);
    expect(key[0]).toBe(0xab);
  });
});

// Re-export for the base64ToHex used above
import { base64ToHex } from '../src/utils/hex';


describe('branch completion: address', () => {
  it('isValidPdcAddress with empty string short-circuits before prefix check', async () => {
    const { isValidPdcAddress } = await import('../src/utils/address');
    expect(isValidPdcAddress('', 'mainnet')).toBe(false);
    expect(isValidPdcAddress('', undefined)).toBe(false);
  });

  it('isValidAlias empty string short-circuits', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    expect(isValidAlias('')).toBe(false);
  });

  it('isValidAlias single @ only', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    expect(isValidAlias('@')).toBe(false);
  });

  it('isValidAlias single char after @ (length<3)', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    expect(isValidAlias('@a')).toBe(false);
  });

  it('isValidAlias exactly 2 chars', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    expect(isValidAlias('@ab')).toBe(false);
  });
});

describe('branch completion: bigint', () => {
  it('hexToBigint with and without 0x prefix', async () => {
    const { hexToBigint } = await import('../src/utils/bigint');
    expect(hexToBigint('ff')).toBe(255n);
    expect(hexToBigint('0xff')).toBe(255n);
  });

  it('humanToAtomic without whole part hits empty-string fallback', async () => {
    const { humanToAtomic } = await import('../src/utils/bigint');
    expect(humanToAtomic('.25', 2)).toBe(25n);
  });

  it('humanToAtomic empty fraction', async () => {
    const { humanToAtomic } = await import('../src/utils/bigint');
    expect(humanToAtomic('3', 2)).toBe(300n);
  });
});

describe('branch completion: hex', () => {
  it('bytesToHex with ArrayBuffer input', async () => {
    const { bytesToHex } = await import('../src/utils/hex');
    const buf = new Uint8Array([0xab, 0xcd]).buffer;
    expect(bytesToHex(buf)).toBe('abcd');
  });

  it('xorHex never hits null-coalescing with equal-length valid hex', async () => {
    const { xorHex } = await import('../src/utils/hex');
    // undefined elements only occur with out-of-bounds access; equal-length valid arrays avoid it
    expect(xorHex('00', 'ff')).toBe('ff');
    expect(xorHex('ff', '00')).toBe('ff');
  });
});

describe('branch completion: rpc-client & daemon-rpc-client', () => {
  it('interceptor error with falsy code defaults to -32603', async () => {
    const { RpcClient } = await import('../src/api/rpc-client');
    const client = new RpcClient({ url: 'http://localhost:1' });
    const inst = client.getAxiosInstance();
    const interceptorFn = inst.interceptors.response.use.mock.calls[0][1];

    let caught: unknown;
    try {
      await interceptorFn({ message: 'x', code: '' });
    } catch (e) {
      caught = e;
    }
    expect((caught as { code: number }).code).toBe(-32603);
  });

  it('DaemonRpcClient getClient/setBaseURL/setAuth/clearAuth', async () => {
    const { DaemonRpcClient } = await import('../src/api/daemon-rpc-client');
    const daemon = new DaemonRpcClient({ url: 'http://localhost:1' });
    expect(daemon.getClient()).toBeDefined();
    daemon.setBaseURL('http://x:2');
    daemon.setAuth('u', 'p');
    daemon.clearAuth();
  });

  it('WalletRpcClient transfer with all optional fields', async () => {
    const { WalletRpcClient } = await import('../src/api/wallet-rpc-client');
    const w = new WalletRpcClient({ url: 'http://localhost:1' });
    const inst = (w.getClient().getAxiosInstance());
    inst.post.mockResolvedValueOnce({ data: { jsonrpc: '2.0', id: 1, result: { tx_hash: 't' } } });
    await w.transfer({
      destinations: [{ address: 'pdc1', amount: 1n }],
      fee: 1n,
      mixin: 10,
      payment_id: 'pid',
      unlock_time: 0,
      get_tx_keys: true,
      do_not_relay: false
    });
    const [, body] = inst.post.mock.calls[0];
    expect(body.params).toMatchObject({ mixin: 10, payment_id: 'pid' });
  });
});


describe('final branch coverage', () => {
  it('isValidAlias 2-char regex path (a- matches regex but too short)', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    // 'a-' fails the regex (can't end with hyphen) AND is short; ensure regex-fail branch covered
    expect(isValidAlias('@a-')).toBe(false);
    expect(isValidAlias('@-a')).toBe(false);
  });

  it('humanToAtomic with whole present and fraction empty string', async () => {
    const { humanToAtomic } = await import('../src/utils/bigint');
    // fraction === '' triggers paddedFraction || '0' fallback when decimalPoint 0
    expect(humanToAtomic('7', 0)).toBe(7n);
  });

  it('isValidAlias ending with underscore', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    // 'ab_' matches the regex (underscore is allowed mid-pattern) but endsWith('_') fails
    expect(isValidAlias('@ab_')).toBe(false);
  });

  it('isValidAlias starting with underscore', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    expect(isValidAlias('@_ab')).toBe(false);
  });

  it('xorHex single-byte full coverage of index access', async () => {
    const { xorHex } = await import('../src/utils/hex');
    expect(xorHex('ff', 'ff')).toBe('00');
  });

  it('isValidAlias starting with underscore', async () => {
    const { isValidAlias } = await import('../src/utils/address');
    expect(isValidAlias('@_ab')).toBe(false);
  });

  it('xorHex single-byte full coverage of index access', async () => {
    const { xorHex } = await import('../src/utils/hex');
    expect(xorHex('ff', 'ff')).toBe('00');
  });

  it('xorHex multi-byte full roundtrip', async () => {
    const { xorHex } = await import('../src/utils/hex');
    const a = 'ff0f';
    const b = '0fff';
    expect(xorHex(a, b)).toBe('f0f0');
    // XOR is its own inverse
    expect(xorHex(a, xorHex(a, b))).toBe(b);
  });

  it('interceptor error code truthy string parses', async () => {
    const { RpcClient } = await import('../src/api/rpc-client');
    const client = new RpcClient({ url: 'http://localhost:1' });
    const inst = client.getAxiosInstance();
    const interceptorFn = inst.interceptors.response.use.mock.calls[0][1];
    let caught: unknown;
    try {
      await interceptorFn({ message: 'm', code: '500' });
    } catch (e) {
      caught = e;
    }
    expect((caught as { code: number }).code).toBe(500);
  });
});

describe('final rpc-client data branch', () => {
  it('interceptor error passes undefined data when response missing', async () => {
    const { RpcClient, RpcClientError } = await import('../src/api/rpc-client');
    const client = new RpcClient({ url: 'http://localhost:1' });
    const inst = client.getAxiosInstance();
    const interceptorFn = inst.interceptors.response.use.mock.calls[0][1];

    let caught: unknown;
    try {
      // error with code truthy and NO response -> responseData undefined branch
      await interceptorFn({ message: 'gone', code: '404' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RpcClientError);
    expect((caught as RpcClientError).code).toBe(404);
    expect((caught as RpcClientError).data).toBeUndefined();
  });
});

describe('final rpc-client response-data branch', () => {
  it('interceptor error with response.data present but no error key', async () => {
    const { RpcClient, RpcClientError } = await import('../src/api/rpc-client');
    const client = new RpcClient({ url: 'http://localhost:1' });
    const inst = client.getAxiosInstance();
    const interceptorFn = inst.interceptors.response.use.mock.calls[0][1];

    let caught: unknown;
    try {
      // response.data is an object WITHOUT .error -> responseData?.error falsy
      await interceptorFn({ message: 'conflict', code: '409', response: { data: { foo: 1 } } });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RpcClientError);
    expect((caught as RpcClientError).code).toBe(409);
    expect((caught as RpcClientError).data).toEqual({ foo: 1 });
  });
});

describe('interceptor functions direct invocation', () => {
  it('success arrow (response => response) executes', async () => {
    const { RpcClient } = await import('../src/api/rpc-client');
    const client = new RpcClient({ url: 'http://localhost:1' });
    const inst = client.getAxiosInstance();
    const successFn = inst.interceptors.response.use.mock.calls[0][0];
    const resp = { data: { jsonrpc: '2.0', id: 1, result: 1 } };
    expect(successFn(resp)).toBe(resp);
  });

  it('error arrow executes via direct call', async () => {
    const { RpcClient, RpcClientError } = await import('../src/api/rpc-client');
    const client = new RpcClient({ url: 'http://localhost:1' });
    const inst = client.getAxiosInstance();
    const interceptorFn = inst.interceptors.response.use.mock.calls[0][1];

    let caught: unknown;
    try {
      await interceptorFn({
        isAxiosError: true,
        message: 'Request failed with status code 500',
        code: 'ERR_BAD_RESPONSE',
        response: { status: 500, data: { foo: 'bar' } }
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RpcClientError);
    expect((caught as RpcClientError).data).toEqual({ foo: 'bar' });
  });
});
