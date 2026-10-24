/** PDC Companion — options page logic: RPC config + approved origins. */
const $ = (id) => document.getElementById(id);

function validOrigin(s) {
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.pathname.match(/[^/]/);
  } catch {
    return false;
  }
}

const DEFAULT_APPROVED = [
  'https://trade.privacydatacoin.com',
  'https://matrix.privacydatacoin.com',
];

const RETIRED_APPROVED = new Set(['https://messenger.privacydatacoin.com']);

async function ensureTradeApproved() {
  const { approvedOrigins = [] } = await chrome.storage.local.get('approvedOrigins');
  const raw = Array.isArray(approvedOrigins) ? approvedOrigins : [];
  const list = raw.filter((o) => !RETIRED_APPROVED.has(o));
  let changed = list.length !== raw.length;
  for (const o of DEFAULT_APPROVED) {
    if (!list.includes(o)) {
      list.push(o);
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ approvedOrigins: list });
  return list;
}

async function load() {
  const approvedOrigins = await ensureTradeApproved();
  const {
    rpcUrl = 'http://127.0.0.1:19212/json_rpc',
    rpcLogin = '',
    rpcPassword = '',
    jwtSecret = '',
  } = await chrome.storage.local.get(['rpcUrl', 'rpcLogin', 'rpcPassword', 'jwtSecret']);
  $('rpcUrl').value = rpcUrl;
  $('rpcLogin').value = rpcLogin;
  $('rpcPassword').value = rpcPassword;
  $('jwtSecret').value = jwtSecret;
  renderOrigins(approvedOrigins);
}

function renderOrigins(origins) {
  const table = $('origins');
  table.innerHTML = '';
  for (const o of origins) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = o;
    const td2 = document.createElement('td');
    const x = document.createElement('span');
    x.className = 'remove';
    x.textContent = '✕';
    x.title = 'Revoke access';
    x.addEventListener('click', async () => {
      const { approvedOrigins = [] } = await chrome.storage.local.get('approvedOrigins');
      await chrome.storage.local.set({ approvedOrigins: approvedOrigins.filter((v) => v !== o) });
      renderOrigins(approvedOrigins.filter((v) => v !== o));
    });
    td2.appendChild(x);
    tr.appendChild(td1);
    tr.appendChild(td2);
    table.appendChild(tr);
  }
  if (origins.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = 'No dApps approved yet.';
    td.style.color = '#b7bdd6';
    tr.appendChild(td);
    table.appendChild(tr);
  }
}

async function persist() {
  const rpcUrl = $('rpcUrl').value.trim() || 'http://127.0.0.1:19212/json_rpc';
  const jwtSecret = $('jwtSecret').value;
  await chrome.storage.local.set({
    rpcUrl,
    rpcLogin: $('rpcLogin').value.trim(),
    rpcPassword: $('rpcPassword').value,
    jwtSecret,
    ...(String(jwtSecret || '').trim()
      ? { jwtSecretRotateRequired: false }
      : {}),
  });
  return rpcUrl;
}

$('presetGui').addEventListener('click', () => {
  $('rpcUrl').value = 'http://127.0.0.1:19211/json_rpc';
  $('rpcLogin').value = '';
  $('rpcPassword').value = '';
});

$('presetSw').addEventListener('click', () => {
  $('rpcUrl').value = 'http://127.0.0.1:19212/json_rpc';
  $('jwtSecret').value = '';
});

$('save').addEventListener('click', async () => {
  const rpcUrl = await persist();
  const s = $('saved');
  s.classList.add('show');
  setTimeout(() => s.classList.remove('show'), 1500);
  $('testResult').style.color = '#3ee0a0';
  const mode = $('jwtSecret').value.trim() ? 'JWT (GUI)' : 'Basic/none';
  $('testResult').textContent = `Saved ${rpcUrl} · auth ${mode}`;
});

$('test').addEventListener('click', async () => {
  const rpcUrl = await persist();
  const out = $('testResult');
  out.style.color = '#b7bdd6';
  out.textContent = 'Testing ' + rpcUrl + ' …';
  try {
    const res = await chrome.runtime.sendMessage({
      pdcExtension: true,
      id: Date.now(),
      method: 'pdc.getWalletInfo',
    });
    if (res?.error) throw new Error(res.error.message);
    out.style.color = '#3ee0a0';
    out.textContent =
      'OK → ' + rpcUrl + ' · ' + (res.result?.address?.slice(0, 20) || '') + '…';
  } catch (e) {
    out.style.color = '#e21e80';
    out.textContent = (e?.message || String(e)) + ' (endpoint: ' + rpcUrl + ')';
  }
});

$('addOrigin').addEventListener('click', async () => {
  const value = $('newOrigin').value.trim().replace(/\/+$/, '');
  if (!validOrigin(value)) {
    $('newOrigin').style.borderColor = '#e21e80';
    setTimeout(() => ($('newOrigin').style.borderColor = ''), 1200);
    return;
  }
  const { approvedOrigins = [] } = await chrome.storage.local.get('approvedOrigins');
  if (!approvedOrigins.includes(value)) {
    approvedOrigins.push(value);
    await chrome.storage.local.set({ approvedOrigins });
  }
  $('newOrigin').value = '';
  renderOrigins(approvedOrigins);
});

void load();
