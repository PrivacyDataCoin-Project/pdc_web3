/**
 * Browser Extension Bridge
 * Compatible with Zano's zano_web3 extension interface
 * Allows web apps to connect to PDC Companion extension
 */
export interface ExtensionWalletInfo {
  address: string;
  network: string;
  isConnected: boolean;
  version: string;
}

export interface ExtensionAuthData {
  publicKey: string;
  signature: string;
  timestamp: number;
  walletType: 'extension' | 'web' | 'mobile';
}

export interface ExtensionConnectionRequest {
  appName: string;
  appUrl: string;
  iconUrl?: string;
  requiredPermissions: ExtensionPermission[];
}

export type ExtensionPermission =
  | 'wallet.connect'
  | 'wallet.sign'
  | 'wallet.transfer'
  | 'wallet.getBalance'
  | 'wallet.getAddress'
  | 'wallet.getAssets'
  | 'wallet.getAliases'
  | 'wallet.getStaking'
  | 'wallet.swap'
  | 'wallet.marketplace'
  | 'daemon.rpc';

export interface ExtensionEventMap {
  'connect': ExtensionWalletInfo;
  'disconnect': void;
  'accountsChanged': string[];
  'networkChanged': string;
  'balanceChanged': { assetId: string; balance: bigint };
}

export type ExtensionEventCallback<K extends keyof ExtensionEventMap> = (
  data: ExtensionEventMap[K]
) => void;

export class ExtensionBridge {
  private connected = false;
  private walletInfo: ExtensionWalletInfo | null = null;
  private eventListeners: Map<keyof ExtensionEventMap, Set<Function>> = new Map();
  private messageId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();


  constructor() {
    // Listen for messages from extension
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  private handleMessage(event: MessageEvent): void {
    // Only accept messages from the extension
    if (event.source !== window || !event.data?.pdcExtension) return;

    const { id, result, error, event: eventName, data } = event.data;

    // Handle response to our request
    if (id !== undefined && this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id)!;
      this.pendingRequests.delete(id);
      
      if (error) {
        reject(new ExtensionError(error.message, error.code, error.data));
      } else {
        resolve(result);
      }
      return;
    }

    // Handle events from extension
    if (eventName && this.eventListeners.has(eventName)) {
      const listeners = this.eventListeners.get(eventName)!;
      listeners.forEach(cb => cb(data));
    }
  }

  private sendMessage(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });

      window.postMessage({
        pdcExtension: true,
        id,
        method,
        params
      }, '*');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new ExtensionError('Request timeout', -32603));
        }
      }, 30000);
    });
  }

  // ============ Connection ============

  async connect(request: ExtensionConnectionRequest): Promise<ExtensionWalletInfo> {
    const result = await this.sendMessage('pdc.connect', request) as ExtensionWalletInfo;
    this.connected = true;
    this.walletInfo = result;
    this.emit('connect', result);
    return result;
  }

  async disconnect(): Promise<void> {
    await this.sendMessage('pdc.disconnect');
    this.connected = false;
    this.walletInfo = null;
    this.emit('disconnect', undefined);
  }

  async validateConnection(): Promise<ExtensionWalletInfo> {
    const result = await this.sendMessage('pdc.getWalletInfo') as ExtensionWalletInfo;
    this.connected = true;
    this.walletInfo = result;
    return result;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getWalletInfo(): ExtensionWalletInfo | null {
    return this.walletInfo;
  }

  // ============ Wallet Operations ============

  async getAddress(): Promise<string> {
    const result = await this.sendMessage('pdc.getAddress') as { address: string };
    return result.address;
  }

  async getBalance(assetId?: string): Promise<{ unlocked: bigint; locked: bigint }> {
    return this.sendMessage('pdc.getBalance', { asset_id: assetId }) as Promise<{ unlocked: bigint; locked: bigint }>;
  }

  async getAssets(): Promise<Array<{ asset_id: string; name: string; ticker: string; decimal_point: number; unlocked: bigint; locked: bigint }>> {
    return this.sendMessage('pdc.getAssets') as Promise<Array<{ asset_id: string; name: string; ticker: string; decimal_point: number; unlocked: bigint; locked: bigint }>>;
  }

  async transfer(params: {
    destination: string;
    amount: bigint;
    asset_id?: string;
    fee?: bigint;
    mixin?: number;
    payment_id?: string;
  }): Promise<{ tx_hash: string }> {
    return this.sendMessage('pdc.transfer', params) as Promise<{ tx_hash: string }>;
  }

  async getAliases(): Promise<Array<{ alias: string; address: string; comment: string }>> {
    return this.sendMessage('pdc.getAliases') as Promise<Array<{ alias: string; address: string; comment: string }>>;
  }

  async registerAlias(params: { alias: string; comment?: string; fee: bigint }): Promise<{ tx_hash: string }> {
    return this.sendMessage('pdc.registerAlias', params) as Promise<{ tx_hash: string }>;
  }

  async updateAlias(params: { alias: string; comment?: string; fee: bigint }): Promise<{ tx_hash: string }> {
    return this.sendMessage('pdc.updateAlias', params) as Promise<{ tx_hash: string }>;
  }

  async getStakingInfo(): Promise<{ active: boolean; estimated_time_to_block: number; stake_amount: bigint }> {
    return this.sendMessage('pdc.getStakingInfo') as Promise<{ active: boolean; estimated_time_to_block: number; stake_amount: bigint }>;
  }

  async setStaking(enabled: boolean): Promise<void> {
    await this.sendMessage('pdc.setStaking', { enabled });
  }

  // ============ Swaps ============

  async createSwapProposal(params: {
    to_finalizer: Array<{ asset_id: string; amount: bigint }>;
    to_initiator: Array<{ asset_id: string; amount: bigint }>;
    fee_paid_by_a: bigint;
    expiration_time: number;
    destination_address: string;
  }): Promise<{ hex_raw_proposal: string }> {
    return this.sendMessage('pdc.createSwapProposal', params) as Promise<{ hex_raw_proposal: string }>;
  }

  async getSwapProposalInfo(hex_raw_proposal: string): Promise<{
    to_finalizer: Array<{ asset_id: string; amount: bigint }>;
    to_initiator: Array<{ asset_id: string; amount: bigint }>;
    fee_paid_by_a: bigint;
    expiration_time: number;
    proposer_address: string;
  }> {
    return this.sendMessage('pdc.getSwapProposalInfo', { hex_raw_proposal }) as Promise<any>;
  }

  async acceptSwapProposal(hex_raw_proposal: string): Promise<{ result_tx_id: string }> {
    return this.sendMessage('pdc.acceptSwapProposal', { hex_raw_proposal }) as Promise<{ result_tx_id: string }>;
  }

  // ============ Marketplace ============

  async getMarketplaceOffers(filter?: unknown): Promise<unknown> {
    return this.sendMessage('pdc.getMarketplaceOffers', { filter });
  }

  async pushMarketplaceOffer(params: unknown): Promise<unknown> {
    return this.sendMessage('pdc.pushMarketplaceOffer', params);
  }

  // ============ Custom RPC ============

  async callWalletRpc(method: string, params?: unknown): Promise<unknown> {
    return this.sendMessage('pdc.callWalletRpc', { method, params });
  }

  async callDaemonRpc(method: string, params?: unknown): Promise<unknown> {
    return this.sendMessage('pdc.callDaemonRpc', { method, params });
  }

  // ============ Events ============

  on<K extends keyof ExtensionEventMap>(event: K, callback: ExtensionEventCallback<K>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off<K extends keyof ExtensionEventMap>(event: K, callback: ExtensionEventCallback<K>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit<K extends keyof ExtensionEventMap>(event: K, data: ExtensionEventMap[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb(data));
    }
  }

  // ============ Static helpers ============

  static async detectExtension(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => resolve(false), 100);
      
      const handler = (event: MessageEvent) => {
        if (event.data?.pdcExtension === true && event.data.method === 'pdc.ping') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(true);
        }
      };
      
      window.addEventListener('message', handler);
      window.postMessage({ pdcExtension: true, method: 'pdc.ping' }, '*');
    });
  }

  static getExtensionId(): string | null {
    // In a real implementation, this would be the Chrome/FF extension ID
    // For now, we use a well-known identifier
    return typeof window !== 'undefined' 
      ? (window as any).__PDC_EXTENSION_ID__ ?? null 
      : null;
  }
}

export class ExtensionError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.data = data;
  }
}

// Singleton instance for easy access
export const pdcExtension = new ExtensionBridge();

// Auto-detect and expose globally (for non-module scripts)
if (typeof window !== 'undefined') {
  (window as any).PdcExtension = pdcExtension;
  (window as any).pdcExtension = pdcExtension;
}