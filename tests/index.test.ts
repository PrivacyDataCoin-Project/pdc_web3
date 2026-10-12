/**
 * Unit tests for main entry point (index.ts)
 */
import { describe, it, expect } from 'vitest';
import * as PdcWeb3 from '../src/index';

describe('SDK entry point', () => {
  it('exports version metadata', () => {
    expect(PdcWeb3.VERSION).toBe('0.1.0-beta.0');
    expect(PdcWeb3.SDK_NAME).toBe('@privacydatacoin/pdc_web3');
  });

  it('exports network enums and helpers', () => {
    expect(PdcWeb3.PdcNetwork).toBeDefined();
    expect(PdcWeb3.getNetworkConfig).toBeInstanceOf(Function);
    expect(PdcWeb3.getNativeAssetId).toBeInstanceOf(Function);
  });

  it('exports RPC clients', () => {
    expect(PdcWeb3.RpcClient).toBeInstanceOf(Function);
    expect(PdcWeb3.WalletRpcClient).toBeInstanceOf(Function);
    expect(PdcWeb3.DaemonRpcClient).toBeInstanceOf(Function);
    expect(PdcWeb3.RpcClientError).toBeInstanceOf(Function);
    expect(PdcWeb3.ExtensionBridge).toBeInstanceOf(Function);
  });

  it('exports RPC error codes', () => {
    expect(PdcWeb3.RPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
  });

  it('exports utility functions', () => {
    expect(PdcWeb3.atomicToHuman).toBeInstanceOf(Function);
    expect(PdcWeb3.humanToAtomic).toBeInstanceOf(Function);
    expect(PdcWeb3.isValidPdcAddress).toBeInstanceOf(Function);
    expect(PdcWeb3.isValidAlias).toBeInstanceOf(Function);
    expect(PdcWeb3.bytesToHex).toBeInstanceOf(Function);
    expect(PdcWeb3.hexToBytes).toBeInstanceOf(Function);
  });

  it('WalletRpcClient from index is instantiable', () => {
    const client = new PdcWeb3.WalletRpcClient({ url: 'http://localhost:1' });
    expect(client).toBeInstanceOf(PdcWeb3.WalletRpcClient);
  });

  it('DaemonRpcClient from index is instantiable', () => {
    const client = new PdcWeb3.DaemonRpcClient({ url: 'http://localhost:1' });
    expect(client).toBeInstanceOf(PdcWeb3.DaemonRpcClient);
  });
});
