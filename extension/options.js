const enabled = document.querySelector('#enabled');
const quiet = document.querySelector('#quiet');
chrome.storage.local.get({ enabled: true, quietSeconds: 10 }).then(settings => {
  enabled.checked = settings.enabled; quiet.value = settings.quietSeconds;
});
document.querySelector('#save').addEventListener('click', async () => {
  if (!quiet.reportValidity()) return;
  await chrome.storage.local.set({ enabled: enabled.checked, quietSeconds: Number(quiet.value) });
  document.querySelector('#status').textContent = 'Gespeichert.';
});
