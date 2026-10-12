/**
 * PDC Wallet RPC Client
 * Provides typed methods for all Wallet RPC endpoints
 */
import { RpcClient } from './rpc-client';
import type {
  // Balance
  BalanceRequest, BalanceResponse,
  // Address
  AddressResponse,
  // Wallet Info
  WalletInfoResponse,
  // Transfer
  TransferRequest, TransferResponse,
  // Alias
  AliasRegisterRequest, AliasRegisterResponse,
  AliasUpdateRequest, AliasUpdateResponse,
  AliasTransferRequest, AliasTransferResponse,
  AliasLookupRequest, AliasLookupResponse,
  AliasCostRequest, AliasCostResponse,
  // Marketplace
  MarketplaceGetOffersRequest, MarketplaceGetOffersResponse,
  MarketplacePushOfferRequest, MarketplacePushOfferResponse,
  MarketplaceUpdateOfferRequest, MarketplaceUpdateOfferResponse,
  MarketplaceCancelOfferRequest, MarketplaceCancelOfferResponse,
  // Ionic Swaps
  IonicSwapGenerateProposalRequest, IonicSwapGenerateProposalResponse,
  IonicSwapGetProposalInfoRequest, IonicSwapGetProposalInfoResponse,
  IonicSwapAcceptProposalRequest, IonicSwapAcceptProposalResponse,
  // Asset Whitelist
  AssetWhitelistResponse,
  AssetWhitelistAddRequest, AssetWhitelistAddResponse,
  AssetWhitelistRemoveRequest, AssetWhitelistRemoveResponse,
  // Asset Operations
  DeployAssetRequest, DeployAssetResponse,
  EmitAssetRequest, EmitAssetResponse,
  UpdateAssetRequest, UpdateAssetResponse,
  BurnAssetRequest, BurnAssetResponse,
  // History
  GetRecentTxsRequest, GetRecentTxsResponse,
  SearchTransactionsRequest, SearchTransactionsResponse,
  // Bare Outputs
  BareOutsStatsResponse,
  SweepBareOutsRequest, SweepBareOutsResponse,
  // Mining
  GetMiningHistoryResponse,
  // Seed/Restore
  GetRestoreInfoResponse,
  GetSeedPhraseInfoResponse
} from '../models/rpc-types';

export interface WalletRpcClientConfig {
  url: string;
  username?: string;
  password?: string;
  timeout?: number;
}

export class WalletRpcClient {
  protected client: RpcClient;

  constructor(config: WalletRpcClientConfig) {
    this.client = new RpcClient(config);
  }

  // ============ Balance & Address ============

  async getBalance(params?: BalanceRequest): Promise<BalanceResponse> {
    return this.client.call('getbalance', params);
  }

  async getAddress(params?: { account_index?: number }): Promise<AddressResponse> {
    return this.client.call('getaddress', params);
  }

  async getWalletInfo(): Promise<WalletInfoResponse> {
    return this.client.call('get_wallet_info');
  }

  // ============ Transfers ============

  async transfer(params: TransferRequest): Promise<TransferResponse> {
    return this.client.call('transfer', params);
  }

  async store(): Promise<{ stored: boolean }> {
    return this.client.call('store');
  }

  // ============ Payments ============

  async getPayments(params: { payment_ids: string[]; min_height?: number }): Promise<{
    payments: Array<{
      payment_id: string;
      tx_hash: string;
      amount: bigint;
      block_height: number;
      unlock_time: number;
    }>;
  }> {
    return this.client.call('get_payments', params);
  }

  async getBulkPayments(params: { payment_ids: string[]; min_height?: number }): Promise<{
    payments: Array<{
      payment_id: string;
      tx_hash: string;
      amount: bigint;
      block_height: number;
      unlock_time: number;
    }>;
  }> {
    return this.client.call('get_bulk_payments', params);
  }

  // ============ Integrated Address ============

  async makeIntegratedAddress(params: { payment_id?: string }): Promise<{
    integrated_address: string;
  }> {
    return this.client.call('make_integrated_address', params);
  }

  async splitIntegratedAddress(params: { integrated_address: string }): Promise<{
    standard_address: string;
    payment_id: string;
  }> {
    return this.client.call('split_integrated_address', params);
  }

  // ============ Bare Outputs (pre-Zarcanum) ============

  async getBareOutsStats(): Promise<BareOutsStatsResponse> {
    return this.client.call('get_bare_outs_stats');
  }

  async sweepBareOuts(params: SweepBareOutsRequest): Promise<SweepBareOutsResponse> {
    return this.client.call('sweep_bare_outs', params);
  }

  // ============ History ============

  async getRecentTxs(params?: GetRecentTxsRequest): Promise<GetRecentTxsResponse> {
    return this.client.call('get_recent_txs_and_info2', params);
  }

  async searchTransactions(params: SearchTransactionsRequest): Promise<SearchTransactionsResponse> {
    return this.client.call('search_for_transactions2', params);
  }

  // ============ Aliases ============

  async registerAlias(params: AliasRegisterRequest): Promise<AliasRegisterResponse> {
    return this.client.call('register_alias', params);
  }

  async updateAlias(params: AliasUpdateRequest): Promise<AliasUpdateResponse> {
    return this.client.call('update_alias', params);
  }

  async transferAlias(params: AliasTransferRequest): Promise<AliasTransferResponse> {
    return this.client.call('transfer_alias', params);
  }

  async lookupAlias(params: AliasLookupRequest): Promise<AliasLookupResponse> {
    return this.client.call('alias_lookup', params);
  }

  async getAliasCost(params: AliasCostRequest): Promise<AliasCostResponse> {
    return this.client.call('get_alias_cost', params);
  }

  async getAliasInfoByName(alias: string): Promise<AliasLookupResponse> {
    return this.client.call('get_alias_info_by_name', { alias });
  }

  async getAliasInfoByAddress(address: string): Promise<AliasLookupResponse> {
    return this.client.call('get_alias_info_by_address', { address });
  }

  // ============ Marketplace ============

  async getMarketplaceOffers(params?: MarketplaceGetOffersRequest): Promise<MarketplaceGetOffersResponse> {
    return this.client.call('marketplace_get_offers_ex', params);
  }

  async pushMarketplaceOffer(params: MarketplacePushOfferRequest): Promise<MarketplacePushOfferResponse> {
    return this.client.call('marketplace_push_offer', params);
  }

  async updateMarketplaceOffer(params: MarketplaceUpdateOfferRequest): Promise<MarketplaceUpdateOfferResponse> {
    return this.client.call('marketplace_push_update_offer', params);
  }

  async cancelMarketplaceOffer(params: MarketplaceCancelOfferRequest): Promise<MarketplaceCancelOfferResponse> {
    return this.client.call('marketplace_cancel_offer', params);
  }

  // ============ Ionic Swaps ============

  async generateSwapProposal(params: IonicSwapGenerateProposalRequest): Promise<IonicSwapGenerateProposalResponse> {
    return this.client.call('ionic_swap_generate_proposal', params);
  }

  async getSwapProposalInfo(params: IonicSwapGetProposalInfoRequest): Promise<IonicSwapGetProposalInfoResponse> {
    return this.client.call('ionic_swap_get_proposal_info', params);
  }

  async acceptSwapProposal(params: IonicSwapAcceptProposalRequest): Promise<IonicSwapAcceptProposalResponse> {
    return this.client.call('ionic_swap_accept_proposal', params);
  }

  // ============ Asset Whitelist ============

  async getAssetWhitelist(): Promise<AssetWhitelistResponse> {
    return this.client.call('assets_whitelist_get');
  }

  async addAssetToWhitelist(params: AssetWhitelistAddRequest): Promise<AssetWhitelistAddResponse> {
    return this.client.call('assets_whitelist_add', params);
  }

  async removeAssetFromWhitelist(params: AssetWhitelistRemoveRequest): Promise<AssetWhitelistRemoveResponse> {
    return this.client.call('assets_whitelist_remove', params);
  }

  // ============ Confidential Assets ============

  async deployAsset(params: DeployAssetRequest): Promise<DeployAssetResponse> {
    return this.client.call('deploy_new_asset', params);
  }

  async emitAsset(params: EmitAssetRequest): Promise<EmitAssetResponse> {
    return this.client.call('emit_asset', params);
  }

  async updateAsset(params: UpdateAssetRequest): Promise<UpdateAssetResponse> {
    return this.client.call('update_asset', params);
  }

  async burnAsset(params: BurnAssetRequest): Promise<BurnAssetResponse> {
    return this.client.call('burn_asset', params);
  }

  // ============ Mining ============

  async getMiningHistory(params?: { offset?: number; limit?: number }): Promise<GetMiningHistoryResponse> {
    return this.client.call('get_mining_history', params);
  }

  // ============ Seed / Restore ============

  async getRestoreInfo(): Promise<GetRestoreInfoResponse> {
    return this.client.call('get_restore_info');
  }

  async getSeedPhraseInfo(): Promise<GetSeedPhraseInfoResponse> {
    return this.client.call('get_seed_phrase_info');
  }

  // ============ Utility ============

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

