/**
 * Base RPC Client for PDC
 * Handles JSON-RPC 2.0 communication with Wallet RPC and Daemon RPC
 */
import type { AxiosInstance, AxiosError } from 'axios';
import axios from 'axios';
import type { RpcRequest, RpcResponse, RpcError } from '../models/rpc-types';

/** JSON.stringify cannot encode bigint. Wallet amounts travel as decimal strings. */
function serializeRpcBody(data: unknown): string {
  return JSON.stringify(data, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

/**
 * Axios transport codes are strings (`ECONNABORTED`, `ERR_BAD_RESPONSE`).
 * parseInt of those is NaN, which made isTransportError() miss real failures.
 */
function coerceRpcErrorCode(code: unknown): number {
  if (typeof code === 'string' && /^-?\d+$/.test(code)) {
    return parseInt(code, 10);
  }
  return -32603;
}

export interface RpcClientConfig {
  url: string;
  username?: string;
  password?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class RpcClient {
  protected client: AxiosInstance;
  protected requestId = 0;

  constructor(config: RpcClientConfig) {
    const auth =
      config.username && config.password
        ? { username: config.username, password: config.password }
        : undefined;

    this.client = axios.create({
      baseURL: config.url,
      timeout: config.timeout ?? 30000,
      auth,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      transformRequest: [(data: unknown) => serializeRpcBody(data)],
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        const responseData = error.response?.data as { error?: RpcError } | undefined;
        if (responseData?.error) {
          const rpcError = responseData.error;
          throw new RpcClientError(rpcError.message, rpcError.code, rpcError.data);
        }
        throw new RpcClientError(
          error.message,
          coerceRpcErrorCode(error.code),
          error.response?.data
        );
      }
    );
  }

  protected nextId(): number | string {
    return ++this.requestId;
  }

  async call<TParams, TResult>(method: string, params?: TParams): Promise<TResult> {
    const request: RpcRequest<TParams> = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method,
      params,
    };

    const response = await this.client.post<RpcResponse<TResult>>('', request);
    const payload = response.data;
    if (payload == null || payload.id !== request.id) {
      throw new RpcClientError(
        'JSON-RPC response id mismatch',
        RPC_ERROR_CODES.INTERNAL_ERROR,
        payload
      );
    }

    if (payload.error) {
      throw new RpcClientError(payload.error.message, payload.error.code, payload.error.data);
    }

    return payload.result as TResult;
  }

  async batchCall<TParams, TResult>(
    calls: Array<{ method: string; params?: TParams }>
  ): Promise<TResult[]> {
    const requests: RpcRequest<TParams>[] = calls.map(call => ({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: call.method,
      params: call.params,
    }));

    const response = await this.client.post<unknown>('', requests);
    const data = response.data;
    if (!Array.isArray(data)) {
      throw new RpcClientError(
        'JSON-RPC batch response is not an array',
        RPC_ERROR_CODES.INTERNAL_ERROR,
        data
      );
    }

    const byId = new Map<number | string, RpcResponse<TResult>>();
    for (const item of data as Array<RpcResponse<TResult> | null>) {
      if (item == null || item.id == null) {
        throw new RpcClientError(
          'JSON-RPC batch item is missing id',
          RPC_ERROR_CODES.INTERNAL_ERROR,
          item
        );
      }
      byId.set(item.id, item);
    }

    return requests.map(req => {
      const item = byId.get(req.id);
      if (!item) {
        throw new RpcClientError(
          `Missing JSON-RPC batch response for id ${String(req.id)}`,
          RPC_ERROR_CODES.INTERNAL_ERROR
        );
      }
      if (item.error) {
        throw new RpcClientError(item.error.message, item.error.code, item.error.data);
      }
      return item.result as TResult;
    });
  }

  // Allow direct access to axios for advanced use cases
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  // Update base URL (useful for network switching)
  setBaseURL(url: string): void {
    this.client.defaults.baseURL = url;
  }

  // Update auth credentials
  setAuth(username: string, password: string): void {
    this.client.defaults.auth = { username, password };
  }

  clearAuth(): void {
    this.client.defaults.auth = undefined;
  }
}

export class RpcClientError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = 'RpcClientError';
    this.code = code;
    this.data = data;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RpcClientError);
    }
  }

  isWalletError(): boolean {
    // JSON-RPC implementation range, plus Zano/PDC wallet codes (-1001..-1013).
    if (this.code >= -32099 && this.code <= -32000) return true;
    return this.code <= -1001 && this.code >= -1013;
  }

  isDaemonError(): boolean {
    return this.code >= -32199 && this.code <= -32100;
  }

  isTransportError(): boolean {
    return this.code === -32603 || this.code === -32300;
  }
}

// Standard JSON-RPC 2.0 error codes
export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Wallet-specific errors (Zano/PDC convention)
  WALLET_RPC_ERROR_CODE_WRONG_ARGUMENT: -1001,
  WALLET_RPC_ERROR_CODE_WRONG_ADDRESS: -1002,
  WALLET_RPC_ERROR_CODE_WRONG_PASSWORD: -1003,
  WALLET_RPC_ERROR_CODE_WALLET_NOT_FOUND: -1004,
  WALLET_RPC_ERROR_CODE_INSUFFICIENT_FUNDS: -1005,
  WALLET_RPC_ERROR_CODE_TOO_LOW_FEE: -1006,
  WALLET_RPC_ERROR_CODE_TOO_HIGH_FEE: -1007,
  WALLET_RPC_ERROR_CODE_OUTPUTS_NOT_FOUND: -1008,
  WALLET_RPC_ERROR_CODE_ALIAS_TAKEN: -1009,
  WALLET_RPC_ERROR_CODE_ALIAS_NOT_FOUND: -1010,
  WALLET_RPC_ERROR_CODE_STAKING_NOT_AVAILABLE: -1011,
  WALLET_RPC_ERROR_CODE_SWAP_INVALID: -1012,
  WALLET_RPC_ERROR_CODE_SWAP_EXPIRED: -1013,
} as const;
