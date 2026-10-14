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

async function load() {
  const { rpcUrl = 'http://127.0.0.1:19212/json_rpc', rpcLogin = '', rpcPassword = '', approvedOrigins = [] } =
    await chrome.storage.local.get(['rpcUrl', 'rpcLogin', 'rpcPassword', 'approvedOrigins']);
  $('rpcUrl').value = rpcUrl;
  $('rpcLogin').value = rpcLogin;
  $('rpcPassword').value = rpcPassword;
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

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    rpcUrl: $('rpcUrl').value.trim() || 'http://127.0.0.1:19212/json_rpc',
    rpcLogin: $('rpcLogin').value.trim(),
    rpcPassword: $('rpcPassword').value,
  });
  const s = $('saved');
  s.classList.add('show');
  setTimeout(() => s.classList.remove('show'), 1500);
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
