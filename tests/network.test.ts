/**
 * Unit tests for network configuration
 */
import { describe, it, expect } from 'vitest';
import {
  PdcNetwork,
  PDC_NETWORKS,
  getNetworkConfig,
  getNativeAssetId
} from '../src/models/network';

describe('Network configuration', () => {
  it('should define all four networks', () => {
    expect(Object.keys(PDC_NETWORKS)).toHaveLength(4);
    expect(PDC_NETWORKS[PdcNetwork.MAINNET]).toBeDefined();
    expect(PDC_NETWORKS[PdcNetwork.TESTNET]).toBeDefined();
    expect(PDC_NETWORKS[PdcNetwork.STAGENET]).toBeDefined();
    expect(PDC_NETWORKS[PdcNetwork.REGTEST]).toBeDefined();
  });

  it('mainnet config', () => {
    const cfg = PDC_NETWORKS[PdcNetwork.MAINNET];
    expect(cfg.ticker).toBe('PDC');
    expect(cfg.nameFull).toBe('PrivacyDataCoin');
    expect(cfg.defaultDaemonPort).toBe(19211);
    expect(cfg.defaultWalletRpcPort).toBe(19311);
    expect(cfg.decimalPoint).toBe(12);
  });

  it('testnet config', () => {
    const cfg = PDC_NETWORKS[PdcNetwork.TESTNET];
    expect(cfg.ticker).toBe('tPDC');
    expect(cfg.defaultDaemonPort).toBe(29211);
    expect(cfg.defaultWalletRpcPort).toBe(29311);
  });

  it('stagenet config', () => {
    const cfg = PDC_NETWORKS[PdcNetwork.STAGENET];
    expect(cfg.ticker).toBe('sPDC');
    expect(cfg.defaultDaemonPort).toBe(39211);
  });

  it('regtest config', () => {
    const cfg = PDC_NETWORKS[PdcNetwork.REGTEST];
    expect(cfg.ticker).toBe('rPDC');
  });

  it('getNetworkConfig returns config for each network', () => {
    for (const net of Object.values(PdcNetwork)) {
      const cfg = getNetworkConfig(net);
      expect(cfg.name).toBe(net);
      expect(cfg.ticker.length).toBeGreaterThan(0);
    }
  });

  it('getNativeAssetId returns 64-char hex', () => {
    for (const net of Object.values(PdcNetwork)) {
      const id = getNativeAssetId(net);
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('all networks share fee and dust settings', () => {
    for (const cfg of Object.values(PDC_NETWORKS)) {
      // PDC currency_config.h: TX_DEFAULT_FEE = 10000000000 (.01), DEFAULT_DUST_THRESHOLD = 0
      expect(cfg.defaultFee).toBe(10000000000n);
      expect(cfg.dustThreshold).toBe(0n);
    }
  });
});
