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
  connect: ExtensionWalletInfo;
  disconnect: void;
  accountsChanged: string[];
  networkChanged: string;
  balanceChanged: { assetId: string; balance: bigint };
}

export type ExtensionEventCallback<K extends keyof ExtensionEventMap> = (
  data: ExtensionEventMap[K]
) => void;

/**
 * Trusted origins allowed to talk to this bridge.
 * - The page's own origin (same-document extension content scripts relay here).
 * - chrome-extension:// / moz-extension:// are validated separately (opaque ids).
 */
let TRUSTED_ORIGINS: readonly string[] = [
  typeof window !== 'undefined' ? window.location.origin : '',
].filter(Boolean);

/** Restrict which origins this bridge accepts messages from (call before connect). */
export function setTrustedOrigins(origins: readonly string[]): void {
  TRUSTED_ORIGINS = origins.filter(Boolean);
}

function isTrustedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (TRUSTED_ORIGINS.includes(origin)) return true;
  // Extension content scripts relay through the page origin, but the MessageEvent
  // origin for a real extension response is the extension origin. Accept any
  // extension scheme; the extension must pin exact ids in production via
  // setTrustedOrigins(['chrome-extension://<id>']).
  return origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://');
}

export class ExtensionBridge {
  private connected = false;
  private walletInfo: ExtensionWalletInfo | null = null;
  private eventListeners: Map<keyof ExtensionEventMap, Set<(data: unknown) => void>> = new Map();
  private messageId = 0;
  private pendingRequests: Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  > = new Map();

  constructor() {
    // Listen for messages from extension
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  private handleMessage(event: MessageEvent): void {
    // Security: drop messages from untrusted origins (prevents cross-tab spoofing
    // of RPC responses and injection of forged results into pendingRequests).
    if (!isTrustedOrigin(event.origin)) return;

    // Only accept messages relayed by the extension through this document
    const rawData: unknown = event.data;
    if (
      (rawData as { pdcExtension?: boolean } | null)?.pdcExtension !== true
    )
      return;

    interface ExtensionMessage {
      id?: number;
      result?: unknown;
      error?: { message: string; code: number; data?: unknown };
      event?: keyof ExtensionEventMap;
      data?: unknown;
    }
    const { id, result, error, event: eventName, data } = event.data as ExtensionMessage;

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

      // Security: never use '*' — restrict to our own origin; the extension
      // content script relays to the extension background with its own pinning.
      window.postMessage(
        {
          pdcExtension: true,
          id,
          method,
          params,
        },
        TRUSTED_ORIGINS[0] ?? window.location.origin
      );

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
    const result = (await this.sendMessage('pdc.connect', request)) as ExtensionWalletInfo;
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
    const result = (await this.sendMessage('pdc.getWalletInfo')) as ExtensionWalletInfo;
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
    const result = (await this.sendMessage('pdc.getAddress')) as { address: string };
    return result.address;
  }

  async getBalance(assetId?: string): Promise<{ unlocked: bigint; locked: bigint }> {
    return this.sendMessage('pdc.getBalance', { asset_id: assetId }) as Promise<{
      unlocked: bigint;
      locked: bigint;
    }>;
  }

  async getAssets(): Promise<
    Array<{
      asset_id: string;
      name: string;
      ticker: string;
      decimal_point: number;
      unlocked: bigint;
      locked: bigint;
    }>
  > {
    return this.sendMessage('pdc.getAssets') as Promise<
      Array<{
        asset_id: string;
        name: string;
        ticker: string;
        decimal_point: number;
        unlocked: bigint;
        locked: bigint;
      }>
    >;
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
    return this.sendMessage('pdc.getAliases') as Promise<
      Array<{ alias: string; address: string; comment: string }>
    >;
  }

  async registerAlias(params: {
    alias: string;
    comment?: string;
    fee: bigint;
  }): Promise<{ tx_hash: string }> {
    return this.sendMessage('pdc.registerAlias', params) as Promise<{ tx_hash: string }>;
  }

  async updateAlias(params: {
    alias: string;
    comment?: string;
    fee: bigint;
  }): Promise<{ tx_hash: string }> {
    return this.sendMessage('pdc.updateAlias', params) as Promise<{ tx_hash: string }>;
  }

  async getStakingInfo(): Promise<{
    active: boolean;
    estimated_time_to_block: number;
    stake_amount: bigint;
  }> {
    return this.sendMessage('pdc.getStakingInfo') as Promise<{
      active: boolean;
      estimated_time_to_block: number;
      stake_amount: bigint;
    }>;
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
    return this.sendMessage('pdc.createSwapProposal', params) as Promise<{
      hex_raw_proposal: string;
    }>;
  }

  async getSwapProposalInfo(hex_raw_proposal: string): Promise<{
    to_finalizer: Array<{ asset_id: string; amount: bigint }>;
    to_initiator: Array<{ asset_id: string; amount: bigint }>;
    fee_paid_by_a: bigint;
    expiration_time: number;
    proposer_address: string;
  }> {
    return this.sendMessage('pdc.getSwapProposalInfo', { hex_raw_proposal }) as Promise<{
      to_finalizer: Array<{ asset_id: string; amount: bigint }>;
      to_initiator: Array<{ asset_id: string; amount: bigint }>;
      fee_paid_by_a: bigint;
      expiration_time: number;
      proposer_address: string;
    }>;
  }

  async acceptSwapProposal(hex_raw_proposal: string): Promise<{ result_tx_id: string }> {
    return this.sendMessage('pdc.acceptSwapProposal', { hex_raw_proposal }) as Promise<{
      result_tx_id: string;
    }>;
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
    const listeners = this.eventListeners.get(event)!;
    listeners.add(callback as (data: unknown) => void);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback as (data: unknown) => void);
    };
  }

  off<K extends keyof ExtensionEventMap>(event: K, callback: ExtensionEventCallback<K>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as (data: unknown) => void);
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
    return new Promise(resolve => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => resolve(false), 100);

      const handler = (event: MessageEvent) => {
        const msg = event.data as { pdcExtension?: boolean; method?: string } | null;
        if (msg?.pdcExtension === true && msg.method === 'pdc.ping') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(true);
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({ pdcExtension: true, method: 'pdc.ping' }, TRUSTED_ORIGINS[0] ?? window.location.origin);
    });
  }

  static getExtensionId(): string | null {
    // In a real implementation, this would be the Chrome/FF extension ID
    // For now, we use a well-known identifier
    return typeof window !== 'undefined'
      ? ((window as unknown as { __PDC_EXTENSION_ID__?: string }).__PDC_EXTENSION_ID__ ?? null)
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
  const globalWindow = window as unknown as Record<string, unknown>;
  globalWindow['PdcExtension'] = pdcExtension;
  globalWindow['pdcExtension'] = pdcExtension;
}
