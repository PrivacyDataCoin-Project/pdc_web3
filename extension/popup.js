/** PDC Companion — popup logic: wallet status, address, balance, multi-wallet pick. */
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

function shortAddr(addr) {
  if (!addr || addr.length < 16) return addr || '';
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

async function refreshBalanceAndAddress() {
  const info = await send('pdc.getWalletInfo');
  if (info?.error) throw new Error(info.error.message);
  const addr = info.result.address;
  document.getElementById('addr').textContent = addr;
  document.getElementById('addrCard').style.display = 'block';
  const bal = await send('pdc.getBalance', {});
  if (!bal?.error) {
    document.getElementById('bal').textContent = atomicToHuman(bal.result.unlocked) + ' PDC';
    document.getElementById('balCard').style.display = 'block';
  }
  return info.result;
}

async function loadWalletPicker(currentAddress) {
  const list = await send('pdc.getWallets');
  if (list?.error || !Array.isArray(list?.result?.wallets)) return;
  const wallets = list.result.wallets;
  if (wallets.length < 2) return;

  const card = document.getElementById('walletPickCard');
  const select = document.getElementById('walletSelect');
  select.innerHTML = '';
  let selectedId = null;
  for (const w of wallets) {
    const opt = document.createElement('option');
    opt.value = String(w.wallet_id);
    const label = (w.name && w.name.trim()) || shortAddr(w.address) || `Wallet #${w.wallet_id}`;
    opt.textContent = `${label} (#${w.wallet_id})`;
    if (currentAddress && w.address === currentAddress) {
      opt.selected = true;
      selectedId = w.wallet_id;
    }
    select.appendChild(opt);
  }
  if (selectedId === null && select.options.length) {
    select.options[0].selected = true;
  }
  card.style.display = 'block';

  select.addEventListener('change', async () => {
    const walletId = Number(select.value);
    const statusEl = document.getElementById('status');
    try {
      const res = await send('pdc.selectWallet', { wallet_id: walletId });
      if (res?.error) throw new Error(res.error.message);
      const info = await refreshBalanceAndAddress();
      statusEl.innerHTML =
        '<span class="dot up"></span>Connected — ' + (info.network ?? 'mainnet');
    } catch (e) {
      statusEl.innerHTML =
        '<span class="dot down"></span>Switch failed<br/><span style="font-size:0.72rem;color:#b7bdd6">' +
        String(e?.message || e).replace(/</g, '&lt;') +
        '</span>';
    }
  });
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
    const info = await refreshBalanceAndAddress();
    statusEl.innerHTML =
      '<span class="dot up"></span>Connected — ' + (info.network ?? 'mainnet');
    await loadWalletPicker(info.address);
  } catch (e) {
    const detail = e?.message ? String(e.message) : 'unreachable';
    statusEl.innerHTML =
      '<span class="dot down"></span>Wallet offline<br/><span style="font-size:0.72rem;color:#b7bdd6">' +
      detail.replace(/</g, '&lt;') +
      '</span>';
  }
  document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
