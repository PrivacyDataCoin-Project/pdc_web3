/** PDC Companion — popup logic: wallet status, address, balance. */
const PDC_DECIMALS = 12;
const DEFAULT_RPC = 'http://127.0.0.1:19212/json_rpc';

function atomicToHuman(v) {
  try {
    const n = BigInt(v);
    if (n === 0n) return '0';
    const whole = n / 10n ** BigInt(PDC_DECIMALS);
    const frac = (n % 10n ** BigInt(PDC_DECIMALS))
      .toString()
      .padStart(PDC_DECIMALS, '0')
      .replace(/0+$/, '');
    return whole.toString() + (frac ? `.${frac}` : '');
  } catch {
    return '0';
  }
}

function send(method, params) {
  return chrome.runtime.sendMessage({ pdcExtension: true, id: Date.now(), method, params });
}

function shortRpc(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
  } catch {
    return url;
  }
}

(async () => {
  document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  const statusEl = document.getElementById('status');

  let rpcUrl = DEFAULT_RPC;
  try {
    const cfg = await send('pdc.getRpcConfig');
    if (cfg?.result?.rpcUrl) rpcUrl = cfg.result.rpcUrl;
  } catch {
    /* ignore — fall back to default for error text */
  }

  const rpcLabel = document.getElementById('rpcLabel');
  if (rpcLabel) rpcLabel.textContent = shortRpc(rpcUrl);

  try {
    const info = await send('pdc.getWalletInfo');
    if (info?.error) throw new Error(info.error.message);
    statusEl.innerHTML =
      '<span class="dot up"></span>Connected — ' + (info.result.network ?? 'mainnet');
    const addr = info.result.address;
    document.getElementById('addr').textContent = addr;
    document.getElementById('addrCard').style.display = 'block';
    const bal = await send('pdc.getBalance', {});
    if (!bal?.error) {
      document.getElementById('bal').textContent = atomicToHuman(bal.result.unlocked) + ' PDC';
      document.getElementById('balCard').style.display = 'block';
    }
  } catch (e) {
    const detail = e?.message ? String(e.message) : 'unreachable';
    statusEl.innerHTML =
      '<span class="dot down"></span>Wallet offline<br/><span style="font-size:0.72rem;color:#b7bdd6">' +
      detail.replace(/</g, '&lt;') +
      '</span>';
  }
  document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
