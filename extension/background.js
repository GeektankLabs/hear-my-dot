import { updateToolbar } from './toolbar.mjs';
import { initial, reconcile } from './core.mjs';
let queue = Promise.resolve();
let timer;
function schedule() {
  queue = queue.then(async () => {
    const { focusState = initial() } = await chrome.storage.session.get('focusState');
    const settings = await chrome.storage.local.get({ enabled: true, quietSeconds: 10 });
    const due = await reconcile(chrome, focusState, settings, Date.now());
    clearTimeout(timer);
    await chrome.alarms.clear('release');
    if (due !== null) {
      timer = setTimeout(schedule, Math.max(0, due - Date.now()));
      await chrome.alarms.create('release', { when: due });
    }
    // UI errors must not interrupt focus restoration or its timer.
    try { await updateToolbar(chrome.action, focusState, settings); }
    catch (error) { console.warn('Hear My Dot toolbar:', error); }
  }).catch(error => console.error('Hear My Dot:', error));
}
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (['audible', 'mutedInfo', 'url', 'discarded', 'frozen', 'status'].some(k => k in change)) schedule();
});
chrome.tabs.onCreated.addListener(schedule);
chrome.tabs.onRemoved.addListener(schedule);
chrome.tabs.onReplaced.addListener(schedule);
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'release') schedule(); });
chrome.storage.onChanged.addListener((_changes, area) => { if (area === 'local') schedule(); });
chrome.runtime.onStartup.addListener(schedule);
chrome.runtime.onInstalled.addListener(schedule);
schedule();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (['hear-my-dot-youtube-ready', 'hear-my-dot-podverse-ready'].includes(message?.type) && sender.id === chrome.runtime.id && sender.tab && sender.frameId === 0) schedule();
});

chrome.action.onClicked.addListener(() => { chrome.runtime.openOptionsPage().catch(console.error); });
