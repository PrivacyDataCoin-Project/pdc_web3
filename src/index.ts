/**
 * PDC Web3 - TypeScript SDK for PrivacyDataCoin
 * 
 * @packageDocumentation
 * 
 * Main entry point for the PDC Web3 SDK.
 * Provides Wallet RPC, Daemon RPC, and Browser Extension bridge.
 */

// Network configuration
export * from './models/network';

// RPC Types
export * from './models/rpc-types';

// RPC Clients
export { RpcClient, RpcClientError, RPC_ERROR_CODES } from './api/rpc-client';
export { WalletRpcClient } from './api/wallet-rpc-client';
export { DaemonRpcClient } from './api/daemon-rpc-client';

// Extension Bridge
export { 
  ExtensionBridge, 
  ExtensionError, 
  pdcExtension,
  type ExtensionWalletInfo,
  type ExtensionAuthData,
  type ExtensionConnectionRequest,
  type ExtensionPermission,
  type ExtensionEventMap
} from './extension/extension-bridge';

// Utility functions
export * from './utils/bigint';
export * from './utils/address';
export * from './utils/hex';

// Version
export const VERSION = '0.1.0-beta.0';
export const SDK_NAME = '@privacydatacoin/pdc_web3';