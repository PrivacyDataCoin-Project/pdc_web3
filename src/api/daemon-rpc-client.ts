/**
 * PDC Daemon RPC Client
 * Provides typed methods for all Daemon RPC endpoints
 */
import { RpcClient } from './rpc-client';
import type {
  DaemonInfoResponse,
  BlockInfo,
  GetBlocksFastRequest,
  GetBlocksFastResponse,
  GetRandomOutputsRequest,
  GetRandomOutputsResponse,
  GetAliasDetailsRequest,
  GetAliasDetailsResponse,
  GetAliasRewardRequest,
  GetAliasRewardResponse,
} from '../models/rpc-types';

export interface DaemonRpcClientConfig {
  url: string;
  username?: string;
  password?: string;
  timeout?: number;
}

export class DaemonRpcClient {
  protected client: RpcClient;

  constructor(config: DaemonRpcClientConfig) {
    this.client = new RpcClient(config);
  }

  async getInfo(): Promise<DaemonInfoResponse> {
    return this.client.call('get_info');
  }

  async getBlocksFast(params: GetBlocksFastRequest): Promise<GetBlocksFastResponse> {
    return this.client.call('get_blocks_fast', params);
  }

  async getBlocksDirect(params: { block_ids: string[] }): Promise<{ blocks: BlockInfo[] }> {
    return this.client.call('get_blocks_direct', params);
  }

  async getTxPool(): Promise<{
    transactions: Array<{
      tx_hash: string;
      blob_size: number;
      fee: bigint;
      kept_by_block: boolean;
      last_failed_height: number;
      last_failed_id: string;
      max_used_block_height: number;
      max_used_block_hash: string;
      receive_time: number;
      relayed: boolean;
      tx_blob: string;
      tx_json: string;
    }>;
  }> {
    return this.client.call('get_tx_pool');
  }

  async getAliasesByAddress(address: string): Promise<{
    aliases: Array<{
      alias: string;
      address: string;
      comment: string;
      cost: bigint;
      reward: bigint;
    }>;
  }> {
    return this.client.call('get_aliases_by_address', { address });
  }

  async getRandomOutputsForAmounts(
    params: GetRandomOutputsRequest
  ): Promise<GetRandomOutputsResponse> {
    return this.client.call('get_random_outputs_for_amounts', params);
  }

  async getRandomOutputsForAmounts3(params: {
    amounts: bigint[];
    count: number;
    distribution?: unknown;
  }): Promise<GetRandomOutputsResponse> {
    return this.client.call('get_random_outputs_for_amounts3', params);
  }

  async sendRawTx(params: { tx_blob: string; do_not_relay?: boolean }): Promise<{
    status: string;
    tx_hash?: string;
  }> {
    return this.client.call('send_raw_tx', params);
  }

  async forceRelayRawTxs(params: { tx_blobs: string[] }): Promise<{
    status: string;
  }> {
    return this.client.call('force_relay_raw_txs', params);
  }

  async getAllAliases(): Promise<{
    aliases: Array<{
      alias: string;
      address: string;
      comment: string;
      cost: bigint;
      reward: bigint;
    }>;
  }> {
    return this.client.call('get_all_aliases');
  }

  async getAliasDetails(params: GetAliasDetailsRequest): Promise<GetAliasDetailsResponse> {
    return this.client.call('get_alias_details', params);
  }

  async getAliasReward(params: GetAliasRewardRequest): Promise<GetAliasRewardResponse> {
    return this.client.call('get_alias_reward', params);
  }

  async getTxGlobalOutputsIndexes(txid: string): Promise<{
    output_indexes: number[];
  }> {
    return this.client.call('get_tx_global_outputs_indexes', { txid });
  }

  async getEstHeightFromDate(timestamp: number): Promise<{
    height: number;
  }> {
    return this.client.call('get_est_height_from_date', { timestamp });
  }

  getClient(): RpcClient {
    return this.client;
  }

  setBaseURL(url: string): void {
    this.client.setBaseURL(url);
  }

  setAuth(username: string, password: string): void {
    this.client.setAuth(username, password);
  }

  clearAuth(): void {
    this.client.clearAuth();
  }
}

export { RpcClientError } from './rpc-client';
