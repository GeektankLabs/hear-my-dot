const session = crypto.randomUUID();
let sequence = 0;
let recent = [];
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }).catch(console.error);
});
chrome.commands.onCommand.addListener(command => {
  if (!command.startsWith('probe-')) return;
  const entry = { id: `${session}:${++sequence}`, command, receivedAt: Date.now() };
  recent.push(entry);
  recent = recent.slice(-100);
  // Only diagnostic pages receive this; no content scripts are installed.
  chrome.runtime.sendMessage({ type: 'probe-event', entry }).catch(() => {});
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'probe-snapshot') respond({ session, entries: recent });
  if (message?.type === 'probe-clear') { recent = []; respond({ cleared: true }); }
});
