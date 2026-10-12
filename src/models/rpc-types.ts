/**
 * Core RPC Types for PDC Wallet and Daemon
 * Based on wallet_public_structs_defs.h and core_rpc_server_commands_defs.h
 */

// Base RPC request/response
export interface RpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: T;
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Wallet RPC Methods
export type WalletRpcMethod =
  | 'getbalance'
  | 'getaddress'
  | 'get_wallet_info'
  | 'get_recent_txs_and_info'
  | 'get_recent_txs_and_info2'
  | 'transfer'
  | 'store'
  | 'get_payments'
  | 'get_bulk_payments'
  | 'make_integrated_address'
  | 'split_integrated_address'
  | 'get_bare_outs_stats'
  | 'sweep_bare_outs'
  | 'search_for_transactions'
  | 'search_for_transactions2'
  | 'get_restore_info'
  | 'get_seed_phrase_info'
  | 'get_mining_history'
  | 'register_alias'
  | 'update_alias'
  | 'marketplace_get_offers_ex'
  | 'marketplace_push_offer'
  | 'marketplace_push_update_offer'
  | 'marketplace_cancel_offer'
  | 'ionic_swap_generate_proposal'
  | 'ionic_swap_get_proposal_info'
  | 'ionic_swap_accept_proposal'
  | 'assets_whitelist_get'
  | 'assets_whitelist_add'
  | 'assets_whitelist_remove'
  | 'deploy_new_asset'
  | 'emit_asset'
  | 'update_asset'
  | 'burn_asset';

// Daemon RPC Methods
export type DaemonRpcMethod =
  | 'get_info'
  | 'get_blocks_fast'
  | 'get_blocks_direct'
  | 'get_tx_pool'
  | 'get_aliases_by_address'
  | 'get_random_outputs_for_amounts'
  | 'get_random_outputs_for_amounts3'
  | 'send_raw_tx'
  | 'force_relay_raw_txs'
  | 'get_all_aliases'
  | 'get_alias_details'
  | 'get_alias_reward'
  | 'get_tx_global_outputs_indexes'
  | 'get_est_height_from_date';

// Asset related
export interface AssetBalance {
  asset_id: string;
  unlocked: bigint;
  locked: bigint;
  decimal_point: number;
  name?: string;
  ticker?: string;
}

export interface AssetInfo {
  asset_id: string;
  name: string;
  ticker: string;
  decimal_point: number;
  total_supply: bigint;
  owner: string;
  description: string;
  icon_url?: string;
  is_confidential: boolean;
}

export interface AssetDescriptor {
  name: string;
  ticker: string;
  decimal_point: number;
  description: string;
  icon_url?: string;
  initial_supply: bigint;
  distribution: AssetDistribution[];
}

export interface AssetDistribution {
  address: string;
  amount: bigint;
}

// Transfer
export interface TransferDestination {
  address: string;
  amount: bigint;
  asset_id?: string;
}

export interface TransferRequest {
  destinations: TransferDestination[];
  fee?: bigint;
  mixin?: number;
  payment_id?: string;
  unlock_time?: number;
  get_tx_keys?: boolean;
  do_not_relay?: boolean;
  account_index?: number;
  subaddr_indices?: number[];
  priority?: number;
}

export interface TransferResponse {
  tx_hash: string;
  tx_key?: string;
  tx_blob?: string;
  fee: bigint;
  amount_list?: bigint[];
  tx_metadata?: string;
}

// Balance
export interface BalanceRequest {
  account_index?: number;
  address_indices?: number[];
}

export interface BalanceResponse {
  balance: bigint;
  unlocked_balance: bigint;
  multisig_import_needed?: boolean;
  per_subaddress?: Array<{
    address_index: number;
    address: string;
    balance: bigint;
    unlocked_balance: bigint;
    label?: string;
  }>;
}

// Address
export interface AddressResponse {
  address: string;
  address_index?: number;
}

// Wallet Info
export interface WalletInfoResponse {
  version: string;
  height: number;
  synchronized: boolean;
  network: string;
  subaddress_lookahead?: { major: number; minor: number };
  multisig_info?: string;
  alias_info?: AliasInfo;
  staking_info?: StakingInfo;
}

export interface AliasInfo {
  alias: string;
  address: string;
  comment: string;
  cost: bigint;
  reward: bigint;
  is_owned: boolean;
}

export interface StakingInfo {
  active: boolean;
  estimated_time_to_block: number;
  stake_amount: bigint;
}

// Alias
export interface AliasRegisterRequest {
  alias: string;
  address: string;
  fee: bigint;
  comment?: string;
  reward?: bigint;
}

export interface AliasRegisterResponse {
  tx_hash: string;
  cost: bigint;
}

export interface AliasUpdateRequest {
  alias: string;
  fee: bigint;
  comment?: string;
}

export interface AliasUpdateResponse {
  tx_hash: string;
}

export interface AliasTransferRequest {
  alias: string;
  address: string;
  fee: bigint;
}

export interface AliasTransferResponse {
  tx_hash: string;
}

export interface AliasLookupRequest {
  alias_first_letters: string;
  n_of_items_to_return: number;
}

export interface AliasLookupResponse {
  aliases: Array<{
    alias: string;
    address: string;
    comment: string;
    cost: bigint;
    reward: bigint;
  }>;
}

export interface AliasCostRequest {
  alias: string;
}

export interface AliasCostResponse {
  cost: bigint;
}

// Marketplace
export interface MarketplaceOffer {
  offer_id: string;
  owner: string;
  asset_id: string;
  amount: bigint;
  price: bigint;
  price_asset_id: string;
  comment: string;
  expiration_time: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface MarketplaceGetOffersRequest {
  filter?: {
    asset_id?: string;
    owner?: string;
    min_price?: bigint;
    max_price?: bigint;
    is_active?: boolean;
  };
  offset?: number;
  limit?: number;
}

export interface MarketplaceGetOffersResponse {
  offers: MarketplaceOffer[];
  total_count: number;
}

export interface MarketplacePushOfferRequest {
  asset_id: string;
  amount: bigint;
  price: bigint;
  price_asset_id: string;
  comment?: string;
  expiration_time: number;
  fee: bigint;
}

export interface MarketplacePushOfferResponse {
  offer_id: string;
  tx_hash: string;
}

export interface MarketplaceUpdateOfferRequest {
  offer_id: string;
  asset_id?: string;
  amount?: bigint;
  price?: bigint;
  price_asset_id?: string;
  comment?: string;
  expiration_time?: number;
  fee: bigint;
}

export interface MarketplaceUpdateOfferResponse {
  tx_hash: string;
}

export interface MarketplaceCancelOfferRequest {
  offer_id: string;
  fee: bigint;
}

export interface MarketplaceCancelOfferResponse {
  tx_hash: string;
}

// Ionic Swaps
export interface IonicSwapProposalFunds {
  asset_id: string;
  amount: bigint;
}

export interface IonicSwapProposalRequest {
  to_finalizer: IonicSwapProposalFunds[]; // What proposer sends
  to_initiator: IonicSwapProposalFunds[]; // What proposer receives
  fee_paid_by_a: bigint;
  expiration_time: number;
  mixin?: number;
}

export interface IonicSwapGenerateProposalRequest {
  proposal: IonicSwapProposalRequest;
  destination_address: string;
}

export interface IonicSwapGenerateProposalResponse {
  hex_raw_proposal: string;
}

export interface IonicSwapProposalInfo {
  to_finalizer: IonicSwapProposalFunds[];
  to_initiator: IonicSwapProposalFunds[];
  fee_paid_by_a: bigint;
  expiration_time: number;
  mixin: number;
  proposer_address: string;
}

export interface IonicSwapGetProposalInfoRequest {
  hex_raw_proposal: string;
}

export interface IonicSwapGetProposalInfoResponse {
  proposal: IonicSwapProposalInfo;
}

export interface IonicSwapAcceptProposalRequest {
  hex_raw_proposal: string;
}

export interface IonicSwapAcceptProposalResponse {
  result_tx_id: string;
}

// Asset Whitelist
export interface AssetWhitelistResponse {
  local_whitelist: AssetInfo[];
  global_whitelist: AssetInfo[];
  own_assets: AssetInfo[];
}

export interface AssetWhitelistAddRequest {
  asset_id: string;
}

export interface AssetWhitelistAddResponse {
  asset_descriptor: AssetInfo;
  status: number;
}

export interface AssetWhitelistRemoveRequest {
  asset_id: string;
}

export interface AssetWhitelistRemoveResponse {
  status: number;
}

// Asset Operations
export interface DeployAssetRequest {
  asset_descriptor: AssetDescriptor;
  distribution: TransferDestination[];
  fee: bigint;
}

export interface DeployAssetResponse {
  new_asset_id: string;
  tx_hash: string;
}

export interface EmitAssetRequest {
  asset_id: string;
  distribution: TransferDestination[];
  fee: bigint;
  service_entries?: unknown[];
  point_tx_to_address?: string;
  native_amount?: bigint;
}

export interface EmitAssetResponse {
  tx_hash: string;
}

export interface UpdateAssetRequest {
  asset_id: string;
  asset_descriptor: AssetDescriptor;
  fee: bigint;
}

export interface UpdateAssetResponse {
  tx_hash: string;
}

export interface BurnAssetRequest {
  asset_id: string;
  burn_amount: bigint;
  fee: bigint;
  service_entries?: unknown[];
  point_tx_to_address?: string;
  native_amount?: bigint;
}

export interface BurnAssetResponse {
  tx_hash: string;
}

// History / Transactions
export interface TransactionInfo {
  tx_hash: string;
  block_height: number;
  timestamp: number;
  amount: bigint;
  fee: bigint;
  asset_id: string;
  is_income: boolean;
  is_outgoing: boolean;
  subaddr_index: number;
  address: string;
  payment_id?: string;
  note?: string;
  type: 'transfer' | 'stake' | 'swap' | 'alias' | 'asset' | 'marketplace';
}

export interface GetRecentTxsRequest {
  account_index?: number;
  count?: number;
  offset?: number;
  include_failed?: boolean;
}

export interface GetRecentTxsResponse {
  transactions: TransactionInfo[];
  total_count: number;
}

export interface SearchTransactionsRequest {
  tx_hashes?: string[];
  payment_ids?: string[];
  min_height?: number;
  max_height?: number;
  asset_ids?: string[];
  min_amount?: bigint;
  max_amount?: bigint;
  offset?: number;
  limit?: number;
}

export interface SearchTransactionsResponse {
  transactions: TransactionInfo[];
  total_count: number;
}

// Bare Outputs (pre-Zarcanum)
export interface BareOutsStatsResponse {
  total_count: number;
  total_amount: bigint;
  unlocked_count: number;
  unlocked_amount: bigint;
}

export interface SweepBareOutsRequest {
  fee: bigint;
}

export interface SweepBareOutsResponse {
  tx_hash: string;
  swept_count: number;
  swept_amount: bigint;
}

// Mining History
export interface MiningHistoryEntry {
  height: number;
  timestamp: number;
  amount: bigint;
  type: 'pow' | 'pos';
  block_hash: string;
}

export interface GetMiningHistoryResponse {
  entries: MiningHistoryEntry[];
  total_count: number;
}

// Seed / Restore
export interface GetRestoreInfoResponse {
  seed_phrase: string;
  spend_key: string;
  view_key: string;
  restore_height: number;
}

export interface GetSeedPhraseInfoResponse {
  seed_phrase: string;
  language: string;
}

// Daemon RPC Types
export interface DaemonInfoResponse {
  version: string;
  height: number;
  target_height: number;
  difficulty: bigint;
  target: bigint;
  tx_pool_size: number;
  alt_blocks_count: number;
  outgoing_connections_count: number;
  incoming_connections_count: number;
  white_peerlist_size: number;
  gray_peerlist_size: number;
  mainnet: boolean;
  testnet: boolean;
  stagenet: boolean;
  rpc_connections_count: number;
  start_time: number;
  credits: number;
  top_block_hash: string;
  cumulative_difficulty: bigint;
  block_size_limit: number;
  block_size_median: number;
  bootstrap_daemon_address: string;
  was_bootstrap_ever_used: boolean;
  major_version: number;
  minor_version: number;
}

export interface BlockInfo {
  block_hash: string;
  height: number;
  timestamp: number;
  size: number;
  difficulty: bigint;
  reward: bigint;
  tx_count: number;
  miner_tx_hash: string;
}

export interface GetBlocksFastRequest {
  block_ids: string[];
  start_height?: number;
  end_height?: number;
  prune?: boolean;
}

export interface GetBlocksFastResponse {
  blocks: BlockInfo[];
  start_height: number;
  current_height: number;
  output_indices?: string;
}

export interface GetRandomOutputsRequest {
  amounts: bigint[];
  count: number;
}

export interface GetRandomOutputsResponse {
  outs: Array<{
    amount: bigint;
    outs_for_amount: Array<{
      global_amount_index: number;
      out_key: string;
      rct: string;
      height: number;
    }>;
  }>;
  status: string;
}

export interface GetAliasDetailsRequest {
  alias: string;
}

export interface GetAliasDetailsResponse {
  alias: string;
  address: string;
  comment: string;
  cost: bigint;
  reward: bigint;
  is_owned: boolean;
}

export interface GetAliasRewardRequest {
  alias: string;
}

export interface GetAliasRewardResponse {
  reward: bigint;
}
