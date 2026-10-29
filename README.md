# @privacydatacoin/pdc_web3

[![CI](https://github.com/PrivacyDataCoin-Project/pdc_web3/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/PrivacyDataCoin-Project/pdc_web3/actions/workflows/ci.yml)

TypeScript SDK for **PrivacyDataCoin (PDC)** — Wallet RPC, Daemon RPC, and Browser Extension bridge.

## Features

- **Wallet RPC Client** — Full typed access to PDC wallet JSON-RPC API (transfers, aliases, staking, swaps, marketplace, confidential assets)
- **Daemon RPC Client** — Access to daemon JSON-RPC (blocks, tx pool, aliases, random outputs)
- **Browser Extension Bridge** — Connect to PDC Companion extension (Zano-compatible interface)
- **Type-Safe** — Written in TypeScript with strict mode, full type definitions included
- **BigInt Support** — Proper handling of 128-bit integers for amounts, fees, supplies
- **Network Config** — Mainnet, Testnet, Stagenet, Regtest presets

## Installation

```bash
# From GitHub Packages (requires authentication)
npm install @privacydatacoin/pdc_web3@beta

# Or from local build
npm install /path/to/pdc_web3
```

## Quick Start

```typescript
import { WalletRpcClient, DaemonRpcClient, PdcNetwork, getNetworkConfig } from '@privacydatacoin/pdc_web3';

// Wallet RPC
const wallet = new WalletRpcClient({
  url: 'http://127.0.0.1:19311', // Default wallet RPC port
  username: 'rpc_user',
  password: 'rpc_password'
});

// Get balance
const balance = await wallet.getBalance();
console.log(`Unlocked: ${balance.unlocked_balance} atomic units`);

// Send transfer
const result = await wallet.transfer({
  destinations: [{
    address: 'pdc...',
    amount: 1000000000000n, // 1 PDC (12 decimals)
    asset_id: getNativeAssetId('mainnet')
  }],
  fee: 10000000000n // 0.01 PDC (TX_DEFAULT_FEE)
});
console.log(`TX: ${result.tx_hash}`);

// Daemon RPC
const daemon = new DaemonRpcClient({
  url: 'http://127.0.0.1:19211'
});

const info = await daemon.getInfo();
console.log(`Height: ${info.height}`);
```

## Browser Extension (PDC Companion)

```typescript
import { pdcExtension, ExtensionConnectionRequest } from '@privacydatacoin/pdc_web3';

// Detect extension
const hasExtension = await pdcExtension.detectExtension();
if (!hasExtension) {
  alert('Please install PDC Companion extension');
  return;
}

// Connect
const walletInfo = await pdcExtension.connect({
  appName: 'My PDC App',
  appUrl: 'https://myapp.com',
  requiredPermissions: ['wallet.connect', 'wallet.transfer', 'wallet.getBalance']
});

console.log('Connected:', walletInfo.address);

// Listen for account changes
const unsubscribe = pdcExtension.on('accountsChanged', (addresses) => {
  console.log('Accounts changed:', addresses);
});

// Transfer via extension (user confirms in popup)
const tx = await pdcExtension.transfer({
  destination: 'pdc...',
  amount: 1000000000000n
});

// Cleanup
unsubscribe();
await pdcExtension.disconnect();
```

## Network Configuration

```typescript
import { PdcNetwork, getNetworkConfig, getNativeAssetId } from '@privacydatacoin/pdc_web3';

const mainnet = getNetworkConfig(PdcNetwork.MAINNET);
console.log(mainnet.ticker); // 'PDC'
console.log(mainnet.decimalPoint); // 12
console.log(mainnet.defaultFee); // 10000000000n (0.01 PDC)

const nativeAssetId = getNativeAssetId(PdcNetwork.MAINNET);
```

## Amount Handling

```typescript
import { atomicToHuman, humanToAtomic, formatAmount, parseAmount } from '@privacydatacoin/pdc_web3';

const atomic = 1500000000000n; // 1.5 PDC
const human = atomicToHuman(atomic, 12); // '1.5'
const formatted = formatAmount(atomic, 12, 'PDC'); // '1.5 PDC'

const back = humanToAtomic('1.5', 12); // 1500000000000n
const parsed = parseAmount('1.5 PDC', 12, 'PDC'); // 1500000000000n
```

## Ionic Swaps (P2P Atomic Swaps)

```typescript
// Create proposal (Alice)
const proposal = await wallet.generateSwapProposal({
  proposal: {
    to_finalizer: [{ asset_id: nativeAssetId, amount: 1000000000000n }], // Alice sends 1 PDC
    to_initiator: [{ asset_id: customAssetId, amount: 500000000000n }], // Alice wants 0.5 CustomAsset
    fee_paid_by_a: 10000000000n, // 0.01 PDC
    expiration_time: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  },
  destination_address: bobAddress
});

// Share proposal.hex_raw_proposal with Bob (QR code, link, etc.)

// Bob inspects proposal
const info = await wallet.getSwapProposalInfo({ hex_raw_proposal: proposal.hex_raw_proposal });
console.log('Alice sends:', info.proposal.to_finalizer);
console.log('Alice wants:', info.proposal.to_initiator);

// Bob accepts
const accept = await wallet.acceptSwapProposal({ hex_raw_proposal: proposal.hex_raw_proposal });
console.log('Swap TX:', accept.result_tx_id);
```

## Confidential Assets

```typescript
// Deploy new asset
const deploy = await wallet.deployAsset({
  asset_descriptor: {
    name: 'My Token',
    ticker: 'MTK',
    decimal_point: 6,
    description: 'My confidential token',
    initial_supply: 1000000000000n
  },
  distribution: [{
    address: myAddress,
    amount: 1000000000000n,
    asset_id: nativeAssetId // payment for deployment fee
  }],
  fee: 10000000000n // 0.01 PDC
});
console.log('New asset ID:', deploy.new_asset_id);

// Emit more supply
await wallet.emitAsset({
  asset_id: deploy.new_asset_id,
  distribution: [{ address: recipient, amount: 100000000000n }],
  fee: 10000000000n // 0.01 PDC
});
```

## Requirements

- **Node.js >= 20** (WebCrypto `crypto.getRandomValues` global — required for CSPRNG)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Type check
npm run typecheck

# Generate docs
npm run docs
```

## Project Structure

```
src/
├── api/
│   ├── rpc-client.ts          # Base JSON-RPC 2.0 client
│   ├── wallet-rpc-client.ts   # Wallet RPC methods
│   └── daemon-rpc-client.ts   # Daemon RPC methods
├── models/
│   ├── network.ts             # Network configurations
│   └── rpc-types.ts           # All RPC request/response types
├── extension/
│   └── extension-bridge.ts    # Browser extension bridge
├── utils/
│   ├── bigint.ts              # BigInt serialization helpers
│   ├── address.ts             # Address validation/formatting
│   └── hex.ts                 # Hex encoding/decoding
└── index.ts                   # Main entry point
```

## License

**MIT** — see [LICENSE](LICENSE). Copyright © 2026 PrivacyDataCoin Project.

This SDK is an independent, API-compatible implementation for PrivacyDataCoin. It does
**not** copy code from the Zano project's [`zano_web3`](https://github.com/hyle-team/zano_web3)
(ISC, Copyright © Zano Team) — the upstream license is acknowledged in [LICENSE](LICENSE)
for attribution purposes only.

**PrivacyDataCoin (PDC) attribution**: any redistribution or derivative work must retain
attribution to the PrivacyDataCoin Project (https://privacydatacoin.com).