const keys = {
  'probe-play-pause': 'MediaPlayPause', 'probe-next': 'MediaNextTrack',
  'probe-previous': 'MediaPrevTrack', 'probe-stop': 'MediaStop'
};
const seen = new Set();
let previous = null;
const rows = document.querySelector('#events');
function row(parent, values) {
  const tr = document.createElement('tr');
  for (const value of values) {
    const td = document.createElement('td'); td.textContent = value; tr.append(td);
  }
  parent.append(tr);
}
function record(entry) {
  if (seen.has(entry.id)) return;
  seen.add(entry.id);
  const gap = previous === null ? '—' : `${entry.receivedAt - previous} ms`;
  previous = entry.receivedAt;
  row(rows, [new Date(entry.receivedAt).toLocaleTimeString(undefined, { hour12: false }) + `.${String(entry.receivedAt % 1000).padStart(3, '0')}`, entry.command, gap]);
  while (rows.children.length > 100) rows.firstElementChild.remove();
  if (seen.size > 200) { const last = entry.id; seen.clear(); seen.add(last); }
  document.querySelector('#log-status').textContent = 'Command received. No media action was performed.';
}
async function refreshBindings() {
  try {
    const commands = await chrome.commands.getAll();
    const table = document.querySelector('#bindings'); table.replaceChildren();
    for (const [name, expected] of Object.entries(keys)) {
      const binding = commands.find(command => command.name === name)?.shortcut;
      row(table, [name, expected, binding || 'UNBOUND — intentionally empty or unavailable/conflicting']);
    }
    document.querySelector('#binding-status').textContent = 'Read from Chrome; no bindings changed.';
  } catch (error) { document.querySelector('#binding-status').textContent = `Could not read bindings: ${error.message}`; }
}
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'probe-event') record(message.entry);
});
chrome.runtime.sendMessage({ type: 'probe-snapshot' }).then(snapshot => {
  for (const entry of snapshot?.entries || []) record(entry);
}).catch(() => { document.querySelector('#log-status').textContent = 'Could not read worker history; live listener remains active.'; });
document.querySelector('#refresh').addEventListener('click', refreshBindings);
document.querySelector('#clear').addEventListener('click', async () => {
  try { await chrome.runtime.sendMessage({ type: 'probe-clear' }); }
  catch { /* The page log can still be cleared if the worker restarted. */ }
  rows.replaceChildren(); seen.clear(); previous = null;
  document.querySelector('#log-status').textContent = 'Local log cleared. Waiting for commands.';
});
refreshBindings();
