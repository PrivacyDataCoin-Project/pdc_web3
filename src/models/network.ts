/**
 * PDC Network Configuration
 * Matches Zano's network parameters but for PDC
 */
export enum PdcNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  STAGENET = 'stagenet',
  REGTEST = 'regtest',
}

export interface PdcNetworkConfig {
  name: PdcNetwork;
  ticker: string;
  nameFull: string;
  addressPrefix: string;
  nativeAssetId: string;
  defaultDaemonPort: number;
  defaultWalletRpcPort: number;
  defaultFee: bigint;
  decimalPoint: number;
  dustThreshold: bigint;
}

export const PDC_NETWORKS: Record<PdcNetwork, PdcNetworkConfig> = {
  [PdcNetwork.MAINNET]: {
    name: PdcNetwork.MAINNET,
    ticker: 'PDC',
    nameFull: 'PrivacyDataCoin',
    addressPrefix: 'pdc',
    nativeAssetId: '0000000000000000000000000000000000000000000000000000000000000000',
    defaultDaemonPort: 19211,
    defaultWalletRpcPort: 19311,
    // Matches PDC currency_config.h: TX_DEFAULT_FEE / TX_MINIMUM_FEE
    defaultFee: 10000000000n, // 0.01 PDC
    decimalPoint: 12,
    // Matches PDC currency_config.h: DEFAULT_DUST_THRESHOLD
    dustThreshold: 0n,
  },
  [PdcNetwork.TESTNET]: {
    name: PdcNetwork.TESTNET,
    ticker: 'tPDC',
    nameFull: 'PrivacyDataCoin Testnet',
    addressPrefix: 'tpdc',
    nativeAssetId: '0000000000000000000000000000000000000000000000000000000000000000',
    defaultDaemonPort: 29211,
    defaultWalletRpcPort: 29311,
    defaultFee: 10000000000n,
    decimalPoint: 12,
    dustThreshold: 0n,
  },
  [PdcNetwork.STAGENET]: {
    name: PdcNetwork.STAGENET,
    ticker: 'sPDC',
    nameFull: 'PrivacyDataCoin Stagenet',
    addressPrefix: 'spdc',
    nativeAssetId: '0000000000000000000000000000000000000000000000000000000000000000',
    defaultDaemonPort: 39211,
    defaultWalletRpcPort: 39311,
    defaultFee: 10000000000n,
    decimalPoint: 12,
    dustThreshold: 0n,
  },
  [PdcNetwork.REGTEST]: {
    name: PdcNetwork.REGTEST,
    ticker: 'rPDC',
    nameFull: 'PrivacyDataCoin Regtest',
    addressPrefix: 'rpdc',
    nativeAssetId: '0000000000000000000000000000000000000000000000000000000000000000',
    defaultDaemonPort: 19211,
    defaultWalletRpcPort: 19311,
    defaultFee: 10000000000n,
    decimalPoint: 12,
    dustThreshold: 0n,
  },
};

export function getNetworkConfig(network: PdcNetwork): PdcNetworkConfig {
  return PDC_NETWORKS[network];
}

export function getNativeAssetId(network: PdcNetwork): string {
  return PDC_NETWORKS[network].nativeAssetId;
}
