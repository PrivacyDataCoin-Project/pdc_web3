/**

 *
 * Unit tests for RpcClient, WalletRpcClient, DaemonRpcClient
 * Uses axios-mock-adapter style mocking via vi.mock
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { RpcClient, RpcClientError, RPC_ERROR_CODES } from '../src/api/rpc-client';
import { WalletRpcClient } from '../src/api/wallet-rpc-client';
import { DaemonRpcClient } from '../src/api/daemon-rpc-client';

// Mock axios at module level
vi.mock('axios', () => {
  const interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  };
  const instance = {
    post: vi.fn(),
    defaults: {
      baseURL: '',
      auth: undefined as unknown,
      headers: {} as Record<string, string>,
    },
    interceptors,
  };
  const axiosMock = {
    create: vi.fn(() => instance),
    default: {},
  };
  return { default: axiosMock, __mockInstance: instance };
});

// Helper to get the shared mock instance

const axiosAny = axios as any;
function getInstance() {
  return axiosAny.create.mock.results[0]?.value ?? axiosAny.__mockInstance;
}

describe('RpcClient', () => {
  let client: RpcClient;
  let instance: ReturnType<typeof getInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new RpcClient({ url: 'http://127.0.0.1:19311' });
    instance = getInstance();
  });

  describe('constructor', () => {
    it('should create axios instance with baseURL', () => {
      expect(axiosAny.create).toHaveBeenCalled();
    });

    it('should set auth when username and password provided', () => {
      new RpcClient({
        url: 'http://localhost:1',
        username: 'user',
        password: 'pass',
      });
      const createArgs = axiosAny.create.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(createArgs['auth']).toEqual({ username: 'user', password: 'pass' });
    });

    it('should not set auth when credentials missing', () => {
      const noAuth = new RpcClient({ url: 'http://localhost:1' });
      expect(noAuth.getAxiosInstance().defaults.auth).toBeUndefined();
    });

    it('should use custom timeout', () => {
      const c = new RpcClient({ url: 'http://localhost:1', timeout: 5000 });
      const call = axiosAny.create.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(call['timeout']).toBe(5000);
      void c;
    });

    it('should default timeout to 30s', () => {
      const c = new RpcClient({ url: 'http://localhost:1' });
      const call = axiosAny.create.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(call['timeout']).toBe(30000);
      void c;
    });

    it('should merge custom headers', () => {
      new RpcClient({ url: 'http://localhost:1', headers: { 'X-Custom': 'val' } });
      const call = axiosAny.create.mock.calls.at(-1)![0] as Record<string, unknown>;
      const headers = call['headers'] as Record<string, string>;
      expect(headers['X-Custom']).toBe('val');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('call', () => {
    it('should send JSON-RPC request and return result', async () => {
      instance.post.mockResolvedValueOnce({
        data: { jsonrpc: '2.0', id: 1, result: { height: 123 } },
      });

      const result = await client.call('get_info');
      expect(result).toEqual({ height: 123 });

      const [url, body] = instance.post.mock.calls[0];
      expect(url).toBe('');
      expect(body).toMatchObject({
        jsonrpc: '2.0',
        method: 'get_info',
        id: 1,
      });
    });

    it('should increment request id across calls', async () => {
      instance.post.mockImplementation((_url: string, body: { id: number }) =>
        Promise.resolve({ data: { jsonrpc: '2.0', id: body.id, result: null } })
      );

      await client.call('a');
      await client.call('b');

      const bodies = instance.post.mock.calls.map(([, body]) => body);
      expect(bodies[0]).toMatchObject({ id: 1 });
      expect(bodies[1]).toMatchObject({ id: 2 });
    });

    it('should include params when provided', async () => {
      instance.post.mockResolvedValue({ data: { jsonrpc: '2.0', id: 1, result: {} } });

      await client.call('transfer', { amount: 1000n });
      const [, body] = instance.post.mock.calls[0];
      expect(body).toMatchObject({ params: { amount: 1000n } });
    });

    it('should throw RpcClientError on RPC error in response', async () => {
      instance.post.mockResolvedValueOnce({
        data: {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -1002, message: 'WALLET_RPC_ERROR_CODE_WRONG_ADDRESS' },
        },
      });

      const promise = client.call('getaddress');
      await expect(promise).rejects.toThrow(RpcClientError);
      await expect(promise).rejects.toMatchObject({
        code: -1002,
        message: 'WALLET_RPC_ERROR_CODE_WRONG_ADDRESS',
      });
    });

    it('should throw on transport error via interceptor', async () => {
      const interceptorFn = instance.interceptors.response.use.mock.calls[0][1];
      const axiosError = {
        message: 'Network Error',
        code: 'ECONNREFUSED',
        response: { data: { error: { code: -1, message: 'down' } } },
      };

      let caught: unknown;
      try {
        await interceptorFn(axiosError);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RpcClientError);
      expect((caught as RpcClientError).message).toBe('down');
      expect((caught as RpcClientError).code).toBe(-1);
    });

    it('should handle interceptor error without response data', async () => {
      const interceptorFn = instance.interceptors.response.use.mock.calls[0][1];
      const axiosError = { message: 'timeout of 30000ms exceeded', code: 'ECONNABORTED' };

      let caught: unknown;
      try {
        await interceptorFn(axiosError);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RpcClientError);
      expect((caught as RpcClientError).message).toBe('timeout of 30000ms exceeded');
      expect((caught as RpcClientError).code).toBe(-32603);
      expect((caught as RpcClientError).isTransportError()).toBe(true);
    });

    it('rejects a response whose id does not match the request', async () => {
      instance.post.mockResolvedValueOnce({
        data: { jsonrpc: '2.0', id: 99, result: { ok: true } },
      });
      await expect(client.call('get_info')).rejects.toThrow('id mismatch');
    });

    it('rejects a null JSON-RPC payload', async () => {
      instance.post.mockResolvedValueOnce({ data: null });
      await expect(client.call('get_info')).rejects.toThrow('id mismatch');
    });

    it('serializes bigint fields as decimal strings', () => {
      const created = axiosAny.create.mock.calls.at(-1)![0] as {
        transformRequest: Array<(data: unknown) => string>;
      };
      const body = created.transformRequest[0]!({
        amount: 10n,
        nested: { fee: 2n },
        note: 'a',
        items: [3n],
      });
      expect(JSON.parse(body)).toEqual({
        amount: '10',
        nested: { fee: '2' },
        note: 'a',
        items: ['3'],
      });
    });

    it('should default code to -32603 when error.code is falsy', async () => {
      const interceptorFn = instance.interceptors.response.use.mock.calls[0][1];
      const axiosError = { message: 'no code', code: undefined };

      let caught: unknown;
      try {
        await interceptorFn(axiosError);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RpcClientError);
      expect((caught as RpcClientError).code).toBe(-32603);
    });
  });

  describe('batchCall', () => {
    it('should send array of requests and return results', async () => {
      instance.post.mockResolvedValueOnce({
        data: [
          { jsonrpc: '2.0', id: 1, result: { r: 1 } },
          { jsonrpc: '2.0', id: 2, result: { r: 2 } },
        ],
      });

      const results = await client.batchCall([{ method: 'a' }, { method: 'b', params: { x: 1 } }]);

      expect(results).toEqual([{ r: 1 }, { r: 2 }]);
      const [, body] = instance.post.mock.calls[0];
      expect(Array.isArray(body)).toBe(true);
    });

    it('should throw on first error in batch response', async () => {
      instance.post.mockResolvedValueOnce({
        data: [
          { jsonrpc: '2.0', id: 1, result: { ok: true } },
          { jsonrpc: '2.0', id: 2, error: { code: -1, message: 'batch fail' } },
        ],
      });

      await expect(client.batchCall([{ method: 'a' }, { method: 'b' }])).rejects.toThrow(
        'batch fail'
      );
    });

    it('reorders batch results by request id', async () => {
      instance.post.mockResolvedValueOnce({
        data: [
          { jsonrpc: '2.0', id: 2, result: { r: 2 } },
          { jsonrpc: '2.0', id: 1, result: { r: 1 } },
        ],
      });

      const results = await client.batchCall([{ method: 'a' }, { method: 'b' }]);
      expect(results).toEqual([{ r: 1 }, { r: 2 }]);
    });

    it('rejects a batch response that is not an array', async () => {
      instance.post.mockResolvedValueOnce({
        data: { jsonrpc: '2.0', error: { code: -32600, message: 'bad batch' } },
      });
      await expect(client.batchCall([{ method: 'a' }])).rejects.toThrow('not an array');
    });

    it('rejects a batch item without an id', async () => {
      instance.post.mockResolvedValueOnce({
        data: [null],
      });
      await expect(client.batchCall([{ method: 'a' }])).rejects.toThrow('missing id');
    });

    it('rejects a batch item whose id is null', async () => {
      instance.post.mockResolvedValueOnce({
        data: [{ jsonrpc: '2.0', id: null, result: { r: 1 } }],
      });
      await expect(client.batchCall([{ method: 'a' }])).rejects.toThrow('missing id');
    });

    it('rejects a batch that omits one request id', async () => {
      instance.post.mockResolvedValueOnce({
        data: [{ jsonrpc: '2.0', id: 1, result: { r: 1 } }],
      });
      await expect(client.batchCall([{ method: 'a' }, { method: 'b' }])).rejects.toThrow(
        'Missing JSON-RPC batch response for id 2'
      );
    });
  });

  describe('configuration methods', () => {
    it('setBaseURL updates axios baseURL', () => {
      client.setBaseURL('http://newhost:9999');
      expect(instance.defaults.baseURL).toBe('http://newhost:9999');
    });

    it('setAuth updates axios auth', () => {
      client.setAuth('u2', 'p2');
      expect(instance.defaults.auth).toEqual({ username: 'u2', password: 'p2' });
    });

    it('clearAuth removes auth', () => {
      client.setAuth('u2', 'p2');
      client.clearAuth();
      expect(instance.defaults.auth).toBeUndefined();
    });

    it('getAxiosInstance returns internal client', () => {
      expect(client.getAxiosInstance()).toBe(instance);
    });
  });
});

describe('RpcClientError', () => {
  it('should capture message, code and data', () => {
    const err = new RpcClientError('test', -1005, { extra: 1 });
    expect(err.message).toBe('test');
    expect(err.code).toBe(-1005);
    expect(err.data).toEqual({ extra: 1 });
    expect(err.name).toBe('RpcClientError');
  });

  it('isWalletError for wallet code range', () => {
    expect(new RpcClientError('x', -32000).isWalletError()).toBe(true);
    expect(new RpcClientError('x', -32099).isWalletError()).toBe(true);
    expect(new RpcClientError('x', -3200).isWalletError()).toBe(false);
    expect(new RpcClientError('x', -1001).isWalletError()).toBe(true);
    expect(new RpcClientError('x', -1005).isWalletError()).toBe(true);
    expect(new RpcClientError('x', -1013).isWalletError()).toBe(true);
    expect(new RpcClientError('x', -1000).isWalletError()).toBe(false);
    expect(new RpcClientError('x', -1014).isWalletError()).toBe(false);
    expect(new RpcClientError('x', 1).isWalletError()).toBe(false);
    expect(new RpcClientError('x', -33000).isWalletError()).toBe(false);
  });

  it('isDaemonError for daemon code range', () => {
    expect(new RpcClientError('x', -32100).isDaemonError()).toBe(true);
    expect(new RpcClientError('x', -32199).isDaemonError()).toBe(true);
    expect(new RpcClientError('x', -32200).isDaemonError()).toBe(false);
  });

  it('isTransportError for transport codes', () => {
    expect(new RpcClientError('x', -32603).isTransportError()).toBe(true);
    expect(new RpcClientError('x', -32300).isTransportError()).toBe(true);
    expect(new RpcClientError('x', -32000).isTransportError()).toBe(false);
  });
});

describe('RPC_ERROR_CODES', () => {
  it('should expose standard JSON-RPC codes', () => {
    expect(RPC_ERROR_CODES.PARSE_ERROR).toBe(-32700);
    expect(RPC_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
    expect(RPC_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
    expect(RPC_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
    expect(RPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
  });

  it('should expose wallet-specific codes', () => {
    expect(RPC_ERROR_CODES.WALLET_RPC_ERROR_CODE_WRONG_ADDRESS).toBe(-1002);
    expect(RPC_ERROR_CODES.WALLET_RPC_ERROR_CODE_INSUFFICIENT_FUNDS).toBe(-1005);
    expect(RPC_ERROR_CODES.WALLET_RPC_ERROR_CODE_ALIAS_TAKEN).toBe(-1009);
  });
});

describe('WalletRpcClient', () => {
  let wallet: WalletRpcClient;
  let instance: ReturnType<typeof getInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    wallet = new WalletRpcClient({ url: 'http://127.0.0.1:19311' });
    instance = getInstance();
  });

  const respond = (result: unknown): void => {
    instance.post.mockImplementationOnce((_url: string, body: { id: number }) =>
      Promise.resolve({ data: { jsonrpc: '2.0', id: body.id, result } })
    );
  };

  it('getBalance sends getbalance', async () => {
    respond({ balance: 1n, unlocked_balance: 1n });
    const r = await wallet.getBalance();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'getbalance' });
    expect(r.balance).toBe(1n);
  });

  it('getAddress sends getaddress', async () => {
    respond({ address: 'pdc123' });
    await wallet.getAddress();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'getaddress' });
  });

  it('getWalletInfo sends get_wallet_info', async () => {
    respond({ height: 10, synchronized: true });
    await wallet.getWalletInfo();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_wallet_info' });
  });

  it('transfer sends transfer with destinations', async () => {
    respond({ tx_hash: 'abc' });
    const r = await wallet.transfer({
      destinations: [{ address: 'pdc1', amount: 5n }],
    });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'transfer',
      params: { destinations: [{ address: 'pdc1', amount: 5n }] },
    });
    expect(r.tx_hash).toBe('abc');
  });

  it('store sends store', async () => {
    respond({ stored: true });
    await wallet.store();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'store' });
  });

  it('getPayments sends get_payments', async () => {
    respond({ payments: [] });
    await wallet.getPayments({ payment_ids: ['pid1'] });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'get_payments',
      params: { payment_ids: ['pid1'] },
    });
  });

  it('getBulkPayments sends get_bulk_payments', async () => {
    respond({ payments: [] });
    await wallet.getBulkPayments({ payment_ids: ['a', 'b'], min_height: 5 });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_bulk_payments' });
  });

  it('makeIntegratedAddress sends make_integrated_address', async () => {
    respond({ integrated_address: 'pdcInt' });
    await wallet.makeIntegratedAddress({});
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'make_integrated_address' });
  });

  it('splitIntegratedAddress sends split_integrated_address', async () => {
    respond({ standard_address: 'pdc1', payment_id: 'pid' });
    await wallet.splitIntegratedAddress({ integrated_address: 'pdcInt' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'split_integrated_address' });
  });

  it('getBareOutsStats sends get_bare_outs_stats', async () => {
    respond({ total_count: 0, total_amount: 0n, unlocked_count: 0, unlocked_amount: 0n });
    await wallet.getBareOutsStats();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_bare_outs_stats' });
  });

  it('sweepBareOuts sends sweep_bare_outs with fee', async () => {
    respond({ tx_hash: 't', swept_count: 1, swept_amount: 2n });
    await wallet.sweepBareOuts({ fee: 1000n });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'sweep_bare_outs' });
  });

  it('getRecentTxs sends get_recent_txs_and_info2', async () => {
    respond({ transactions: [], total_count: 0 });
    await wallet.getRecentTxs({ count: 10 });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_recent_txs_and_info2' });
  });

  it('searchTransactions sends search_for_transactions2', async () => {
    respond({ transactions: [], total_count: 0 });
    await wallet.searchTransactions({ min_height: 1 });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'search_for_transactions2' });
  });

  it('registerAlias sends register_alias', async () => {
    respond({ tx_hash: 't', cost: 10n });
    await wallet.registerAlias({ alias: 'name', address: 'pdc1', fee: 1n });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'register_alias' });
  });

  it('updateAlias sends update_alias', async () => {
    respond({ tx_hash: 't' });
    await wallet.updateAlias({ alias: 'name', fee: 1n });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'update_alias' });
  });

  it('transferAlias sends transfer_alias', async () => {
    respond({ tx_hash: 't' });
    await wallet.transferAlias({ alias: 'name', address: 'pdc2', fee: 1n });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'transfer_alias' });
  });

  it('lookupAlias sends alias_lookup', async () => {
    respond({ aliases: [] });
    await wallet.lookupAlias({ alias_first_letters: 'na', n_of_items_to_return: 10 });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'alias_lookup' });
  });

  it('getAliasCost sends get_alias_cost', async () => {
    respond({ cost: 10n });
    await wallet.getAliasCost({ alias: 'name' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_alias_cost' });
  });

  it('getAliasInfoByName sends get_alias_info_by_name', async () => {
    respond({ aliases: [] });
    await wallet.getAliasInfoByName('name');
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'get_alias_info_by_name',
      params: { alias: 'name' },
    });
  });

  it('getAliasInfoByAddress sends get_alias_info_by_address', async () => {
    respond({ aliases: [] });
    await wallet.getAliasInfoByAddress('pdc1');
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_alias_info_by_address' });
  });

  it('getMarketplaceOffers sends marketplace_get_offers_ex', async () => {
    respond({ offers: [], total_count: 0 });
    await wallet.getMarketplaceOffers();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'marketplace_get_offers_ex' });
  });

  it('pushMarketplaceOffer sends marketplace_push_offer', async () => {
    respond({ offer_id: 'o1', tx_hash: 't' });
    await wallet.pushMarketplaceOffer({
      asset_id: 'aa',
      amount: 1n,
      price: 2n,
      price_asset_id: 'bb',
      expiration_time: 0,
      fee: 3n,
    });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'marketplace_push_offer' });
  });

  it('updateMarketplaceOffer sends marketplace_push_update_offer', async () => {
    respond({ tx_hash: 't' });
    await wallet.updateMarketplaceOffer({ offer_id: 'o1', fee: 1n });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'marketplace_push_update_offer',
    });
  });

  it('cancelMarketplaceOffer sends marketplace_cancel_offer', async () => {
    respond({ tx_hash: 't' });
    await wallet.cancelMarketplaceOffer({ offer_id: 'o1', fee: 1n });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'marketplace_cancel_offer' });
  });

  it('generateSwapProposal sends ionic_swap_generate_proposal', async () => {
    respond({ hex_raw_proposal: '0xdead' });
    const r = await wallet.generateSwapProposal({
      proposal: {
        to_finalizer: [{ asset_id: 'a', amount: 1n }],
        to_initiator: [{ asset_id: 'b', amount: 2n }],
        fee_paid_by_a: 3n,
        expiration_time: 0,
      },
      destination_address: 'pdc2',
    });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'ionic_swap_generate_proposal',
    });
    expect(r.hex_raw_proposal).toBe('0xdead');
  });

  it('getSwapProposalInfo sends ionic_swap_get_proposal_info', async () => {
    respond({
      proposal: {
        to_finalizer: [],
        to_initiator: [],
        fee_paid_by_a: 0n,
        expiration_time: 0,
        mixin: 10,
        proposer_address: 'pdc1',
      },
    });
    await wallet.getSwapProposalInfo({ hex_raw_proposal: '0x01' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'ionic_swap_get_proposal_info',
    });
  });

  it('acceptSwapProposal sends ionic_swap_accept_proposal', async () => {
    respond({ result_tx_id: 'tx1' });
    const r = await wallet.acceptSwapProposal({ hex_raw_proposal: '0x01' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'ionic_swap_accept_proposal',
    });
    expect(r.result_tx_id).toBe('tx1');
  });

  it('getAssetWhitelist sends assets_whitelist_get', async () => {
    respond({ local_whitelist: [], global_whitelist: [], own_assets: [] });
    await wallet.getAssetWhitelist();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'assets_whitelist_get' });
  });

  it('addAssetToWhitelist sends assets_whitelist_add', async () => {
    respond({ asset_descriptor: {}, status: 0 });
    await wallet.addAssetToWhitelist({ asset_id: 'aa' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'assets_whitelist_add' });
  });

  it('removeAssetFromWhitelist sends assets_whitelist_remove', async () => {
    respond({ status: 0 });
    await wallet.removeAssetFromWhitelist({ asset_id: 'aa' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'assets_whitelist_remove' });
  });

  it('deployAsset sends deploy_new_asset', async () => {
    respond({ new_asset_id: 'na', tx_hash: 't' });
    await wallet.deployAsset({
      asset_descriptor: {
        name: 'T',
        ticker: 'TT',
        decimal_point: 6,
        description: '',
        initial_supply: 1n,
        distribution: [],
      },
      distribution: [{ address: 'pdc1', amount: 1n }],
      fee: 1n,
    });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'deploy_new_asset' });
  });

  it('emitAsset sends emit_asset', async () => {
    respond({ tx_hash: 't' });
    await wallet.emitAsset({
      asset_id: 'aa',
      distribution: [{ address: 'pdc1', amount: 1n }],
      fee: 1n,
    });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'emit_asset' });
  });

  it('updateAsset sends update_asset', async () => {
    respond({ tx_hash: 't' });
    await wallet.updateAsset({
      asset_id: 'aa',
      asset_descriptor: {
        name: 'T',
        ticker: 'TT',
        decimal_point: 6,
        description: '',
        initial_supply: 1n,
        distribution: [],
      },
      fee: 1n,
    });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'update_asset' });
  });

  it('burnAsset sends burn_asset', async () => {
    respond({ tx_hash: 't' });
    await wallet.burnAsset({ asset_id: 'aa', burn_amount: 1n, fee: 1n });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'burn_asset' });
  });

  it('getMiningHistory sends get_mining_history', async () => {
    respond({ entries: [], total_count: 0 });
    await wallet.getMiningHistory();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_mining_history' });
  });

  it('getRestoreInfo sends get_restore_info', async () => {
    respond({ seed_phrase: 'w', spend_key: 's', view_key: 'v', restore_height: 0 });
    await wallet.getRestoreInfo();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_restore_info' });
  });

  it('getSeedPhraseInfo sends get_seed_phrase_info', async () => {
    respond({ seed_phrase: 'w', language: 'English' });
    await wallet.getSeedPhraseInfo();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_seed_phrase_info' });
  });

  it('setBaseURL proxies to client', async () => {
    wallet.setBaseURL('http://x:1');
    expect(instance.defaults.baseURL).toBe('http://x:1');
  });

  it('setAuth/clearAuth proxies to client', () => {
    wallet.setAuth('u', 'p');
    expect(instance.defaults.auth).toEqual({ username: 'u', password: 'p' });
    wallet.clearAuth();
    expect(instance.defaults.auth).toBeUndefined();
  });

  it('makeIntegratedAddress/splitIntegratedAddress via WalletRpcClient covered above', async () => {
    respond({ integrated_address: 'ia' });
    const r = await wallet.makeIntegratedAddress({ payment_id: 'pid' });
    expect(r.integrated_address).toBe('ia');

    respond({ integrated_address: 'ia2' });
    const r2 = await wallet.makeIntegratedAddress({});
    expect(r2.integrated_address).toBe('ia2');

    respond({ standard_address: 'pdc1', payment_id: 'pid' });
    const s = await wallet.splitIntegratedAddress({ integrated_address: 'ia' });
    expect(s.standard_address).toBe('pdc1');
    expect(s.payment_id).toBe('pid');
  });

  it('getPayments/getBulkPayments return payment arrays', async () => {
    respond({
      payments: [{ payment_id: 'p', tx_hash: 't', amount: 1n, block_height: 2, unlock_time: 0 }],
    });
    const p1 = await wallet.getPayments({ payment_ids: ['p'] });
    expect(p1.payments[0]?.tx_hash).toBe('t');

    respond({ payments: [] });
    const p2 = await wallet.getBulkPayments({ payment_ids: [] });
    expect(p2.payments).toEqual([]);
  });

  it('getPayments/getBulkPayments return payment arrays', async () => {
    respond({
      payments: [{ payment_id: 'p', tx_hash: 't', amount: 1n, block_height: 2, unlock_time: 0 }],
    });
    const p1 = await wallet.getPayments({ payment_ids: ['p'] });
    expect(p1.payments[0]?.tx_hash).toBe('t');

    respond({ payments: [] });
    const p2 = await wallet.getBulkPayments({ payment_ids: [] });
    expect(p2.payments).toEqual([]);
  });

  it('getClient returns RpcClient', () => {
    expect(wallet.getClient()).toBeInstanceOf(RpcClient);
  });
});

describe('DaemonRpcClient', () => {
  let daemon: DaemonRpcClient;
  let instance: ReturnType<typeof getInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    daemon = new DaemonRpcClient({ url: 'http://127.0.0.1:19211' });
    instance = getInstance();
  });

  const respond = (result: unknown): void => {
    instance.post.mockImplementationOnce((_url: string, body: { id: number }) =>
      Promise.resolve({ data: { jsonrpc: '2.0', id: body.id, result } })
    );
  };

  it('getInfo sends get_info', async () => {
    respond({ height: 100, top_block_hash: 'h' });
    const r = await daemon.getInfo();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_info' });
    expect(r.height).toBe(100);
  });

  it('getBlocksFast sends get_blocks_fast', async () => {
    respond({ blocks: [], start_height: 0, current_height: 1 });
    await daemon.getBlocksFast({ block_ids: ['h1'] });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_blocks_fast' });
  });

  it('getBlocksDirect sends get_blocks_direct', async () => {
    respond({ blocks: [] });
    await daemon.getBlocksDirect({ block_ids: ['h1', 'h2'] });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'get_blocks_direct',
      params: { block_ids: ['h1', 'h2'] },
    });
  });

  it('getTxPool sends get_tx_pool', async () => {
    respond({ transactions: [] });
    await daemon.getTxPool();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_tx_pool' });
  });

  it('getAliasesByAddress sends get_aliases_by_address', async () => {
    respond({ aliases: [] });
    await daemon.getAliasesByAddress('pdc1');
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_aliases_by_address' });
  });

  it('getRandomOutputsForAmounts sends get_random_outputs_for_amounts', async () => {
    respond({ outs: [], status: 'OK' });
    await daemon.getRandomOutputsForAmounts({ amounts: [1n], count: 10 });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'get_random_outputs_for_amounts',
    });
  });

  it('getRandomOutputsForAmounts3 sends v3 method', async () => {
    respond({ outs: [], status: 'OK' });
    await daemon.getRandomOutputsForAmounts3({ amounts: [1n], count: 10 });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'get_random_outputs_for_amounts3',
    });
  });

  it('sendRawTx sends send_raw_tx', async () => {
    respond({ status: 'OK', tx_hash: 't' });
    const r = await daemon.sendRawTx({ tx_blob: 'deadbeef' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({
      method: 'send_raw_tx',
      params: { tx_blob: 'deadbeef' },
    });
    expect(r.tx_hash).toBe('t');
  });

  it('forceRelayRawTxs sends force_relay_raw_txs', async () => {
    respond({ status: 'OK' });
    await daemon.forceRelayRawTxs({ tx_blobs: ['aa'] });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'force_relay_raw_txs' });
  });

  it('getAllAliases sends get_all_aliases', async () => {
    respond({ aliases: [] });
    await daemon.getAllAliases();
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_all_aliases' });
  });

  it('getAliasDetails sends get_alias_details', async () => {
    respond({ alias: 'a', address: 'pdc1', comment: '', cost: 0n, reward: 0n, is_owned: false });
    await daemon.getAliasDetails({ alias: 'a' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_alias_details' });
  });

  it('getAliasReward sends get_alias_reward', async () => {
    respond({ reward: 1n });
    await daemon.getAliasReward({ alias: 'a' });
    expect(instance.post.mock.calls[0][1]).toMatchObject({ method: 'get_alias_reward' });
  });

  it('getTxGlobalOutputsIndexes sends get_tx_global_outputs_indexes', async () => {
    respond({ output_indexes: [1, 2] });
    const r = await daemon.getTxGlobalOutputsIndexes('tx1');
    expect(r.output_indexes).toEqual([1, 2]);
  });

  it('getEstHeightFromDate sends get_est_height_from_date', async () => {
    respond({ height: 42 });
    const r = await daemon.getEstHeightFromDate(1700000000);
    expect(r.height).toBe(42);
  });

  it('setAuth/clearAuth proxies to client', () => {
    daemon.setAuth('u', 'p');
    expect(instance.defaults.auth).toEqual({ username: 'u', password: 'p' });
    daemon.clearAuth();
    expect(instance.defaults.auth).toBeUndefined();
  });
});
