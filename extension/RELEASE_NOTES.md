# PDC Companion v0.1.0

First public release of the PrivacyDataCoin wallet companion extension.

## Downloads

| File | For |
|---|---|
| `pdc-companion-extension-v0.1.0.zip` | Chrome / Edge / Brave — load unpacked via `chrome://extensions` |
| `pdc-companion-extension-v0.1.0-firefox-src.zip` | Firefox — `about:debugging` → Load Temporary Add-on (manifest.json) |
| `SHA256SUMS.txt` | Integrity verification |

## Highlights

- `window.pdcExtension` bridge protocol compatible with
  [`@privacydatacoin/pdc_web3`](https://github.com/PrivacyDataCoin-Project/pdc_web3)
  (`ExtensionBridge`, `detectExtension`, `connect`, swap proposal methods).
- Local wallet RPC relay (`simplewallet`, default `127.0.0.1:19212`) —
  keys never leave the wallet.
- Per-origin dApp approval: balance / transfer / Ionic Swap methods require
  explicit user approval; read-only info is public.
- Popup with wallet status, address, unlocked balance (PDC dark theme).
- Options page for RPC credentials and approved dApps management.

## Install

1. Unzip the download.
2. Chrome: `chrome://extensions` → Developer mode → **Load unpacked** →
   select the unzipped folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**
   → pick `manifest.json` from the unzipped folder.
4. Start `simplewallet` with `--rpc-bind-port 19212` and enter credentials in
   the extension Settings if RPC login is enabled.

## Verify checksums

```bash
sha256sum -c SHA256SUMS.txt
```
