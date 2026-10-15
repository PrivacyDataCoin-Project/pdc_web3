# PDC Companion release notes

## 0.1.3

- Fix stuck “Generating…”: stringify `BigInt` before `chrome.runtime.sendMessage`
  (JSON cannot serialize bigint → silent hang until timeout).

## 0.1.2

- Fix Ionic Swap generate: wrap RPC params as `{ proposal, destination_address }`
  (flat body left `fee_paid_by_a=0` → `WALLET_FEE_TOO_LOW` / stuck “Generating…”).

## 0.1.1

- Fix false “Wallet offline” when simplewallet is up: use PDC RPC names
  (`get_wallet_info`, `getaddress`, `getbalance`) instead of Zano aliases.
- Map `getbalance` → unlocked/locked for the popup.
- Fix content script wiring: inject page-world `window.pdcExtension` so Trade
  **Connect Wallet** can talk to the companion.

## 0.1.0

First public release of the PrivacyDataCoin wallet companion extension.

### Downloads

| File | For |
|---|---|
| `pdc-companion-extension-v0.1.0.zip` | Chrome / Edge / Brave — load unpacked via `chrome://extensions` |
| `pdc-companion-extension-v0.1.0-firefox-src.zip` | Firefox — `about:debugging` → Load Temporary Add-on (manifest.json) |
| `SHA256SUMS.txt` | Integrity verification |

### Highlights

- `window.pdcExtension` bridge protocol compatible with
  [`@privacydatacoin/pdc_web3`](https://github.com/PrivacyDataCoin-Project/pdc_web3)
  (`ExtensionBridge`, `detectExtension`, `connect`, swap proposal methods).
- Local wallet RPC relay (`simplewallet`, default `127.0.0.1:19212`) —
  keys never leave the wallet.
- Per-origin dApp approval: balance / transfer / Ionic Swap methods require
  explicit user approval; read-only info is public.
- Popup with wallet status, address, unlocked balance (PDC dark theme).
- Options page for RPC credentials and approved dApps management.

### Install

1. Unzip the download.
2. Chrome: `chrome://extensions` → Developer mode → **Load unpacked** →
   select the unzipped folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**
   → select `manifest.json` inside the firefox src zip.
4. Start wallet RPC:
   `simplewallet --wallet-file … --rpc-bind-ip 127.0.0.1 --rpc-bind-port 19212`
5. Open Trade → approve `https://trade.privacydatacoin.com` in Companion Settings.
