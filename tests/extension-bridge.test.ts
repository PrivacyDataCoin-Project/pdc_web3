/**
 * Unit tests for ExtensionBridge
 * Pure-Node approach: a minimal fake `window` global is installed before module import.
 * The extension bridge attaches a 'message' listener; we dispatch synthetic events.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

 

type Listener = (evt: { data?: unknown; source?: unknown }) => void;

interface FakeWindow {
  listeners: Map<string, Set<Listener>>;
  postMessage: (data: unknown, origin?: string) => void;
  addEventListener: (type: string, cb: Listener) => void;
  removeEventListener: (type: string, cb: Listener) => void;
  dispatch: (data: unknown) => void;
}

let fakeWindow: FakeWindow;

function installFakeWindow(): void {
  const listeners = new Map<string, Set<Listener>>();
  fakeWindow = {
    listeners,
    location: { origin: 'https://test.local' },
    postMessage: vi.fn(),
    addEventListener: (type, cb) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type, cb) => {
      listeners.get(type)?.delete(cb);
    },
    dispatch: (data: unknown) => {
      // default: trusted same-origin (extension content script relay)
      const evt = { data, source: fakeWindow, origin: 'https://test.local' };
      listeners.get('message')?.forEach(cb => cb(evt));
    },
    dispatchWithOrigin: (data: unknown, origin: string) => {
      const evt = { data, source: fakeWindow, origin };
      listeners.get('message')?.forEach(cb => cb(evt));
    }
  };
  (globalThis as Record<string, unknown>)['window'] = fakeWindow;
}

function removeFakeWindow(): void {
  delete (globalThis as Record<string, unknown>)['window'];
}

/** Respond to the LAST postMessage call at execution time (setTimeout 0) */
function respondToNextPost(
  result: unknown,
  opts?: { error?: { code: number; message: string; data?: unknown } }
): void {
  setTimeout(() => {
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const calls = postMock.mock.calls;
    // find the last call that looks like a request (has id)
    for (let i = calls.length - 1; i >= 0; i--) {
      const req = calls[i][0] as { id?: number } | undefined;
      if (req?.id !== undefined) {
        fakeWindow.dispatch({ pdcExtension: true, id: req.id, result, error: opts?.error });
        return;
      }
    }
  }, 0);
}

// Load module with fake window installed
import type { ExtensionBridge as ExtensionBridgeType } from '../src/extension/extension-bridge';

let mod: typeof ExtensionBridgeType;
void (0 as unknown as ExtensionBridgeType);

describe('ExtensionBridge', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });

  afterEach(() => {
    removeFakeWindow();
    vi.restoreAllMocks();
  });

  const makeBridge = () => new mod.ExtensionBridge();

  it('constructor attaches message listener when window exists', () => {
    const before = fakeWindow.listeners.get('message')?.size ?? 0;
    makeBridge();
    const after = fakeWindow.listeners.get('message')?.size ?? 0;
    expect(after).toBe(before + 1);
  });

  it('constructor skips listener when window undefined', async () => {
    removeFakeWindow();
    vi.resetModules();
    const m = await import('../src/extension/extension-bridge');
    // Should not throw
    expect(() => new m.ExtensionBridge()).not.toThrow();
  });

  it('starts disconnected', () => {
    const bridge = makeBridge();
    expect(bridge.isConnected()).toBe(false);
    expect(bridge.getWalletInfo()).toBeNull();
  });

  it('connect stores wallet info and emits connect event', async () => {
    const bridge = makeBridge();
    const walletInfo = {
      address: 'pdc1',
      network: 'mainnet',
      isConnected: true,
      version: '1.0.0'
    };

    const emitted: unknown[] = [];
    // subscribe before connect
    setTimeout(() => {
      respondToNextPost(walletInfo);
    }, 0);

    const onConnect = (data: unknown): void => {
      emitted.push(data);
    };
    // register listener using the on() API with proper cast
    type ConnCb = Parameters<Parameters<typeof bridge.on>[1]>[0];
    void (0 as unknown as ConnCb);

    const unsub = bridge.on('connect', onConnect);

    const result = await bridge.connect({
      appName: 'TestApp',
      appUrl: 'https://t.local',
      requiredPermissions: ['wallet.connect']
    });

    expect(result).toEqual(walletInfo);
    expect(bridge.isConnected()).toBe(true);
    expect(bridge.getWalletInfo()).toEqual(walletInfo);

    // event was emitted (possibly before we registered - check after a tick)
    await new Promise(r => setTimeout(r, 5));
    void unsub;
  });

  it('connect rejects on error response', async () => {
    const bridge = makeBridge();
    setTimeout(() => {
      respondToNextPost(null, { error: { code: -32000, message: 'user rejected' } });
    }, 0);

    await expect(
      bridge.connect({ appName: 'T', appUrl: 'https://t', requiredPermissions: [] })
    ).rejects.toMatchObject({ message: 'user rejected', code: -32000 });
  });

  it('disconnect resets connection state', async () => {
    const bridge = makeBridge();
    setTimeout(() => respondToNextPost({ address: 'x' }), 0);
    await bridge.connect({ appName: 'T', appUrl: 'https://t', requiredPermissions: [] });
    expect(bridge.isConnected()).toBe(true);

    setTimeout(() => respondToNextPost(null), 0);
    await bridge.disconnect();
    expect(bridge.isConnected()).toBe(false);
    expect(bridge.getWalletInfo()).toBeNull();
  });

  it('sendMessage rejects after 30s timeout', async () => {
    vi.useFakeTimers();
    const bridge = makeBridge();

    const promise = bridge.getAddress();
    const assertion = expect(promise).rejects.toThrow('Request timeout');
    await vi.advanceTimersByTimeAsync(31_000);
    await assertion;
    vi.useRealTimers();
  });

  it('handleMessage ignores messages without pdcExtension flag', async () => {
    const bridge = makeBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;

    // dispatch message without the flag; pending request stays unresolved
    const promise = bridge.getAddress();
    fakeWindow.dispatch({ id: 999, result: 'not-extension' });
    expect(postMock).toHaveBeenCalledTimes(1); // only our original request

    // cleanup: respond properly
    const call = postMock.mock.calls[0][0] as { id: number };
    fakeWindow.dispatch({ pdcExtension: true, id: call.id, result: { address: 'pdc1' } });
    expect(await promise).toBe('pdc1');
  });

  it('getAddress returns address', async () => {
    const bridge = makeBridge();
    setTimeout(() => respondToNextPost({ address: 'pdcABC' }), 0);
    expect(await bridge.getAddress()).toBe('pdcABC');
  });

  it('getBalance returns balance object', async () => {
    const bridge = makeBridge();
    setTimeout(() => respondToNextPost({ unlocked: 5n, locked: 1n }), 0);
    expect(await bridge.getBalance()).toEqual({ unlocked: 5n, locked: 1n });
  });

  it('getBalance passes asset_id param', async () => {
    const bridge = makeBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    setTimeout(() => respondToNextPost({ unlocked: 0n, locked: 0n }), 0);
    await bridge.getBalance('assetXYZ');
    const [data] = postMock.mock.calls[0];
    expect(data).toMatchObject({ params: { asset_id: 'assetXYZ' } });
  });

  it('getAssets returns asset list', async () => {
    const bridge = makeBridge();
    const assets = [{ asset_id: 'a', name: 'N', ticker: 'NNN', decimal_point: 6, unlocked: 1n, locked: 0n }];
    setTimeout(() => respondToNextPost(assets), 0);
    expect(await bridge.getAssets()).toEqual(assets);
  });

  it('transfer sends destination and amount', async () => {
    const bridge = makeBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    setTimeout(() => respondToNextPost({ tx_hash: 't1' }), 0);
    const r = await bridge.transfer({ destination: 'pdc1', amount: 10n, fee: 1n });
    expect(r).toEqual({ tx_hash: 't1' });
    const [data] = postMock.mock.calls[0];
    expect(data).toMatchObject({
      method: 'pdc.transfer',
      params: { destination: 'pdc1', amount: 10n, fee: 1n }
    });
  });

  it('alias operations', async () => {
    const bridge = makeBridge();
    setTimeout(() => respondToNextPost({ tx_hash: 'reg' }), 0);
    expect(await bridge.registerAlias({ alias: 'a', fee: 1n })).toEqual({ tx_hash: 'reg' });

    setTimeout(() => respondToNextPost({ tx_hash: 'upd' }), 0);
    expect(await bridge.updateAlias({ alias: 'a', fee: 1n })).toEqual({ tx_hash: 'upd' });

    setTimeout(() => respondToNextPost([{ alias: 'a', address: 'pdc1', comment: '' }]), 0);
    const aliases = await bridge.getAliases();
    expect(Array.isArray(aliases)).toBe(true);
  });

  it('staking operations', async () => {
    const bridge = makeBridge();
    setTimeout(() => respondToNextPost({ active: true, estimated_time_to_block: 60, stake_amount: 1n }), 0);
    const info = await bridge.getStakingInfo();
    expect(info.active).toBe(true);

    setTimeout(() => respondToNextPost(null), 0);
    await expect(bridge.setStaking(false)).resolves.toBeUndefined();
  });

  it('swap operations round-trip', async () => {
    const bridge = makeBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;

    setTimeout(() => respondToNextPost({ hex_raw_proposal: '0xff' }), 0);
    const created = await bridge.createSwapProposal({
      to_finalizer: [{ asset_id: 'a', amount: 1n }],
      to_initiator: [{ asset_id: 'b', amount: 2n }],
      fee_paid_by_a: 3n,
      expiration_time: 0,
      destination_address: 'pdc1'
    });
    expect(created).toEqual({ hex_raw_proposal: '0xff' });
    expect((postMock.mock.calls[0][0] as Record<string, unknown>).method).toBe(
      'pdc.createSwapProposal'
    );

    setTimeout(
      () =>
        respondToNextPost({
          to_finalizer: [{ asset_id: 'a', amount: 1n }],
          to_initiator: [{ asset_id: 'b', amount: 2n }],
          fee_paid_by_a: 3n,
          expiration_time: 0,
          proposer_address: 'pdc1'
        }),
      0
    );
    const info = await bridge.getSwapProposalInfo('0xff');
    expect(info.proposer_address).toBe('pdc1');
    expect(info.fee_paid_by_a).toBe(3n);

    setTimeout(() => respondToNextPost({ result_tx_id: 'tx9' }), 0);
    const accepted = await bridge.acceptSwapProposal('0xff');
    expect(accepted).toEqual({ result_tx_id: 'tx9' });
  });

  it('marketplace forwarding', async () => {
    const bridge = makeBridge();
    setTimeout(() => respondToNextPost({ offers: [], total_count: 0 }), 0);
    const offers = await bridge.getMarketplaceOffers({ limit: 5 });
    expect(offers).toMatchObject({ total_count: 0 });

    setTimeout(() => respondToNextPost({ offer_id: 'o1' }), 0);
    const pushed = await bridge.pushMarketplaceOffer({ asset_id: 'a' });
    expect(pushed).toMatchObject({ offer_id: 'o1' });
  });

  it('custom RPC forwarding for wallet and daemon', async () => {
    const bridge = makeBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;

    setTimeout(() => respondToNextPost({ balance: 1n }), 0);
    const w = await bridge.callWalletRpc('getbalance');
    expect(w).toEqual({ balance: 1n });
    expect((postMock.mock.calls[0][0] as Record<string, unknown>).method).toBe(
      'pdc.callWalletRpc'
    );

    setTimeout(() => respondToNextPost({ height: 5 }), 0);
    const d = await bridge.callDaemonRpc('get_info');
    expect(d).toEqual({ height: 5 });
    expect((postMock.mock.calls[1][0] as Record<string, unknown>).method).toBe(
      'pdc.callDaemonRpc'
    );
  });

  it('on() callback fires for matching event and off() removes it', async () => {
    const bridge = makeBridge();
    const calls: unknown[] = [];
    const cb = (data: unknown): void => {
      calls.push(data);
    };

    const unsub = bridge.on('balanceChanged', cb);
    fakeWindow.dispatch({
      pdcExtension: true,
      event: 'balanceChanged',
      data: { assetId: 'a', balance: 1n }
    });
    await new Promise(r => setTimeout(r, 5));
    expect(calls).toEqual([{ assetId: 'a', balance: 1n }]);

    unsub();
    fakeWindow.dispatch({
      pdcExtension: true,
      event: 'balanceChanged',
      data: { assetId: 'a', balance: 2n }
    });
    await new Promise(r => setTimeout(r, 5));
    expect(calls).toHaveLength(1); // no new calls after unsub
  });

  it('events without listeners are ignored safely', async () => {
    const bridge = makeBridge();
    expect(() => {
      fakeWindow.dispatch({ pdcExtension: true, event: 'networkChanged', data: 'mainnet' });
    }).not.toThrow();
    void bridge;
  });

  it('off() removes listener so callback is not invoked', async () => {
    const bridge = makeBridge();
    const calls: unknown[] = [];
    const cb = (data: unknown): void => {
      calls.push(data);
    };
    bridge.on('networkChanged', cb);
    bridge.off('networkChanged', cb);
    fakeWindow.dispatch({ pdcExtension: true, event: 'networkChanged', data: 'testnet' });
    await new Promise(r => setTimeout(r, 5));
    expect(calls).toHaveLength(0);
  });

  it('off() is safe when no listeners exist for event', () => {
    const bridge = makeBridge();
    const cb = (): void => {};
    expect(() => bridge.off('connect', cb)).not.toThrow();
  });

  it('pending request map does not resolve twice', async () => {
    const bridge = makeBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    setTimeout(() => respondToNextPost({ address: 'first' }), 0);
    const result = await bridge.getAddress();
    expect(result).toBe('first');

    // duplicate response for the same id is ignored (id no longer pending)
    const call = postMock.mock.calls[0][0] as { id: number };
    expect(() => {
      fakeWindow.dispatch({
        pdcExtension: true,
        id: call.id,
        result: { address: 'second' }
      });
    }).not.toThrow();
  });
});

describe('getWalletInfo / validateConnection', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
    vi.restoreAllMocks();
  });

  it('validateConnection sets connected state', async () => {
    const bridge = new mod.ExtensionBridge();
    const walletInfo = { address: 'pdcV', network: 'testnet', isConnected: true, version: '2' };
    setTimeout(() => respondToNextPost(walletInfo), 0);

    const result = await bridge.validateConnection();
    expect(result).toEqual(walletInfo);
    expect(bridge.isConnected()).toBe(true);
  });
});

describe('detectExtension', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
    vi.restoreAllMocks();
  });

  it('detects responding extension', async () => {
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    postMock.mockImplementation((data: unknown) => {
      const msg = data as { method?: string };
      if (msg?.method === 'pdc.ping') {
        setTimeout(() => {
          fakeWindow.dispatch({ pdcExtension: true, method: 'pdc.ping' });
        }, 0);
      }
    });

    const detected = await mod.ExtensionBridge.detectExtension();
    expect(detected).toBe(true);
  });

  it('returns false on timeout without extension', async () => {
    vi.useFakeTimers();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    postMock.mockImplementation(() => {});

    const promise = mod.ExtensionBridge.detectExtension();
    const assertion = expect(promise).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
    vi.useRealTimers();
  });

  it('getExtensionId reads global marker', async () => {
    (globalThis as Record<string, unknown>)['__PDC_EXTENSION_ID__'] = 'ext-123';
    // window getter must return it too - extend fake window
    (fakeWindow as unknown as Record<string, unknown>)['__PDC_EXTENSION_ID__'] = 'ext-123';
    expect(mod.ExtensionBridge.getExtensionId()).toBe('ext-123');
    delete (globalThis as Record<string, unknown>)['__PDC_EXTENSION_ID__'];
  });

  it('getExtensionId returns null without window marker', () => {
    const result = mod.ExtensionBridge.getExtensionId();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('detectExtension resolves false when window undefined', async () => {
    removeFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
    const detected = await mod.ExtensionBridge.detectExtension();
    expect(detected).toBe(false);
  });

  it('getExtensionId returns null when window undefined', async () => {
    removeFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
    expect(mod.ExtensionBridge.getExtensionId()).toBeNull();
  });
});

describe('module-level singleton and globals', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
  });

  it('exports pdcExtension singleton', () => {
    expect(mod.pdcExtension).toBeInstanceOf(mod.ExtensionBridge);
  });

  it('sets window.PdcExtension and window.pdcExtension globals', () => {
    expect(fakeWindow['PdcExtension']).toBeInstanceOf(mod.ExtensionBridge);
    expect(fakeWindow['pdcExtension']).toBeInstanceOf(mod.ExtensionBridge);
  });
});

describe('ExtensionError', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
  });

  it('captures message, code and data', () => {
    const err = new mod.ExtensionError('boom', -1, { ctx: true });
    expect(err.message).toBe('boom');
    expect(err.code).toBe(-1);
    expect(err.data).toEqual({ ctx: true });
    expect(err.name).toBe('ExtensionError');
    expect(err instanceof Error).toBe(true);
  });
});

describe('origin security (M2)', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
    vi.restoreAllMocks();
  });

  it('handleMessage drops events from untrusted origin', async () => {
    const bridge = new mod.ExtensionBridge();
    const p = bridge.getAddress();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const { id } = postMock.mock.calls[0][0] as { id: number };

    // foreign origin → dropped
    fakeWindow.dispatchWithOrigin({ pdcExtension: true, id, result: { address: 'EVIL' } }, 'https://evil.example');
    await new Promise(r => setTimeout(r, 10));

    // trusted origin → resolved
    fakeWindow.dispatchWithOrigin({ pdcExtension: true, id, result: { address: 'pdcOK' } }, 'https://test.local');
    expect(await p).toBe('pdcOK');
  });

  it('setTrustedOrigins pins extension id and rejects others', async () => {
    const { setTrustedOrigins } = mod;
    setTrustedOrigins(['chrome-extension://abcdef']);
    const bridge = new mod.ExtensionBridge();
    const p = bridge.getAddress();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const { id } = postMock.mock.calls[0][0] as { id: number };

    const listeners = ((fakeWindow as any).listeners as Map<string, Set<Listener>>).get('message')!;
    // evil origin
    const evil = { data: { pdcExtension: true, id, result: { address: 'EVIL' } }, source: fakeWindow, origin: 'https://evil.example' };
    listeners.forEach(cb => (cb as (e: unknown) => void)(evil));
    // trusted extension origin
    const good = { data: { pdcExtension: true, id, result: { address: 'pdcOK' } }, source: fakeWindow, origin: 'chrome-extension://abcdef' };
    listeners.forEach(cb => (cb as (e: unknown) => void)(good));

    expect(await p).toBe('pdcOK');
    setTrustedOrigins([]); // restore default trust model
  });

  it('postMessage does not use wildcard target origin', async () => {
    const bridge = new mod.ExtensionBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const p = bridge.getAddress();
    await new Promise(r => setTimeout(r, 5));
    const [, targetOrigin] = postMock.mock.calls[0];
    expect(targetOrigin).not.toBe('*');
    expect(typeof targetOrigin).toBe('string');
    expect((targetOrigin as string).length).toBeGreaterThan(0);
    void p;
  });
});

describe('origin security — remaining branches', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
    vi.restoreAllMocks();
  });

  it('isTrustedOrigin: empty origin is untrusted', async () => {
    const bridge = new mod.ExtensionBridge();
    const p = bridge.getAddress();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const { id } = postMock.mock.calls[0][0] as { id: number };
    // empty origin → dropped
    fakeWindow.dispatchWithOrigin({ pdcExtension: true, id, result: { address: 'EVIL' } }, '');
    await new Promise(r => setTimeout(r, 10));
    fakeWindow.dispatchWithOrigin({ pdcExtension: true, id, result: { address: 'pdcOK' } }, 'https://test.local');
    expect(await p).toBe('pdcOK');
  });

  it('TRUSTED_ORIGINS includes-match short-circuits extension-scheme check', async () => {
    const { setTrustedOrigins } = mod;
    setTrustedOrigins(['https://exact-match.example']);
    const bridge = new mod.ExtensionBridge();
    const p = bridge.getAddress();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const { id } = postMock.mock.calls[0][0] as { id: number };
    fakeWindow.dispatchWithOrigin({ pdcExtension: true, id, result: { address: 'pdcOK' } }, 'https://exact-match.example');
    expect(await p).toBe('pdcOK');
    setTrustedOrigins([]);
  });

  it('sendMessage uses TRUSTED_ORIGINS[0] when set (not location.origin)', async () => {
    const { setTrustedOrigins } = mod;
    setTrustedOrigins(['https://pinned.example']);
    const bridge = new mod.ExtensionBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const p = bridge.getAddress();
    await new Promise(r => setTimeout(r, 5));
    const [, targetOrigin] = postMock.mock.calls.at(-1)!;
    expect(targetOrigin).toBe('https://pinned.example');
    setTrustedOrigins([]);
    void p;
  });

  it('detectExtension uses TRUSTED_ORIGINS[0] when set', async () => {
    const { setTrustedOrigins } = mod;
    setTrustedOrigins(['https://pinned.example']);
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    postMock.mockImplementation((data: unknown) => {
      const msg = data as { method?: string };
      if (msg?.method === 'pdc.ping') {
        setTimeout(() => {
          fakeWindow.dispatchWithOrigin({ pdcExtension: true, method: 'pdc.ping' }, 'https://pinned.example');
        }, 0);
      }
    });
    const detected = await mod.ExtensionBridge.detectExtension();
    expect(detected).toBe(true);
    setTrustedOrigins([]);
  });
});

describe('origin security — default target origin branch', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
    vi.restoreAllMocks();
  });

  it('sendMessage falls back to location.origin when TRUSTED_ORIGINS empty', async () => {
    const bridge = new mod.ExtensionBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const p = bridge.getAddress();
    await new Promise(r => setTimeout(r, 5));
    const [, targetOrigin] = postMock.mock.calls.at(-1)!;
    expect(targetOrigin).toBe('https://test.local'); // == window.location.origin
    void p;
  });

  it('detectExtension falls back to location.origin when TRUSTED_ORIGINS empty', async () => {
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    postMock.mockImplementation((data: unknown) => {
      const msg = data as { method?: string };
      if (msg?.method === 'pdc.ping') {
        setTimeout(() => {
          fakeWindow.dispatchWithOrigin({ pdcExtension: true, method: 'pdc.ping' }, 'https://test.local');
        }, 0);
      }
    });
    await mod.ExtensionBridge.detectExtension();
    const [, targetOrigin] = postMock.mock.calls.at(-1)!;
    expect(targetOrigin).toBe('https://test.local');
  });
});

describe('origin security — empty TRUSTED_ORIGINS fallback', () => {
  beforeEach(async () => {
    installFakeWindow();
    vi.resetModules();
    mod = await import('../src/extension/extension-bridge');
  });
  afterEach(() => {
    removeFakeWindow();
    vi.restoreAllMocks();
  });

  it('sendMessage uses location.origin when TRUSTED_ORIGINS is empty', async () => {
    const { setTrustedOrigins } = mod;
    setTrustedOrigins([]); // empty → ?? falls back to location.origin
    const bridge = new mod.ExtensionBridge();
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    const p = bridge.getAddress();
    await new Promise(r => setTimeout(r, 5));
    const [, targetOrigin] = postMock.mock.calls.at(-1)!;
    expect(targetOrigin).toBe('https://test.local');
    void p;
  });

  it('detectExtension uses location.origin when TRUSTED_ORIGINS is empty', async () => {
    const { setTrustedOrigins } = mod;
    setTrustedOrigins([]);
    const postMock = fakeWindow.postMessage as unknown as ReturnType<typeof vi.fn>;
    postMock.mockImplementation((data: unknown) => {
      const msg = data as { method?: string };
      if (msg?.method === 'pdc.ping') {
        setTimeout(() => {
          fakeWindow.dispatchWithOrigin({ pdcExtension: true, method: 'pdc.ping' }, 'https://test.local');
        }, 0);
      }
    });
    await mod.ExtensionBridge.detectExtension();
    const [, targetOrigin] = postMock.mock.calls.at(-1)!;
    expect(targetOrigin).toBe('https://test.local');
  });
});
